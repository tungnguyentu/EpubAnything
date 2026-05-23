import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from main import app

# Rich enough for trafilatura to extract 200+ words
RICH_HTML = """<html><body><article>
<h1>Sample Article</h1>
<p>Python is an interpreted language created by Guido van Rossum in 1991. It emphasizes
readability and simplicity, making it ideal for beginners and experts alike.</p>
<p>The language is dynamically typed and supports multiple programming paradigms. Its extensive
standard library and third-party ecosystem make it useful for web development, data science,
automation, and more. Community support is one of Python's greatest strengths globally.</p>
<p>Python's syntax allows programmers to express concepts in fewer lines than C++ or Java.
PEPs guide the language's evolution, ensuring backward compatibility while allowing innovation.
Version 3 introduced better Unicode support and cleaner syntax than version 2, which
reached end of life in 2020 after completing the long transition from Python 2 to Python 3.</p>
<p>The Python Package Index hosts hundreds of thousands of third-party modules that extend
the language's capabilities far beyond its standard library for all use cases imaginable.</p>
</article></body></html>"""


@pytest.fixture
def mock_pipeline():
    with (
        patch("main.scrape_url", new_callable=AsyncMock, return_value=RICH_HTML),
        patch(
            "main.upload_epub",
            return_value=("https://r2.example.com/file.epub", "2026-05-23T00:00:00Z"),
        ),
    ):
        yield


async def test_convert_success(mock_pipeline):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/convert", json={"url": "https://example.com"})
    assert response.status_code == 200
    body = response.json()
    assert body["downloadUrl"] == "https://r2.example.com/file.epub"
    assert body["expiresAt"] == "2026-05-23T00:00:00Z"
    assert isinstance(body["warning"], bool)


async def test_convert_invalid_url():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/convert", json={"url": "not-a-url"})
    assert response.status_code == 422


async def test_convert_scrape_failure():
    with patch("main.scrape_url", new_callable=AsyncMock, side_effect=Exception("Timeout")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert", json={"url": "https://example.com"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Could not load page"


async def test_convert_no_content():
    # Empty body → extractor returns None → 400
    with patch("main.scrape_url", new_callable=AsyncMock, return_value="<html><body></body></html>"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert", json={"url": "https://example.com"})
    assert response.status_code == 400
    assert response.json()["detail"] == "No readable content found"


async def test_convert_storage_failure(mock_pipeline):
    with patch("main.upload_epub", side_effect=Exception("S3 error")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert", json={"url": "https://example.com"})
    assert response.status_code == 500
    assert response.json()["detail"] == "Storage error, please try again"


SITE_HTML = """<html>
<head><title>Learn Engineering</title></head>
<body>
<nav>
  <a href="/vi/lesson-1">Lesson 1</a>
  <a href="/vi/lesson-2">Lesson 2</a>
  <a href="/vi/lesson-3">Lesson 3</a>
</nav>
<p>Welcome.</p>
</body></html>"""

PAGE_HTML = """<html><body><article>
<h1>Lesson</h1>
<p>Python is an interpreted language created by Guido van Rossum in 1991. It emphasizes
readability and simplicity, making it ideal for beginners and experts alike.</p>
<p>The language is dynamically typed and supports multiple programming paradigms. Its extensive
standard library and third-party ecosystem make it useful for web development, data science,
automation, and more. Community support is one of Python's greatest strengths globally.</p>
</article></body></html>"""


async def test_convert_returns_site_when_toc_detected():
    with patch("main.scrape_url", new_callable=AsyncMock, return_value=SITE_HTML):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert", json={"url": "https://example.com/vi/"})
    assert response.status_code == 200
    body = response.json()
    assert "site" in body
    assert body["site"]["siteTitle"] == "Learn Engineering"
    assert len(body["site"]["pages"]) == 3


import json as _json


def _parse_sse(text: str) -> list[dict]:
    events = []
    for line in text.splitlines():
        if line.startswith("data: "):
            events.append(_json.loads(line[6:]))
    return events


AUTHED_USER = {"id": 1, "email": "test@example.com", "name": "Test", "credits": 5}


async def test_convert_site_success():
    with (
        patch("main.scrape_url", new_callable=AsyncMock, return_value=PAGE_HTML),
        patch(
            "main.upload_epub",
            return_value=("https://r2.example.com/site.epub", "2026-05-23T00:00:00Z"),
        ),
        patch("main.get_current_user", return_value=AUTHED_USER),
        patch("main.deduct_credit", return_value=True),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert-site", json={
                "siteTitle": "My Course",
                "pages": [
                    {"url": "https://example.com/vi/lesson-1", "title": "Lesson 1"},
                    {"url": "https://example.com/vi/lesson-2", "title": "Lesson 2"},
                ],
            })
    assert response.status_code == 200
    events = _parse_sse(response.text)
    done = next(e for e in events if e["type"] == "done")
    assert done["downloadUrl"] == "https://r2.example.com/site.epub"
    assert done["expiresAt"] == "2026-05-23T00:00:00Z"


async def test_convert_site_streams_progress():
    with (
        patch("main.scrape_url", new_callable=AsyncMock, return_value=PAGE_HTML),
        patch(
            "main.upload_epub",
            return_value=("https://r2.example.com/site.epub", "2026-05-23T00:00:00Z"),
        ),
        patch("main.get_current_user", return_value=AUTHED_USER),
        patch("main.deduct_credit", return_value=True),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert-site", json={
                "siteTitle": "My Course",
                "pages": [
                    {"url": "https://example.com/vi/lesson-1", "title": "Lesson 1"},
                    {"url": "https://example.com/vi/lesson-2", "title": "Lesson 2"},
                ],
            })
    events = _parse_sse(response.text)
    progress_events = [e for e in events if e["type"] == "progress"]
    assert len(progress_events) == 2
    assert progress_events[0]["current"] == 1
    assert progress_events[0]["total"] == 2
    assert progress_events[0]["pageTitle"] == "Lesson 1"
    types = [e["type"] for e in events]
    assert types.index("progress") < types.index("done")


async def test_convert_site_all_pages_fail():
    with (
        patch("main.scrape_url", new_callable=AsyncMock, side_effect=Exception("Timeout")),
        patch("main.get_current_user", return_value=AUTHED_USER),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert-site", json={
                "siteTitle": "My Course",
                "pages": [
                    {"url": "https://example.com/vi/lesson-1", "title": "Lesson 1"},
                ],
            })
    assert response.status_code == 200
    events = _parse_sse(response.text)
    error = next(e for e in events if e["type"] == "error")
    assert error["detail"] == "No readable content found"


async def test_convert_site_requires_auth():
    with patch("main.get_current_user", return_value=None):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert-site", json={
                "siteTitle": "My Course",
                "pages": [{"url": "https://example.com/vi/lesson-1", "title": "Lesson 1"}],
            })
    assert response.status_code == 401
    assert response.json()["detail"] == "Sign in to convert course sites"


async def test_convert_site_requires_credits():
    with patch("main.get_current_user", return_value={**AUTHED_USER, "credits": 0}):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert-site", json={
                "siteTitle": "My Course",
                "pages": [{"url": "https://example.com/vi/lesson-1", "title": "Lesson 1"}],
            })
    assert response.status_code == 402
    assert response.json()["detail"] == "No credits remaining"

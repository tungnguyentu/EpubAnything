from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from main import app

_FAKE_PDF = b"%PDF-1.4 fake"
_UPLOAD_RESULT = ("https://r2.example.com/file.epub", "2026-05-25T00:00:00Z")


async def test_convert_pdf_success():
    with (
        patch("main.extract_pdf", return_value={"title": "My PDF", "html": "<p>Content</p>"}),
        patch("main.upload_epub", return_value=_UPLOAD_RESULT),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/convert-pdf",
                files={"file": ("doc.pdf", _FAKE_PDF, "application/pdf")},
            )
    assert response.status_code == 200
    body = response.json()
    assert body["downloadUrl"] == "https://r2.example.com/file.epub"
    assert body["expiresAt"] == "2026-05-25T00:00:00Z"
    assert body["warning"] is False


async def test_convert_pdf_no_text():
    with patch("main.extract_pdf", return_value=None):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/convert-pdf",
                files={"file": ("doc.pdf", _FAKE_PDF, "application/pdf")},
            )
    assert response.status_code == 400
    assert response.json()["detail"] == "No readable text found in PDF"


async def test_convert_pdf_wrong_type():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/convert-pdf",
            files={"file": ("doc.txt", b"hello", "text/plain")},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == "File must be a PDF"


async def test_convert_pdf_too_large():
    big = b"x" * (51 * 1024 * 1024)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/convert-pdf",
            files={"file": ("doc.pdf", big, "application/pdf")},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == "File too large (max 50 MB)"


async def test_convert_pdf_storage_failure():
    with (
        patch("main.extract_pdf", return_value={"title": "My PDF", "html": "<p>Content</p>"}),
        patch("main.upload_epub", side_effect=Exception("S3 error")),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/convert-pdf",
                files={"file": ("doc.pdf", _FAKE_PDF, "application/pdf")},
            )
    assert response.status_code == 500
    assert response.json()["detail"] == "Storage error, please try again"


async def test_convert_pdf_wrong_mime_with_pdf_extension():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/convert-pdf",
            files={"file": ("doc.pdf", b"<html>not a pdf</html>", "text/html")},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == "File must be a PDF"

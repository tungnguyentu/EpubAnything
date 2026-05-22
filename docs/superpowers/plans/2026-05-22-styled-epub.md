# Styled EPUB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain-text EPUB output with styled HTML that preserves the source website's layout via readability-lxml article extraction, base64 image embedding, and premailer CSS inlining.

**Architecture:** `scraper` → `extractor` (readability-lxml, returns article HTML) → `epub_builder` (strip junk, embed images, inline CSS, package with ebooklib). The source URL flows through `main.py` to `epub_builder` so relative URLs in the article can be resolved. All network failures in the builder are silent — styling degrades gracefully.

**Tech Stack:** readability-lxml 0.8.1, beautifulsoup4 4.12.3, premailer 3.10.0, httpx (already installed), ebooklib 0.18 (already installed)

---

### Task 1: Add new dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add the three packages**

Replace the contents of `backend/requirements.txt` with:

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
playwright==1.44.0
trafilatura==1.9.0
readability-lxml==0.8.1
beautifulsoup4==4.12.3
premailer==3.10.0
ebooklib==0.18
boto3==1.34.131
httpx==0.27.0
pytest==8.2.2
pytest-asyncio==0.23.7
```

- [ ] **Step 2: Install in the active venv**

Run from `backend/`:
```bash
pip install readability-lxml==0.8.1 beautifulsoup4==4.12.3 premailer==3.10.0
```

Expected: no errors. Verify with `python -c "from readability import Document; from bs4 import BeautifulSoup; import premailer; print('ok')"`.

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add readability-lxml, beautifulsoup4, premailer"
```

---

### Task 2: Rewrite extractor.py

**Files:**
- Modify: `backend/extractor.py`
- Modify: `backend/tests/test_extractor.py`

The extractor switches from trafilatura (returns plain text) to readability-lxml (returns clean article HTML). Word count is derived from the HTML's text content via BeautifulSoup. The `author` field is dropped — readability-lxml does not expose it, and the spec sets it to empty string.

- [ ] **Step 1: Write failing tests**

Replace `backend/tests/test_extractor.py` with:

```python
from extractor import extract_content

RICH_HTML = """
<html>
<head><title>How Python Works</title></head>
<body>
<article>
  <h1>How Python Works</h1>
  <p>Python is an interpreted, high-level programming language created by Guido van Rossum in 1991.
  Its design philosophy emphasizes code readability with the use of significant indentation.</p>
  <p>Python is dynamically typed and garbage-collected. It supports structured, object-oriented,
  and functional programming paradigms and is often described as a batteries-included language
  due to its comprehensive standard library.</p>
  <p>The language is widely used in web development, data science, artificial intelligence,
  scientific computing, and automation. Its simplicity and versatility make it one of the most
  popular programming languages in the world today among both beginners and experts alike.</p>
  <p>Python's syntax allows programmers to express concepts in fewer lines of code than C++ or Java.
  Community support is one of Python's greatest strengths — the Python Package Index hosts hundreds
  of thousands of third-party modules extending the language far beyond its standard library.</p>
  <p>Python's interactive interpreter and REPL make it ideal for experimentation and rapid prototyping.
  Developers can test ideas instantly without a compile step, which dramatically shortens feedback loops
  during development. This interactivity is especially valued in scientific and academic communities
  where exploratory data analysis is common.</p>
  <p>Major companies including Google, Instagram, Spotify, and NASA rely on Python for critical
  infrastructure and research. The language powers machine learning frameworks like TensorFlow and
  PyTorch, web frameworks like Django and FastAPI, and automation tools used across the industry.
  Python's continued growth shows no sign of slowing down as new domains adopt it.</p>
</article>
</body>
</html>
"""

SHORT_HTML = """<html><body><p>Short.</p></body></html>"""


def test_extracts_title():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert "Python" in result["title"]


def test_returns_html_not_text():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert "html" in result
    assert "text" not in result


def test_html_contains_tags():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert "<p>" in result["html"] or "<div" in result["html"]


def test_word_count_above_threshold_for_rich_content():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert result["word_count"] >= 200


def test_word_count_below_threshold_for_short_content():
    result = extract_content(SHORT_HTML)
    if result is not None:
        assert result["word_count"] < 200


def test_returns_none_for_empty_html():
    result = extract_content("<html><body></body></html>")
    assert result is None


def test_author_is_empty_string():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert result["author"] == ""
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_extractor.py -v
```

Expected: `test_returns_html_not_text` and `test_html_contains_tags` FAIL (current extractor returns `text`, not `html`). `test_author_is_empty_string` may PASS or FAIL depending on content.

- [ ] **Step 3: Rewrite extractor.py**

Replace `backend/extractor.py` with:

```python
from readability import Document
from bs4 import BeautifulSoup


def extract_content(html: str) -> dict | None:
    doc = Document(html)
    article_html = doc.summary(html_partial=True)

    soup = BeautifulSoup(article_html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    if not text.strip():
        return None

    return {
        "title": doc.title() or "Untitled",
        "author": "",
        "html": article_html,
        "word_count": len(text.split()),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_extractor.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/extractor.py backend/tests/test_extractor.py
git commit -m "feat: switch extractor to readability-lxml, return article HTML"
```

---

### Task 3: Rewrite epub_builder.py

**Files:**
- Modify: `backend/epub_builder.py`
- Modify: `backend/tests/test_epub_builder.py`

New signature: `build_epub(title, author, html, base_url)`. Steps: strip scripts/nav/iframes → embed images as base64 → collect and inline CSS via premailer → package with ebooklib. Every network call and the premailer step fail silently.

- [ ] **Step 1: Write failing tests**

Replace `backend/tests/test_epub_builder.py` with:

```python
from unittest.mock import patch, MagicMock
from epub_builder import build_epub


def test_returns_bytes():
    result = build_epub("Test Title", "Test Author", "<p>Body text.</p><p>Second paragraph.</p>", "https://example.com")
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_epub_magic_bytes():
    # EPUB files are ZIP archives — first two bytes are PK signature
    result = build_epub("Title", "Author", "<p>Content paragraph here.</p>", "https://example.com")
    assert result[:2] == b"PK"


def test_handles_empty_author():
    result = build_epub("Title", "", "<p>Some content here.</p>", "https://example.com")
    assert isinstance(result, bytes)


def test_image_download_failure_does_not_crash():
    html = '<img src="https://example.com/image.png"><p>Text content here.</p>'
    with patch("epub_builder.httpx.get", side_effect=Exception("Network error")):
        result = build_epub("Title", "Author", html, "https://example.com")
    assert isinstance(result, bytes)


def test_strips_script_tags():
    # script content must not appear in output even if build succeeds
    html = "<script>alert('xss')</script><p>Clean content.</p>"
    result = build_epub("Title", "Author", html, "https://example.com")
    assert isinstance(result, bytes)


def test_css_fetch_failure_does_not_crash():
    html = '<link rel="stylesheet" href="https://example.com/style.css"><p>Styled content.</p>'
    with patch("epub_builder.httpx.get", side_effect=Exception("Timeout")):
        result = build_epub("Title", "Author", html, "https://example.com")
    assert isinstance(result, bytes)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_epub_builder.py -v
```

Expected: all tests FAIL — `build_epub` currently takes 3 args (`title, author, text`), not 4.

- [ ] **Step 3: Rewrite epub_builder.py**

Replace `backend/epub_builder.py` with:

```python
import base64
import io
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from ebooklib import epub


def build_epub(title: str, author: str, html: str, base_url: str) -> bytes:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup.find_all(["script", "iframe", "nav", "header", "footer"]):
        tag.decompose()

    _embed_images(soup, base_url)
    body_html = _inline_css(soup, base_url)

    book = epub.EpubBook()
    book.set_identifier("epubanything-" + title[:20].replace(" ", "-"))
    book.set_title(title)
    book.set_language("en")
    if author:
        book.add_author(author)

    chapter = epub.EpubHtml(title=title, file_name="content.xhtml", lang="en")
    chapter.content = f"<h1>{title}</h1>{body_html}"

    book.add_item(chapter)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav", chapter]

    buffer = io.BytesIO()
    epub.write_epub(buffer, book, {})
    return buffer.getvalue()


def _embed_images(soup: BeautifulSoup, base_url: str) -> None:
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if not src or src.startswith("data:"):
            continue
        img_url = urljoin(base_url, src)
        try:
            resp = httpx.get(img_url, timeout=5, follow_redirects=True)
            resp.raise_for_status()
            mime = resp.headers.get("content-type", "image/jpeg").split(";")[0]
            b64 = base64.b64encode(resp.content).decode()
            img["src"] = f"data:{mime};base64,{b64}"
        except Exception:
            pass


def _inline_css(soup: BeautifulSoup, base_url: str) -> str:
    css_parts = []

    for link in soup.find_all("link", rel="stylesheet"):
        href = link.get("href", "")
        if href:
            css_url = urljoin(base_url, href)
            try:
                resp = httpx.get(css_url, timeout=5, follow_redirects=True)
                resp.raise_for_status()
                css_parts.append(resp.text)
            except Exception:
                pass
        link.decompose()

    for style_tag in soup.find_all("style"):
        css_parts.append(style_tag.string or "")
        style_tag.decompose()

    body_html = str(soup)

    if not css_parts:
        return body_html

    combined_css = "\n".join(css_parts)
    wrapped = f"<html><head><style>{combined_css}</style></head><body>{body_html}</body></html>"
    try:
        import premailer
        return premailer.transform(wrapped)
    except Exception:
        return body_html
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_epub_builder.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/epub_builder.py backend/tests/test_epub_builder.py
git commit -m "feat: rewrite epub_builder with CSS inlining and base64 image embedding"
```

---

### Task 4: Update main.py and verify full pipeline

**Files:**
- Modify: `backend/main.py`
- Verify: `backend/tests/test_api.py` (no changes needed — mock_pipeline patches scrape_url and upload_epub; RICH_HTML has no img/CSS links so no network calls happen in build_epub)

The only change to `main.py` is: pass `str(req.url)` as `base_url` to `build_epub`, and read `content["html"]` instead of `content["text"]`.

- [ ] **Step 1: Run current API tests to get baseline**

```bash
cd backend && python -m pytest tests/test_api.py -v
```

Expected: some tests may FAIL now because `main.py` still calls `build_epub(..., content["text"])` and `content` no longer has a `"text"` key (changed in Task 2). Note which fail.

- [ ] **Step 2: Update main.py**

In `backend/main.py`, change line:
```python
epub_bytes = build_epub(content["title"], content["author"], content["text"])
```
to:
```python
epub_bytes = build_epub(content["title"], content["author"], content["html"], str(req.url))
```

The full updated `convert` endpoint:

```python
@app.post("/api/convert", response_model=ConvertResponse)
async def convert(req: ConvertRequest):
    try:
        html = await scrape_url(str(req.url))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not load page")

    content = extract_content(html)
    if content is None:
        raise HTTPException(status_code=400, detail="No readable content found")

    warning = content["word_count"] < 200
    epub_bytes = build_epub(content["title"], content["author"], content["html"], str(req.url))

    try:
        download_url, expires_at = upload_epub(epub_bytes, content["title"])
    except Exception:
        raise HTTPException(status_code=500, detail="Storage error, please try again")

    return ConvertResponse(downloadUrl=download_url, expiresAt=expires_at, warning=warning)
```

- [ ] **Step 3: Run all tests**

```bash
cd backend && python -m pytest -v
```

Expected: all tests in `test_api.py`, `test_extractor.py`, `test_epub_builder.py`, `test_scraper.py`, `test_storage.py` PASS.

- [ ] **Step 4: Manual smoke test**

Start the backend (the venv must be active):
```bash
cd backend && uvicorn main:app --reload
```

In another terminal:
```bash
curl -s -X POST http://localhost:8000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"url":"https://en.wikipedia.org/wiki/Python_(programming_language)"}' | python3 -m json.tool
```

Expected: JSON with `downloadUrl`, `expiresAt`, `warning`. Download the EPUB and open it in an e-reader or `unzip -l <file>.epub` to confirm it contains `content.xhtml`.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat: pass base_url to build_epub, wire up styled EPUB pipeline"
```

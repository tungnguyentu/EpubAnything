# Multi-Page Course EPUB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect course/documentation sites from a single URL and convert all linked pages into one multi-chapter EPUB.

**Architecture:** Two-phase REST — Phase 1 (`/api/convert`) detects TOC links and returns a confirmation payload; Phase 2 (`/api/convert-site`) crawls confirmed pages and builds a multi-chapter EPUB. Frontend adds a `site-detected` state that shows a `SiteConfirmCard` between phases.

**Tech Stack:** Python 3.11 · FastAPI · BeautifulSoup4 · ebooklib · Playwright · Next.js 16 · TypeScript · Tailwind CSS (CSS vars)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/site_detector.py` | Create | `detect_site_pages` + `extract_site_title` |
| `backend/epub_builder.py` | Modify | Add `build_site_epub` |
| `backend/main.py` | Modify | New Pydantic models, update `/api/convert`, add `/api/convert-site` |
| `backend/tests/test_site_detector.py` | Create | TDD for site detector |
| `backend/tests/test_epub_builder.py` | Modify | Add `build_site_epub` tests |
| `backend/tests/test_api.py` | Modify | Tests for updated `/api/convert` + new `/api/convert-site` |
| `frontend/components/site-confirm-card.tsx` | Create | Confirmation UI card |
| `frontend/components/url-form.tsx` | Modify | New states + site-converting flow |
| `frontend/app/globals.css` | Modify | CSS for SiteConfirmCard |

---

## Task 1: `site_detector.py`

**Files:**
- Create: `backend/site_detector.py`
- Create: `backend/tests/test_site_detector.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_site_detector.py`:

```python
import pytest
from site_detector import detect_site_pages, extract_site_title

BASE = "https://example.com/docs/"

NAV_HTML = """<html>
<head><title>My Course</title></head>
<body>
<nav>
  <a href="/docs/lesson-1">Lesson 1</a>
  <a href="/docs/lesson-2">Lesson 2</a>
  <a href="/docs/lesson-3">Lesson 3</a>
</nav>
<p>Welcome to the course.</p>
</body></html>"""

ASIDE_HTML = """<html><body>
<aside>
  <a href="/docs/ch-1">Chapter 1</a>
  <a href="/docs/ch-2">Chapter 2</a>
  <a href="/docs/ch-3">Chapter 3</a>
  <a href="/docs/ch-4">Chapter 4</a>
</aside>
</body></html>"""

ROLE_NAV_HTML = """<html><body>
<div role="navigation">
  <a href="/docs/a">Page A</a>
  <a href="/docs/b">Page B</a>
  <a href="/docs/c">Page C</a>
</div>
</body></html>"""

EXTERNAL_LINKS_HTML = """<html><body>
<nav>
  <a href="https://other.com/page1">External 1</a>
  <a href="https://other.com/page2">External 2</a>
  <a href="https://other.com/page3">External 3</a>
</nav>
</body></html>"""

FRAGMENT_ONLY_HTML = """<html><body>
<nav>
  <a href="#section1">Section 1</a>
  <a href="#section2">Section 2</a>
  <a href="#section3">Section 3</a>
</nav>
</body></html>"""

TOO_FEW_HTML = """<html><body>
<nav>
  <a href="/docs/lesson-1">Lesson 1</a>
  <a href="/docs/lesson-2">Lesson 2</a>
</nav>
</body></html>"""

DUPLICATE_HTML = """<html><body>
<nav>
  <a href="/docs/lesson-1">Lesson 1</a>
  <a href="/docs/lesson-1">Lesson 1 again</a>
  <a href="/docs/lesson-2">Lesson 2</a>
  <a href="/docs/lesson-3">Lesson 3</a>
</nav>
</body></html>"""


def test_detects_nav_links():
    result = detect_site_pages(NAV_HTML, BASE)
    assert result is not None
    assert len(result) == 3
    assert result[0]["title"] == "Lesson 1"
    assert result[0]["url"].endswith("/docs/lesson-1")


def test_detects_aside_links():
    result = detect_site_pages(ASIDE_HTML, BASE)
    assert result is not None
    assert len(result) == 4


def test_detects_role_navigation():
    result = detect_site_pages(ROLE_NAV_HTML, BASE)
    assert result is not None
    assert len(result) == 3


def test_ignores_external_links():
    result = detect_site_pages(EXTERNAL_LINKS_HTML, BASE)
    assert result is None


def test_ignores_fragment_only_links():
    result = detect_site_pages(FRAGMENT_ONLY_HTML, BASE)
    assert result is None


def test_returns_none_when_fewer_than_3_links():
    result = detect_site_pages(TOO_FEW_HTML, BASE)
    assert result is None


def test_deduplicates_urls():
    result = detect_site_pages(DUPLICATE_HTML, BASE)
    assert result is not None
    urls = [p["url"] for p in result]
    assert len(urls) == len(set(urls))
    assert len(result) == 3


def test_skips_base_url_itself():
    html = """<html><body><nav>
      <a href="/docs/">Home</a>
      <a href="/docs/lesson-1">Lesson 1</a>
      <a href="/docs/lesson-2">Lesson 2</a>
      <a href="/docs/lesson-3">Lesson 3</a>
    </nav></body></html>"""
    result = detect_site_pages(html, BASE)
    assert result is not None
    urls = [p["url"] for p in result]
    assert not any(u.rstrip("/") == BASE.rstrip("/") for u in urls)


def test_extract_site_title_from_title_tag():
    html = "<html><head><title>My Course</title></head><body><h1>Other</h1></body></html>"
    assert extract_site_title(html, BASE) == "My Course"


def test_extract_site_title_falls_back_to_h1():
    html = "<html><head></head><body><h1>Course Title</h1></body></html>"
    assert extract_site_title(html, BASE) == "Course Title"


def test_extract_site_title_falls_back_to_hostname():
    html = "<html><head></head><body></body></html>"
    assert extract_site_title(html, "https://example.com/docs/") == "example.com"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && .venv/bin/python -m pytest tests/test_site_detector.py -v
```

Expected: `ModuleNotFoundError: No module named 'site_detector'`

- [ ] **Step 3: Implement `backend/site_detector.py`**

```python
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup


def detect_site_pages(html: str, base_url: str) -> list[dict] | None:
    soup = BeautifulSoup(html, "html.parser")
    base_domain = urlparse(base_url).netloc
    base_normalized = base_url.rstrip("/")

    containers = (
        soup.find_all("nav")
        + soup.find_all("aside")
        + soup.find_all(attrs={"role": "navigation"})
    )

    seen: set[str] = set()
    pages: list[dict] = []

    for container in containers:
        for a in container.find_all("a", href=True):
            href = a["href"].strip()
            if not href or href.startswith("#"):
                continue

            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)

            if parsed.netloc != base_domain:
                continue

            # Strip fragment so #section links to same page are excluded
            clean_url = parsed._replace(fragment="").geturl()

            if clean_url.rstrip("/") == base_normalized:
                continue

            if clean_url in seen:
                continue

            seen.add(clean_url)
            title = a.get_text(strip=True) or parsed.path.rstrip("/").split("/")[-1]
            pages.append({"url": clean_url, "title": title})

    return pages if len(pages) >= 3 else None


def extract_site_title(html: str, base_url: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.find("title")
    h1_tag = soup.find("h1")
    return (
        (title_tag.get_text(strip=True) if title_tag else None)
        or (h1_tag.get_text(strip=True) if h1_tag else None)
        or urlparse(base_url).hostname
        or "Untitled"
    )
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd backend && .venv/bin/python -m pytest tests/test_site_detector.py -v
```

Expected: all 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/site_detector.py backend/tests/test_site_detector.py
git commit -m "feat: add site_detector with TOC link detection"
```

---

## Task 2: `build_site_epub`

**Files:**
- Modify: `backend/epub_builder.py`
- Modify: `backend/tests/test_epub_builder.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_epub_builder.py`:

```python
from epub_builder import build_epub, build_site_epub


def test_build_site_epub_returns_bytes():
    chapters = [
        {"title": "Chapter 1", "html": "<p>First chapter content here.</p>", "base_url": "https://example.com/ch1"},
        {"title": "Chapter 2", "html": "<p>Second chapter content here.</p>", "base_url": "https://example.com/ch2"},
    ]
    result = build_site_epub("My Course", chapters)
    assert isinstance(result, bytes)
    assert result[:2] == b"PK"


def test_build_site_epub_multiple_chapters():
    chapters = [
        {"title": f"Chapter {i}", "html": f"<p>Content for chapter {i}.</p>", "base_url": "https://example.com"}
        for i in range(1, 6)
    ]
    result = build_site_epub("Five Chapter Course", chapters)
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_build_site_epub_image_failure_does_not_crash():
    from unittest.mock import patch
    chapters = [
        {"title": "Ch 1", "html": '<img src="https://example.com/img.png"><p>Text.</p>', "base_url": "https://example.com"},
    ]
    with patch("epub_builder.httpx.get", side_effect=Exception("Network error")):
        result = build_site_epub("Course", chapters)
    assert isinstance(result, bytes)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && .venv/bin/python -m pytest tests/test_epub_builder.py::test_build_site_epub_returns_bytes -v
```

Expected: `ImportError: cannot import name 'build_site_epub'`

- [ ] **Step 3: Add `build_site_epub` to `backend/epub_builder.py`**

Append after the existing `_inline_css` function:

```python
def build_site_epub(site_title: str, chapters: list[dict]) -> bytes:
    book = epub.EpubBook()
    book.set_identifier("epubanything-site-" + site_title[:20].replace(" ", "-"))
    book.set_title(site_title)
    book.set_language("en")

    epub_chapters = []
    for i, ch in enumerate(chapters):
        soup = BeautifulSoup(ch["html"], "html.parser")
        for tag in soup.find_all(["script", "iframe", "nav", "header", "footer"]):
            tag.decompose()
        _embed_images(soup, ch["base_url"])
        body_html = _inline_css(soup, ch["base_url"])

        epub_ch = epub.EpubHtml(
            title=ch["title"],
            file_name=f"chapter_{i + 1:03d}.xhtml",
            lang="en",
        )
        epub_ch.content = f"<h1>{ch['title']}</h1>{body_html}"
        book.add_item(epub_ch)
        epub_chapters.append(epub_ch)

    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav"] + epub_chapters
    book.toc = tuple(epub_chapters)

    buffer = io.BytesIO()
    epub.write_epub(buffer, book, {})
    return buffer.getvalue()
```

Also update the import line at the top of `test_epub_builder.py` to include `build_site_epub`:

```python
from epub_builder import build_epub, build_site_epub
```

- [ ] **Step 4: Run all epub_builder tests**

```bash
cd backend && .venv/bin/python -m pytest tests/test_epub_builder.py -v
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/epub_builder.py backend/tests/test_epub_builder.py
git commit -m "feat: add build_site_epub for multi-chapter EPUB generation"
```

---

## Task 3: Backend API Updates

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Add failing API tests**

Append to `backend/tests/test_api.py`:

```python
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


async def test_convert_site_success():
    with (
        patch("main.scrape_url", new_callable=AsyncMock, return_value=PAGE_HTML),
        patch(
            "main.upload_epub",
            return_value=("https://r2.example.com/site.epub", "2026-05-23T00:00:00Z"),
        ),
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
    body = response.json()
    assert body["downloadUrl"] == "https://r2.example.com/site.epub"
    assert body["expiresAt"] == "2026-05-23T00:00:00Z"


async def test_convert_site_all_pages_fail():
    with patch("main.scrape_url", new_callable=AsyncMock, side_effect=Exception("Timeout")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/convert-site", json={
                "siteTitle": "My Course",
                "pages": [
                    {"url": "https://example.com/vi/lesson-1", "title": "Lesson 1"},
                ],
            })
    assert response.status_code == 400
    assert response.json()["detail"] == "No readable content found"
```

- [ ] **Step 2: Run new tests — expect failures**

```bash
cd backend && .venv/bin/python -m pytest tests/test_api.py::test_convert_returns_site_when_toc_detected tests/test_api.py::test_convert_site_success tests/test_api.py::test_convert_site_all_pages_fail -v
```

Expected: all 3 FAIL (endpoints not updated yet)

- [ ] **Step 3: Rewrite `backend/main.py`**

```python
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl

from storage import LOCAL_STORAGE_DIR
from scraper import scrape_url
from extractor import extract_content
from epub_builder import build_epub, build_site_epub
from storage import upload_epub
from site_detector import detect_site_pages, extract_site_title

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


class ConvertRequest(BaseModel):
    url: HttpUrl


class ConvertResponse(BaseModel):
    downloadUrl: str
    expiresAt: str
    warning: bool


class SitePageInfo(BaseModel):
    url: str
    title: str


class SiteInfo(BaseModel):
    siteTitle: str
    pages: list[SitePageInfo]


class SiteDetectedResponse(BaseModel):
    site: SiteInfo


class ConvertSiteRequest(BaseModel):
    pages: list[SitePageInfo]
    siteTitle: str


class ConvertSiteResponse(BaseModel):
    downloadUrl: str
    expiresAt: str


@app.post("/api/convert")
async def convert(req: ConvertRequest) -> ConvertResponse | SiteDetectedResponse:
    try:
        html = await scrape_url(str(req.url))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not load page")

    pages = detect_site_pages(html, str(req.url))
    if pages is not None:
        site_title = extract_site_title(html, str(req.url))
        return SiteDetectedResponse(
            site=SiteInfo(
                siteTitle=site_title,
                pages=[SitePageInfo(url=p["url"], title=p["title"]) for p in pages],
            )
        )

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


@app.post("/api/convert-site", response_model=ConvertSiteResponse)
async def convert_site(req: ConvertSiteRequest):
    chapters = []
    for page in req.pages:
        try:
            html = await scrape_url(page.url)
            content = extract_content(html)
            if content is None:
                continue
            chapters.append({"title": page.title, "html": content["html"], "base_url": page.url})
        except Exception:
            continue

    if not chapters:
        raise HTTPException(status_code=400, detail="No readable content found")

    epub_bytes = build_site_epub(req.siteTitle, chapters)

    try:
        download_url, expires_at = upload_epub(epub_bytes, req.siteTitle)
    except Exception:
        raise HTTPException(status_code=500, detail="Storage error, please try again")

    return ConvertSiteResponse(downloadUrl=download_url, expiresAt=expires_at)


@app.get("/api/files/{filename}")
async def serve_file(filename: str):
    safe = Path(filename).name
    path = LOCAL_STORAGE_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")
    return FileResponse(path, media_type="application/epub+zip", filename=safe)
```

- [ ] **Step 4: Run full test suite**

```bash
cd backend && .venv/bin/python -m pytest tests/test_api.py -v
```

Expected: all 8 tests PASS (5 existing + 3 new)

- [ ] **Step 5: Run complete backend test suite**

```bash
cd backend && .venv/bin/python -m pytest -v
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat: add site detection to /api/convert and new /api/convert-site endpoint"
```

---

## Task 4: Frontend

**Files:**
- Create: `frontend/components/site-confirm-card.tsx`
- Modify: `frontend/components/url-form.tsx`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Create `frontend/components/site-confirm-card.tsx`**

```tsx
type SitePage = { url: string; title: string }

type Props = {
  siteTitle: string
  pages: SitePage[]
  onConfirm: () => void
  onCancel: () => void
}

export function SiteConfirmCard({ siteTitle, pages, onConfirm, onCancel }: Props) {
  const estimatedMinutes = Math.ceil(pages.length / 4)

  return (
    <div className="result-card">
      <div className="result-card-accent" />
      <div className="result-card-body">
        <p className="site-confirm-title">{siteTitle}</p>
        <p className="site-confirm-count">Found {pages.length} pages</p>

        {pages.length > 20 && (
          <div className="warning-banner">
            ⚠ This may take a while (~{estimatedMinutes} minutes)
          </div>
        )}

        <ol className="site-page-list">
          {pages.map((p) => (
            <li key={p.url}>{p.title || p.url}</li>
          ))}
        </ol>

        <div className="site-confirm-actions">
          <button onClick={onConfirm} className="download-btn">
            Convert All
          </button>
          <button onClick={onCancel} className="site-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `frontend/components/url-form.tsx`**

```tsx
"use client"

import { useRef, useState } from "react"
import { ResultCard } from "./result-card"
import { SiteConfirmCard } from "./site-confirm-card"

type ConvertResult = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

type SitePage = { url: string; title: string }
type SiteInfo = { siteTitle: string; pages: SitePage[] }

type State =
  | { status: "idle" }
  | { status: "converting" }
  | { status: "site-detected"; site: SiteInfo }
  | { status: "site-converting" }
  | { status: "done"; result: ConvertResult }
  | { status: "error"; message: string }

export function UrlForm() {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<State>({ status: "idle" })
  const [flash, setFlash] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setState({ status: "converting" })

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const err = await res.json()
        setState({ status: "error", message: err.detail || "Conversion failed" })
        return
      }

      const data = await res.json()
      if (data.site) {
        setState({ status: "site-detected", site: data.site })
        return
      }

      setState({ status: "done", result: data })
    } catch {
      setState({ status: "error", message: "Network error, please try again" })
    }
  }

  async function handleConfirmSite() {
    if (state.status !== "site-detected") return
    const { site } = state
    setState({ status: "site-converting" })

    try {
      const res = await fetch("/api/convert-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: site.pages, siteTitle: site.siteTitle }),
      })

      if (!res.ok) {
        const err = await res.json()
        setState({ status: "error", message: err.detail || "Conversion failed" })
        return
      }

      const result: ConvertResult = await res.json()
      setState({ status: "done", result: { ...result, warning: false } })
    } catch {
      setState({ status: "error", message: "Network error, please try again" })
    }
  }

  function handleResultAction() {
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setState({ status: "idle" }), 2200)
  }

  const isConverting =
    state.status === "converting" || state.status === "site-converting"

  return (
    <div className="form-wrap w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          required
          disabled={isConverting}
          className="url-input"
        />
        <button
          type="submit"
          disabled={isConverting}
          className={`convert-btn${flash ? " success" : ""}`}
        >
          {isConverting ? (
            <span className="dot-loader">
              <span />
              <span />
              <span />
            </span>
          ) : (
            "Convert"
          )}
        </button>
      </form>

      {state.status === "error" && (
        <p className="error-msg">{state.message}</p>
      )}

      {state.status === "site-detected" && (
        <SiteConfirmCard
          siteTitle={state.site.siteTitle}
          pages={state.site.pages}
          onConfirm={handleConfirmSite}
          onCancel={() => setState({ status: "idle" })}
        />
      )}

      {state.status === "done" && (
        <ResultCard result={state.result} onDownload={handleResultAction} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add CSS for `SiteConfirmCard` to `frontend/app/globals.css`**

Append to the end of `frontend/app/globals.css`:

```css
/* ── SiteConfirmCard ─────────────────────────────────── */
.site-confirm-title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fg);
  margin: 0 0 0.25rem;
}

.site-confirm-count {
  font-size: 0.8rem;
  color: var(--fg-muted);
  margin: 0 0 0.75rem;
  font-family: var(--font-ui);
}

.site-page-list {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
  max-height: 14rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.site-page-list li {
  font-size: 0.8rem;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  padding: 0.2rem 0;
  line-height: 1.4;
}

.site-confirm-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.site-cancel-btn {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.15s;
}

.site-cancel-btn:hover {
  color: var(--fg);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/components/site-confirm-card.tsx frontend/components/url-form.tsx frontend/app/globals.css
git commit -m "feat: add SiteConfirmCard and multi-page conversion flow to frontend"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `site_detector.py` with `detect_site_pages` and `extract_site_title` — Task 1
- ✅ `build_site_epub` — Task 2
- ✅ `/api/convert` modified to call detection, return `SiteDetectedResponse` — Task 3
- ✅ `/api/convert-site` endpoint — Task 3
- ✅ Union response model — Task 3
- ✅ `SiteConfirmCard` with page count, warning banner (>20), Convert All + Cancel — Task 4
- ✅ `site-detected` and `site-converting` states in `url-form.tsx` — Task 4
- ✅ `isConverting` covers both converting states (button disabled + dot-loader) — Task 4
- ✅ All error cases (individual page fail = skip, all fail = 400, network error = error state) — Tasks 3 + 4
- ✅ Tests: `test_site_detector.py`, extended `test_epub_builder.py`, extended `test_api.py` — Tasks 1–3

**Placeholder scan:** None found.

**Type consistency:**
- `SitePageInfo.url / .title` used consistently across `main.py`, `url-form.tsx`, `site-confirm-card.tsx` ✅
- `detect_site_pages` returns `list[dict]` with `url` + `title` keys, consumed as `SitePageInfo` in `main.py` ✅
- `build_site_epub` takes `chapters: list[dict]` with `title`, `html`, `base_url` — consistent across Task 2 and Task 3 ✅
- `ConvertSiteResponse` has no `warning` field — `url-form.tsx` spreads `{ ...result, warning: false }` to satisfy `ConvertResult` type ✅

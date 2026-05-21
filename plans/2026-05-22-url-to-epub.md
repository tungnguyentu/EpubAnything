# URL to EPUB Converter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public web app that converts any URL to a downloadable EPUB with a 24-hour shareable link.

**Architecture:** FastAPI backend (scraper → extractor → epub builder → R2 storage) + Next.js frontend. Single VPS with Docker Compose and Nginx as reverse proxy. Browser fetches `yourdomain.com/api/convert` → Nginx routes to FastAPI. In local dev, Next.js rewrites proxy `/api` to FastAPI at port 8000.

**Tech Stack:** Python 3.11, FastAPI, Playwright, trafilatura, ebooklib, boto3 (Cloudflare R2), Next.js 14, TypeScript, Tailwind CSS, Docker Compose, Nginx

---

## File Map

```
EpubAnything/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── main.py           # FastAPI app + POST /api/convert endpoint
│   ├── scraper.py        # Playwright: load URL → raw HTML
│   ├── extractor.py      # trafilatura: HTML → article dict
│   ├── epub_builder.py   # ebooklib: article dict → .epub bytes
│   ├── storage.py        # boto3: upload to R2, return presigned URL
│   ├── .env.example
│   └── tests/
│       ├── test_extractor.py
│       ├── test_epub_builder.py
│       ├── test_scraper.py
│       └── test_api.py
├── frontend/
│   ├── Dockerfile
│   ├── next.config.js
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
│       ├── url-form.tsx
│       └── result-card.tsx
├── nginx/
│   └── nginx.conf
└── docker-compose.yml
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `backend/`, `frontend/`, `nginx/` directories
- Create: `.gitignore`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p backend/tests frontend/app frontend/components nginx
```

- [ ] **Step 2: Create .gitignore**

```
__pycache__/
*.py[cod]
.venv/
.env
node_modules/
.next/
*.log
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: project scaffold"
```

---

### Task 2: Backend Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/Dockerfile`
- Create: `backend/.env.example`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
playwright==1.44.0
trafilatura==1.9.0
ebooklib==0.18
boto3==1.34.131
httpx==0.27.0
pytest==8.2.2
pytest-asyncio==0.23.7
```

- [ ] **Step 2: Create pytest.ini**

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 3: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y wget curl gnupg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium && playwright install-deps chromium

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 4: Create .env.example**

```
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY=your-r2-access-key
R2_SECRET_KEY=your-r2-secret-key
R2_BUCKET_NAME=epubanything
```

- [ ] **Step 5: Install dependencies locally for development**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Expected: no errors, Chromium downloaded.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "chore: backend setup"
```

---

### Task 3: Extractor Module

**Files:**
- Create: `backend/extractor.py`
- Create: `backend/tests/test_extractor.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_extractor.py`:

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
</article>
</body>
</html>
"""

SHORT_HTML = """<html><body><p>Short.</p></body></html>"""


def test_extracts_title():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert "Python" in result["title"]


def test_extracts_text():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert len(result["text"]) > 100


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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && source .venv/bin/activate
pytest tests/test_extractor.py -v
```

Expected: `ImportError: No module named 'extractor'`

- [ ] **Step 3: Implement extractor.py**

```python
import trafilatura


def extract_content(html: str) -> dict | None:
    result = trafilatura.bare_extraction(html, include_comments=False)
    if result is None:
        return None

    text = result.get("text") or ""
    if not text.strip():
        return None

    return {
        "title": result.get("title") or "Untitled",
        "author": result.get("author") or "",
        "date": result.get("date") or "",
        "text": text,
        "word_count": len(text.split()),
    }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_extractor.py -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/extractor.py backend/tests/test_extractor.py
git commit -m "feat: add extractor module"
```

---

### Task 4: EPUB Builder Module

**Files:**
- Create: `backend/epub_builder.py`
- Create: `backend/tests/test_epub_builder.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_epub_builder.py`:

```python
from epub_builder import build_epub


def test_returns_bytes():
    result = build_epub("Test Title", "Test Author", "Body text.\n\nSecond paragraph.")
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_epub_magic_bytes():
    # EPUB files are ZIP archives — first two bytes are PK signature
    result = build_epub("Title", "Author", "Content paragraph here.")
    assert result[:2] == b"PK"


def test_handles_empty_author():
    result = build_epub("Title", "", "Some content here.")
    assert isinstance(result, bytes)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_epub_builder.py -v
```

Expected: `ImportError: No module named 'epub_builder'`

- [ ] **Step 3: Implement epub_builder.py**

```python
import io
from ebooklib import epub


def build_epub(title: str, author: str, text: str) -> bytes:
    book = epub.EpubBook()
    book.set_identifier("epubanything-" + title[:20].replace(" ", "-"))
    book.set_title(title)
    book.set_language("en")
    if author:
        book.add_author(author)

    paragraphs = "".join(
        f"<p>{p.strip()}</p>"
        for p in text.split("\n\n")
        if p.strip()
    )
    chapter = epub.EpubHtml(title=title, file_name="content.xhtml", lang="en")
    chapter.content = f"<h1>{title}</h1>{paragraphs}"

    book.add_item(chapter)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav", chapter]

    buffer = io.BytesIO()
    epub.write_epub(buffer, book, {})
    return buffer.getvalue()
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_epub_builder.py -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/epub_builder.py backend/tests/test_epub_builder.py
git commit -m "feat: add epub_builder module"
```

---

### Task 5: Scraper Module

**Files:**
- Create: `backend/scraper.py`
- Create: `backend/tests/test_scraper.py`

- [ ] **Step 1: Write failing tests (Playwright mocked)**

Create `backend/tests/test_scraper.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch
from scraper import scrape_url


@pytest.fixture
def mock_playwright_ctx():
    mock_page = AsyncMock()
    mock_page.content = AsyncMock(return_value="<html><body>Hello</body></html>")
    mock_page.goto = AsyncMock()

    mock_browser = AsyncMock()
    mock_browser.new_page = AsyncMock(return_value=mock_page)
    mock_browser.close = AsyncMock()

    mock_chromium = AsyncMock()
    mock_chromium.launch = AsyncMock(return_value=mock_browser)

    mock_pw = AsyncMock()
    mock_pw.__aenter__ = AsyncMock(return_value=mock_pw)
    mock_pw.__aexit__ = AsyncMock(return_value=None)
    mock_pw.chromium = mock_chromium

    return mock_pw, mock_page


async def test_returns_html_string(mock_playwright_ctx):
    mock_pw, _ = mock_playwright_ctx
    with patch("scraper.async_playwright", return_value=mock_pw):
        result = await scrape_url("https://example.com")
    assert result == "<html><body>Hello</body></html>"


async def test_raises_on_navigation_error(mock_playwright_ctx):
    mock_pw, mock_page = mock_playwright_ctx
    mock_page.goto = AsyncMock(side_effect=Exception("Timeout"))
    with patch("scraper.async_playwright", return_value=mock_pw):
        with pytest.raises(Exception, match="Timeout"):
            await scrape_url("https://example.com")
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_scraper.py -v
```

Expected: `ImportError: No module named 'scraper'`

- [ ] **Step 3: Implement scraper.py**

```python
from playwright.async_api import async_playwright


async def scrape_url(url: str) -> str:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="networkidle", timeout=30000)
        html = await page.content()
        await browser.close()
        return html
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_scraper.py -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/scraper.py backend/tests/test_scraper.py
git commit -m "feat: add scraper module"
```

---

### Task 6: Storage Module

**Files:**
- Create: `backend/storage.py`
- Create: `backend/tests/test_storage.py`

- [ ] **Step 1: Write failing tests (boto3 mocked)**

Create `backend/tests/test_storage.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from storage import upload_epub


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("R2_ACCOUNT_ID", "test-account")
    monkeypatch.setenv("R2_ACCESS_KEY", "test-key")
    monkeypatch.setenv("R2_SECRET_KEY", "test-secret")
    monkeypatch.setenv("R2_BUCKET_NAME", "test-bucket")


@pytest.fixture
def mock_s3():
    s3 = MagicMock()
    s3.generate_presigned_url.return_value = "https://r2.example.com/file.epub?token=abc"
    return s3


def test_returns_url_and_expiry(mock_s3):
    with patch("storage.boto3.client", return_value=mock_s3):
        url, expires_at = upload_epub(b"epub-bytes", "Test Title")
    assert url == "https://r2.example.com/file.epub?token=abc"
    assert "Z" in expires_at


def test_uploads_to_correct_bucket(mock_s3):
    with patch("storage.boto3.client", return_value=mock_s3):
        upload_epub(b"epub-bytes", "My Article")
    call_kwargs = mock_s3.put_object.call_args.kwargs
    assert call_kwargs["Bucket"] == "test-bucket"
    assert call_kwargs["Body"] == b"epub-bytes"
    assert call_kwargs["ContentType"] == "application/epub+zip"


def test_presigned_url_expires_in_24h(mock_s3):
    with patch("storage.boto3.client", return_value=mock_s3):
        upload_epub(b"epub-bytes", "Title")
    call_kwargs = mock_s3.generate_presigned_url.call_args.kwargs
    assert call_kwargs["ExpiresIn"] == 86400
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_storage.py -v
```

Expected: `ImportError: No module named 'storage'`

- [ ] **Step 3: Implement storage.py**

```python
import os
import uuid
from datetime import datetime, timedelta, timezone

import boto3


def upload_epub(epub_bytes: bytes, title: str) -> tuple[str, str]:
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["R2_SECRET_KEY"],
        region_name="auto",
    )
    bucket = os.environ["R2_BUCKET_NAME"]
    safe_title = "".join(c for c in title if c.isalnum() or c in " -_")[:50].strip()
    filename = safe_title or "article"
    key = f"{uuid.uuid4()}/{filename}.epub"

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=epub_bytes,
        ContentType="application/epub+zip",
        ContentDisposition=f'attachment; filename="{filename}.epub"',
    )
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=86400,
    )
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    return url, expires_at
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_storage.py -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/storage.py backend/tests/test_storage.py
git commit -m "feat: add storage module"
```

---

### Task 7: API Endpoint

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

Create `backend/tests/test_api.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_api.py -v
```

Expected: `ImportError: No module named 'main'`

- [ ] **Step 3: Implement main.py**

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from scraper import scrape_url
from extractor import extract_content
from epub_builder import build_epub
from storage import upload_epub

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
    epub_bytes = build_epub(content["title"], content["author"], content["text"])

    try:
        download_url, expires_at = upload_epub(epub_bytes, content["title"])
    except Exception:
        raise HTTPException(status_code=500, detail="Storage error, please try again")

    return ConvertResponse(downloadUrl=download_url, expiresAt=expires_at, warning=warning)
```

- [ ] **Step 4: Run all backend tests**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat: add API endpoint"
```

---

### Task 8: Frontend Setup

**Files:**
- Create: `frontend/` — Next.js scaffold
- Create: `frontend/next.config.js` (replace generated)
- Create: `frontend/Dockerfile`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-eslint --import-alias "@/*"
```

Expected: Next.js 14 project created with TypeScript and Tailwind.

- [ ] **Step 2: Replace next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    // In production, Nginx routes /api to FastAPI directly.
    // These rewrites only apply in local dev (no Nginx).
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
```

- [ ] **Step 3: Replace app/layout.tsx**

```tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EpubAnything — Convert any URL to EPUB",
  description: "Paste a URL and download it as an EPUB for your e-reader.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Create Dockerfile**

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Expected: `ready - started server on http://localhost:3000`

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/
git commit -m "chore: frontend setup"
```

---

### Task 9: Frontend UI

**Files:**
- Create: `frontend/components/result-card.tsx`
- Create: `frontend/components/url-form.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create result-card.tsx**

```tsx
type Result = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

export function ResultCard({ result }: { result: Result }) {
  const expiresDate = new Date(result.expiresAt).toLocaleString()

  return (
    <div className="mt-6 p-6 border border-gray-200 rounded-xl space-y-4">
      {result.warning && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          ⚠ Content may be incomplete — this page may be JavaScript-heavy or behind a paywall.
        </div>
      )}

      <a
        href={result.downloadUrl}
        download
        className="block w-full text-center py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
      >
        Download EPUB
      </a>

      <div className="space-y-1">
        <p className="text-sm text-gray-500 font-medium">Shareable link</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={result.downloadUrl}
            readOnly
            className="flex-1 text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 truncate"
          />
          <button
            onClick={() => navigator.clipboard.writeText(result.downloadUrl)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-gray-400">Link expires {expiresDate}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create url-form.tsx**

```tsx
"use client"

import { useState } from "react"
import { ResultCard } from "./result-card"

type ConvertResult = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

type State =
  | { status: "idle" }
  | { status: "converting" }
  | { status: "done"; result: ConvertResult }
  | { status: "error"; message: string }

export function UrlForm() {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<State>({ status: "idle" })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

      const result: ConvertResult = await res.json()
      setState({ status: "done", result })
    } catch {
      setState({ status: "error", message: "Network error, please try again" })
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          required
          disabled={state.status === "converting"}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={state.status === "converting"}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {state.status === "converting" ? "Converting…" : "Convert"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="mt-4 text-sm text-red-600">{state.message}</p>
      )}

      {state.status === "done" && <ResultCard result={state.result} />}
    </div>
  )
}
```

- [ ] **Step 3: Replace app/page.tsx**

```tsx
import { UrlForm } from "@/components/url-form"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">EpubAnything</h1>
          <p className="text-gray-500">
            Paste any URL and download it as an EPUB for your e-reader
          </p>
        </div>
        <UrlForm />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Smoke test in browser**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`. Verify:
- Title "EpubAnything" and subtitle visible
- Input field and Convert button render correctly
- Paste any URL and click Convert → error message appears (expected, backend not running)

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/components/ frontend/app/page.tsx
git commit -m "feat: add frontend UI"
```

---

### Task 10: Nginx Config

**Files:**
- Create: `nginx/nginx.conf`

- [ ] **Step 1: Create nginx.conf**

```nginx
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass         http://backend:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass         http://frontend:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
}
```

Note: After confirming HTTP works on the VPS, add HTTPS by running:
`sudo certbot --nginx -d yourdomain.com`
Certbot modifies `nginx.conf` in place — no manual edits needed.

- [ ] **Step 2: Commit**

```bash
git add nginx/nginx.conf
git commit -m "chore: add nginx config"
```

---

### Task 11: Docker Compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: "3.9"

services:
  backend:
    build: ./backend
    restart: unless-stopped
    env_file:
      - ./backend/.env

  frontend:
    build: ./frontend
    restart: unless-stopped
    environment:
      - BACKEND_URL=http://backend:8000
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
```

- [ ] **Step 2: Copy and fill in env file**

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with real R2 credentials before running
```

- [ ] **Step 3: Build and start all services**

```bash
docker compose up --build
```

Expected: backend, frontend, and nginx all start. Check logs:
```bash
docker compose logs backend   # should show "Application startup complete."
docker compose logs frontend  # should show server running
```

- [ ] **Step 4: End-to-end smoke test**

Open `http://localhost` in browser. Paste a real URL (e.g. `https://en.wikipedia.org/wiki/Python_(programming_language)`). Click Convert.

Expected:
- "Converting…" button state appears
- After 20–40 seconds, EPUB download starts automatically
- Shareable link and expiry notice appear below the form
- No warning banner on a content-rich page like Wikipedia

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: docker compose setup"
```

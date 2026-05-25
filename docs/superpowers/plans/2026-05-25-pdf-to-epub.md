# PDF-to-EPUB Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload a PDF file and download a converted EPUB, with best-effort format preservation (headings, bold/italic, images).

**Architecture:** New `pdf_extractor.py` module uses `pymupdf` to convert PDF bytes to structured HTML; existing `build_epub()` and `upload_epub()` are reused unchanged. A new `POST /api/convert-pdf` endpoint in `main.py` wires the pipeline together. The frontend `url-form.tsx` gains a URL/PDF tab toggle with a drag-and-drop file zone.

**Tech Stack:** pymupdf (fitz), FastAPI `UploadFile`, existing ebooklib / boto3 pipeline, Next.js / TypeScript

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/pdf_extractor.py` | PDF bytes → `{title, html}` via pymupdf |
| Create | `backend/tests/test_pdf_extractor.py` | Unit tests for extraction logic |
| Create | `backend/tests/test_convert_pdf.py` | Endpoint integration tests |
| Modify | `backend/main.py` | Add `/api/convert-pdf` endpoint + import |
| Modify | `backend/requirements.txt` | Add `pymupdf` |
| Modify | `frontend/components/url-form.tsx` | Add mode state, PDF tab, drop zone |
| Modify | `frontend/app/globals.css` | Tab + drop zone styles |

---

## Task 1: Add pymupdf dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add pymupdf to requirements**

Append to `backend/requirements.txt`:
```
pymupdf==1.24.5
```

- [ ] **Step 2: Install into the venv**

```bash
cd backend && .venv/bin/pip install pymupdf==1.24.5
```

Expected: `Successfully installed pymupdf-1.24.5` (or similar, no errors)

- [ ] **Step 3: Verify existing tests still pass**

```bash
cd backend && .venv/bin/python -m pytest -v --tb=short -q
```

Expected: all existing tests pass, no import errors.

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add pymupdf dependency for PDF extraction"
```

---

## Task 2: Unit tests for `pdf_extractor.py`

**Files:**
- Create: `backend/tests/test_pdf_extractor.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_pdf_extractor.py`:

```python
import fitz
import pytest
from pdf_extractor import extract_pdf


def _make_pdf(*text_entries) -> bytes:
    """Create a single-page PDF with text inserted at staggered y positions."""
    doc = fitz.open()
    page = doc.new_page()
    for i, (text, fontsize) in enumerate(text_entries):
        page.insert_text((72, 72 + i * 40), text, fontsize=fontsize)
    buf = doc.tobytes()
    doc.close()
    return buf


def test_extract_pdf_returns_title():
    # Largest font becomes h1 — its text is the title
    pdf = _make_pdf(("My Title", 24), ("Body text here", 12))
    result = extract_pdf(pdf)
    assert result is not None
    assert result["title"] == "My Title"


def test_extract_pdf_returns_html_with_content():
    pdf = _make_pdf(("Hello World", 12))
    result = extract_pdf(pdf)
    assert result is not None
    assert "Hello World" in result["html"]


def test_extract_pdf_blank_page_returns_none():
    doc = fitz.open()
    doc.new_page()  # no text inserted
    buf = doc.tobytes()
    doc.close()
    assert extract_pdf(buf) is None


def test_extract_pdf_multipage_has_hr():
    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text((72, 100), "Page one content", fontsize=12)
    p2 = doc.new_page()
    p2.insert_text((72, 100), "Page two content", fontsize=12)
    buf = doc.tobytes()
    doc.close()
    result = extract_pdf(buf)
    assert result is not None
    assert "<hr>" in result["html"]


def test_extract_pdf_heading_hierarchy():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 50), "Big Title", fontsize=24)
    page.insert_text((72, 100), "Sub Heading", fontsize=18)
    page.insert_text((72, 150), "Normal text", fontsize=12)
    buf = doc.tobytes()
    doc.close()
    result = extract_pdf(buf)
    assert result is not None
    assert "<h1>" in result["html"]
    assert "<h2>" in result["html"]
    assert "<p>" in result["html"]


def test_extract_pdf_fallback_title_when_no_large_font():
    pdf = _make_pdf(("uniform size text", 12))
    result = extract_pdf(pdf)
    assert result is not None
    # No h1 possible with single size — title falls back to first text or "Untitled PDF"
    assert result["title"] in ("uniform size text", "Untitled PDF")


def test_extract_pdf_invalid_bytes_returns_none():
    assert extract_pdf(b"not a pdf at all") is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && .venv/bin/python -m pytest tests/test_pdf_extractor.py -v
```

Expected: `ModuleNotFoundError: No module named 'pdf_extractor'` — confirms tests are wired up correctly.

---

## Task 3: Implement `pdf_extractor.py`

**Files:**
- Create: `backend/pdf_extractor.py`

- [ ] **Step 1: Create the module**

Create `backend/pdf_extractor.py`:

```python
import base64

import fitz  # pymupdf


def extract_pdf(data: bytes) -> dict | None:
    """Convert PDF bytes to {title, html}. Returns None if no extractable text."""
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception:
        return None

    size_map = _build_size_map(doc)
    if not size_map:
        return None

    html_parts = []
    title = None

    for page_num, page in enumerate(doc):
        if page_num > 0:
            html_parts.append("<hr>")

        for block in page.get_text("dict")["blocks"]:
            if block["type"] == 1:
                _append_image_block(block, html_parts)
            else:
                fragment, block_title = _render_text_block(block, size_map)
                if fragment:
                    html_parts.append(fragment)
                    if title is None and block_title:
                        title = block_title

    if not html_parts:
        return None

    return {"title": title or "Untitled PDF", "html": "\n".join(html_parts)}


def _build_size_map(doc) -> dict[int, str]:
    """Map rounded font sizes to heading tags. Top 3 sizes → h1/h2/h3, rest → p."""
    sizes: set[int] = set()
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    if span["text"].strip():
                        sizes.add(round(span["size"]))

    tags = ["h1", "h2", "h3"]
    return {size: tags[i] for i, size in enumerate(sorted(sizes, reverse=True)[:3])}


def _append_image_block(block: dict, html_parts: list[str]) -> None:
    try:
        img_bytes = block["image"]
        ext = block.get("ext", "png")
        b64 = base64.b64encode(img_bytes).decode()
        html_parts.append(f'<img src="data:image/{ext};base64,{b64}">')
    except Exception:
        pass


def _render_text_block(block: dict, size_map: dict[int, str]) -> tuple[str, str | None]:
    """Render a text block to an HTML element. Returns (html_fragment, title_text_or_None)."""
    spans_html = []
    first_size = None

    for line in block["lines"]:
        for span in line["spans"]:
            text = span["text"].strip()
            if not text:
                continue
            size = round(span["size"])
            if first_size is None:
                first_size = size
            spans_html.append(_wrap_span(text, span["flags"]))

    if not spans_html:
        return "", None

    tag = size_map.get(first_size, "p")
    content = " ".join(spans_html)
    fragment = f"<{tag}>{content}</{tag}>"

    title_text = None
    if tag == "h1":
        title_text = " ".join(
            s["text"].strip()
            for line in block["lines"]
            for s in line["spans"]
        ).strip()

    return fragment, title_text


def _wrap_span(text: str, flags: int) -> str:
    bold = bool(flags & 16)
    italic = bool(flags & 2)
    if bold and italic:
        return f"<strong><em>{text}</em></strong>"
    if bold:
        return f"<strong>{text}</strong>"
    if italic:
        return f"<em>{text}</em>"
    return text
```

- [ ] **Step 2: Run unit tests**

```bash
cd backend && .venv/bin/python -m pytest tests/test_pdf_extractor.py -v
```

Expected: all 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/pdf_extractor.py backend/tests/test_pdf_extractor.py
git commit -m "feat: add pdf_extractor module with pymupdf heading/image extraction"
```

---

## Task 4: Endpoint tests for `/api/convert-pdf`

**Files:**
- Create: `backend/tests/test_convert_pdf.py`

- [ ] **Step 1: Write the failing endpoint tests**

Create `backend/tests/test_convert_pdf.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd backend && .venv/bin/python -m pytest tests/test_convert_pdf.py -v
```

Expected: `404 Not Found` or `ImportError` — endpoint doesn't exist yet.

---

## Task 5: Add `/api/convert-pdf` to `main.py`

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add import and endpoint**

At the top of `backend/main.py`, add to the existing imports:

```python
from fastapi import FastAPI, File, HTTPException, Request, UploadFile

from pdf_extractor import extract_pdf
```

Then add the endpoint after the existing `convert_site` handler (before `serve_file`):

```python
_MAX_PDF_BYTES = 50 * 1024 * 1024  # 50 MB


@app.post("/api/convert-pdf")
async def convert_pdf(file: UploadFile = File(...)) -> ConvertResponse:
    if file.content_type != "application/pdf" and not (file.filename or "").endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    data = await file.read()

    if len(data) > _MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    content = extract_pdf(data)
    if content is None:
        raise HTTPException(status_code=400, detail="No readable text found in PDF")

    epub_bytes = build_epub(content["title"], "", content["html"], "")

    try:
        download_url, expires_at = upload_epub(epub_bytes, content["title"])
    except Exception:
        raise HTTPException(status_code=500, detail="Storage error, please try again")

    return ConvertResponse(downloadUrl=download_url, expiresAt=expires_at, warning=False)
```

The existing `from fastapi import FastAPI, HTTPException, Request` line must become `from fastapi import FastAPI, File, HTTPException, Request, UploadFile`.

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && .venv/bin/python -m pytest -v --tb=short
```

Expected: all tests pass including the 5 new endpoint tests.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py backend/tests/test_convert_pdf.py
git commit -m "feat: add /api/convert-pdf endpoint for PDF-to-EPUB conversion"
```

---

## Task 6: Frontend — PDF tab in `url-form.tsx`

**Files:**
- Modify: `frontend/components/url-form.tsx`

- [ ] **Step 1: Replace the file with the updated version**

Replace the contents of `frontend/components/url-form.tsx` with:

```tsx
"use client"

import { useRef, useState } from "react"
import { ResultCard } from "./result-card"
import { SiteConfirmCard } from "./site-confirm-card"
import { ProgressCard } from "./progress-card"

type ConvertResult = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

type SitePage = { url: string; title: string }
type SiteInfo = { siteTitle: string; pages: SitePage[] }

type Progress = { current: number; total: number; pageTitle: string }

type State =
  | { status: "idle" }
  | { status: "converting" }
  | { status: "site-detected"; site: SiteInfo }
  | { status: "site-converting"; siteTitle: string; progress: Progress }
  | { status: "done"; result: ConvertResult }
  | { status: "error"; message: string }

type User = { id: number; email: string; name: string; credits: number }

type Props = { user: User | null }

export function UrlForm({ user }: Props) {
  const [mode, setMode] = useState<"url" | "pdf">("url")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<State>({ status: "idle" })
  const [flash, setFlash] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function switchMode(next: "url" | "pdf") {
    setMode(next)
    setState({ status: "idle" })
    setFile(null)
  }

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

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    if (resetTimer.current) clearTimeout(resetTimer.current)

    if (file.size > 50 * 1024 * 1024) {
      setState({ status: "error", message: "File too large (max 50 MB)" })
      return
    }

    setState({ status: "converting" })

    try {
      const form = new FormData()
      form.append("file", file)

      const res = await fetch("/api/convert-pdf", { method: "POST", body: form })

      if (!res.ok) {
        const err = await res.json()
        setState({ status: "error", message: err.detail || "Conversion failed" })
        return
      }

      setState({ status: "done", result: await res.json() })
    } catch {
      setState({ status: "error", message: "Network error, please try again" })
    }
  }

  async function handleConfirmSite() {
    if (state.status !== "site-detected") return

    if (!user) {
      setState({ status: "error", message: "Sign in with Google to convert course sites" })
      return
    }
    if (user.credits < 1) {
      setState({ status: "error", message: "No credits remaining — buy a pack to continue" })
      return
    }

    const { site } = state

    setState({
      status: "site-converting",
      siteTitle: site.siteTitle,
      progress: { current: 0, total: site.pages.length, pageTitle: "" },
    })

    const res = await fetch("/api/convert-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pages: site.pages, siteTitle: site.siteTitle }),
    })

    if (!res.ok || !res.body) {
      setState({ status: "error", message: "Network error, please try again" })
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === "progress") {
            setState({
              status: "site-converting",
              siteTitle: site.siteTitle,
              progress: { current: event.current, total: event.total, pageTitle: event.pageTitle },
            })
          } else if (event.type === "done") {
            setState({
              status: "done",
              result: { downloadUrl: event.downloadUrl, expiresAt: event.expiresAt, warning: false },
            })
          } else if (event.type === "error") {
            setState({ status: "error", message: event.detail })
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  }

  function handleResultAction() {
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setState({ status: "idle" }), 2200)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.type === "application/pdf" || dropped?.name.endsWith(".pdf")) {
      setFile(dropped)
      setState({ status: "idle" })
    } else {
      setState({ status: "error", message: "Please drop a PDF file" })
    }
  }

  const isConverting =
    state.status === "converting" || state.status === "site-converting"

  return (
    <div className="form-wrap w-full">
      <div className="input-tabs">
        <button
          type="button"
          className={`input-tab${mode === "url" ? " active" : ""}`}
          onClick={() => switchMode("url")}
        >
          URL
        </button>
        <button
          type="button"
          className={`input-tab${mode === "pdf" ? " active" : ""}`}
          onClick={() => switchMode("pdf")}
        >
          PDF
        </button>
      </div>

      {mode === "url" && (
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
      )}

      {mode === "pdf" && (
        <form onSubmit={handlePdfSubmit} className="flex flex-col gap-2">
          <div
            className={`pdf-drop-zone${dragOver ? " drag-over" : ""}${file ? " has-file" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <span className="pdf-filename">{file.name}</span>
            ) : (
              <span className="pdf-drop-hint">Drop PDF here or</span>
            )}
            <label className="pdf-browse-btn">
              {file ? "Change file" : "Browse"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  setState({ status: "idle" })
                }}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isConverting || !file}
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
      )}

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

      {state.status === "site-converting" && (
        <ProgressCard
          siteTitle={state.siteTitle}
          current={state.progress.current}
          total={state.progress.total}
          pageTitle={state.progress.pageTitle}
        />
      )}

      {state.status === "done" && (
        <ResultCard result={state.result} onDownload={handleResultAction} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

---

## Task 7: Frontend CSS for tabs and PDF drop zone

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Add styles after the `.form-wrap` block**

Find the comment `/* ── Form ─────────────────────────────────────────────── */` in `globals.css` and append the following after the existing form styles (after `.error-msg` block):

```css
/* ── Input mode tabs ─────────────────────────────────── */
.input-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid var(--border);
}

.input-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.35rem 0.9rem;
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-muted);
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.input-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.input-tab:hover:not(.active) {
  color: var(--fg);
}

/* ── PDF drop zone ────────────────────────────────────── */
.pdf-drop-zone {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-surface);
  border: 1px dashed var(--border);
  border-radius: 3px;
  padding: 0.85rem 1.1rem;
  transition: border-color 0.2s, background 0.2s;
  min-height: 3rem;
}

.pdf-drop-zone.drag-over {
  border-color: var(--accent);
  background: rgba(201, 150, 58, 0.04);
}

.pdf-drop-zone.has-file {
  border-style: solid;
  border-color: rgba(201, 150, 58, 0.4);
}

.pdf-drop-hint {
  font-size: 0.85rem;
  color: var(--fg-subtle);
  flex: 1;
}

.pdf-filename {
  font-size: 0.85rem;
  color: var(--fg);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-browse-btn {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  cursor: pointer;
  white-space: nowrap;
  padding: 0.2rem 0;
  transition: color 0.15s;
}

.pdf-browse-btn:hover {
  color: var(--accent-light);
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full verification**

```bash
cd "/Volumes/external/Projects 2/EpubAnything" && ./init.sh
```

Expected: all backend tests pass, TypeScript clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/url-form.tsx frontend/app/globals.css
git commit -m "feat: add PDF tab with drag-and-drop file upload to url-form"
```

---

## Task 8: Update `feature_list.json` and wrap up

**Files:**
- Modify: `feature_list.json`

- [ ] **Step 1: Mark feat-009 as done**

In `feature_list.json`, update the feat-009 entry:

```json
{
  "id": "feat-009",
  "name": "PDF to EPUB conversion",
  "description": "Upload a PDF file and receive a downloadable EPUB. Format preserved best-effort via pymupdf: heading hierarchy (font-size), bold/italic (font flags), embedded images. Free, no auth required. New pdf_extractor.py module + /api/convert-pdf endpoint + PDF tab in url-form.tsx.",
  "dependencies": ["feat-001"],
  "status": "done",
  "evidence": "pdf_extractor.py (pymupdf), /api/convert-pdf endpoint, url-form.tsx PDF tab + CSS. All tests pass, TypeScript clean."
}
```

- [ ] **Step 2: Final verification**

```bash
cd "/Volumes/external/Projects 2/EpubAnything" && ./init.sh
```

Expected: all tests pass, TypeScript clean.

- [ ] **Step 3: Commit**

```bash
git add feature_list.json
git commit -m "chore: mark feat-009 PDF-to-EPUB as done"
```

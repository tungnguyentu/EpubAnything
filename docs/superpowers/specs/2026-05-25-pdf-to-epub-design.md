# PDF-to-EPUB Conversion — Design Spec

**Date:** 2026-05-25
**Feature:** feat-009 — PDF file upload to EPUB
**Status:** Approved, pending implementation

---

## Overview

Allow users to upload a PDF file and receive a downloadable EPUB. Format is preserved best-effort: headings (by font-size hierarchy), bold/italic (by font flags), and embedded images are retained. Free, no auth required.

---

## Architecture

New input path parallel to the existing URL flow. No existing modules are modified except `main.py` (new endpoint) and `url-form.tsx` (new tab mode).

```
Frontend
  ├── URL tab (existing)   → POST /api/convert
  └── PDF tab (new)        → POST /api/convert-pdf  (multipart/form-data)

Backend
  ├── main.py              — /api/convert-pdf endpoint
  ├── pdf_extractor.py     — new: PDF bytes → {title, html} via pymupdf
  └── epub_builder.py      — reuses build_epub() unchanged
```

---

## Backend: `pdf_extractor.py`

Single public function: `extract_pdf(data: bytes) -> dict | None`

Returns `{title: str, html: str}` or `None` if no extractable content.

**Extraction logic:**
1. Open PDF from bytes with `pymupdf.open(stream=data, filetype="pdf")`
2. Collect all font sizes across all spans in the document; rank unique sizes descending
3. Map: largest size → `<h1>` (title), 2nd → `<h2>`, 3rd → `<h3>`, rest → `<p>`
4. Per span: bold flag → `<strong>`, italic flag → `<em>`, both → `<strong><em>`
5. Images: extract per-block as PNG bytes, base64-encode into `<img src="data:image/png;base64,...">`
6. Page breaks: emit `<hr>` between pages
7. Title: first h1 text found; fallback to `"Untitled PDF"`

**Constraints:**
- Max input: 50 MB (enforced at endpoint level)
- Scanned PDFs (image-only, no text layer): return `None` — endpoint returns 400 "No readable text found in PDF"

---

## Backend: `/api/convert-pdf` endpoint

```
POST /api/convert-pdf
Content-Type: multipart/form-data
Field: file  (PDF, max 50 MB)
```

**Flow:**
1. Validate file is PDF (content-type check + `.pdf` extension)
2. Read bytes into memory
3. Call `extract_pdf(bytes)` → `{title, html}`; 400 if None
4. Call `build_epub(title, "", html, "")` — existing function, no changes
5. Call `upload_epub(epub_bytes, title)` — existing function, no changes
6. Return `ConvertResponse` — same shape as `/api/convert`

No authentication. No credit deduction.

---

## Frontend: `url-form.tsx`

Add a tab toggle: **URL** | **PDF** — controls which input is shown.

**URL tab** — existing form, unchanged behavior.

**PDF tab:**
- File input: `<input type="file" accept=".pdf">`
- Drag-and-drop zone (same element, `onDragOver`/`onDrop`)
- Client-side size guard: file > 50 MB → set error state, no fetch
- Submit: `fetch("/api/convert-pdf", { method: "POST", body: new FormData() })`
- Reuses existing `converting` → `done` / `error` state machine — no new states

**State additions:**
- `mode: "url" | "pdf"` — controls tab display
- `file: File | null` — selected PDF

---

## Testing

- `test_convert_pdf_success` — mock `extract_pdf` + `upload_epub`, assert 200 + ConvertResponse
- `test_convert_pdf_no_text` — mock `extract_pdf` returning None, assert 400
- `test_convert_pdf_wrong_type` — send a `.txt` file, assert 400
- `test_convert_pdf_too_large` — send >50 MB, assert 400
- Unit tests for `pdf_extractor.py`: heading hierarchy, bold/italic spans, image extraction, page breaks

---

## `feature_list.json` entry

```json
{
  "id": "feat-009",
  "name": "PDF to EPUB conversion",
  "description": "Upload a PDF file and receive a downloadable EPUB. Format preserved best-effort via pymupdf: heading hierarchy (font-size), bold/italic (font flags), embedded images. Free, no auth required. New pdf_extractor.py module + /api/convert-pdf endpoint + PDF tab in url-form.tsx.",
  "dependencies": ["feat-001"],
  "status": "not-started"
}
```

---

## Out of Scope

- Scanned PDF OCR (image-only PDFs with no text layer)
- Multi-column layout reflow
- Tables-to-HTML conversion
- PDF URL input (file upload only)

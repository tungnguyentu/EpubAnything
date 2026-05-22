# Multi-Page / Course EPUB Feature Design

## Goal

Auto-detect when a URL points to a multi-page course or documentation site, confirm with the user, then crawl all linked pages and package them as a single multi-chapter EPUB.

## Architecture

Two-phase REST approach. Phase 1 uses the existing `/api/convert` endpoint; Phase 2 uses a new `/api/convert-site` endpoint.

```
Phase 1: URL → scrape → detect TOC links → return {site: {pages, siteTitle}}
Phase 2: [{url, title}] → scrape each → extract → build multi-chapter EPUB → upload → return download URL
```

## Backend

### `backend/site_detector.py` (new)

Single public function:

```python
def detect_site_pages(html: str, base_url: str) -> list[dict] | None
```

- Parses HTML with BeautifulSoup (already a dependency)
- Searches `<nav>`, `<aside>`, `[role="navigation"]` for `<a>` tags with `href` pointing to the same domain as `base_url`
- Filters out fragment-only links (`#...`), external links, and the base URL itself
- Deduplicates while preserving DOM order
- Returns `[{url: str, title: str}]` if 3+ links found, else `None`
- Title comes from link text; falls back to URL path segment

### `/api/convert` changes

After scraping, call `detect_site_pages(html, url)`. If it returns pages:

- Return HTTP 200 with a new `site` field: `{pages: [{url, title}], siteTitle: str}`
- Do NOT build an EPUB in Phase 1
- `siteTitle` comes from `<title>` tag or the page's `<h1>`; falls back to the URL hostname

If no site detected: existing behavior unchanged (build EPUB, return download URL).

**Response schema** — two Pydantic models, `/api/convert` returns a union:

```python
class SingleConvertResponse(BaseModel):
    downloadUrl: str
    expiresAt: str
    warning: bool

class SiteDetectedResponse(BaseModel):
    site: SiteInfo  # {siteTitle: str, pages: [{url, title}]}

# endpoint returns Union[SingleConvertResponse, SiteDetectedResponse]
```

Example when site detected:
```json
{
  "site": {
    "siteTitle": "Learn Harness Engineering",
    "pages": [
      {"url": "https://...", "title": "Lecture 01"},
      ...
    ]
  }
}
```

Frontend distinguishes by presence of `site` key.

### `/api/convert-site` (new endpoint)

**Request:**

```json
{
  "pages": [{"url": "...", "title": "..."}],
  "siteTitle": "..."
}
```

**Behavior:**

1. For each page in order: scrape with Playwright, extract with readability-lxml
2. Skip silently if scrape or extract fails
3. If all pages fail → raise HTTP 400 "No readable content found"
4. Build multi-chapter EPUB: each page → one `EpubHtml` item, `EpubNcx` + `EpubNav` for TOC
5. Upload and return `{downloadUrl, expiresAt}`

**No `warning` field** — not meaningful for multi-page crawls.

### `backend/epub_builder.py` changes

Add a second public function:

```python
def build_site_epub(site_title: str, chapters: list[dict]) -> bytes
# chapters: [{title: str, html: str, base_url: str}]
```

Each chapter: embed images as base64, inline CSS via premailer (same helpers as existing `build_epub`). Package as one EPUB with proper NCX/Nav TOC.

## Frontend

### New state in `url-form.tsx`

```
idle → converting → site-detected → site-converting → done | error
```

- `site-detected`: holds `{pages, siteTitle}` from Phase 1 response
- Renders `<SiteConfirmCard>` instead of `<ResultCard>`

### `SiteConfirmCard` (new component)

Props: `{siteTitle, pages, onConfirm, onCancel}`

Shows:
- Site title
- Page count + ordered list of page titles (scrollable if >10)
- Warning banner if page count > 20: "This may take a while (~N minutes)"
- "Convert All" button → calls `onConfirm`
- "Cancel" link → calls `onCancel`, resets to idle

On "Convert All": parent sets state to `site-converting`, calls `/api/convert-site`, then transitions to `done` or `error`.

### Loading state during site-converting

Reuse existing dot-loader on Convert button. No progress bar (deferred to future).

## Error handling

| Scenario | Behavior |
|---|---|
| Individual page fails to scrape | Skip silently |
| All pages fail | HTTP 400 from backend, error state in UI |
| Page has no readable content | Skip silently |
| Network error calling `/api/convert-site` | "Network error, please try again" |

## Out of scope

- Real-time progress (SSE / WebSocket) — future enhancement
- Parallel crawling — sequential only to avoid Playwright resource contention
- User-configurable page selection — all or nothing
- Depth > 1 (following links within linked pages)

## Testing

- `tests/test_site_detector.py`: detection with nav/aside/role, dedup, filtering, <3 links returns None
- `tests/test_epub_builder.py`: extend with `build_site_epub` multi-chapter test
- `tests/test_main.py`: mock `detect_site_pages` returning pages → `/api/convert` returns `site` field; `/api/convert-site` happy path + all-pages-fail 400

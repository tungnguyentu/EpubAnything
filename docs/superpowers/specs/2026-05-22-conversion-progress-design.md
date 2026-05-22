# Conversion Progress Feature Design

## Goal

Show real-time progress during multi-page site conversion — "Converting page 3 of 12 — Lesson Title" with a live progress bar — by streaming SSE events from the backend as each page is crawled.

## Architecture

`/api/convert-site` becomes a streaming SSE endpoint. The frontend reads the stream using `fetch` + `ReadableStream` and updates the `site-converting` state incrementally. A new `ProgressCard` component renders the live UI.

```
User clicks "Convert All"
  → frontend POSTs to /api/convert-site (streaming)
  → backend streams: progress event per page, then done (or error)
  → frontend updates progress state on each event
  → done event transitions to download state
```

## Backend

### `/api/convert-site` — streaming rewrite

Change from `response_model=ConvertSiteResponse` + returning a single object, to returning a `StreamingResponse` with `media_type="text/event-stream"`.

Remove the `ConvertSiteResponse` Pydantic model (no longer used as a response model on this endpoint). Keep `ConvertSiteRequest` unchanged.

```python
import json
from fastapi.responses import StreamingResponse

@app.post("/api/convert-site")
async def convert_site(req: ConvertSiteRequest):
    return StreamingResponse(
        _stream_site_conversion(req.pages, req.siteTitle),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream_site_conversion(pages, site_title):
    chapters = []
    total = len(pages)

    for i, page in enumerate(pages):
        # Emit progress before processing so user sees current page immediately
        yield f"data: {json.dumps({'type': 'progress', 'current': i + 1, 'total': total, 'pageTitle': page.title})}\n\n"

        try:
            html = await scrape_url(page.url)
            content = extract_content(html)
            if content is not None:
                chapters.append({"title": page.title, "html": content["html"], "base_url": page.url})
        except Exception:
            pass  # Skip failed pages silently, consistent with existing behavior

    if not chapters:
        yield f"data: {json.dumps({'type': 'error', 'detail': 'No readable content found'})}\n\n"
        return

    epub_bytes = build_site_epub(site_title, chapters)

    try:
        download_url, expires_at = upload_epub(epub_bytes, site_title)
    except Exception:
        yield f"data: {json.dumps({'type': 'error', 'detail': 'Storage error, please try again'})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'done', 'downloadUrl': download_url, 'expiresAt': expires_at})}\n\n"
```

### SSE event types

| type | fields | meaning |
|------|--------|---------|
| `progress` | `current, total, pageTitle` | one page started processing |
| `done` | `downloadUrl, expiresAt` | EPUB ready |
| `error` | `detail` | all pages failed or storage error |

## Frontend

### `frontend/components/progress-card.tsx` (new)

Presentational component, same `result-card` / `result-card-accent` / `result-card-body` shell as `SiteConfirmCard`.

Props: `{ siteTitle: string; current: number; total: number; pageTitle: string }`

Shows:
- Site title (`.progress-site-title`)
- Count label (`.progress-count`): "Preparing…" when `current === 0`, else "Converting page N of M"
- Progress bar track + fill: `width = (current / total) * 100%` (`.progress-bar-track` / `.progress-bar-fill`)
- Current page title in italic (`.progress-page-label`); empty when `current === 0`

### `frontend/components/url-form.tsx` changes

**State type update** — `site-converting` now carries progress and the site title:

```ts
| { status: "site-converting"; siteTitle: string; progress: { current: number; total: number; pageTitle: string } }
```

**`handleConfirmSite` rewrite** — reads the streaming body instead of awaiting JSON:

```ts
async function handleConfirmSite() {
  if (state.status !== "site-detected") return
  const { site } = state
  // current=0 triggers "Preparing…" label in ProgressCard before first SSE event
  setState({ status: "site-converting", siteTitle: site.siteTitle, progress: { current: 0, total: site.pages.length, pageTitle: "" } })

  const res = await fetch("/api/convert-site", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
          setState({ status: "site-converting", siteTitle: site.siteTitle, progress: { current: event.current, total: event.total, pageTitle: event.pageTitle } })
        } else if (event.type === "done") {
          setState({ status: "done", result: { downloadUrl: event.downloadUrl, expiresAt: event.expiresAt, warning: false } })
        } else if (event.type === "error") {
          setState({ status: "error", message: event.detail })
        }
      } catch {
        // Ignore malformed SSE lines
      }
    }
  }
}
```

**Render update** — replace the bare `site-converting` render with `ProgressCard`:

```tsx
{state.status === "site-converting" && (
  <ProgressCard
    siteTitle={state.siteTitle}
    current={state.progress.current}
    total={state.progress.total}
    pageTitle={state.progress.pageTitle}
  />
)}
```

**`isConverting`** — unchanged: `state.status === "converting" || state.status === "site-converting"` (input stays disabled, Convert button stays in dot-loader during both phases).

### `frontend/app/globals.css` additions

```css
/* ── ProgressCard ──────────────────────────────────────── */
.progress-site-title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fg);
  margin: 0 0 0.2rem;
}

.progress-count {
  font-size: 0.78rem;
  color: var(--fg-muted);
  margin: 0 0 0.75rem;
  font-family: var(--font-ui);
}

.progress-bar-track {
  background: var(--bg-raised);
  border-radius: 999px;
  height: 6px;
  overflow: hidden;
  margin-bottom: 0.6rem;
}

.progress-bar-fill {
  background: linear-gradient(90deg, var(--accent), var(--accent-light));
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.progress-page-label {
  font-size: 0.75rem;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-style: italic;
  margin: 0;
}
```

## Testing

- `backend/tests/test_api.py`: update `test_convert_site_success` to read SSE stream instead of JSON; add `test_convert_site_streams_progress` that verifies progress events emitted before done; add `test_convert_site_all_pages_fail` streams error event.
- TypeScript: `npx tsc --noEmit` must pass with updated `site-converting` state shape.

## Out of scope

- Progress for single-page conversion — no page count available
- Cancellation mid-stream
- Retry on individual page failure (already skipped silently)

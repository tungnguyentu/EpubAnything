# EpubAnything — URL to EPUB Design Spec

**Date:** 2026-05-22  
**Scope:** v1 — convert a pasted website URL into a downloadable EPUB file

---

## Overview

A public web app where anyone pastes a URL and receives an EPUB file. The user gets an immediate browser download and a shareable link that expires after 24 hours. The system makes a best-effort attempt on all pages, including JS-rendered and paywalled ones, and warns the user when extracted content is likely incomplete.

---

## Architecture

Two services on a single VPS, managed by Docker Compose, fronted by Nginx:

```
User (browser)
    │
    ▼
Nginx (reverse proxy + HTTPS via Certbot)
    ├── yourdomain.com       → Next.js frontend (port 3000)
    └── yourdomain.com/api   → FastAPI backend  (port 8000)
                                    │
                                    ├── Playwright  →  raw HTML
                                    ├── trafilatura →  clean article content
                                    ├── ebooklib    →  .epub (in memory)
                                    └── Cloudflare R2  →  presigned 24h URL
```

The frontend never touches R2. The backend returns a presigned URL; the browser downloads directly from R2.

---

## Components

### Backend (FastAPI)

| Module | Responsibility |
|---|---|
| `scraper.py` | Playwright headless Chromium — loads page, waits for network idle (max 30s), returns raw HTML |
| `extractor.py` | trafilatura — parses HTML into title, author, date, body text |
| `epub_builder.py` | ebooklib — assembles extracted content into `.epub` in memory |
| `storage.py` | Uploads `.epub` to R2, returns presigned URL with 24h TTL |
| `main.py` | Single `POST /api/convert` endpoint orchestrating the four modules above |

### Frontend (Next.js)

Single-page app with three UI states:

- **Idle:** URL input field + Convert button
- **Converting:** loading indicator
- **Done:** download button + copyable shareable link + "expires in 24 hours" notice
- **Warning banner** (overlaid on Done state): shown when `warning=true` in response

---

## Data Flow

```
1. User pastes URL → clicks Convert
2. Frontend  POST /api/convert { url }
3. Backend pipeline:
   a. Playwright loads page (30s timeout)
   b. trafilatura extracts article content
   c. If extraction < 200 words → set warning=true, continue
   d. ebooklib builds .epub in memory (no disk write)
   e. Upload to R2 → presigned URL (24h TTL, auto-expired by R2 lifecycle rule)
   f. Return { downloadUrl, expiresAt, warning }
4. Frontend:
   - Triggers browser download via presigned URL
   - Displays shareable link + expiry notice
   - If warning=true → shows incomplete content banner
```

---

## Error Handling

| Condition | HTTP | Message returned |
|---|---|---|
| URL unreachable or times out | 400 | `"Could not load page"` |
| Extraction returns nothing | 400 | `"No readable content found"` |
| R2 upload fails | 500 | `"Storage error, please try again"` |
| Content < 200 words | 200 + `warning=true` | EPUB delivered with warning banner |

---

## Deployment

**VPS stack:**

```yaml
# docker-compose.yml
services:
  backend:    # FastAPI + Playwright + Chromium (playwright install at build time)
  frontend:   # Next.js (Node.js)
  nginx:      # reverse proxy, serves both services
```

- **HTTPS:** Certbot (Let's Encrypt), auto-renew via cron
- **Storage:** Cloudflare R2 — one bucket, 24h object lifecycle rule (no cron needed for cleanup)

**Environment variables:**

| Service | Variable |
|---|---|
| Backend | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET_NAME` |

The frontend uses relative paths (`/api/convert`) — Nginx handles routing to FastAPI, so no frontend env var is needed in production. In local development, use Next.js `rewrites` in `next.config.js` to proxy `/api` → `localhost:8000`.

---

## Testing

- **Backend unit tests (pytest):** mock Playwright and R2; test extractor and epub builder with real HTML fixtures
- **Error case tests:** unreachable URL, empty extraction, upload failure
- **Frontend:** manual smoke test — paste URL, verify download triggers and shareable link works

No CI pipeline in v1 scope.

---

## Out of Scope (v1)

- User accounts or history
- Batch conversion (multiple URLs)
- Other input types (PDF, Word, etc.) — planned for future versions
- Rate limiting / abuse prevention (add before public launch)

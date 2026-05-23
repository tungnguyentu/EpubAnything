# Session Progress Log

## Current State

**Last Updated:** 2026-05-24
**Active Feature:** feat-008 (next feature — not yet defined)

## Completed Features

- [x] feat-001 — Single-page EPUB conversion (scrape → extract → build → upload → download link)
- [x] feat-002 — Multi-page site detection and EPUB (nav detection, SiteConfirmCard, multi-chapter EPUB)
- [x] feat-003 — SSE conversion progress (StreamingResponse, ProgressCard, SSE stream reader in frontend)
- [x] feat-004 — Scraper concurrency cap (Semaphore(5) in scraper.py)
- [x] feat-005 — Payments & credits (Google OAuth, SQLite, PayPal 10-for-$3, credit gate on /api/convert-site, AuthBar + PayPal buttons)
- [x] feat-006 — Privacy policy & terms of service pages + homepage footer links. Required for Google OAuth consent screen publishing. TypeScript clean. Commits 5911797..3450404.
- [x] feat-007 — Google sign-in button (white bg, official G logo SVG) + /pricing page (Free & Credits tiers, guarantee strip, FAQ). Homepage footer pricing link. 57 tests pass, TypeScript clean. Commit 0abd8de.

## What's Next

Define the next feature in `feature_list.json` feat-008 before starting work.

## Baseline Evidence

- Backend: `cd backend && .venv/bin/python -m pytest -v` → **57 passed**
- TypeScript: `cd frontend && npx tsc --noEmit` → **no errors**
- Branch: `master`, clean, pushed to origin

## Architecture Notes

- `/api/convert` returns JSON: either `ConvertResponse` (single page) or `SiteDetectedResponse` (site detected)
- `/api/convert-site` returns SSE stream: `progress` events per page, then `done` or `error`; requires auth cookie + credits ≥ 1
- Frontend state machine: `idle → converting → site-detected → site-converting → done | error`
- CSS theme via custom properties in `globals.css` — dark/warm palette, variables: `--fg`, `--fg-muted`, `--accent`, `--accent-light`, `--bg-raised`
- Deployment: Docker Compose + Nginx + PM2 (`ecosystem.config.cjs`)
- Auth: Google OAuth via `authlib`, signed session cookie (`itsdangerous`), 30-day expiry
- DB: SQLite at `backend/epubanything.db` — `users` table (google_id, email, name, credits)
- Payments: PayPal Orders API v2 via `httpx`; Bearer token cached with expiry; no webhook needed (capture is synchronous)

## Known Risks

- Playwright memory: capped at 5 concurrent browsers via semaphore — monitor under real load
- R2 credentials: stored in environment — never commit `.env`
- `@app.on_event("startup")` deprecation warning — non-blocking, migrate to lifespan handler eventually

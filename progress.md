# Session Progress Log

## Current State

**Last Updated:** 2026-05-23
**Active Feature:** feat-005 (next feature — not yet defined)

## Completed Features

- [x] feat-001 — Single-page EPUB conversion (scrape → extract → build → upload → download link)
- [x] feat-002 — Multi-page site detection and EPUB (nav detection, SiteConfirmCard, multi-chapter EPUB)
- [x] feat-003 — SSE conversion progress (StreamingResponse, ProgressCard, SSE stream reader in frontend)
- [x] feat-004 — Scraper concurrency cap (Semaphore(5) in scraper.py)

## What's Next

Define the next feature in `feature_list.json` feat-005 before starting work.

## Baseline Evidence

- Backend: `cd backend && .venv/bin/python -m pytest -v` → **41 passed**
- TypeScript: `cd frontend && npx tsc --noEmit` → **no errors**
- Branch: `master`, clean, pushed to origin

## Architecture Notes

- `/api/convert` returns JSON: either `ConvertResponse` (single page) or `SiteDetectedResponse` (site detected)
- `/api/convert-site` returns SSE stream: `progress` events per page, then `done` or `error`
- Frontend state machine: `idle → converting → site-detected → site-converting → done | error`
- CSS theme via custom properties in `globals.css` — dark/warm palette, variables: `--fg`, `--fg-muted`, `--accent`, `--accent-light`, `--bg-raised`
- Deployment: Docker Compose + Nginx + PM2 (`ecosystem.config.cjs`)

## Known Risks

- Playwright memory: capped at 5 concurrent browsers via semaphore — monitor under real load
- R2 credentials: stored in environment — never commit `.env`

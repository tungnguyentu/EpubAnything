# CLAUDE.md — EpubAnything

Convert any webpage or multi-page documentation site to a clean EPUB file.

**Stack:** FastAPI (Python 3.11) backend · Next.js 16 / TypeScript frontend · Playwright scraping · Cloudflare R2 storage · Docker Compose deployment

## Startup Workflow

Before writing any code:

1. Run `./init.sh` — verifies both backend tests and TypeScript compile
2. Read `feature_list.json` — pick ONE `not-started` or `in-progress` feature
3. Review recent commits: `git log --oneline -5`

If `./init.sh` is red, fix it before touching new scope.

## Project Layout

```
backend/          FastAPI app (main.py, scraper.py, extractor.py, epub_builder.py, site_detector.py, storage.py)
backend/tests/    pytest suite (41 tests)
frontend/         Next.js app
frontend/components/  url-form.tsx, result-card.tsx, site-confirm-card.tsx, progress-card.tsx
frontend/app/     page.tsx, globals.css
nginx/            Reverse proxy config
docker-compose.yml  Production stack
```

## Verification Commands

```bash
# Backend — run from backend/
cd backend && .venv/bin/python -m pytest -v

# TypeScript — run from frontend/
cd frontend && npx tsc --noEmit

# Both at once
./init.sh
```

## Key Conventions

- **API:** `/api/convert` → single-page or site-detected JSON; `/api/convert-site` → SSE stream
- **SSE events:** `{type:"progress"|"done"|"error"}` — never break this contract
- **Scraper concurrency:** `asyncio.Semaphore(5)` in `scraper.py` — do not remove
- **Storage:** `upload_epub()` in `storage.py` — returns `(download_url, expires_at)`
- **Tests:** mock `scrape_url` and `upload_epub` — never hit real network in tests
- **CSS:** CSS custom properties (`--fg`, `--accent`, `--bg-raised`, etc.) — use variables, never hardcode colors

## Working Rules

- One feature at a time from `feature_list.json`
- Don't claim done without running `./init.sh`
- Update `progress.md` before ending a session
- Stay in scope — don't refactor unrelated files

## Definition of Done

A feature is done only when ALL are true:

- [ ] Behavior implemented and manual-tested (or tested via pytest)
- [ ] `./init.sh` passes clean
- [ ] `progress.md` updated with evidence
- [ ] `feature_list.json` status set to `done`
- [ ] Committed

## Escalation

- **Architecture decisions** → read `docs/superpowers/specs/` for prior design docs
- **Unclear requirements** → ask user
- **Repeated test failures** → flag in `progress.md`, do not push

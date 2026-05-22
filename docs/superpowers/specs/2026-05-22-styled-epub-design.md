# Styled EPUB Output — Design Spec

**Date:** 2026-05-22  
**Scope:** Preserve source website layout in EPUB output — Option A (Readability HTML + CSS inlining)

---

## Overview

Instead of extracting plain text, the EPUB builder will extract the article's full HTML structure, inline the source page's CSS, and embed images as base64. The result is an EPUB that visually resembles the source website on capable e-readers and degrades gracefully to clean semantic HTML on others.

---

## Pipeline Change

```
Before: raw HTML → trafilatura (plain text) → ebooklib (plain EPUB)
After:  raw HTML → readability-lxml (article HTML) → premailer (inline CSS) + base64 images → ebooklib (styled EPUB)
```

The source URL is threaded through to `epub_builder` to resolve relative paths for images and CSS.

---

## Components

### `extractor.py` — rewritten

Switches from `trafilatura` to `readability-lxml`. Returns clean article HTML with tags intact (`<h1>`, `<h2>`, `<img>`, `<code>`, `<table>`, etc.) instead of plain text.

Return shape:
```python
{
    "title": str,
    "author": str,      # empty string if not found
    "html": str,        # clean article HTML
    "word_count": int,  # computed from text content of HTML
}
```

Returns `None` if readability cannot extract meaningful content.

### `epub_builder.py` — rewritten

New signature: `build_epub(title: str, author: str, html: str, base_url: str) -> bytes`

Processing steps before handing off to ebooklib:

1. **Strip unwanted elements** — remove `<script>`, `<iframe>`, `<nav>`, `<header>`, `<footer>` tags (not valid or useful in EPUB)
2. **Embed images** — for each `<img src="...">`: download via `httpx`, replace `src` with `data:<mime>;base64,<data>` URI. Skip silently on error.
3. **Collect CSS** — fetch each `<link rel="stylesheet" href="...">`, collect all `<style>` block contents. Skip silently on error.
4. **Inline CSS** — concatenate collected CSS, pass to `premailer` to inline into `style` attributes. Fall back to unstyled HTML if premailer fails.
5. **Build EPUB** — pass processed HTML to ebooklib as a single chapter.

### `main.py` — minor change

Pass `str(req.url)` as `base_url` to `build_epub`. No other changes.

### `requirements.txt` — 3 new packages

```
readability-lxml==0.8.1
premailer==3.10.0
beautifulsoup4==4.12.3
```

---

## Data Flow

```
1. scrape_url(url) → raw HTML
2. extract_content(raw_html)
   → { title, author, html, word_count }
   → None if no content → 400 "No readable content found"
   → word_count < 200 → warning=True
3. build_epub(title, author, html, base_url) → bytes
   a. Strip scripts/nav/iframes
   b. Download images → base64 data URIs (best-effort, skip on error)
   c. Fetch CSS links + collect <style> blocks (best-effort, skip on error)
   d. premailer inlines CSS → fallback to plain HTML if premailer errors
   e. ebooklib packages → .epub bytes
4. upload_epub(bytes, title) → (downloadUrl, expiresAt)
```

---

## Error Handling

| Failure | Behaviour |
|---|---|
| readability finds no content | Return `None` → 400 response |
| Image download fails | Skip image (src left as-is or removed), continue |
| CSS fetch fails | Skip that stylesheet, continue |
| premailer inlining fails | Use un-inlined HTML (still has `<style>` blocks) |
| All above | EPUB always generated — styling degrades gracefully |

---

## Out of Scope

- Downloading and embedding web fonts (too large for EPUB)
- Preserving JavaScript-driven interactivity
- Pixel-perfect layout fidelity on all e-readers (CSS Grid/Flex not universally supported)
- Changes to frontend, scraper, storage, or API shape

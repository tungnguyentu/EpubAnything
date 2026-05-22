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

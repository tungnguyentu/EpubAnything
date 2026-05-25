import base64
import html as _html

import fitz  # pymupdf

_BOLD_FLAG = 1 << 4   # pymupdf TEXT_FONT_BOLD
_ITALIC_FLAG = 1 << 1  # pymupdf TEXT_FONT_ITALIC
_ALLOWED_IMG_EXTS = {"png", "jpeg", "gif", "webp"}


def extract_pdf(data: bytes) -> dict | None:
    """Convert PDF bytes to {title, html}. Returns None if no extractable text."""
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception:
        return None

    size_map = _build_size_map(doc)
    # size_map may be empty (single font size) — that's fine, everything renders as <p>
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
    """Map rounded font sizes to heading tags. Top 2 sizes → h1/h2, rest → p."""
    sizes: set[int] = set()
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    if span["text"].strip():
                        sizes.add(round(span["size"]))

    # Only map the top 2 sizes to headings; everything else renders as <p>.
    # With 3 sizes, the smallest must be body text, not h3.
    # With 1 size, nothing maps to headings — all text renders as <p>.
    if len(sizes) < 2:
        return {}
    tags = ["h1", "h2"]
    return {size: tags[i] for i, size in enumerate(sorted(sizes, reverse=True)[:2])}


def _append_image_block(block: dict, html_parts: list[str]) -> None:
    try:
        img_bytes = block["image"]
        ext = block.get("ext", "png") if block.get("ext") in _ALLOWED_IMG_EXTS else "png"
        b64 = base64.b64encode(img_bytes).decode()
        html_parts.append(f'<img src="data:image/{ext};base64,{b64}">')
    except Exception:
        pass


def _render_text_block(block: dict, size_map: dict[int, str]) -> tuple[str, str | None]:
    """Render a text block to an HTML element. Returns (html_fragment, title_text_or_None)."""
    if "lines" not in block:
        return "", None

    spans_html = []
    first_size = None

    for line in block["lines"]:
        for span in line["spans"]:
            text = _html.escape(span["text"].strip())
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
            if s["text"].strip()
        ).strip()

    return fragment, title_text


def _wrap_span(text: str, flags: int) -> str:
    bold = bool(flags & _BOLD_FLAG)
    italic = bool(flags & _ITALIC_FLAG)
    if bold and italic:
        return f"<strong><em>{text}</em></strong>"
    if bold:
        return f"<strong>{text}</strong>"
    if italic:
        return f"<em>{text}</em>"
    return text

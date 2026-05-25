import fitz
import pytest
from pdf_extractor import extract_pdf


def _make_pdf(*text_entries) -> bytes:
    """Create a single-page PDF with text inserted at staggered y positions."""
    doc = fitz.open()
    page = doc.new_page()
    for i, (text, fontsize) in enumerate(text_entries):
        page.insert_text((72, 72 + i * 40), text, fontsize=fontsize)
    buf = doc.tobytes()
    doc.close()
    return buf


def test_extract_pdf_returns_title():
    # Largest font becomes h1 — its text is the title
    pdf = _make_pdf(("My Title", 24), ("Body text here", 12))
    result = extract_pdf(pdf)
    assert result is not None
    assert result["title"] == "My Title"


def test_extract_pdf_returns_html_with_content():
    pdf = _make_pdf(("Hello World", 12))
    result = extract_pdf(pdf)
    assert result is not None
    assert "Hello World" in result["html"]


def test_extract_pdf_blank_page_returns_none():
    doc = fitz.open()
    doc.new_page()  # no text inserted
    buf = doc.tobytes()
    doc.close()
    assert extract_pdf(buf) is None


def test_extract_pdf_multipage_has_hr():
    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text((72, 100), "Page one content", fontsize=12)
    p2 = doc.new_page()
    p2.insert_text((72, 100), "Page two content", fontsize=12)
    buf = doc.tobytes()
    doc.close()
    result = extract_pdf(buf)
    assert result is not None
    assert "<hr>" in result["html"]


def test_extract_pdf_heading_hierarchy():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 50), "Big Title", fontsize=24)
    page.insert_text((72, 100), "Sub Heading", fontsize=18)
    page.insert_text((72, 150), "Normal text", fontsize=12)
    buf = doc.tobytes()
    doc.close()
    result = extract_pdf(buf)
    assert result is not None
    assert "<h1>" in result["html"]
    assert "<h2>" in result["html"]
    assert "<p>" in result["html"]


def test_extract_pdf_fallback_title_when_no_large_font():
    # Single font size → size_map is empty → all text renders as <p>, no h1 → title fallback
    pdf = _make_pdf(("uniform size text", 12))
    result = extract_pdf(pdf)
    assert result is not None
    assert result["title"] == "Untitled PDF"
    assert "<p>" in result["html"]


def test_extract_pdf_invalid_bytes_returns_none():
    assert extract_pdf(b"not a pdf at all") is None

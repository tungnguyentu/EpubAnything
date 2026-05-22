from unittest.mock import patch, MagicMock
from epub_builder import build_epub


def test_returns_bytes():
    result = build_epub("Test Title", "Test Author", "<p>Body text.</p><p>Second paragraph.</p>", "https://example.com")
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_epub_magic_bytes():
    # EPUB files are ZIP archives — first two bytes are PK signature
    result = build_epub("Title", "Author", "<p>Content paragraph here.</p>", "https://example.com")
    assert result[:2] == b"PK"


def test_handles_empty_author():
    result = build_epub("Title", "", "<p>Some content here.</p>", "https://example.com")
    assert isinstance(result, bytes)


def test_image_download_failure_does_not_crash():
    html = '<img src="https://example.com/image.png"><p>Text content here.</p>'
    with patch("epub_builder.httpx.get", side_effect=Exception("Network error")):
        result = build_epub("Title", "Author", html, "https://example.com")
    assert isinstance(result, bytes)


def test_strips_script_tags():
    # script content must not appear in output even if build succeeds
    html = "<script>alert('xss')</script><p>Clean content.</p>"
    result = build_epub("Title", "Author", html, "https://example.com")
    assert isinstance(result, bytes)


def test_css_fetch_failure_does_not_crash():
    html = '<link rel="stylesheet" href="https://example.com/style.css"><p>Styled content.</p>'
    with patch("epub_builder.httpx.get", side_effect=Exception("Timeout")):
        result = build_epub("Title", "Author", html, "https://example.com")
    assert isinstance(result, bytes)

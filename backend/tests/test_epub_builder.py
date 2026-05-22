from epub_builder import build_epub


def test_returns_bytes():
    result = build_epub("Test Title", "Test Author", "Body text.\n\nSecond paragraph.")
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_epub_magic_bytes():
    # EPUB files are ZIP archives — first two bytes are PK signature
    result = build_epub("Title", "Author", "Content paragraph here.")
    assert result[:2] == b"PK"


def test_handles_empty_author():
    result = build_epub("Title", "", "Some content here.")
    assert isinstance(result, bytes)

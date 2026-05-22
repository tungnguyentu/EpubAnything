import pytest
from site_detector import detect_site_pages, extract_site_title

BASE = "https://example.com/docs/"

NAV_HTML = """<html>
<head><title>My Course</title></head>
<body>
<nav>
  <a href="/docs/lesson-1">Lesson 1</a>
  <a href="/docs/lesson-2">Lesson 2</a>
  <a href="/docs/lesson-3">Lesson 3</a>
</nav>
<p>Welcome to the course.</p>
</body></html>"""

ASIDE_HTML = """<html><body>
<aside>
  <a href="/docs/ch-1">Chapter 1</a>
  <a href="/docs/ch-2">Chapter 2</a>
  <a href="/docs/ch-3">Chapter 3</a>
  <a href="/docs/ch-4">Chapter 4</a>
</aside>
</body></html>"""

ROLE_NAV_HTML = """<html><body>
<div role="navigation">
  <a href="/docs/a">Page A</a>
  <a href="/docs/b">Page B</a>
  <a href="/docs/c">Page C</a>
</div>
</body></html>"""

EXTERNAL_LINKS_HTML = """<html><body>
<nav>
  <a href="https://other.com/page1">External 1</a>
  <a href="https://other.com/page2">External 2</a>
  <a href="https://other.com/page3">External 3</a>
</nav>
</body></html>"""

FRAGMENT_ONLY_HTML = """<html><body>
<nav>
  <a href="#section1">Section 1</a>
  <a href="#section2">Section 2</a>
  <a href="#section3">Section 3</a>
</nav>
</body></html>"""

TOO_FEW_HTML = """<html><body>
<nav>
  <a href="/docs/lesson-1">Lesson 1</a>
  <a href="/docs/lesson-2">Lesson 2</a>
</nav>
</body></html>"""

DUPLICATE_HTML = """<html><body>
<nav>
  <a href="/docs/lesson-1">Lesson 1</a>
  <a href="/docs/lesson-1">Lesson 1 again</a>
  <a href="/docs/lesson-2">Lesson 2</a>
  <a href="/docs/lesson-3">Lesson 3</a>
</nav>
</body></html>"""


def test_detects_nav_links():
    result = detect_site_pages(NAV_HTML, BASE)
    assert result is not None
    assert len(result) == 3
    assert result[0]["title"] == "Lesson 1"
    assert result[0]["url"].endswith("/docs/lesson-1")


def test_detects_aside_links():
    result = detect_site_pages(ASIDE_HTML, BASE)
    assert result is not None
    assert len(result) == 4


def test_detects_role_navigation():
    result = detect_site_pages(ROLE_NAV_HTML, BASE)
    assert result is not None
    assert len(result) == 3


def test_ignores_external_links():
    result = detect_site_pages(EXTERNAL_LINKS_HTML, BASE)
    assert result is None


def test_ignores_fragment_only_links():
    result = detect_site_pages(FRAGMENT_ONLY_HTML, BASE)
    assert result is None


def test_returns_none_when_fewer_than_3_links():
    result = detect_site_pages(TOO_FEW_HTML, BASE)
    assert result is None


def test_deduplicates_urls():
    result = detect_site_pages(DUPLICATE_HTML, BASE)
    assert result is not None
    urls = [p["url"] for p in result]
    assert len(urls) == len(set(urls))
    assert len(result) == 3


def test_skips_base_url_itself():
    html = """<html><body><nav>
      <a href="/docs/">Home</a>
      <a href="/docs/lesson-1">Lesson 1</a>
      <a href="/docs/lesson-2">Lesson 2</a>
      <a href="/docs/lesson-3">Lesson 3</a>
    </nav></body></html>"""
    result = detect_site_pages(html, BASE)
    assert result is not None
    urls = [p["url"] for p in result]
    assert not any(u.rstrip("/") == BASE.rstrip("/") for u in urls)


def test_extract_site_title_from_title_tag():
    html = "<html><head><title>My Course</title></head><body><h1>Other</h1></body></html>"
    assert extract_site_title(html, BASE) == "My Course"


def test_extract_site_title_falls_back_to_h1():
    html = "<html><head></head><body><h1>Course Title</h1></body></html>"
    assert extract_site_title(html, BASE) == "Course Title"


def test_extract_site_title_falls_back_to_hostname():
    html = "<html><head></head><body></body></html>"
    assert extract_site_title(html, "https://example.com/docs/") == "example.com"

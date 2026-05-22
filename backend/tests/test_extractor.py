from extractor import extract_content

RICH_HTML = """
<html>
<head><title>How Python Works</title></head>
<body>
<article>
  <h1>How Python Works</h1>
  <p>Python is an interpreted, high-level programming language created by Guido van Rossum in 1991.
  Its design philosophy emphasizes code readability with the use of significant indentation.</p>
  <p>Python is dynamically typed and garbage-collected. It supports structured, object-oriented,
  and functional programming paradigms and is often described as a batteries-included language
  due to its comprehensive standard library.</p>
  <p>The language is widely used in web development, data science, artificial intelligence,
  scientific computing, and automation. Its simplicity and versatility make it one of the most
  popular programming languages in the world today among both beginners and experts alike.</p>
  <p>Python's syntax allows programmers to express concepts in fewer lines of code than C++ or Java.
  Community support is one of Python's greatest strengths — the Python Package Index hosts hundreds
  of thousands of third-party modules extending the language far beyond its standard library.</p>
  <p>Python's interactive interpreter and REPL make it ideal for experimentation and rapid prototyping.
  Developers can test ideas instantly without a compile step, which dramatically shortens feedback loops
  during development. This interactivity is especially valued in scientific and academic communities
  where exploratory data analysis is common.</p>
  <p>Major companies including Google, Instagram, Spotify, and NASA rely on Python for critical
  infrastructure and research. The language powers machine learning frameworks like TensorFlow and
  PyTorch, web frameworks like Django and FastAPI, and automation tools used across the industry.
  Python's continued growth shows no sign of slowing down as new domains adopt it.</p>
</article>
</body>
</html>
"""

SHORT_HTML = """<html><body><p>Short.</p></body></html>"""


def test_extracts_title():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert "Python" in result["title"]


def test_extracts_text():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert len(result["text"]) > 100


def test_word_count_above_threshold_for_rich_content():
    result = extract_content(RICH_HTML)
    assert result is not None
    assert result["word_count"] >= 200


def test_word_count_below_threshold_for_short_content():
    result = extract_content(SHORT_HTML)
    if result is not None:
        assert result["word_count"] < 200


def test_returns_none_for_empty_html():
    result = extract_content("<html><body></body></html>")
    assert result is None

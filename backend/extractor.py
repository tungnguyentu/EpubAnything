from readability import Document
from bs4 import BeautifulSoup


def extract_content(html: str) -> dict | None:
    doc = Document(html)
    article_html = doc.summary(html_partial=True)

    soup = BeautifulSoup(article_html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    if not text.strip():
        return None

    return {
        "title": doc.title() or "Untitled",
        "author": "",
        "html": article_html,
        "word_count": len(text.split()),
    }

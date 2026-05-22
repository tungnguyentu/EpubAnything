import base64
import io
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from ebooklib import epub


def build_epub(title: str, author: str, html: str, base_url: str) -> bytes:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup.find_all(["script", "iframe", "nav", "header", "footer"]):
        tag.decompose()

    _embed_images(soup, base_url)
    body_html = _inline_css(soup, base_url)

    book = epub.EpubBook()
    book.set_identifier("epubanything-" + title[:20].replace(" ", "-"))
    book.set_title(title)
    book.set_language("en")
    if author:
        book.add_author(author)

    chapter = epub.EpubHtml(title=title, file_name="content.xhtml", lang="en")
    chapter.content = f"<h1>{title}</h1>{body_html}"

    book.add_item(chapter)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav", chapter]

    buffer = io.BytesIO()
    epub.write_epub(buffer, book, {})
    return buffer.getvalue()


def _embed_images(soup: BeautifulSoup, base_url: str) -> None:
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if not src or src.startswith("data:"):
            continue
        img_url = urljoin(base_url, src)
        try:
            resp = httpx.get(img_url, timeout=5, follow_redirects=True)
            resp.raise_for_status()
            mime = resp.headers.get("content-type", "image/jpeg").split(";")[0]
            b64 = base64.b64encode(resp.content).decode()
            img["src"] = f"data:{mime};base64,{b64}"
        except Exception:
            pass


def _inline_css(soup: BeautifulSoup, base_url: str) -> str:
    css_parts = []

    for link in soup.find_all("link", rel="stylesheet"):
        href = link.get("href", "")
        if href:
            css_url = urljoin(base_url, href)
            try:
                resp = httpx.get(css_url, timeout=5, follow_redirects=True)
                resp.raise_for_status()
                css_parts.append(resp.text)
            except Exception:
                pass
        link.decompose()

    for style_tag in soup.find_all("style"):
        css_parts.append(style_tag.string or "")
        style_tag.decompose()

    body_html = str(soup)

    if not css_parts:
        return body_html

    combined_css = "\n".join(css_parts)
    wrapped = f"<html><head><style>{combined_css}</style></head><body>{body_html}</body></html>"
    try:
        import premailer
        return premailer.transform(wrapped)
    except Exception:
        return body_html


def build_site_epub(site_title: str, chapters: list[dict]) -> bytes:
    book = epub.EpubBook()
    book.set_identifier("epubanything-site-" + site_title[:20].replace(" ", "-"))
    book.set_title(site_title)
    book.set_language("en")

    epub_chapters = []
    for i, ch in enumerate(chapters):
        soup = BeautifulSoup(ch["html"], "html.parser")
        for tag in soup.find_all(["script", "iframe", "nav", "header", "footer"]):
            tag.decompose()
        _embed_images(soup, ch["base_url"])
        body_html = _inline_css(soup, ch["base_url"])

        epub_ch = epub.EpubHtml(
            title=ch["title"],
            file_name=f"chapter_{i + 1:03d}.xhtml",
            lang="en",
        )
        epub_ch.content = f"<h1>{ch['title']}</h1>{body_html}"
        book.add_item(epub_ch)
        epub_chapters.append(epub_ch)

    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav"] + epub_chapters
    book.toc = tuple(epub_chapters)

    buffer = io.BytesIO()
    epub.write_epub(buffer, book, {})
    return buffer.getvalue()

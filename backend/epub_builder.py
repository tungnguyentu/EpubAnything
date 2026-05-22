import io
from ebooklib import epub


def build_epub(title: str, author: str, text: str) -> bytes:
    book = epub.EpubBook()
    book.set_identifier("epubanything-" + title[:20].replace(" ", "-"))
    book.set_title(title)
    book.set_language("en")
    if author:
        book.add_author(author)

    paragraphs = "".join(
        f"<p>{p.strip()}</p>"
        for p in text.split("\n\n")
        if p.strip()
    )
    chapter = epub.EpubHtml(title=title, file_name="content.xhtml", lang="en")
    chapter.content = f"<h1>{title}</h1>{paragraphs}"

    book.add_item(chapter)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav", chapter]

    buffer = io.BytesIO()
    epub.write_epub(buffer, book, {})
    return buffer.getvalue()

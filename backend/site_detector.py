from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup


def detect_site_pages(html: str, base_url: str) -> list[dict] | None:
    soup = BeautifulSoup(html, "html.parser")
    base_domain = urlparse(base_url).netloc
    base_normalized = base_url.rstrip("/")

    containers = (
        soup.find_all("nav")
        + soup.find_all("aside")
        + soup.find_all(attrs={"role": "navigation"})
    )

    seen: set[str] = set()
    pages: list[dict] = []

    for container in containers:
        for a in container.find_all("a", href=True):
            href = a["href"].strip()
            if not href or href.startswith("#"):
                continue

            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)

            if parsed.netloc != base_domain:
                continue

            # Strip fragment so #section links to same page are excluded
            clean_url = parsed._replace(fragment="").geturl()

            if clean_url.rstrip("/") == base_normalized:
                continue

            if clean_url in seen:
                continue

            seen.add(clean_url)
            title = a.get_text(strip=True) or parsed.path.rstrip("/").split("/")[-1]
            pages.append({"url": clean_url, "title": title})

    return pages if len(pages) >= 3 else None


def extract_site_title(html: str, base_url: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.find("title")
    h1_tag = soup.find("h1")
    return (
        (title_tag.get_text(strip=True) if title_tag else None)
        or (h1_tag.get_text(strip=True) if h1_tag else None)
        or urlparse(base_url).hostname
        or "Untitled"
    )

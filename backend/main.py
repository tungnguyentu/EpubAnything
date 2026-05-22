from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl

from storage import LOCAL_STORAGE_DIR
from scraper import scrape_url
from extractor import extract_content
from epub_builder import build_epub, build_site_epub
from storage import upload_epub
from site_detector import detect_site_pages, extract_site_title

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


class ConvertRequest(BaseModel):
    url: HttpUrl


class ConvertResponse(BaseModel):
    downloadUrl: str
    expiresAt: str
    warning: bool


class SitePageInfo(BaseModel):
    url: str
    title: str


class SiteInfo(BaseModel):
    siteTitle: str
    pages: list[SitePageInfo]


class SiteDetectedResponse(BaseModel):
    site: SiteInfo


class ConvertSiteRequest(BaseModel):
    pages: list[SitePageInfo]
    siteTitle: str


class ConvertSiteResponse(BaseModel):
    downloadUrl: str
    expiresAt: str


@app.post("/api/convert")
async def convert(req: ConvertRequest) -> ConvertResponse | SiteDetectedResponse:
    try:
        html = await scrape_url(str(req.url))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not load page")

    pages = detect_site_pages(html, str(req.url))
    if pages is not None:
        site_title = extract_site_title(html, str(req.url))
        return SiteDetectedResponse(
            site=SiteInfo(
                siteTitle=site_title,
                pages=[SitePageInfo(url=p["url"], title=p["title"]) for p in pages],
            )
        )

    content = extract_content(html)
    if content is None:
        raise HTTPException(status_code=400, detail="No readable content found")

    warning = content["word_count"] < 200
    epub_bytes = build_epub(content["title"], content["author"], content["html"], str(req.url))

    try:
        download_url, expires_at = upload_epub(epub_bytes, content["title"])
    except Exception:
        raise HTTPException(status_code=500, detail="Storage error, please try again")

    return ConvertResponse(downloadUrl=download_url, expiresAt=expires_at, warning=warning)


@app.post("/api/convert-site", response_model=ConvertSiteResponse)
async def convert_site(req: ConvertSiteRequest):
    chapters = []
    for page in req.pages:
        try:
            html = await scrape_url(page.url)
            content = extract_content(html)
            if content is None:
                continue
            chapters.append({"title": page.title, "html": content["html"], "base_url": page.url})
        except Exception:
            continue

    if not chapters:
        raise HTTPException(status_code=400, detail="No readable content found")

    epub_bytes = build_site_epub(req.siteTitle, chapters)

    try:
        download_url, expires_at = upload_epub(epub_bytes, req.siteTitle)
    except Exception:
        raise HTTPException(status_code=500, detail="Storage error, please try again")

    return ConvertSiteResponse(downloadUrl=download_url, expiresAt=expires_at)


@app.get("/api/files/{filename}")
async def serve_file(filename: str):
    safe = Path(filename).name
    path = LOCAL_STORAGE_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")
    return FileResponse(path, media_type="application/epub+zip", filename=safe)

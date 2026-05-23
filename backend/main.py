import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, HttpUrl

from storage import LOCAL_STORAGE_DIR
from scraper import scrape_url
from extractor import extract_content
from epub_builder import build_epub, build_site_epub
from storage import upload_epub
from site_detector import detect_site_pages, extract_site_title
from database import init_db, deduct_credit
from auth import router as auth_router, get_current_user
from payments import router as payments_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth_router)
app.include_router(payments_router)


@app.on_event("startup")
async def startup():
    init_db()


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


@app.post("/api/convert-site")
async def convert_site(req: ConvertSiteRequest, request: Request):
    user = get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to convert course sites")
    if user["credits"] < 1:
        raise HTTPException(status_code=402, detail="No credits remaining")

    return StreamingResponse(
        _stream_site_conversion(req.pages, req.siteTitle, user["id"]),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream_site_conversion(pages, site_title, user_id):
    chapters = []
    total = len(pages)

    for i, page in enumerate(pages):
        # Emit progress before processing so user sees which page is being fetched
        yield f"data: {json.dumps({'type': 'progress', 'current': i + 1, 'total': total, 'pageTitle': page.title})}\n\n"

        try:
            html = await scrape_url(page.url)
            content = extract_content(html)
            if content is not None:
                chapters.append({"title": page.title, "html": content["html"], "base_url": page.url})
        except Exception:
            pass

    if not chapters:
        yield f"data: {json.dumps({'type': 'error', 'detail': 'No readable content found'})}\n\n"
        return

    epub_bytes = build_site_epub(site_title, chapters)

    try:
        download_url, expires_at = upload_epub(epub_bytes, site_title)
    except Exception:
        yield f"data: {json.dumps({'type': 'error', 'detail': 'Storage error, please try again'})}\n\n"
        return

    if not deduct_credit(user_id):
        yield f"data: {json.dumps({'type': 'error', 'detail': 'Credit deduction failed'})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'done', 'downloadUrl': download_url, 'expiresAt': expires_at})}\n\n"


@app.get("/api/files/{filename}")
async def serve_file(filename: str):
    safe = Path(filename).name
    path = LOCAL_STORAGE_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")
    return FileResponse(path, media_type="application/epub+zip", filename=safe)

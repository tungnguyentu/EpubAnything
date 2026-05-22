from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl

from storage import LOCAL_STORAGE_DIR

from scraper import scrape_url
from extractor import extract_content
from epub_builder import build_epub
from storage import upload_epub

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


@app.post("/api/convert", response_model=ConvertResponse)
async def convert(req: ConvertRequest):
    try:
        html = await scrape_url(str(req.url))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not load page")

    content = extract_content(html)
    if content is None:
        raise HTTPException(status_code=400, detail="No readable content found")

    warning = content["word_count"] < 200
    epub_bytes = build_epub(content["title"], content["author"], content["text"])

    try:
        download_url, expires_at = upload_epub(epub_bytes, content["title"])
    except Exception:
        raise HTTPException(status_code=500, detail="Storage error, please try again")

    return ConvertResponse(downloadUrl=download_url, expiresAt=expires_at, warning=warning)


@app.get("/api/files/{filename}")
async def serve_file(filename: str):
    # Prevent path traversal attacks
    safe = Path(filename).name
    path = LOCAL_STORAGE_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")
    return FileResponse(path, media_type="application/epub+zip", filename=safe)

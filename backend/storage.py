import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3

LOCAL_STORAGE_DIR = Path(__file__).parent / "tmp"


def upload_epub(epub_bytes: bytes, title: str) -> tuple[str, str]:
    safe_title = "".join(c for c in title if c.isalnum() or c in " -_")[:50].strip() or "article"
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")

    if os.environ.get("STORAGE") == "local":
        return _store_local(epub_bytes, safe_title, expires_at)
    return _store_r2(epub_bytes, safe_title, expires_at)


def _store_local(epub_bytes: bytes, safe_title: str, expires_at: str) -> tuple[str, str]:
    LOCAL_STORAGE_DIR.mkdir(exist_ok=True)
    filename = f"{uuid.uuid4().hex[:8]}-{safe_title}.epub"
    (LOCAL_STORAGE_DIR / filename).write_bytes(epub_bytes)
    base_url = os.environ.get("BASE_URL", "http://localhost:8000")
    return f"{base_url}/api/files/{filename}", expires_at


def _store_r2(epub_bytes: bytes, safe_title: str, expires_at: str) -> tuple[str, str]:
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["R2_SECRET_KEY"],
        region_name="auto",
    )
    bucket = os.environ["R2_BUCKET_NAME"]
    key = f"{uuid.uuid4()}/{safe_title}.epub"

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=epub_bytes,
        ContentType="application/epub+zip",
        ContentDisposition=f'attachment; filename="{safe_title}.epub"',
    )
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=86400,
    )
    return url, expires_at

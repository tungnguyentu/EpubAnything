import os
import uuid
from datetime import datetime, timedelta, timezone

import boto3


def upload_epub(epub_bytes: bytes, title: str) -> tuple[str, str]:
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["R2_SECRET_KEY"],
        region_name="auto",
    )
    bucket = os.environ["R2_BUCKET_NAME"]
    safe_title = "".join(c for c in title if c.isalnum() or c in " -_")[:50].strip()
    filename = safe_title or "article"
    key = f"{uuid.uuid4()}/{filename}.epub"

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=epub_bytes,
        ContentType="application/epub+zip",
        ContentDisposition=f'attachment; filename="{filename}.epub"',
    )
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=86400,
    )
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    return url, expires_at

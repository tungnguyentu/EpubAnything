import pytest
from unittest.mock import MagicMock, patch
from storage import upload_epub


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("R2_ACCOUNT_ID", "test-account")
    monkeypatch.setenv("R2_ACCESS_KEY", "test-key")
    monkeypatch.setenv("R2_SECRET_KEY", "test-secret")
    monkeypatch.setenv("R2_BUCKET_NAME", "test-bucket")


@pytest.fixture
def mock_s3():
    s3 = MagicMock()
    s3.generate_presigned_url.return_value = "https://r2.example.com/file.epub?token=abc"
    return s3


def test_returns_url_and_expiry(mock_s3):
    with patch("storage.boto3.client", return_value=mock_s3):
        url, expires_at = upload_epub(b"epub-bytes", "Test Title")
    assert url == "https://r2.example.com/file.epub?token=abc"
    assert "Z" in expires_at


def test_uploads_to_correct_bucket(mock_s3):
    with patch("storage.boto3.client", return_value=mock_s3):
        upload_epub(b"epub-bytes", "My Article")
    call_kwargs = mock_s3.put_object.call_args.kwargs
    assert call_kwargs["Bucket"] == "test-bucket"
    assert call_kwargs["Body"] == b"epub-bytes"
    assert call_kwargs["ContentType"] == "application/epub+zip"


def test_presigned_url_expires_in_24h(mock_s3):
    with patch("storage.boto3.client", return_value=mock_s3):
        upload_epub(b"epub-bytes", "Title")
    call_kwargs = mock_s3.generate_presigned_url.call_args.kwargs
    assert call_kwargs["ExpiresIn"] == 86400

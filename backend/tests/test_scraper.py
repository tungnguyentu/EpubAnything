import pytest
from unittest.mock import AsyncMock, patch
from scraper import scrape_url


@pytest.fixture
def mock_playwright_ctx():
    mock_page = AsyncMock()
    mock_page.content = AsyncMock(return_value="<html><body>Hello</body></html>")
    mock_page.goto = AsyncMock()

    mock_browser = AsyncMock()
    mock_browser.new_page = AsyncMock(return_value=mock_page)
    mock_browser.close = AsyncMock()

    mock_chromium = AsyncMock()
    mock_chromium.launch = AsyncMock(return_value=mock_browser)

    mock_pw = AsyncMock()
    mock_pw.__aenter__ = AsyncMock(return_value=mock_pw)
    mock_pw.__aexit__ = AsyncMock(return_value=None)
    mock_pw.chromium = mock_chromium

    return mock_pw, mock_page


async def test_returns_html_string(mock_playwright_ctx):
    mock_pw, _ = mock_playwright_ctx
    with patch("scraper.async_playwright", return_value=mock_pw):
        result = await scrape_url("https://example.com")
    assert result == "<html><body>Hello</body></html>"


async def test_raises_on_navigation_error(mock_playwright_ctx):
    mock_pw, mock_page = mock_playwright_ctx
    mock_page.goto = AsyncMock(side_effect=Exception("Timeout"))
    with patch("scraper.async_playwright", return_value=mock_pw):
        with pytest.raises(Exception, match="Timeout"):
            await scrape_url("https://example.com")

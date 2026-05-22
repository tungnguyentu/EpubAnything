import asyncio

from playwright.async_api import async_playwright

# Cap concurrent browser launches to avoid OOM under load
_sem = asyncio.Semaphore(5)


async def scrape_url(url: str) -> str:
    async with _sem, async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)
            html = await page.content()
        finally:
            await browser.close()
        return html

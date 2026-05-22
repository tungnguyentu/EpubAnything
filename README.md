# EpubAnything

Paste any URL and download it as a styled EPUB for your e-reader. The EPUB preserves the source article's HTML layout, embeds images as base64, and inlines CSS — with graceful fallback to clean semantic HTML on simpler e-readers.

## Stack

| Layer | Tech |
|---|---|
| Backend | Python · FastAPI · Playwright · readability-lxml · premailer · ebooklib |
| Frontend | Next.js 16 · TypeScript · Tailwind CSS |
| Storage | Cloudflare R2 (production) · local disk (development) |
| Deploy | Docker Compose · Nginx · Let's Encrypt |

## Local Development

**Prerequisites:** Python 3.11+, Node.js 18+

### Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --port 8000 --reload --env-file .env
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment (`backend/.env`)

```env
# Storage mode: "local" writes to backend/tmp/, "r2" uses Cloudflare R2
STORAGE=local
BASE_URL=http://localhost:8000

# Required only when STORAGE=r2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY=your-s3-access-key-id
R2_SECRET_KEY=your-s3-secret-access-key
R2_BUCKET_NAME=epubanything
```

To get R2 credentials: Cloudflare dashboard → **R2** → **Manage R2 API Tokens** → create a token with **Object Read & Write** → use the **S3 API** credentials (Access Key ID + Secret Access Key).

### Run tests

```bash
cd backend
python -m pytest -v
```

## Production Deployment (VPS)

```bash
# 1. Clone and configure
git clone https://github.com/tungnguyentu/EpubAnything.git
cd EpubAnything
cp backend/.env.example backend/.env   # fill in R2 credentials + STORAGE=r2

# 2. Get TLS certificate
certbot certonly --standalone -d yourdomain.com

# 3. Start
docker compose up -d --build
```

Nginx listens on ports 80 and 443. Edit `nginx/nginx.conf` to add your domain and HTTPS redirect.

## How It Works

```
URL → Playwright (scrape) → readability-lxml (extract article HTML)
    → premailer (inline CSS) + httpx (embed images as base64)
    → ebooklib (package as EPUB) → Cloudflare R2 (24h presigned link)
```

- Files expire after **24 hours**
- Pages with fewer than 200 words trigger a warning (JS-heavy or paywalled)
- All image/CSS fetch failures are silent — the EPUB is always generated

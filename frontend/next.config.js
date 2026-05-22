/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    // In production, Nginx routes /api to FastAPI directly.
    // These rewrites only apply in local dev (no Nginx).
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig

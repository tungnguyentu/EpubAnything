import type { Metadata } from "next"
import { Cormorant_Garamond, Jost } from "next/font/google"
import "./globals.css"

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
})

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
})

const BASE_URL = "https://epubanything.site"

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "EpubAnything — Convert any URL to EPUB",
  description: "Convert any URL to EPUB instantly — paste a link from any webpage, article, or blog post and download a clean, e-reader-friendly EPUB file. Free and works with Kindle, Kobo, and any EPUB reader.",
  alternates: {
    canonical: BASE_URL,
  },
  keywords: [
    "epub converter",
    "url to epub",
    "web to epub",
    "article to epub",
    "webpage to epub",
    "kindle epub converter",
    "epub from url",
    "e-reader converter",
  ],
  authors: [{ name: "EpubAnything" }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "EpubAnything — Convert any URL to EPUB",
    description: "Paste a URL from any webpage, article, or blog post and download a clean EPUB for your Kindle, Kobo, or e-reader. Free and instant.",
    url: BASE_URL,
    siteName: "EpubAnything",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "EpubAnything — Convert any URL to EPUB" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EpubAnything — Convert any URL to EPUB",
    description: "Paste a URL from any webpage, article, or blog post and download a clean EPUB for your Kindle, Kobo, or e-reader. Free and instant.",
    images: ["/opengraph-image"],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${jost.variable}`}>{children}</body>
    </html>
  )
}

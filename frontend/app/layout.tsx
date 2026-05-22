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

export const metadata: Metadata = {
  title: "EpubAnything — Convert any URL to EPUB",
  description: "Paste a URL and download it as an EPUB for your e-reader.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${jost.variable}`}>{children}</body>
    </html>
  )
}

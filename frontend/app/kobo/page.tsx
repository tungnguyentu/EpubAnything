import type { Metadata } from "next"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "Kobo EPUB Reader — Read Web Articles on Your Kobo",
  description:
    "Kobo e-readers open EPUB files natively. Convert any URL to EPUB with EpubAnything, transfer it to your Kobo, and read offline.",
  alternates: {
    canonical: "https://epubanything.site/kobo",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to read a web article on a Kobo e-reader",
  description:
    "Convert a webpage to EPUB using EpubAnything, then sideload it onto your Kobo.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Convert the page to EPUB",
      text: "Paste the article URL into EpubAnything and download the EPUB file.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Transfer to your Kobo",
      text: "Connect your Kobo via USB and copy the EPUB file to the device root or use Calibre to manage the transfer.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Read on your Kobo",
      text: "Eject the device and open the book from your library.",
    },
  ],
}

export default function KoboPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ThemeToggle />
      <div className="w-full max-w-xl">
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-1">
            <span className="ornament">✦</span>
            <h1 className="display-title">Kobo</h1>
            <span className="ornament">✦</span>
          </div>
          <div className="title-rule" />
          <p className="subtitle">Read any web article on your Kobo e-reader</p>
        </header>

        <section className="mb-10">
          <p className="body-text mb-4">
            Kobo e-readers support EPUB natively — no conversion or extra software needed on the
            device side. Convert any webpage with{" "}
            <Link href="/" style={{ color: "var(--accent)" }}>EpubAnything</Link> and copy the
            file straight to your Kobo.
          </p>
        </section>

        <div className="title-rule mb-8" />

        <section className="mb-10">
          <h2 className="faq-heading mb-4">How to sideload</h2>
          <ol className="space-y-4">
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">①</span>
              <span>
                <strong>Convert the URL.</strong> Paste the article address into EpubAnything on the{" "}
                <Link href="/" style={{ color: "var(--accent)" }}>homepage</Link> and download the
                EPUB file.
              </span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">②</span>
              <span>
                <strong>Connect via USB.</strong> Plug your Kobo into your computer. It appears as
                a USB drive.
              </span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">③</span>
              <span>
                <strong>Copy the file.</strong> Drag the EPUB into the root folder of the device (or
                any subfolder). Eject safely.
              </span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">④</span>
              <span>
                <strong>Open and read.</strong> The book appears in your Kobo library automatically.
              </span>
            </li>
          </ol>
        </section>

        <div className="title-rule mb-8" />

        <section className="mb-10">
          <h2 className="faq-heading mb-4">Tips</h2>
          <ul className="space-y-3">
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">—</span>
              <span>Calibre is a free desktop app that makes managing e-books across multiple devices easier — useful if you convert often.</span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">—</span>
              <span>Kobo's built-in browser can open web pages, but sideloaded EPUBs give a much better reading experience with custom fonts and margins.</span>
            </li>
          </ul>
        </section>

        <div className="title-rule mb-8" />

        <section className="text-center">
          <Link href="/" className="convert-btn inline-block no-underline">
            Convert a URL to EPUB
          </Link>
          <p className="body-text mt-6">
            Have a Kindle?{" "}
            <Link href="/send-to-kindle" className="underline" style={{ color: "var(--accent)" }}>
              See the Kindle guide
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

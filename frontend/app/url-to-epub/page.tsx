import type { Metadata } from "next"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "URL to EPUB Converter — EpubAnything",
  description:
    "Paste any public URL and get a clean EPUB file in seconds. Works with articles, blog posts, documentation, and more. Free, no account needed.",
  alternates: {
    canonical: "https://epubanything.site/url-to-epub",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to convert a URL to EPUB",
  description:
    "Turn any publicly accessible webpage into a clean EPUB file using EpubAnything.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Paste the URL",
      text: "Copy the address of any publicly accessible article, blog post, or documentation page and paste it into EpubAnything.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Convert",
      text: "Click Convert. The page is fetched, cleaned, and packaged into a standard EPUB 3 file in seconds.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Download and read",
      text: "Download the EPUB and open it on your Kindle, Kobo, or any e-reader app.",
    },
  ],
}

export default function UrlToEpubPage() {
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
            <h1 className="display-title">URL to EPUB</h1>
            <span className="ornament">✦</span>
          </div>
          <div className="title-rule" />
          <p className="subtitle">Turn any webpage into a clean e-reader file</p>
        </header>

        <section className="mb-10">
          <p className="body-text mb-4">
            EpubAnything converts any publicly accessible URL — a news article, blog post,
            documentation page, or long-form essay — into a standard EPUB 3 file you can read
            offline on any device.
          </p>
          <p className="body-text">
            No account required. No ads. Just paste a link and download.
          </p>
        </section>

        <div className="title-rule mb-8" />

        <section className="mb-10">
          <h2 className="faq-heading mb-4">How it works</h2>
          <ol className="space-y-3">
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">①</span>
              <span><strong>Paste a URL.</strong> Any publicly accessible webpage works — articles, blog posts, documentation, or recipes.</span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">②</span>
              <span><strong>Convert.</strong> The page is fetched, cleaned of ads and clutter, and packaged into an EPUB 3 file.</span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">③</span>
              <span><strong>Download.</strong> Save the file and open it on your Kindle, Kobo, or preferred reading app.</span>
            </li>
          </ol>
        </section>

        <div className="title-rule mb-8" />

        <section className="mb-10">
          <h2 className="faq-heading mb-4">Tips</h2>
          <ul className="space-y-3">
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">—</span>
              <span>Pages behind a login or paywall cannot be fetched. Use publicly accessible URLs only.</span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">—</span>
              <span>Long articles and documentation pages convert especially well — formatting is preserved.</span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">—</span>
              <span>Download links are valid for 24 hours after conversion.</span>
            </li>
          </ul>
        </section>

        <div className="title-rule mb-8" />

        <section className="text-center">
          <Link href="/" className="convert-btn inline-block no-underline">
            Convert a URL now
          </Link>
          <p className="body-text mt-6">
            Want to read on a specific device?{" "}
            <Link href="/send-to-kindle" className="underline" style={{ color: "var(--accent)" }}>
              Send to Kindle
            </Link>{" "}
            or{" "}
            <Link href="/kobo" className="underline" style={{ color: "var(--accent)" }}>
              read on Kobo
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

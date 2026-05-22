import type { Metadata } from "next"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "Send to Kindle — Read Web Articles on Your Kindle",
  description:
    "Convert any URL to EPUB with EpubAnything, then send it to your Kindle via Send-to-Kindle or USB. Step-by-step guide.",
  alternates: {
    canonical: "https://epubanything.site/send-to-kindle",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to send a web article to your Kindle",
  description:
    "Convert a webpage to EPUB using EpubAnything, then transfer it to your Kindle.",
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
      name: "Send via Send-to-Kindle or USB",
      text: "Use Amazon's Send-to-Kindle app or email the file to your Kindle address, or connect via USB and copy the file to the Documents folder.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Read on your Kindle",
      text: "Open the book from your Kindle library and read offline.",
    },
  ],
}

export default function SendToKindlePage() {
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
            <h1 className="display-title">Send to Kindle</h1>
            <span className="ornament">✦</span>
          </div>
          <div className="title-rule" />
          <p className="subtitle">Read any web article on your Kindle</p>
        </header>

        <section className="mb-10">
          <p className="body-text mb-4">
            Kindle devices and the Kindle app support EPUB files. Convert any webpage with{" "}
            <Link href="/" style={{ color: "var(--accent)" }}>EpubAnything</Link>, then
            transfer the file to your Kindle using any of the methods below.
          </p>
        </section>

        <div className="title-rule mb-8" />

        <section className="mb-10">
          <h2 className="faq-heading mb-4">Transfer methods</h2>
          <ul className="space-y-4">
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">①</span>
              <span>
                <strong>Send-to-Kindle app.</strong> Install the free Send-to-Kindle desktop or
                mobile app from Amazon, then drag and drop or share the EPUB file to it. The book
                syncs to your device wirelessly.
              </span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">②</span>
              <span>
                <strong>Email.</strong> Every Kindle has a personal <em>@kindle.com</em> address
                (found in Kindle Settings → Your Account). Attach the EPUB to an email and send it
                from an approved address.
              </span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">③</span>
              <span>
                <strong>USB.</strong> Connect your Kindle with a USB cable, open it as a drive, and
                copy the EPUB file to the <em>Documents</em> folder.
              </span>
            </li>
          </ul>
        </section>

        <div className="title-rule mb-8" />

        <section className="mb-10">
          <h2 className="faq-heading mb-4">Tips</h2>
          <ul className="space-y-3">
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">—</span>
              <span>Older Kindle firmware may need a software update to fully support EPUB. Connect to Wi-Fi and update from Settings → Device Options.</span>
            </li>
            <li className="body-text flex gap-3">
              <span className="ornament shrink-0">—</span>
              <span>The Kindle app on iOS and Android opens EPUB files directly from Files or the Files app — no device required.</span>
            </li>
          </ul>
        </section>

        <div className="title-rule mb-8" />

        <section className="text-center">
          <Link href="/" className="convert-btn inline-block no-underline">
            Convert a URL to EPUB
          </Link>
          <p className="body-text mt-6">
            Using a Kobo instead?{" "}
            <Link href="/kobo" className="underline" style={{ color: "var(--accent)" }}>
              See the Kobo guide
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

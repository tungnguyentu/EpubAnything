import type { Metadata } from "next"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "Terms of Service — EpubAnything",
  description: "Terms of service for EpubAnything. Use the service responsibly for personal, non-commercial purposes.",
  alternates: {
    canonical: "https://epubanything.site/terms",
  },
  robots: { index: true, follow: true },
}

const SECTIONS = [
  {
    heading: "Acceptance",
    body: (
      <p>
        By using EpubAnything you agree to these terms. If you do not agree, do not use the
        service.
      </p>
    ),
  },
  {
    heading: "What the service does",
    body: (
      <p>
        EpubAnything fetches publicly accessible web pages and converts them into EPUB files
        for personal reading on e-readers. Single-page conversion is free and requires no
        account. Multi-page course or documentation conversion requires an account and
        credits.
      </p>
    ),
  },
  {
    heading: "Acceptable use",
    body: (
      <>
        <p>You may only convert pages that are publicly accessible and that you have the right
        to access. You agree not to:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Convert pages in violation of their terms of service or copyright</li>
          <li>Use the service to scrape, index, or redistribute content at scale</li>
          <li>Attempt to bypass rate limits, authentication, or credit checks</li>
          <li>Use the service for any unlawful purpose</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Credits and payments",
    body: (
      <>
        <p>
          Credits are purchased through PayPal and are non-refundable except where required
          by law. One credit is consumed per multi-page conversion. Credits do not expire.
        </p>
        <p>
          If a conversion fails before completing, the credit is not charged. If it fails
          mid-conversion, contact us and we will review the case.
        </p>
      </>
    ),
  },
  {
    heading: "Intellectual property",
    body: (
      <p>
        EpubAnything does not claim ownership of any content you convert. You are responsible
        for ensuring that your use of converted content complies with applicable copyright
        law. The EPUB files generated are for personal use only.
      </p>
    ),
  },
  {
    heading: "Availability",
    body: (
      <p>
        We provide EpubAnything on a best-effort basis with no uptime guarantee. We may
        modify or discontinue the service at any time without notice.
      </p>
    ),
  },
  {
    heading: "Limitation of liability",
    body: (
      <p>
        EpubAnything is provided "as is" without warranty of any kind. To the maximum extent
        permitted by law, we are not liable for any damages arising from your use of or
        inability to use the service.
      </p>
    ),
  },
  {
    heading: "Changes",
    body: (
      <p>
        We may update these terms at any time. Continued use of EpubAnything after changes
        are posted constitutes acceptance of the updated terms.
      </p>
    ),
  },
  {
    heading: "Contact",
    body: (
      <p>
        Questions about these terms?{" "}
        <a
          href="mailto:hanguk1006@gmail.com"
          style={{ color: "var(--accent)" }}
          className="underline"
        >
          hanguk1006@gmail.com
        </a>
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <ThemeToggle />
      <div className="w-full max-w-xl">
        <header className="text-center mb-10">
          <Link href="/" className="ornament hover:opacity-100 transition-opacity" style={{ color: "var(--accent)" }}>
            ← EpubAnything
          </Link>
          <div className="title-rule" />
          <h1 className="display-title">Terms of Service</h1>
          <div className="title-rule" />
          <p className="body-text mt-3">Last updated: May 2026</p>
        </header>

        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="faq-q mb-3">{section.heading}</h2>
              <div className="body-text space-y-3">{section.body}</div>
            </section>
          ))}
        </div>

        <footer className="mt-16 text-center">
          <div className="title-rule mb-6" />
          <p className="body-text">
            <Link href="/privacy" style={{ color: "var(--accent)" }} className="underline">
              Privacy Policy
            </Link>
          </p>
        </footer>
      </div>
    </main>
  )
}

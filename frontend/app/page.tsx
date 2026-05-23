import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { ThemeToggle } from "@/components/theme-toggle"

const faqs = [
  {
    question: "Which websites can EpubAnything convert?",
    answer:
      "Any publicly accessible URL works — news articles, blog posts, documentation pages, long-form essays, and recipes. Pages that require a login or sit behind a paywall cannot be fetched.",
    answerNode: (
      <>
        Any publicly accessible URL works — news articles, blog posts, documentation pages,
        long-form essays, and recipes. See{" "}
        <Link href="/url-to-epub" className="underline" style={{ color: "var(--accent)" }}>
          how URL-to-EPUB conversion works
        </Link>
        . Pages that require a login or sit behind a paywall cannot be fetched.
      </>
    ),
  },
  {
    question: "Does the EPUB work on Kindle?",
    answer:
      "Yes. Download the EPUB file and send it to your Kindle using Send-to-Kindle, sideload it via USB, or open it in the Kindle app. Kobo and other EPUB readers work out of the box.",
    answerNode: (
      <>
        Yes. Download the EPUB and{" "}
        <Link href="/send-to-kindle" className="underline" style={{ color: "var(--accent)" }}>
          send it to your Kindle
        </Link>{" "}
        using Send-to-Kindle, sideload via USB, or open it in the Kindle app.{" "}
        <Link href="/kobo" className="underline" style={{ color: "var(--accent)" }}>
          Kobo
        </Link>{" "}
        and other EPUB readers work out of the box.
      </>
    ),
  },
  {
    question: "Is it free? Do I need an account?",
    answer:
      "Completely free — no account, no email address, and no sign-up required. Just paste a URL and download.",
  },
  {
    question: "How long does conversion take?",
    answer:
      "Most conversions finish in under ten seconds. Very long pages or slow servers may take a little longer.",
  },
  {
    question: "Are converted files stored on your servers?",
    answer:
      "Download links are valid for 24 hours. After that the link expires and the file is no longer accessible. No content is shared with third parties.",
  },
]

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://epubanything.site/#app",
      name: "EpubAnything",
      url: "https://epubanything.site",
      description:
        "Convert any publicly accessible URL to a clean EPUB file for your Kindle, Kobo, or e-reader. Free, instant, no account required.",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      "@id": "https://epubanything.site/#faq",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ],
}

export default function Home() {
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
            <h1 className="display-title">EpubAnything</h1>
            <span className="ornament">✦</span>
          </div>
          <div className="title-rule" />
          <p className="subtitle">Convert any webpage to EPUB for your e-reader</p>
        </header>
        <AppShell />
      </div>

      <section className="w-full max-w-xl mt-16 px-1 text-center">
        <div className="title-rule mb-6" />
        <p className="body-text mb-6">
          EpubAnything converts any URL — a news article, blog post, documentation page, or
          long-form essay — into a clean EPUB file you can send to your Kindle, Kobo, or any
          e-reader. No account required, no ads, no tracking.
        </p>
        <ol className="text-left space-y-3">
          <li className="body-text flex gap-3">
            <span className="ornament shrink-0">①</span>
            <span><strong>Paste a URL.</strong> Any publicly accessible webpage works — articles, blog posts, documentation, or recipes.</span>
          </li>
          <li className="body-text flex gap-3">
            <span className="ornament shrink-0">②</span>
            <span><strong>Convert to EPUB.</strong> The page is fetched, cleaned, and packaged into a standard EPUB&nbsp;3 file in seconds.</span>
          </li>
          <li className="body-text flex gap-3">
            <span className="ornament shrink-0">③</span>
            <span><strong>Read offline.</strong> Download the file and sideload it onto your Kindle, Kobo, or preferred e-reader app.</span>
          </li>
        </ol>
      </section>

      <section className="w-full max-w-xl mt-16 px-1">
        <div className="title-rule mb-6" />
        <h2 className="faq-heading">Frequently Asked Questions</h2>
        <dl className="faq-list">
          {faqs.map((faq) => (
            <div key={faq.question} className="faq-item">
              <dt className="faq-q">{faq.question}</dt>
              <dd className="faq-a">{"answerNode" in faq ? faq.answerNode : faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="w-full max-w-xl mt-16 px-1 text-center">
        <div className="title-rule mb-6" />
        <p className="body-text">
          <Link href="/pricing" style={{ color: "var(--accent)" }} className="underline">
            Pricing
          </Link>
          {" · "}
          <Link href="/privacy" style={{ color: "var(--accent)" }} className="underline">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" style={{ color: "var(--accent)" }} className="underline">
            Terms of Service
          </Link>
        </p>
      </footer>
    </main>
  )
}

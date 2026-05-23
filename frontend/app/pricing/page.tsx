import Link from "next/link"
import type { Metadata } from "next"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "Pricing — EpubAnything",
  description: "Simple, transparent pricing. Convert webpages to EPUB free, or buy credits for bulk site conversions.",
}

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for occasional reading.",
    features: [
      "Unlimited single-page conversions",
      "Clean EPUB output",
      "Works on Kindle, Kobo & all e-readers",
      "Download links valid 24 hours",
      "No account required",
    ],
    cta: "Start converting",
    ctaHref: "/",
    highlighted: false,
  },
  {
    name: "Credits",
    price: "$3",
    period: "per 10 credits",
    description: "For researchers and voracious readers.",
    features: [
      "Everything in Free",
      "Full documentation site conversions",
      "Multi-page scraping up to 500 pages",
      "Priority queue",
      "Credits never expire",
    ],
    cta: "Sign in to buy",
    ctaHref: "/api/auth/login",
    highlighted: true,
    badge: "Most popular",
  },
]

const faqs = [
  {
    q: "What counts as one credit?",
    a: "One credit covers a full multi-page site conversion — up to 500 pages scraped and bundled into a single EPUB. Single-page conversions are always free and don't use credits.",
  },
  {
    q: "Do credits expire?",
    a: "No. Credits you purchase stay on your account indefinitely with no expiry date.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major cards and PayPal via the secure PayPal checkout. No card details are stored on our servers.",
  },
  {
    q: "Can I try before I buy?",
    a: "Absolutely. Single-page conversion is completely free — no sign-in, no limits. Buy credits only when you need to convert a whole documentation site or multi-page resource.",
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <ThemeToggle />

      {/* Header */}
      <div className="w-full max-w-2xl text-center mb-14">
        <Link href="/" className="inline-flex items-center gap-2 mb-8 body-text hover:opacity-70 transition-opacity no-underline" style={{ textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to converter
        </Link>
        <div className="flex items-center justify-center gap-3 mb-1">
          <span className="ornament">✦</span>
          <h1 className="display-title">Pricing</h1>
          <span className="ornament">✦</span>
        </div>
        <div className="title-rule" />
        <p className="subtitle">Simple. Transparent. No subscriptions.</p>
      </div>

      {/* Plans */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-5 mb-16">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="pricing-card"
            data-highlighted={plan.highlighted ? "true" : undefined}
          >
            {plan.badge && (
              <div className="pricing-badge">{plan.badge}</div>
            )}
            <div className="pricing-card-accent" data-highlighted={plan.highlighted ? "true" : undefined} />
            <div className="pricing-card-body">
              <div className="pricing-name">{plan.name}</div>
              <div className="pricing-price-row">
                <span className="pricing-price">{plan.price}</span>
                <span className="pricing-period">{plan.period}</span>
              </div>
              <p className="pricing-desc">{plan.description}</p>

              <ul className="pricing-features">
                {plan.features.map((f) => (
                  <li key={f} className="pricing-feature-item">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="pricing-check">
                      <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaHref}
                className={plan.highlighted ? "pricing-cta-primary" : "pricing-cta-secondary"}
              >
                {plan.cta}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Guarantee strip */}
      <div className="w-full max-w-2xl mb-16">
        <div className="pricing-guarantee">
          <div className="pricing-guarantee-icon">✦</div>
          <div>
            <div className="pricing-guarantee-title">No subscription, ever</div>
            <p className="pricing-guarantee-body">
              We don&apos;t believe in recurring charges for a tool you use occasionally.
              Pay once for credits, use them whenever you need, keep them as long as you like.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <section className="w-full max-w-2xl mb-16">
        <div className="title-rule mb-6" />
        <h2 className="faq-heading">Questions about pricing</h2>
        <dl className="faq-list">
          {faqs.map((faq) => (
            <div key={faq.q} className="faq-item">
              <dt className="faq-q">{faq.q}</dt>
              <dd className="faq-a">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="w-full max-w-2xl text-center">
        <div className="title-rule mb-6" />
        <p className="body-text">
          <Link href="/privacy" style={{ color: "var(--accent)" }} className="underline">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" style={{ color: "var(--accent)" }} className="underline">Terms of Service</Link>
          {" · "}
          <Link href="/" style={{ color: "var(--accent)" }} className="underline">Back to converter</Link>
        </p>
      </footer>
    </main>
  )
}

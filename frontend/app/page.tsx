import { UrlForm } from "@/components/url-form"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
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
        <UrlForm />
      </div>
    </main>
  )
}

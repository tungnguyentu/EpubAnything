import { UrlForm } from "@/components/url-form"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">EpubAnything</h1>
          <p className="text-gray-500">
            Paste any URL and download it as an EPUB for your e-reader
          </p>
        </div>
        <UrlForm />
      </div>
    </main>
  )
}

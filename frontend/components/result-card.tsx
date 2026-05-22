type Result = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

export function ResultCard({ result }: { result: Result }) {
  const expiresDate = new Date(result.expiresAt).toLocaleString()

  return (
    <div className="mt-6 p-6 border border-gray-200 rounded-xl space-y-4">
      {result.warning && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          ⚠ Content may be incomplete — this page may be JavaScript-heavy or behind a paywall.
        </div>
      )}

      <a
        href={result.downloadUrl}
        download
        className="block w-full text-center py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
      >
        Download EPUB
      </a>

      <div className="space-y-1">
        <p className="text-sm text-gray-500 font-medium">Shareable link</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={result.downloadUrl}
            readOnly
            className="flex-1 text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 truncate"
          />
          <button
            onClick={() => navigator.clipboard.writeText(result.downloadUrl)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-gray-400">Link expires {expiresDate}</p>
      </div>
    </div>
  )
}

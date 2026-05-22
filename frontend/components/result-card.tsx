type Result = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

type Props = {
  result: Result
  onDownload: () => void
}

export function ResultCard({ result, onDownload }: Props) {
  const expiresDate = new Date(result.expiresAt).toLocaleString()

  function handleCopy() {
    navigator.clipboard.writeText(result.downloadUrl)
  }

  return (
    <div className="result-card">
      <div className="result-card-accent" />
      <div className="result-card-body">
        {result.warning && (
          <div className="warning-banner">
            ⚠ Content may be incomplete — this page may be JavaScript-heavy or behind a paywall.
          </div>
        )}

        <a href={result.downloadUrl} download className="download-btn" onClick={onDownload}>
          Download EPUB
        </a>

        <div>
          <p className="share-label">Shareable link</p>
          <div className="share-row">
            <input
              type="text"
              value={result.downloadUrl}
              readOnly
              className="share-input"
            />
            <button onClick={handleCopy} className="copy-btn">
              Copy
            </button>
          </div>
          <p className="expiry-note">Expires {expiresDate}</p>
        </div>
      </div>
    </div>
  )
}

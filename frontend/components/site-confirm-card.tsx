type SitePage = { url: string; title: string }

type Props = {
  siteTitle: string
  pages: SitePage[]
  onConfirm: () => void
  onCancel: () => void
}

export function SiteConfirmCard({ siteTitle, pages, onConfirm, onCancel }: Props) {
  const estimatedMinutes = Math.ceil(pages.length / 4)

  return (
    <div className="result-card">
      <div className="result-card-accent" />
      <div className="result-card-body">
        <p className="site-confirm-title">{siteTitle}</p>
        <p className="site-confirm-count">Found {pages.length} pages</p>

        {pages.length > 20 && (
          <div className="warning-banner">
            ⚠ This may take a while (~{estimatedMinutes} minutes)
          </div>
        )}

        <ol className="site-page-list">
          {pages.map((p) => (
            <li key={p.url}>{p.title || p.url}</li>
          ))}
        </ol>

        <div className="site-confirm-actions">
          <button onClick={onConfirm} className="download-btn">
            Convert All
          </button>
          <button onClick={onCancel} className="site-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

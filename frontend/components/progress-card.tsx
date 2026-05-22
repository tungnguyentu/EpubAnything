type Props = {
  siteTitle: string
  current: number
  total: number
  pageTitle: string
}

export function ProgressCard({ siteTitle, current, total, pageTitle }: Props) {
  const pct = total > 0 ? (current / total) * 100 : 0
  const label = current === 0 ? "Preparing…" : `Converting page ${current} of ${total}`

  return (
    <div className="result-card">
      <div className="result-card-accent" />
      <div className="result-card-body">
        <p className="progress-site-title">{siteTitle}</p>
        <p className="progress-count">{label}</p>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {pageTitle && <p className="progress-page-label">{pageTitle}</p>}
      </div>
    </div>
  )
}

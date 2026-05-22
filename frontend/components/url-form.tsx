"use client"

import { useRef, useState } from "react"
import { ResultCard } from "./result-card"
import { SiteConfirmCard } from "./site-confirm-card"

type ConvertResult = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

type SitePage = { url: string; title: string }
type SiteInfo = { siteTitle: string; pages: SitePage[] }

type State =
  | { status: "idle" }
  | { status: "converting" }
  | { status: "site-detected"; site: SiteInfo }
  | { status: "site-converting" }
  | { status: "done"; result: ConvertResult }
  | { status: "error"; message: string }

export function UrlForm() {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<State>({ status: "idle" })
  const [flash, setFlash] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setState({ status: "converting" })

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const err = await res.json()
        setState({ status: "error", message: err.detail || "Conversion failed" })
        return
      }

      const data = await res.json()
      if (data.site) {
        setState({ status: "site-detected", site: data.site })
        return
      }

      setState({ status: "done", result: data })
    } catch {
      setState({ status: "error", message: "Network error, please try again" })
    }
  }

  async function handleConfirmSite() {
    if (state.status !== "site-detected") return
    const { site } = state
    setState({ status: "site-converting" })

    try {
      const res = await fetch("/api/convert-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: site.pages, siteTitle: site.siteTitle }),
      })

      if (!res.ok) {
        const err = await res.json()
        setState({ status: "error", message: err.detail || "Conversion failed" })
        return
      }

      const result: ConvertResult = await res.json()
      setState({ status: "done", result: { ...result, warning: false } })
    } catch {
      setState({ status: "error", message: "Network error, please try again" })
    }
  }

  function handleResultAction() {
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setState({ status: "idle" }), 2200)
  }

  const isConverting =
    state.status === "converting" || state.status === "site-converting"

  return (
    <div className="form-wrap w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          required
          disabled={isConverting}
          className="url-input"
        />
        <button
          type="submit"
          disabled={isConverting}
          className={`convert-btn${flash ? " success" : ""}`}
        >
          {isConverting ? (
            <span className="dot-loader">
              <span />
              <span />
              <span />
            </span>
          ) : (
            "Convert"
          )}
        </button>
      </form>

      {state.status === "error" && (
        <p className="error-msg">{state.message}</p>
      )}

      {state.status === "site-detected" && (
        <SiteConfirmCard
          siteTitle={state.site.siteTitle}
          pages={state.site.pages}
          onConfirm={handleConfirmSite}
          onCancel={() => setState({ status: "idle" })}
        />
      )}

      {state.status === "done" && (
        <ResultCard result={state.result} onDownload={handleResultAction} />
      )}
    </div>
  )
}

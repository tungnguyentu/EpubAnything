"use client"

import { useRef, useState } from "react"
import { ResultCard } from "./result-card"
import { SiteConfirmCard } from "./site-confirm-card"
import { ProgressCard } from "./progress-card"

type ConvertResult = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

type SitePage = { url: string; title: string }
type SiteInfo = { siteTitle: string; pages: SitePage[] }

type Progress = { current: number; total: number; pageTitle: string }

type State =
  | { status: "idle" }
  | { status: "converting" }
  | { status: "site-detected"; site: SiteInfo }
  | { status: "site-converting"; siteTitle: string; progress: Progress }
  | { status: "done"; result: ConvertResult }
  | { status: "error"; message: string }

type User = { id: number; email: string; name: string; credits: number }

type Props = { user: User | null }

export function UrlForm({ user }: Props) {
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

    if (!user) {
      setState({ status: "error", message: "Sign in with Google to convert course sites" })
      return
    }
    if (user.credits < 1) {
      setState({ status: "error", message: "No credits remaining — buy a pack to continue" })
      return
    }

    const { site } = state

    setState({
      status: "site-converting",
      siteTitle: site.siteTitle,
      progress: { current: 0, total: site.pages.length, pageTitle: "" },
    })

    const res = await fetch("/api/convert-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pages: site.pages, siteTitle: site.siteTitle }),
    })

    if (!res.ok || !res.body) {
      setState({ status: "error", message: "Network error, please try again" })
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === "progress") {
            setState({
              status: "site-converting",
              siteTitle: site.siteTitle,
              progress: { current: event.current, total: event.total, pageTitle: event.pageTitle },
            })
          } else if (event.type === "done") {
            setState({
              status: "done",
              result: { downloadUrl: event.downloadUrl, expiresAt: event.expiresAt, warning: false },
            })
          } else if (event.type === "error") {
            setState({ status: "error", message: event.detail })
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
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

      {state.status === "site-converting" && (
        <ProgressCard
          siteTitle={state.siteTitle}
          current={state.progress.current}
          total={state.progress.total}
          pageTitle={state.progress.pageTitle}
        />
      )}

      {state.status === "done" && (
        <ResultCard result={state.result} onDownload={handleResultAction} />
      )}
    </div>
  )
}

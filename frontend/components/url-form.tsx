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
  const [mode, setMode] = useState<"url" | "pdf">("url")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<State>({ status: "idle" })
  const [flash, setFlash] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function switchMode(next: "url" | "pdf") {
    setMode(next)
    setState({ status: "idle" })
    setFile(null)
  }

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

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    if (resetTimer.current) clearTimeout(resetTimer.current)

    if (file.size > 50 * 1024 * 1024) {
      setState({ status: "error", message: "File too large (max 50 MB)" })
      return
    }

    setState({ status: "converting" })

    try {
      const form = new FormData()
      form.append("file", file)

      const res = await fetch("/api/convert-pdf", { method: "POST", body: form })

      if (!res.ok) {
        const err = await res.json()
        setState({ status: "error", message: err.detail || "Conversion failed" })
        return
      }

      setState({ status: "done", result: await res.json() })
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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.type === "application/pdf" || dropped?.name.endsWith(".pdf")) {
      setFile(dropped)
      setState({ status: "idle" })
    } else {
      setState({ status: "error", message: "Please drop a PDF file" })
    }
  }

  const isConverting =
    state.status === "converting" || state.status === "site-converting"

  return (
    <div className="form-wrap w-full">
      <div className="input-tabs">
        <button
          type="button"
          className={`input-tab${mode === "url" ? " active" : ""}`}
          onClick={() => switchMode("url")}
        >
          URL
        </button>
        <button
          type="button"
          className={`input-tab${mode === "pdf" ? " active" : ""}`}
          onClick={() => switchMode("pdf")}
        >
          PDF
        </button>
      </div>

      {mode === "url" && (
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
      )}

      {mode === "pdf" && (
        <form onSubmit={handlePdfSubmit} className="flex flex-col gap-2">
          <div
            className={`pdf-drop-zone${dragOver ? " drag-over" : ""}${file ? " has-file" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <span className="pdf-filename">{file.name}</span>
            ) : (
              <span className="pdf-drop-hint">Drop PDF here or</span>
            )}
            <label className="pdf-browse-btn">
              {file ? "Change file" : "Browse"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  setState({ status: "idle" })
                }}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isConverting || !file}
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
      )}

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

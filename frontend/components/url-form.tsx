"use client"

import { useState } from "react"
import { ResultCard } from "./result-card"

type ConvertResult = {
  downloadUrl: string
  expiresAt: string
  warning: boolean
}

type State =
  | { status: "idle" }
  | { status: "converting" }
  | { status: "done"; result: ConvertResult }
  | { status: "error"; message: string }

export function UrlForm() {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<State>({ status: "idle" })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

      const result: ConvertResult = await res.json()
      setState({ status: "done", result })
    } catch {
      setState({ status: "error", message: "Network error, please try again" })
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          required
          disabled={state.status === "converting"}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={state.status === "converting"}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {state.status === "converting" ? "Converting…" : "Convert"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="mt-4 text-sm text-red-600">{state.message}</p>
      )}

      {state.status === "done" && <ResultCard result={state.result} />}
    </div>
  )
}

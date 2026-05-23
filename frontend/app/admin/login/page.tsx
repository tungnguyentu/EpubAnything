"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
  const router = useRouter()
  const [secret, setSecret] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ secret }),
      })
      if (res.status === 401) {
        setError("Invalid password")
      } else if (res.ok) {
        router.push("/admin/dashboard")
      } else {
        setError("Something went wrong")
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 32,
          width: 320,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, color: "var(--fg)", fontFamily: "var(--font-display)" }}>
          Admin Login
        </h1>
        <input
          type="password"
          placeholder="Admin password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
          style={{
            padding: "10px 12px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--bg-raised)",
            color: "var(--fg)",
            fontSize: 14,
          }}
        />
        {error && <p style={{ margin: 0, color: "var(--error)", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            borderRadius: 4,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  )
}

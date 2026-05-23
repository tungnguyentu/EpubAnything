"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: number
  email: string
  name: string | null
  credits: number
  created_at: string
}

interface PageData {
  items: User[]
  total: number
  page: number
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [data, setData] = useState<PageData | null>(null)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<Record<number, string>>({})

  async function loadPage(p: number) {
    const res = await fetch(`/api/admin/users?page=${p}`, { credentials: "include" })
    if (res.status === 401) { router.replace("/admin/login"); return }
    setData(await res.json())
    setPage(p)
  }

  useEffect(() => { loadPage(1) }, [])

  async function saveCredits(userId: number) {
    const credits = editing[userId]
    setSaving(userId)
    setSaveError((prev) => ({ ...prev, [userId]: "" }))
    try {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credits }),
      })
      if (!res.ok) throw new Error("Failed")
      const updated: User = await res.json()
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((u) => (u.id === userId ? updated : u)) }
          : prev
      )
      setEditing((prev) => { const n = { ...prev }; delete n[userId]; return n })
    } catch {
      setSaveError((prev) => ({ ...prev, [userId]: "Save failed" }))
    } finally {
      setSaving(null)
    }
  }

  if (!data) return <p style={{ color: "var(--fg-muted)" }}>Loading…</p>

  const totalPages = Math.ceil(data.total / 20)

  return (
    <div>
      <h2 style={{ margin: "0 0 8px", color: "var(--fg)", fontFamily: "var(--font-display)", fontWeight: 400 }}>
        Users
      </h2>
      <p style={{ margin: "0 0 24px", color: "var(--fg-muted)", fontSize: 13 }}>
        {data.total} total — click a credit value to edit
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Email", "Name", "Credits", "Joined"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--fg-muted)", fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <td style={{ padding: "10px 12px", color: "var(--fg)" }}>{u.email}</td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)" }}>{u.name ?? "—"}</td>
              <td style={{ padding: "10px 12px" }}>
                {editing[u.id] !== undefined ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      value={editing[u.id]}
                      min={0}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [u.id]: Number(e.target.value) }))}
                      style={{
                        width: 64,
                        padding: "3px 6px",
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background: "var(--bg-raised)",
                        color: "var(--fg)",
                        fontSize: 13,
                      }}
                    />
                    <button
                      onClick={() => saveCredits(u.id)}
                      disabled={saving === u.id}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 4,
                        border: "none",
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {saving === u.id ? "…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[u.id]; return n })}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--fg-muted)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                    {saveError[u.id] && (
                      <span style={{ color: "var(--error)", fontSize: 11 }}>{saveError[u.id]}</span>
                    )}
                  </span>
                ) : (
                  <span
                    onClick={() => setEditing((prev) => ({ ...prev, [u.id]: u.credits }))}
                    style={{ color: "var(--accent)", cursor: "pointer", borderBottom: "1px dashed var(--accent)" }}
                    title="Click to edit"
                  >
                    {u.credits}
                  </span>
                )}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontSize: 12 }}>
                {u.created_at.slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
        <button
          onClick={() => loadPage(page - 1)}
          disabled={page <= 1}
          style={{
            padding: "6px 16px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "transparent",
            color: page <= 1 ? "var(--fg-subtle)" : "var(--fg)",
            cursor: page <= 1 ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          ← Prev
        </button>
        <span style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => loadPage(page + 1)}
          disabled={page >= totalPages}
          style={{
            padding: "6px 16px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "transparent",
            color: page >= totalPages ? "var(--fg-subtle)" : "var(--fg)",
            cursor: page >= totalPages ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

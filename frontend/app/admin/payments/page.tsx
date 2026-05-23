"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Transaction {
  id: number
  email: string
  amount_usd: number
  credits_purchased: number
  paypal_order_id: string
  created_at: string
}

interface PageData {
  items: Transaction[]
  total: number
  page: number
}

export default function AdminPaymentsPage() {
  const router = useRouter()
  const [data, setData] = useState<PageData | null>(null)
  const [page, setPage] = useState(1)

  async function loadPage(p: number) {
    const res = await fetch(`/api/admin/payments?page=${p}`, { credentials: "include" })
    if (res.status === 401) { router.replace("/admin/login"); return }
    setData(await res.json())
    setPage(p)
  }

  useEffect(() => { loadPage(1) }, [])

  if (!data) return <p style={{ color: "var(--fg-muted)" }}>Loading…</p>

  const totalPages = Math.ceil(data.total / 20) || 1

  return (
    <div>
      <h2 style={{ margin: "0 0 8px", color: "var(--fg)", fontFamily: "var(--font-display)", fontWeight: 400 }}>
        Payments
      </h2>
      <p style={{ margin: "0 0 24px", color: "var(--fg-muted)", fontSize: 13 }}>
        {data.total} total transactions
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Date", "Email", "Amount", "Credits", "PayPal Order ID"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--fg-muted)", fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontSize: 12 }}>
                {t.created_at.slice(0, 10)}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--fg)" }}>{t.email}</td>
              <td style={{ padding: "10px 12px", color: "var(--accent)" }}>
                ${t.amount_usd.toFixed(2)}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)" }}>{t.credits_purchased}</td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontSize: 11, fontFamily: "monospace" }}>
                {t.paypal_order_id}
              </td>
            </tr>
          ))}
          {data.items.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "20px 12px", color: "var(--fg-muted)", textAlign: "center" }}>
                No transactions yet
              </td>
            </tr>
          )}
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

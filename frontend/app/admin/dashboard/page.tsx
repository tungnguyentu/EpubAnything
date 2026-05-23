"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Stats {
  total_users: number
  total_revenue: number
  paying_users: number
  signups_today: number
}

interface User {
  id: number
  email: string
  name: string | null
  credits: number
  created_at: string
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "20px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-display)" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentUsers, setRecentUsers] = useState<User[]>([])

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats", { credentials: "include" }),
      fetch("/api/admin/users?page=1", { credentials: "include" }),
    ]).then(async ([statsRes, usersRes]) => {
      if (statsRes.status === 401) { router.replace("/admin/login"); return }
      setStats(await statsRes.json())
      const usersData = await usersRes.json()
      setRecentUsers(usersData.items.slice(0, 10))
    })
  }, [])

  if (!stats) return <p style={{ color: "var(--fg-muted)" }}>Loading…</p>

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", color: "var(--fg)", fontFamily: "var(--font-display)", fontWeight: 400 }}>
        Dashboard
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Users" value={stats.total_users} />
        <StatCard label="Total Revenue" value={`$${stats.total_revenue.toFixed(2)}`} />
        <StatCard label="Paying Users" value={stats.paying_users} />
        <StatCard label="Signups Today" value={stats.signups_today} />
      </div>

      <h3 style={{ margin: "0 0 12px", color: "var(--fg)", fontSize: 14, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Recent Users
      </h3>
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
          {recentUsers.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <td style={{ padding: "10px 12px", color: "var(--fg)" }}>{u.email}</td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)" }}>{u.name ?? "—"}</td>
              <td style={{ padding: "10px 12px", color: "var(--accent)" }}>{u.credits}</td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontSize: 12 }}>
                {u.created_at.slice(0, 10)}
              </td>
            </tr>
          ))}
          {recentUsers.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "20px 12px", color: "var(--fg-muted)", textAlign: "center" }}>
                No users yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

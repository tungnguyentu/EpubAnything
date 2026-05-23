"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

function SidebarLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "6px 8px",
        borderRadius: 4,
        fontSize: 13,
        textDecoration: "none",
        color: active ? "var(--accent)" : "var(--fg-muted)",
        background: active ? "var(--bg-raised)" : "transparent",
      }}
    >
      {label}
    </Link>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (pathname === "/admin/login") {
      setReady(true)
      return
    }
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) router.replace("/admin/login")
        else setReady(true)
      })
      .catch(() => router.replace("/admin/login"))
  }, [pathname])

  if (!ready) return null

  if (pathname === "/admin/login") return <>{children}</>

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-ui)" }}>
      <aside
        style={{
          width: 160,
          background: "#111",
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--accent)",
            fontSize: 16,
            marginBottom: 24,
            paddingLeft: 8,
          }}
        >
          ⚙ Admin
        </div>
        <SidebarLink href="/admin/dashboard" label="Dashboard" />
        <SidebarLink href="/admin/users" label="Users" />
        <SidebarLink href="/admin/payments" label="Payments" />
        <div style={{ flex: 1 }} />
        <Link href="/" style={{ fontSize: 12, color: "var(--fg-muted)", textDecoration: "none", paddingLeft: 8 }}>
          ← Back to site
        </Link>
      </aside>
      <main style={{ flex: 1, padding: 28, overflowY: "auto" }}>{children}</main>
    </div>
  )
}

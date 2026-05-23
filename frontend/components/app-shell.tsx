"use client"

import { useEffect, useState } from "react"
import { AuthBar } from "./auth-bar"
import { UrlForm } from "./url-form"

type User = { id: number; email: string; name: string; credits: number }

export function AppShell() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
  }, [])

  return (
    <>
      <AuthBar user={user} onUserChange={setUser} />
      <UrlForm user={user} />
    </>
  )
}

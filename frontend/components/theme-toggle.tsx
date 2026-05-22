"use client"

import { useEffect, useState } from "react"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    const dark = saved ? saved === "dark" : true
    setIsDark(dark)
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light")
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light")
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  return (
    <button onClick={toggle} className="theme-toggle" aria-label="Toggle theme">
      {isDark ? "☀" : "☾"}
    </button>
  )
}

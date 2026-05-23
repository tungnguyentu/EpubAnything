"use client"

import { useState } from "react"
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js"

type User = { id: number; email: string; name: string; credits: number }

type Props = {
  user: User | null
  onUserChange: (user: User | null) => void
}

export function AuthBar({ user, onUserChange }: Props) {
  const [showBuy, setShowBuy] = useState(false)

  if (!user) {
    return (
      <div className="auth-bar">
        <a href="/api/auth/login" className="auth-signin-link">Sign in with Google</a>
      </div>
    )
  }

  return (
    <div className="auth-bar">
      <span className="auth-name">{user.name}</span>
      <span className="credits-badge">{user.credits} credits</span>
      {!showBuy ? (
        <button className="auth-buy-btn" onClick={() => setShowBuy(true)}>
          Buy 10 credits — $3
        </button>
      ) : (
        <div className="paypal-wrap">
          <PayPalScriptProvider
            options={{
              clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
              currency: "USD",
            }}
          >
            <PayPalButtons
              style={{ layout: "horizontal", height: 35 }}
              createOrder={async () => {
                const res = await fetch("/api/checkout", {
                  method: "POST",
                  credentials: "include",
                })
                const data = await res.json()
                return data.orderId
              }}
              onApprove={async (data) => {
                const res = await fetch("/api/checkout/capture", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ orderId: data.orderID }),
                })
                const result = await res.json()
                onUserChange({ ...user, credits: result.credits })
                setShowBuy(false)
              }}
              onCancel={() => setShowBuy(false)}
            />
          </PayPalScriptProvider>
        </div>
      )}
      <a href="/api/auth/logout" className="auth-signout-link">Sign out</a>
    </div>
  )
}

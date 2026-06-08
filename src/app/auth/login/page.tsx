"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin() {
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080A0B",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        padding: "0 24px",
      }}>

        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "48px",
          justifyContent: "center",
        }}>
          <div style={{
            width: "36px",
            height: "36px",
            background: "#A91E22",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>EG</div>
          <div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "24px",
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#fff",
              lineHeight: 1,
            }}>EdelFit</div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#131518",
          border: "0.5px solid rgba(255,255,255,0.06)",
          borderTop: "2px solid #A91E22",
          padding: "36px",
        }}>
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "22px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#fff",
            margin: "0 0 6px",
          }}>Sign In</h1>
          <p style={{
            fontSize: "12px",
            color: "#444",
            margin: "0 0 28px",
            fontFamily: "'Barlow', sans-serif",
            textTransform: "none",
            letterSpacing: "normal",
            fontWeight: 400,
          }}>Enter your credentials to access the portal</p>

          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#444",
              marginBottom: "8px",
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="you@edelgolf.com"
              style={{
                width: "100%",
                background: "#0A0C0D",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: "0",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#fff",
                fontFamily: "'Barlow', sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#444",
              marginBottom: "8px",
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              style={{
                width: "100%",
                background: "#0A0C0D",
                border: "0.5px solid rgba(255,255,255,0.08)",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#fff",
                fontFamily: "'Barlow', sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(169,30,34,0.1)",
              border: "0.5px solid rgba(169,30,34,0.3)",
              padding: "10px 14px",
              marginBottom: "16px",
              fontSize: "12px",
              color: "#A91E22",
              fontFamily: "'Barlow', sans-serif",
            }}>{error}</div>
          )}

          {/* Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "#5A0F11" : "#A91E22",
              border: "none",
              padding: "12px",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </div>

        <p style={{
          textAlign: "center",
          fontSize: "11px",
          color: "#2A2A2A",
          marginTop: "24px",
          fontFamily: "'Barlow', sans-serif",
        }}>
          Access restricted to authorized Edel Golf dealers
        </p>
      </div>
    </div>
  )
}
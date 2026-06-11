"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Save } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  async function handleReset() {
    setError("")
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (password !== confirm) { setError("Passwords do not match."); return }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      // Mark password as changed
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("profiles").update({ password_changed: true }).eq("id", user.id)
      }
      setDone(true)
      setTimeout(() => router.push("/dashboard"), 2000)
    }
    setSaving(false)
  }

  const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "12px 14px", fontSize: "14px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }

  return (
    <div style={{ minHeight: "100vh", background: "#0E1114", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "400px", background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <img src="/edelfit-logo.png" alt="EdelFit" style={{ height: "60px", width: "auto", filter: "invert(1)", display: "block", margin: "0 auto 16px" }} />
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 8px" }}>Set New Password</h1>
          <p style={{ fontSize: "13px", color: "#666", fontFamily: "'Barlow', sans-serif", margin: 0 }}>Choose a new password for your EdelFit account</p>
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "14px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif" }}>✓ Password updated! Redirecting to dashboard...</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#666", marginBottom: "6px" }}>New Password</label>
              <input type="password" style={inputStyle} placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#666", marginBottom: "6px" }}>Confirm Password</label>
              <input type="password" style={{ ...inputStyle, borderColor: confirm && password !== confirm ? "rgba(169,30,34,0.5)" : "rgba(255,255,255,0.12)" }} placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>{error}</div>}
            <button onClick={handleReset} disabled={saving || !password} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <Save size={14} /> {saving ? "Saving..." : "Set Password →"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
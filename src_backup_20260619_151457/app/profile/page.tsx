"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Save, User, AlertTriangle } from "lucide-react"

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [error, setError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(true)

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  })

  const [passwordForm, setPasswordForm] = useState({
    new_password: "",
    confirm_password: "",
  })

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/auth/login"); return }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, password_changed")
      .eq("id", user.id)
      .single()

    setForm({
      full_name: profile?.full_name || "",
      email: user.email || "",
      phone: profile?.phone || "",
    })
    setPasswordChanged(profile?.password_changed ?? true)
    setLoading(false)
  }

  async function handleSaveProfile() {
    setSaving(true)
    setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: profileError } = await supabase.from("profiles").update({
      full_name: form.full_name,
      phone: form.phone,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id)

    if (profileError) {
      setError(profileError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function handleChangePassword() {
    setPasswordError("")
    if (passwordForm.new_password.length < 8) { setPasswordError("Password must be at least 8 characters."); return }
    if (passwordForm.new_password !== passwordForm.confirm_password) { setPasswordError("Passwords do not match."); return }

    setSavingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: passwordForm.new_password })
    if (error) {
      setPasswordError(error.message)
    } else {
      // Mark password as changed
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("profiles").update({ password_changed: true }).eq("id", user.id)
      }
      setPasswordChanged(true)
      setPasswordSaved(true)
      setPasswordForm({ new_password: "", confirm_password: "" })
      setTimeout(() => setPasswordSaved(false), 3000)
    }
    setSavingPassword(false)
  }

  const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "10px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#666", marginBottom: "6px" }

  if (loading) return (
    <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
  )

  const initials = form.full_name ? form.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "EF"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "640px" }}>

      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Account</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>My Profile</h1>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>Update your name, contact details, and password</p>
      </div>

      {/* Temp password warning banner */}
      {!passwordChanged && (
        <div style={{ background: "rgba(196,169,58,0.08)", border: "1px solid rgba(196,169,58,0.3)", padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <AlertTriangle size={20} color="#C4A93A" style={{ flexShrink: 0, marginTop: "1px" }} />
          <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#C4A93A", margin: "0 0 4px" }}>Temporary Password Active</p>
            <p style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
              You are using a temporary password. Please update it below before using EdelFit.
            </p>
          </div>
        </div>
      )}

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "20px" }}>
        <div style={{ width: "56px", height: "56px", background: "#A91E22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em", flexShrink: 0 }}>
          {initials || <User size={22} color="#fff" />}
        </div>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>{form.full_name || "No name set"}</p>
          <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{form.email}</p>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", margin: "4px 0 0" }}>Administrator</p>
        </div>
      </div>

      {/* Profile details */}
      <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666" }}>Profile Details</span>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} placeholder="Gavin Jones" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} placeholder="303-555-0100" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Email (cannot be changed here)</label>
            <input style={{ ...inputStyle, color: "#555", cursor: "not-allowed" }} value={form.email} disabled />
          </div>
          {error && <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>{error}</div>}
          <button onClick={handleSaveProfile} disabled={saving} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: saved ? "#5A9E5A" : saving ? "#333" : "#A91E22", border: "none", padding: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <Save size={14} />{saved ? "Saved!" : saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div style={{ background: "#22262B", border: `0.5px solid ${!passwordChanged ? "rgba(196,169,58,0.3)" : "rgba(255,255,255,0.10)"}`, borderTop: !passwordChanged ? "2px solid #C4A93A" : "0.5px solid rgba(255,255,255,0.10)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: !passwordChanged ? "#C4A93A" : "#666" }}>
            {!passwordChanged ? "⚠ Change Your Password" : "Change Password"}
          </span>
          {passwordSaved && (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5A9E5A" }}>✓ Password Updated</span>
          )}
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {!passwordChanged && (
            <p style={{ fontSize: "12px", color: "#C4A93A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
              Your account is using the temporary password <strong>EdelGolf2026!</strong> — please set a new personal password below.
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={labelStyle}>New Password</label>
              <input type={showPasswords ? "text" : "password"} style={inputStyle} placeholder="Min 8 characters" value={passwordForm.new_password} onChange={e => setPasswordForm(f => ({ ...f, new_password: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <input type={showPasswords ? "text" : "password"} style={{ ...inputStyle, borderColor: passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password ? "rgba(169,30,34,0.5)" : "rgba(255,255,255,0.12)" }} placeholder="Repeat password" value={passwordForm.confirm_password} onChange={e => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" id="show_pw" checked={showPasswords} onChange={e => setShowPasswords(e.target.checked)} style={{ cursor: "pointer" }} />
            <label htmlFor="show_pw" style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Show passwords</label>
          </div>
          {passwordError && <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>{passwordError}</div>}
          <button onClick={handleChangePassword} disabled={savingPassword || !passwordForm.new_password} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: passwordSaved ? "#5A9E5A" : savingPassword ? "#333" : !passwordChanged ? "#C4A93A" : "#A91E22", border: "none", padding: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <Save size={14} />{passwordSaved ? "Password Updated!" : savingPassword ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  )
}
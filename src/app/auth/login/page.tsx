"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Eye, EyeOff } from "lucide-react"

const ADMIN_EMAILS = [
  'gjones@edelgolf.com',
  'nedel@edelgolf.com',
  'abard@edelgolf.com',
  'acalzada@edelgolf.com',
  'accounting@edelgolf.com',
  'alex@pinsandaces.com',
  'edeldev@edelgolf.com',
]

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<"login" | "signup">("login")

  // Login state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState("")

  // Signup state
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupConfirm, setSignupConfirm] = useState("")
  const [signupName, setSignupName] = useState("")
  const [signupCompany, setSignupCompany] = useState("")
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showSignupConfirm, setShowSignupConfirm] = useState(false)
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState("")
  const [signupDone, setSignupDone] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError("")

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        // Check if this is an admin email with no account yet
        if (ADMIN_EMAILS.includes(loginEmail.toLowerCase())) {
          setLoginError("This email is registered as an EdelFit admin. Please check your email for an invitation to set your password.")
        } else {
          setLoginError("Incorrect email or password. If you don't have an account, use the Sign Up tab.")
        }
      } else if (error.message.includes("Email not confirmed")) {
        setLoginError("Please check your email and confirm your account before logging in.")
      } else {
        setLoginError(error.message)
      }
      setLoginLoading(false)
      return
    }

    if (data.user) {
      // Check if admin email
      if (ADMIN_EMAILS.includes(data.user.email || "")) {
        router.push("/dashboard")
      } else {
        // Check approval status
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_approved, role")
          .eq("id", data.user.id)
          .single()

        if (profile?.is_approved) {
          router.push("/portal")
        } else {
          router.push("/portal/pending")
        }
      }
    }
    setLoginLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSignupError("")

    // Validation
    if (!signupName.trim()) { setSignupError("Please enter your name."); return }
    if (!signupEmail.trim()) { setSignupError("Please enter your email."); return }
    if (ADMIN_EMAILS.includes(signupEmail.toLowerCase())) {
      setSignupError("This email is registered as an EdelFit admin. Please use the login tab.")
      return
    }
    if (signupPassword.length < 8) { setSignupError("Password must be at least 8 characters."); return }
    if (signupPassword !== signupConfirm) { setSignupError("Passwords do not match."); return }

    setSignupLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: signupName,
          company: signupCompany,
          role: "dealer",
        }
      }
    })

    if (error) {
      if (error.message.includes("already registered")) {
        setSignupError("An account with this email already exists. Please use the login tab.")
      } else {
        setSignupError(error.message)
      }
      setSignupLoading(false)
      return
    }

    if (data.user) {
      // Create profile
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: signupEmail,
        full_name: signupName,
        role: "dealer",
        is_approved: false,
      }, { onConflict: "id" })

      // Create admin notification
      await supabase.from("portal_notifications").insert({
        type: "new_dealer_signup",
        title: `New Dealer Signup: ${signupName}`,
        message: `${signupName}${signupCompany ? ` from ${signupCompany}` : ""} (${signupEmail}) has requested access. Please review and approve their account.`,
      })
    }

    setSignupLoading(false)
    setSignupDone(true)
  }

  const inputStyle = {
    width: "100%",
    background: "#13161A",
    border: "0.5px solid rgba(255,255,255,0.12)",
    color: "#fff",
    padding: "11px 14px",
    fontSize: "14px",
    fontFamily: "'Barlow', sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
  }

  const labelStyle = {
    display: "block" as const,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "#555",
    marginBottom: "6px",
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0D0F10",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img
            src="/edelfit-logo.png"
            alt="EdelFit"
            style={{ height: "36px", width: "auto", filter: "invert(1)" }}
          />
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "11px", fontWeight: 600,
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: "#333", marginTop: "10px",
          }}>Operations + Dealer Portal</p>
        </div>

        {/* Card */}
        <div style={{
          background: "#1E2226",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderTop: "2px solid #A91E22",
        }}>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
            {(["login", "signup"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setLoginError(""); setSignupError("") }} style={{
                flex: 1,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "12px", fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "14px",
                cursor: "pointer", border: "none",
                background: "transparent",
                color: tab === t ? "#fff" : "#444",
                borderBottom: tab === t ? "2px solid #A91E22" : "2px solid transparent",
                marginBottom: "-1px",
              }}>
                {t === "login" ? "Sign In" : "Request Access"}
              </button>
            ))}
          </div>

          <div style={{ padding: "28px" }}>

            {/* LOGIN TAB */}
            {tab === "login" && (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    type="email"
                    style={inputStyle}
                    placeholder="you@edelgolf.com"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      style={{ ...inputStyle, paddingRight: "44px" }}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#444", cursor: "pointer", padding: "0" }}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", lineHeight: "1.5" }}>
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "13px", fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "#fff",
                    background: loginLoading ? "#333" : "#A91E22",
                    border: "none", padding: "13px",
                    cursor: loginLoading ? "not-allowed" : "pointer",
                    marginTop: "4px",
                  }}
                >
                  {loginLoading ? "Signing in..." : "Sign In →"}
                </button>

                <p style={{ fontSize: "11px", color: "#333", textAlign: "center", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                  Don't have an account?{" "}
                  <span onClick={() => setTab("signup")} style={{ color: "#A91E22", cursor: "pointer", fontWeight: 600 }}>
                    Request access
                  </span>
                </p>
              </form>
            )}

            {/* SIGNUP TAB */}
            {tab === "signup" && !signupDone && (
              <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif", margin: "0 0 4px", lineHeight: "1.5" }}>
                  Create a dealer account to access the Edel Golf ordering portal. Accounts are reviewed and approved by our team.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Your Name *</label>
                    <input style={inputStyle} placeholder="John Smith" value={signupName} onChange={e => setSignupName(e.target.value)} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Company</label>
                    <input style={inputStyle} placeholder="Golf Galaxy" value={signupCompany} onChange={e => setSignupCompany(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Email Address *</label>
                  <input type="email" style={inputStyle} placeholder="john@company.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                </div>

                <div>
                  <label style={labelStyle}>Password * (min 8 characters)</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      style={{ ...inputStyle, paddingRight: "44px" }}
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#444", cursor: "pointer", padding: "0" }}>
                      {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Confirm Password *</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showSignupConfirm ? "text" : "password"}
                      style={{ ...inputStyle, paddingRight: "44px", borderColor: signupConfirm && signupPassword !== signupConfirm ? "rgba(169,30,34,0.5)" : "rgba(255,255,255,0.12)" }}
                      placeholder="••••••••"
                      value={signupConfirm}
                      onChange={e => setSignupConfirm(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowSignupConfirm(!showSignupConfirm)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#444", cursor: "pointer", padding: "0" }}>
                      {showSignupConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {signupConfirm && signupPassword !== signupConfirm && (
                    <p style={{ fontSize: "11px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", marginTop: "4px" }}>Passwords do not match</p>
                  )}
                </div>

                {signupError && (
                  <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", lineHeight: "1.5" }}>
                    {signupError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={signupLoading || (!!signupConfirm && signupPassword !== signupConfirm)}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "13px", fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "#fff",
                    background: signupLoading ? "#333" : "#A91E22",
                    border: "none", padding: "13px",
                    cursor: signupLoading ? "not-allowed" : "pointer",
                    marginTop: "4px",
                  }}
                >
                  {signupLoading ? "Submitting..." : "Request Access →"}
                </button>

                <p style={{ fontSize: "11px", color: "#333", textAlign: "center", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                  Already have an account?{" "}
                  <span onClick={() => setTab("login")} style={{ color: "#A91E22", cursor: "pointer", fontWeight: 600 }}>Sign in</span>
                </p>
              </form>
            )}

            {/* SIGNUP SUCCESS */}
            {tab === "signup" && signupDone && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: "52px", height: "52px", background: "rgba(196,169,58,0.1)", border: "1px solid rgba(196,169,58,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", margin: "0 auto 16px" }}>⏳</div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 10px" }}>Request Submitted</h3>
                <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 8px", lineHeight: "1.6" }}>
                  Your account request has been sent to the Edel Golf team.
                </p>
                <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px", lineHeight: "1.6" }}>
                  Once approved, you'll receive an email and can log in with the password you just set.
                </p>
                <button onClick={() => { setTab("login"); setSignupDone(false) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>
                  Back to Sign In
                </button>
              </div>
            )}

          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: "11px", color: "#222", marginTop: "24px", fontFamily: "'Barlow', sans-serif" }}>
          © {new Date().getFullYear()} Edel Golf · EdelFit Portal
        </p>
      </div>
    </div>
  )
}
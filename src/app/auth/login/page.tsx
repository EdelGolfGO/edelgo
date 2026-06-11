"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Eye, EyeOff, ChevronDown } from "lucide-react"

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
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  // Signup state
  const [signupForm, setSignupForm] = useState({
    first_name: "",
    last_name: "",
    company: "",
    email: "",
    phone: "",
    address_line1: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    dealer_type: "wholesale",
    password: "",
    confirm_password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState("")
  const [signupDone, setSignupDone] = useState(false)
  const [step, setStep] = useState(1) // 2-step signup

  function updateSignup(key: string, value: string) {
    setSignupForm(f => ({ ...f, [key]: value }))
  }

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
        if (ADMIN_EMAILS.includes(loginEmail.toLowerCase())) {
          setLoginError("This is an EdelFit admin account. Please check your email for an invitation to set your password.")
        } else {
          setLoginError("Incorrect email or password. Don't have an account? Use the Request Access tab.")
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
      if (ADMIN_EMAILS.includes(data.user.email || "")) {
        router.push("/dashboard")
      } else {
        const { data: profile } = await supabase.from("profiles").select("is_approved").eq("id", data.user.id).single()
        router.push(profile?.is_approved ? "/portal" : "/portal/pending")
      }
    }
    setLoginLoading(false)
  }

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault()
    setSignupError("")
    if (!signupForm.first_name.trim()) { setSignupError("Please enter your first name."); return }
    if (!signupForm.last_name.trim()) { setSignupError("Please enter your last name."); return }
    if (!signupForm.email.trim()) { setSignupError("Please enter your email."); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupForm.email)) { setSignupError("Please enter a valid email address."); return }
    if (signupForm.phone && !/^[+\d][\d\s\-().]{6,}$/.test(signupForm.phone)) { setSignupError("Please enter a valid phone number."); return }
    if (ADMIN_EMAILS.includes(signupForm.email.toLowerCase())) {
      setSignupError("This email is registered as an EdelFit admin. Please use the Sign In tab.")
      return
    }
    setStep(2)
  }

  async function handleForgotPassword() {
    if (!loginEmail) return
    setForgotLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setForgotSent(true)
    setForgotLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSignupError("")
    if (signupForm.password.length < 8) { setSignupError("Password must be at least 8 characters."); return }
    if (signupForm.password !== signupForm.confirm_password) { setSignupError("Passwords do not match."); return }

    setSignupLoading(true)

    const fullName = `${signupForm.first_name.trim()} ${signupForm.last_name.trim()}`
    const { data, error } = await supabase.auth.signUp({
      email: signupForm.email,
      password: signupForm.password,
      options: {
        data: {
          full_name: fullName,
          company: signupForm.company,
          role: "dealer",
        }
      }
    })

    if (error) {
      setSignupError(error.message.includes("already registered") ? "An account with this email already exists. Please sign in." : error.message)
      setSignupLoading(false)
      return
    }

    if (data.user) {
      // Wait for DB trigger to create the profile first
      await new Promise(resolve => setTimeout(resolve, 600))

      // Update profile with all dealer info
      await supabase.from("profiles").update({
        email: signupForm.email,
        full_name: fullName,
        role: "dealer",
        is_approved: false,
        company: signupForm.company,
        phone: signupForm.phone,
        address_line1: signupForm.address_line1,
        city: signupForm.city,
        state: signupForm.state,
        zip: signupForm.zip,
        country: signupForm.country,
        dealer_type: signupForm.dealer_type,
      }).eq("id", data.user.id)

      // Admin notification
      await supabase.from("portal_notifications").insert({
        type: "new_dealer_signup",
        title: `New Dealer Signup: ${fullName}`,
        message: `${fullName}${signupForm.company ? ` from ${signupForm.company}` : ""} (${signupForm.email}) has requested access. ${signupForm.city ? `Located in ${signupForm.city}, ${signupForm.state}.` : ""}`,
      })
    }

    setSignupLoading(false)
    setSignupDone(true)
  }

  const inputStyle = {
    width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)",
    color: "#fff", padding: "11px 14px", fontSize: "14px",
    fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const,
  }
  const labelStyle = {
    display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em",
    textTransform: "uppercase" as const, color: "#555", marginBottom: "6px",
  }
  const smallInputStyle = { ...inputStyle, padding: "9px 12px", fontSize: "13px" }

  return (
    <div style={{ minHeight: "100vh", background: "#0D0F10", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <img
            src="/edelfit-logo.png"
            alt="EdelFit"
            style={{ height: "90px", width: "auto", filter: "invert(1)", display: "block", margin: "0 auto 16px" }}
          />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#333", marginTop: "4px" }}>Operations + Dealer Portal</p>
        </div>

        <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.08)", borderTop: "2px solid #A91E22" }}>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
            {(["login", "signup"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setLoginError(""); setSignupError(""); setStep(1) }} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "14px", cursor: "pointer", border: "none", background: "transparent", color: tab === t ? "#fff" : "#444", borderBottom: tab === t ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
                {t === "login" ? "Sign In" : "Request Access"}
              </button>
            ))}
          </div>

          <div style={{ padding: "28px" }}>

            {/* LOGIN */}
            {tab === "login" && (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" style={inputStyle} placeholder="you@company.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input type={showLoginPassword ? "text" : "password"} style={{ ...inputStyle, paddingRight: "44px" }} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required autoComplete="current-password" />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#444", cursor: "pointer", padding: 0 }}>
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {loginError && <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", lineHeight: "1.5" }}>{loginError}</div>}
                <button type="submit" disabled={loginLoading} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: loginLoading ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: loginLoading ? "not-allowed" : "pointer", marginTop: "4px" }}>
                  {loginLoading ? "Signing in..." : "Sign In →"}
                </button>
                {forgotSent ? (
                  <p style={{ fontSize: "12px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif", textAlign: "center", margin: "10px 0 0" }}>✓ Password reset email sent — check your inbox</p>
                ) : (
                  <button type="button" onClick={handleForgotPassword} disabled={forgotLoading} style={{ background: "none", border: "none", color: "#555", fontSize: "12px", fontFamily: "'Barlow', sans-serif", cursor: "pointer", textAlign: "center", width: "100%", marginTop: "10px", textDecoration: "underline" }}>
                    {forgotLoading ? "Sending..." : "Forgot password?"}
                  </button>
                )}
                <p style={{ fontSize: "11px", color: "#333", textAlign: "center", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                  Don't have an account? <span onClick={() => setTab("signup")} style={{ color: "#A91E22", cursor: "pointer", fontWeight: 600 }}>Request access</span>
                </p>
              </form>
            )}

            {/* SIGNUP — Step 1: Contact + Company Info */}
            {tab === "signup" && !signupDone && step === 1 && (
              <form onSubmit={handleNextStep} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif", margin: "0 0 4px", lineHeight: "1.5" }}>
                  Create a dealer account to access the Edel Golf ordering portal. Tell us about yourself and your business.
                </p>

                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", margin: "4px 0 -4px" }}>Contact Info</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>First Name *</label>
                    <input style={smallInputStyle} placeholder="John" value={signupForm.first_name} onChange={e => updateSignup("first_name", e.target.value)} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name *</label>
                    <input style={smallInputStyle} placeholder="Smith" value={signupForm.last_name} onChange={e => updateSignup("last_name", e.target.value)} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone *</label>
                    <input style={smallInputStyle} placeholder="+1 303-555-0100" value={signupForm.phone} onChange={e => updateSignup("phone", e.target.value)} required />
                    {signupForm.phone && !/^[+\d][\d\s\-().]{6,}$/.test(signupForm.phone) && (
                      <p style={{ fontSize: "10px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", marginTop: "3px" }}>Enter a valid phone number</p>
                    )}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Email Address *</label>
                  <input type="email" style={smallInputStyle} placeholder="john@company.com" value={signupForm.email} onChange={e => updateSignup("email", e.target.value)} required />
                </div>

                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", margin: "4px 0 -4px" }}>Business Info</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Company Name</label>
                    <input style={smallInputStyle} placeholder="Golf Galaxy Denver" value={signupForm.company} onChange={e => updateSignup("company", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Business Type</label>
                    <select style={{ ...smallInputStyle, cursor: "pointer" }} value={signupForm.dealer_type} onChange={e => updateSignup("dealer_type", e.target.value)}>
                      <option value="wholesale">Wholesale / Retail</option>
                      <option value="fitter">Club Fitter</option>
                      <option value="distributor">Distributor</option>
                      <option value="international">International</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Business Address</label>
                  <input style={smallInputStyle} placeholder="123 Main St" value={signupForm.address_line1} onChange={e => updateSignup("address_line1", e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input style={smallInputStyle} placeholder="Denver" value={signupForm.city} onChange={e => updateSignup("city", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <input style={smallInputStyle} placeholder="CO" value={signupForm.state} onChange={e => updateSignup("state", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP</label>
                    <input style={smallInputStyle} placeholder="80202" value={signupForm.zip} onChange={e => updateSignup("zip", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <input style={smallInputStyle} placeholder="US" value={signupForm.country} onChange={e => updateSignup("country", e.target.value)} />
                  </div>
                </div>

                {signupError && <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>{signupError}</div>}

                <button type="submit" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "13px", cursor: "pointer", marginTop: "4px" }}>
                  Continue to Password →
                </button>
                <p style={{ fontSize: "11px", color: "#333", textAlign: "center", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                  Already have an account? <span onClick={() => setTab("login")} style={{ color: "#A91E22", cursor: "pointer", fontWeight: 600 }}>Sign in</span>
                </p>
              </form>
            )}

            {/* SIGNUP — Step 2: Password */}
            {tab === "signup" && !signupDone && step === 2 && (
              <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ background: "#13161A", border: "0.5px solid rgba(255,255,255,0.06)", padding: "12px 14px", marginBottom: "4px" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A9E5A", margin: "0 0 4px" }}>✓ Account Info Saved</p>
                  <p style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{signupForm.first_name} {signupForm.last_name} · {signupForm.email}{signupForm.company ? ` · ${signupForm.company}` : ""}</p>
                </div>

                <div>
                  <label style={labelStyle}>Create Password * (min 8 characters)</label>
                  <div style={{ position: "relative" }}>
                    <input type={showPassword ? "text" : "password"} style={{ ...inputStyle, paddingRight: "44px" }} placeholder="••••••••" value={signupForm.password} onChange={e => updateSignup("password", e.target.value)} required minLength={8} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#444", cursor: "pointer", padding: 0 }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Confirm Password *</label>
                  <div style={{ position: "relative" }}>
                    <input type={showConfirm ? "text" : "password"} style={{ ...inputStyle, paddingRight: "44px", borderColor: signupForm.confirm_password && signupForm.password !== signupForm.confirm_password ? "rgba(169,30,34,0.5)" : "rgba(255,255,255,0.12)" }} placeholder="••••••••" value={signupForm.confirm_password} onChange={e => updateSignup("confirm_password", e.target.value)} required />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#444", cursor: "pointer", padding: 0 }}>
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {signupForm.confirm_password && signupForm.password !== signupForm.confirm_password && (
                    <p style={{ fontSize: "11px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", marginTop: "4px" }}>Passwords do not match</p>
                  )}
                </div>

                {signupError && <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>{signupError}</div>}

                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button type="button" onClick={() => setStep(1)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", background: "transparent", border: "1px solid #333", padding: "11px 16px", cursor: "pointer" }}>← Back</button>
                  <button type="submit" disabled={signupLoading || (!!signupForm.confirm_password && signupForm.password !== signupForm.confirm_password)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: signupLoading ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: signupLoading ? "not-allowed" : "pointer" }}>
                    {signupLoading ? "Submitting..." : "Request Access →"}
                  </button>
                </div>
              </form>
            )}

            {/* SIGNUP SUCCESS */}
            {tab === "signup" && signupDone && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: "52px", height: "52px", background: "rgba(196,169,58,0.1)", border: "1px solid rgba(196,169,58,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", margin: "0 auto 16px" }}>⏳</div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 10px" }}>Request Submitted</h3>
                <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 8px", lineHeight: "1.6" }}>Your account request has been sent to the Edel Golf team.</p>
                <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px", lineHeight: "1.6" }}>Once approved, you can log in with the password you just set.</p>
                <button onClick={() => { setTab("login"); setSignupDone(false); setStep(1) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>Back to Sign In</button>
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
"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Clock } from "lucide-react"

export default function PortalPendingPage() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div style={{ minHeight: "100vh", background: "#262B32", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #C4A93A", padding: "48px", maxWidth: "480px", width: "100%", textAlign: "center" }}>
        <img src="/edelfit-logo.png" alt="EdelFit" style={{ height: "32px", width: "auto", filter: "invert(1)", margin: "0 auto 32px" }} />

        <div style={{ width: "56px", height: "56px", background: "rgba(196,169,58,0.1)", border: "1px solid rgba(196,169,58,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Clock size={24} color="#C4A93A" />
        </div>

        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 12px" }}>
          Account Pending Approval
        </h1>

        <p style={{ fontSize: "14px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: "0 0 8px", lineHeight: "1.6" }}>
          Your account has been created and is awaiting approval from the Edel Golf team.
        </p>

        <p style={{ fontSize: "13px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "0 0 32px", lineHeight: "1.6" }}>
          You'll receive an email once your account is approved and your pricing tier has been set. This typically takes 1-2 business days.
        </p>

        <p style={{ fontSize: "12px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>
          Questions? Contact us at <span style={{ color: "#6A9CC8" }}>dealers@edelgolf.com</span>
        </p>

        <button onClick={handleSignOut} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B5BAC2", background: "transparent", border: "1px solid #666C75", padding: "10px 24px", cursor: "pointer" }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
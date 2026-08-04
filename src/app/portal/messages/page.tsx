"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import MessageThread from "@/components/dealers/MessageThread"

export default function PortalMessagesPage() {
  const [dealerId, setDealerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from("profiles").select("dealer_id").eq("id", user.id).single()
    setDealerId(profile?.dealer_id || null)
    setLoading(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Dealer Portal</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Messages</h1>
        <p style={{ fontSize: "12px", color: "#B5BAC2", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
          General questions for the Edel Golf team. For questions about a specific order, use that order's thread under My Orders.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
      ) : !dealerId ? (
        <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#787E87", margin: 0 }}>Account Not Linked</p>
          <p style={{ fontSize: "13px", color: "#666C75", fontFamily: "'Barlow', sans-serif", margin: "8px 0 0" }}>Your account isn't linked to a dealer record yet.</p>
        </div>
      ) : (
        <MessageThread dealerId={dealerId} currentUserRole="dealer" />
      )}
    </div>
  )
}
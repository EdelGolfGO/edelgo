"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { CheckCircle, XCircle, User, Mail, Building2 } from "lucide-react"

type PendingDealer = {
  id: string
  email: string
  full_name: string
  role: string
  is_approved: boolean
  pricing_tier: string
  dealer_id: string | null
  created_at: string
}

type Dealer = {
  id: string
  name: string
  company: string
}

const PRICING_TIERS = ["wholesaler", "fitter", "distributor"]

export default function DealerApprovalsPage() {
  const [pending, setPending] = useState<PendingDealer[]>([])
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, { pricing_tier: string; dealer_id: string }>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const [pendingResult, dealersResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "dealer").eq("is_approved", false).order("created_at", { ascending: false }),
      supabase.from("dealers").select("id, name, company").order("name"),
    ])
    if (pendingResult.data) {
      setPending(pendingResult.data)
      const initial: Record<string, { pricing_tier: string; dealer_id: string }> = {}
      pendingResult.data.forEach(p => {
        initial[p.id] = { pricing_tier: "wholesaler", dealer_id: "" }
      })
      setSelections(initial)
    }
    if (dealersResult.data) setDealers(dealersResult.data)
    setLoading(false)
  }

  async function handleApprove(profile: PendingDealer) {
    setApproving(profile.id)
    const supabase = createClient()
    const sel = selections[profile.id]

    const updatePayload: any = {
      is_approved: true,
      pricing_tier: sel.pricing_tier,
      updated_at: new Date().toISOString(),
    }
    if (sel.dealer_id) updatePayload.dealer_id = sel.dealer_id

    await supabase.from("profiles").update(updatePayload).eq("id", profile.id)

    // Mark notification as read
    await supabase.from("portal_notifications")
      .update({ is_read: true })
      .eq("type", "new_dealer_signup")
      .ilike("message", `%${profile.email}%`)

    setApproving(null)
    loadData()
  }

  async function handleDeny(profile: PendingDealer) {
    setApproving(profile.id)
    const supabase = createClient()
    await supabase.from("profiles").update({ role: "denied", updated_at: new Date().toISOString() }).eq("id", profile.id)
    await supabase.from("portal_notifications").update({ is_read: true }).eq("type", "new_dealer_signup").ilike("message", `%${profile.email}%`)
    setApproving(null)
    loadData()
  }

  const inputStyle = { background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "100%", boxSizing: "border-box" as const, cursor: "pointer" }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#555", marginBottom: "4px" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Admin</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Dealer Approvals</h1>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
          {pending.length} account{pending.length !== 1 ? "s" : ""} pending approval
        </p>
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
      ) : pending.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(90,158,90,0.2)", borderTop: "2px solid #5A9E5A", padding: "48px 20px", textAlign: "center" }}>
          <CheckCircle size={32} color="#5A9E5A" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5A9E5A", margin: "0 0 6px" }}>All Clear</p>
          <p style={{ fontSize: "13px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>No dealer accounts pending approval.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {pending.map(profile => {
            const sel = selections[profile.id] || { pricing_tier: "wholesaler", dealer_id: "" }
            return (
              <div key={profile.id} style={{ background: "#22262B", border: "0.5px solid rgba(196,169,58,0.25)", borderTop: "2px solid #C4A93A" }}>
                <div style={{ padding: "16px 20px" }}>

                  {/* Dealer info */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
                    <div style={{ width: "44px", height: "44px", background: "rgba(196,169,58,0.1)", border: "1px solid rgba(196,169,58,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <User size={20} color="#C4A93A" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "0.04em" }}>{profile.full_name || "Unknown"}</p>
                      <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Mail size={11} color="#555" />
                          <span style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif" }}>{profile.email}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: "4px 0 0" }}>
                        Requested {new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4A93A", background: "rgba(196,169,58,0.1)", padding: "3px 10px" }}>Pending</span>
                  </div>

                  {/* Approval settings */}
                  <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.06)", padding: "14px", marginBottom: "14px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Set Account Details Before Approving</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={labelStyle}>Pricing Tier *</label>
                        <select
                          style={inputStyle}
                          value={sel.pricing_tier}
                          onChange={e => setSelections(prev => ({ ...prev, [profile.id]: { ...prev[profile.id], pricing_tier: e.target.value } }))}
                        >
                          {PRICING_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Link to Existing Dealer (optional)</label>
                        <select
                          style={inputStyle}
                          value={sel.dealer_id}
                          onChange={e => setSelections(prev => ({ ...prev, [profile.id]: { ...prev[profile.id], dealer_id: e.target.value } }))}
                        >
                          <option value="">Create new dealer record</option>
                          {dealers.map(d => <option key={d.id} value={d.id}>{d.company || d.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleDeny(profile)}
                      disabled={approving === profile.id}
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <XCircle size={13} /> Deny
                    </button>
                    <button
                      onClick={() => handleApprove(profile)}
                      disabled={approving === profile.id}
                      style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: approving === profile.id ? "#333" : "#5A9E5A", border: "none", padding: "10px", cursor: approving === profile.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                      <CheckCircle size={14} />
                      {approving === profile.id ? "Approving..." : `Approve — Set as ${sel.pricing_tier.charAt(0).toUpperCase() + sel.pricing_tier.slice(1)}`}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
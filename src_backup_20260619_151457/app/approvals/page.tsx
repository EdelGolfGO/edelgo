"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { CheckCircle, XCircle, User, Mail, Building2, Phone } from "lucide-react"

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

const PRICING_TIERS = [
  { value: "wholesaler", label: "Tier 1 — Wholesaler (60% of MSRP)" },
  { value: "fitter", label: "Tier 2 — Fitter (70% of MSRP)" },
  { value: "distributor", label: "Tier 3 — Distributor (Custom)" },
]

const DEALER_TYPES = [
  { value: "wholesale", label: "Wholesale" },
  { value: "fitter", label: "Fitter" },
  { value: "distributor", label: "Distributor" },
  { value: "retail", label: "Retail" },
  { value: "international", label: "International" },
]

const PAYMENT_TERMS = [
  { value: "prepay", label: "Prepay" },
  { value: "net15", label: "Net 15" },
  { value: "net30", label: "Net 30" },
  { value: "net60", label: "Net 60" },
  { value: "50_50", label: "50/50" },
]

const emptyApprovalForm = {
  pricing_tier: "wholesaler",
  dealer_type: "wholesale",
  payment_terms: "net30",
  company: "",
  phone: "",
  address_line1: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  credit_limit: "",
  discount_percent: "",
  tax_exempt: false,
  notes: "",
  link_existing: false,
  existing_dealer_id: "",
}

export default function DealerApprovalsPage() {
  const [pending, setPending] = useState<PendingDealer[]>([])
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, any>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

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
      const initial: Record<string, any> = {}
      pendingResult.data.forEach((p: any) => {
        initial[p.id] = {
          ...emptyApprovalForm,
          // Pre-fill from what dealer entered at signup
          company: p.company || "",
          phone: p.phone || "",
          address_line1: p.address_line1 || "",
          city: p.city || "",
          state: p.state || "",
          zip: p.zip || "",
          country: p.country || "US",
          dealer_type: p.dealer_type || "wholesale",
        }
      })
      setForms(initial)
      if (pendingResult.data.length > 0) setExpanded(pendingResult.data[0].id)
    }
    if (dealersResult.data) setDealers(dealersResult.data)
    setLoading(false)
  }

  function updateForm(profileId: string, key: string, value: any) {
    setForms(prev => ({ ...prev, [profileId]: { ...prev[profileId], [key]: value } }))
  }

  async function handleApprove(profile: PendingDealer) {
    setApproving(profile.id)
    const supabase = createClient()
    const form = forms[profile.id]

    let dealerId = form.link_existing ? form.existing_dealer_id : null

    // Create new dealer record if not linking to existing
    if (!form.link_existing) {
      const { data: newDealer, error: dealerError } = await supabase.from("dealers").insert({
        name: profile.full_name,
        company: form.company || profile.full_name,
        email: profile.email,
        phone: form.phone || null,
        address_line1: form.address_line1 || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        country: form.country || "US",
        dealer_type: form.dealer_type,
        payment_terms: form.payment_terms,
        credit_limit: parseFloat(form.credit_limit) || 0,
        discount_percent: parseFloat(form.discount_percent) || 0,
        tax_exempt: form.tax_exempt,
        notes: form.notes || null,
        status: "active",
      }).select("id").single()
      if (dealerError) console.error("Dealer insert error:", dealerError)
      if (newDealer) dealerId = newDealer.id
    }

    // Update profile — approve with pricing tier and dealer link
    await supabase.from("profiles").update({
      is_approved: true,
      pricing_tier: form.pricing_tier,
      dealer_id: dealerId,
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id)

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

  const inputStyle = { background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "100%", boxSizing: "border-box" as const }
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
            const form = forms[profile.id] || emptyApprovalForm
            const isExpanded = expanded === profile.id

            return (
              <div key={profile.id} style={{ background: "#22262B", border: "0.5px solid rgba(196,169,58,0.25)", borderTop: "2px solid #C4A93A" }}>

                {/* Header row - always visible */}
                <div onClick={() => setExpanded(isExpanded ? null : profile.id)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }}>
                  <div style={{ width: "40px", height: "40px", background: "rgba(196,169,58,0.1)", border: "1px solid rgba(196,169,58,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User size={18} color="#C4A93A" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>{profile.full_name || "Unknown"}</p>
                    <div style={{ display: "flex", gap: "12px", marginTop: "3px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Mail size={10} color="#555" />
                        <span style={{ fontSize: "11px", color: "#777", fontFamily: "'Barlow', sans-serif" }}>{profile.email}</span>
                      </div>
                      <span style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif" }}>
                        {new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4A93A", background: "rgba(196,169,58,0.1)", padding: "3px 10px" }}>
                    {isExpanded ? "▲ Collapse" : "▼ Review"}
                  </span>
                </div>

                {/* Expanded form */}
                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", padding: "20px" }}>

                    {/* Section: Account settings */}
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#A91E22", marginBottom: "12px" }}>Account Settings</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                      <div>
                        <label style={labelStyle}>Pricing Tier *</label>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.pricing_tier} onChange={e => updateForm(profile.id, "pricing_tier", e.target.value)}>
                          {PRICING_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Dealer Type *</label>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.dealer_type} onChange={e => updateForm(profile.id, "dealer_type", e.target.value)}>
                          {DEALER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Payment Terms *</label>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.payment_terms} onChange={e => updateForm(profile.id, "payment_terms", e.target.value)}>
                          {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Section: Dealer record */}
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Dealer Record</p>

                    {/* Link to existing toggle */}
                    <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                      <button onClick={() => updateForm(profile.id, "link_existing", false)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: !form.link_existing ? "#fff" : "#555", background: !form.link_existing ? "#A91E22" : "transparent", border: !form.link_existing ? "none" : "1px solid #333", padding: "6px 14px", cursor: "pointer" }}>
                        Create New Dealer Record
                      </button>
                      <button onClick={() => updateForm(profile.id, "link_existing", true)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: form.link_existing ? "#fff" : "#555", background: form.link_existing ? "#A91E22" : "transparent", border: form.link_existing ? "none" : "1px solid #333", padding: "6px 14px", cursor: "pointer" }}>
                        Link to Existing Dealer
                      </button>
                    </div>

                    {form.link_existing ? (
                      <div style={{ marginBottom: "20px" }}>
                        <label style={labelStyle}>Select Existing Dealer</label>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.existing_dealer_id} onChange={e => updateForm(profile.id, "existing_dealer_id", e.target.value)}>
                          <option value="">Select dealer...</option>
                          {dealers.map(d => <option key={d.id} value={d.id}>{d.company || d.name}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div>
                            <label style={labelStyle}>Company Name</label>
                            <input style={inputStyle} placeholder="Golf Galaxy Denver" value={form.company} onChange={e => updateForm(profile.id, "company", e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>Phone</label>
                            <input style={inputStyle} placeholder="303-555-0100" value={form.phone} onChange={e => updateForm(profile.id, "phone", e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Address</label>
                          <input style={inputStyle} placeholder="123 Main St" value={form.address_line1} onChange={e => updateForm(profile.id, "address_line1", e.target.value)} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px" }}>
                          <div>
                            <label style={labelStyle}>City</label>
                            <input style={inputStyle} placeholder="Denver" value={form.city} onChange={e => updateForm(profile.id, "city", e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>State</label>
                            <input style={inputStyle} placeholder="CO" value={form.state} onChange={e => updateForm(profile.id, "state", e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>ZIP</label>
                            <input style={inputStyle} placeholder="80202" value={form.zip} onChange={e => updateForm(profile.id, "zip", e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>Country</label>
                            <input style={inputStyle} placeholder="US" value={form.country} onChange={e => updateForm(profile.id, "country", e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div>
                            <label style={labelStyle}>Credit Limit ($)</label>
                            <input type="number" style={inputStyle} placeholder="5000" value={form.credit_limit} onChange={e => updateForm(profile.id, "credit_limit", e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>Discount %</label>
                            <input type="number" style={inputStyle} placeholder="0" value={form.discount_percent} onChange={e => updateForm(profile.id, "discount_percent", e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input type="checkbox" id={`tax-${profile.id}`} checked={form.tax_exempt} onChange={e => updateForm(profile.id, "tax_exempt", e.target.checked)} style={{ cursor: "pointer" }} />
                          <label htmlFor={`tax-${profile.id}`} style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Tax Exempt</label>
                        </div>
                        <div>
                          <label style={labelStyle}>Internal Notes</label>
                          <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} placeholder="Any notes about this dealer..." value={form.notes} onChange={e => updateForm(profile.id, "notes", e.target.value)} />
                        </div>
                      </div>
                    )}

                    {/* Summary of what will be set */}
                    <div style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.06)", padding: "12px 16px", marginBottom: "16px", display: "flex", gap: "24px" }}>
                      <div>
                        <p style={labelStyle}>Pricing</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#6A9CC8", margin: 0 }}>{PRICING_TIERS.find(t => t.value === form.pricing_tier)?.label}</p>
                      </div>
                      <div>
                        <p style={labelStyle}>Type</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", margin: 0 }}>{DEALER_TYPES.find(t => t.value === form.dealer_type)?.label}</p>
                      </div>
                      <div>
                        <p style={labelStyle}>Terms</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", margin: 0 }}>{PAYMENT_TERMS.find(t => t.value === form.payment_terms)?.label}</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button onClick={() => handleDeny(profile)} disabled={approving === profile.id} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "10px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <XCircle size={13} /> Deny Access
                      </button>
                      <button onClick={() => handleApprove(profile)} disabled={approving === profile.id} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: approving === profile.id ? "#333" : "#5A9E5A", border: "none", padding: "11px", cursor: approving === profile.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <CheckCircle size={15} />
                        {approving === profile.id ? "Approving..." : "Approve & Create Dealer Record →"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
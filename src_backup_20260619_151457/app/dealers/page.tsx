"use client"

import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, Mail, Phone, MapPin, CreditCard, Pencil, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Dealer = {
  id: string
  name: string
  company: string
  email: string
  phone: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip: string
  country: string
  dealer_type: string
  status: string
  payment_terms: string
  credit_limit: number
  discount_percent: number
  tax_exempt: boolean
  tax_id: string
  notes: string
}

const DEALER_TYPES = ["wholesale", "distributor", "fitter", "retail", "international"]
const PAYMENT_TERMS = ["prepay", "net15", "net30", "net60", "50_50"]
const STATUS_OPTIONS = ["active", "inactive", "pending"]

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  wholesale:     { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  distributor:   { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
  fitter:        { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)" },
  retail:        { color: "#888",    bg: "rgba(136,136,136,0.1)" },
  international: { color: "#A91E22", bg: "rgba(169,30,34,0.1)" },
}

const emptyForm = {
  name: "", company: "", email: "", phone: "",
  address_line1: "", address_line2: "", city: "", state: "", zip: "", country: "US",
  dealer_type: "wholesale", status: "active", payment_terms: "net30",
  credit_limit: "", discount_percent: "", tax_exempt: false, tax_id: "", notes: "",
}

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")
  const [deleteConfirm, setDeleteConfirm] = useState<Dealer | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => { loadDealers() }, [])

  async function loadDealers() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from("dealers").select("*").order("name")
    if (data) setDealers(data)
    setLoading(false)
  }

  function openNew() {
    setForm(emptyForm)
    setEditId(null)
    setModal(true)
  }

  function openEdit(dealer: Dealer) {
    setForm({
      name: dealer.name || "",
      company: dealer.company || "",
      email: dealer.email || "",
      phone: dealer.phone || "",
      address_line1: dealer.address_line1 || "",
      address_line2: dealer.address_line2 || "",
      city: dealer.city || "",
      state: dealer.state || "",
      zip: dealer.zip || "",
      country: dealer.country || "US",
      dealer_type: dealer.dealer_type || "wholesale",
      status: dealer.status || "active",
      payment_terms: dealer.payment_terms || "net30",
      credit_limit: dealer.credit_limit?.toString() || "",
      discount_percent: dealer.discount_percent?.toString() || "",
      tax_exempt: dealer.tax_exempt || false,
      tax_id: dealer.tax_id || "",
      notes: dealer.notes || "",
    })
    setEditId(dealer.id)
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const payload = {
      ...form,
      credit_limit: parseFloat(form.credit_limit) || 0,
      discount_percent: parseFloat(form.discount_percent) || 0,
      updated_at: new Date().toISOString(),
    }
    if (editId) {
      await supabase.from("dealers").update(payload).eq("id", editId)
    } else {
      await supabase.from("dealers").insert(payload)
    }
    setSaving(false)
    setModal(false)
    loadDealers()
  }

  async function handleDelete(dealer: Dealer) {
    const supabase = createClient()
    await supabase.from("dealers").delete().eq("id", dealer.id)
    setDeleteConfirm(null)
    loadDealers()
  }

  const filtered = dealers.filter(d => {
    if (filter !== "all" && d.dealer_type !== filter) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.company?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inputStyle = {
    width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)",
    color: "#fff", padding: "9px 12px", fontSize: "13px",
    fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const,
  }

  const labelStyle = {
    display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em",
    textTransform: "uppercase" as const, color: "#666", marginBottom: "6px",
  }

  const selectStyle = { ...inputStyle, cursor: "pointer" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Accounts</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Dealers</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>{dealers.length} dealers in your network</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input placeholder="Search dealers..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "200px" }} />
          <button onClick={openNew} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add Dealer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
        {DEALER_TYPES.map(type => {
          const count = dealers.filter(d => d.dealer_type === type).length
          const tc = TYPE_COLORS[type]
          return (
            <div key={type} onClick={() => setFilter(filter === type ? "all" : type)} style={{ background: "#22262B", border: `0.5px solid ${filter === type ? tc.color : "rgba(255,255,255,0.10)"}`, borderTop: `2px solid ${filter === type ? tc.color : "#2A2A2A"}`, padding: "14px 16px", cursor: "pointer" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666", marginBottom: "6px" }}>{type}</p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: count > 0 ? tc.color : "#333", margin: 0 }}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Dealer list */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading dealers...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 16px" }}>No Dealers Yet</p>
          <button onClick={openNew} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer" }}>+ Add First Dealer</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(dealer => {
            const tc = TYPE_COLORS[dealer.dealer_type] || TYPE_COLORS.wholesale
            const isExpanded = expanded === dealer.id
            return (
              <div key={dealer.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: `3px solid ${tc.color}` }}>
                <div onClick={() => setExpanded(isExpanded ? null : dealer.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 200px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>{dealer.name}</p>
                    {dealer.company && <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{dealer.company}</p>}
                  </div>
                  <div style={{ flex: "0 0 140px" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: tc.color, background: tc.bg, padding: "3px 10px" }}>{dealer.dealer_type}</span>
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: "20px" }}>
                    {dealer.email && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Mail size={11} color="#444" /><span style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif" }}>{dealer.email}</span></div>}
                    {dealer.phone && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Phone size={11} color="#444" /><span style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif" }}>{dealer.phone}</span></div>}
                    {dealer.city && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><MapPin size={11} color="#444" /><span style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif" }}>{dealer.city}{dealer.state ? `, ${dealer.state}` : ""}</span></div>}
                  </div>
                  <div style={{ flex: "0 0 120px", textAlign: "right" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#555", margin: "0 0 2px" }}>{dealer.payment_terms?.replace("_", "/")}</p>
                    {dealer.discount_percent > 0 && <p style={{ fontSize: "11px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{dealer.discount_percent}% discount</p>}
                  </div>
                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "16px" }}>
                      {[
                        { label: "Payment Terms", value: dealer.payment_terms?.replace("_", "/") },
                        { label: "Credit Limit", value: dealer.credit_limit ? `$${dealer.credit_limit.toLocaleString()}` : "None" },
                        { label: "Discount", value: dealer.discount_percent ? `${dealer.discount_percent}%` : "None" },
                        { label: "Status", value: dealer.status },
                      ].map(item => (
                        <div key={item.label}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 4px" }}>{item.label}</p>
                          <p style={{ fontSize: "13px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{item.value || "—"}</p>
                        </div>
                      ))}
                    </div>
                    {dealer.address_line1 && (
                      <div style={{ marginBottom: "12px" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 4px" }}>Address</p>
                        <p style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{dealer.address_line1}{dealer.address_line2 ? `, ${dealer.address_line2}` : ""}, {dealer.city}, {dealer.state} {dealer.zip}</p>
                      </div>
                    )}
                    {dealer.notes && <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", marginBottom: "16px", fontStyle: "italic" }}>Note: {dealer.notes}</p>}
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button onClick={() => openEdit(dealer)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => setDeleteConfirm(dealer)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setModal(false)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", position: "sticky", top: 0, zIndex: 10 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>Accounts</p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>{editId ? "Edit Dealer" : "New Dealer"}</h2>
              </div>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Basic Info */}
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Basic Information</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Contact Name *</label>
                    <input style={inputStyle} placeholder="John Smith" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Company Name</label>
                    <input style={inputStyle} placeholder="Golf Galaxy Denver" value={form.company} onChange={e => setForm((f: any) => ({ ...f, company: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" style={inputStyle} placeholder="john@company.com" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input style={inputStyle} placeholder="303-555-0100" value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Type + Status */}
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Account Type</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Dealer Type</label>
                    <select style={selectStyle} value={form.dealer_type} onChange={e => setForm((f: any) => ({ ...f, dealer_type: e.target.value }))}>
                      {DEALER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select style={selectStyle} value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Address</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Address Line 1</label>
                    <input style={inputStyle} placeholder="123 Main St" value={form.address_line1} onChange={e => setForm((f: any) => ({ ...f, address_line1: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Address Line 2</label>
                    <input style={inputStyle} placeholder="Suite 100" value={form.address_line2} onChange={e => setForm((f: any) => ({ ...f, address_line2: e.target.value }))} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelStyle}>City</label>
                      <input style={inputStyle} placeholder="Denver" value={form.city} onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>State</label>
                      <input style={inputStyle} placeholder="CO" value={form.state} onChange={e => setForm((f: any) => ({ ...f, state: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>ZIP</label>
                      <input style={inputStyle} placeholder="80202" value={form.zip} onChange={e => setForm((f: any) => ({ ...f, zip: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Country</label>
                      <input style={inputStyle} placeholder="US" value={form.country} onChange={e => setForm((f: any) => ({ ...f, country: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Terms */}
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Payment Terms</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Terms</label>
                    <select style={selectStyle} value={form.payment_terms} onChange={e => setForm((f: any) => ({ ...f, payment_terms: e.target.value }))}>
                      {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t.replace("_", "/").toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Credit Limit ($)</label>
                    <input type="number" style={inputStyle} placeholder="5000" value={form.credit_limit} onChange={e => setForm((f: any) => ({ ...f, credit_limit: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Discount %</label>
                    <input type="number" style={inputStyle} placeholder="20" value={form.discount_percent} onChange={e => setForm((f: any) => ({ ...f, discount_percent: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <input type="checkbox" id="tax_exempt" checked={form.tax_exempt} onChange={e => setForm((f: any) => ({ ...f, tax_exempt: e.target.checked }))} style={{ cursor: "pointer" }} />
                  <label htmlFor="tax_exempt" style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Tax Exempt</label>
                  {form.tax_exempt && (
                    <input style={{ ...inputStyle, width: "200px", marginLeft: "12px" }} placeholder="Tax ID" value={form.tax_id} onChange={e => setForm((f: any) => ({ ...f, tax_id: e.target.value }))} />
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} placeholder="Any additional notes..." value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>

              <button onClick={handleSave} disabled={saving || !form.name} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || !form.name ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: saving || !form.name ? "not-allowed" : "pointer" }}>
                {saving ? "Saving..." : editId ? "Update Dealer →" : "Add Dealer →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "380px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 8px" }}>Delete Dealer?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px" }}>Are you sure you want to delete <strong style={{ color: "#fff" }}>{deleteConfirm.name}</strong>?</p>
            <p style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { Plus, X, Mail, Phone, Pencil, Trash2, Search } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Contact = {
  id: string
  name: string
  title: string
  email: string
  phone: string
  mobile: string
  entity_type: string
  entity_id: string
  entity_name: string
  is_primary: boolean
  notes: string
}

const ENTITY_TYPES = ["dealer", "supplier", "factory", "internal"]
const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  dealer:   { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)" },
  supplier: { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  factory:  { color: "#A91E22", bg: "rgba(169,30,34,0.1)" },
  internal: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
}

const emptyForm = {
  name: "", title: "", email: "", phone: "", mobile: "",
  entity_type: "dealer", entity_id: "", entity_name: "",
  is_primary: false, notes: "",
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [deleteConfirm, setDeleteConfirm] = useState<Contact | null>(null)

  useEffect(() => { loadContacts() }, [])

  async function loadContacts() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from("contacts").select("*").order("name")
    if (data) setContacts(data)
    setLoading(false)
  }

  function openNew() { setForm(emptyForm); setEditId(null); setModal(true) }
  function openEdit(c: Contact) { setForm({ ...c }); setEditId(c.id); setModal(true) }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    if (editId) {
      await supabase.from("contacts").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editId)
    } else {
      await supabase.from("contacts").insert(form)
    }
    setSaving(false)
    setModal(false)
    loadContacts()
  }

  async function handleDelete(c: Contact) {
    const supabase = createClient()
    await supabase.from("contacts").delete().eq("id", c.id)
    setDeleteConfirm(null)
    loadContacts()
  }

  const filtered = contacts.filter(c => {
    if (filter !== "all" && c.entity_type !== filter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.entity_name?.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "9px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#666", marginBottom: "6px" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Accounts</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Contacts</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>Dealer reps, supplier contacts, factory contacts</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "200px" }} />
          </div>
          <button onClick={openNew} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add Contact
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {(["all", ...ENTITY_TYPES] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: filter === t ? "#fff" : "#555", borderBottom: filter === t ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {t === "all" ? `All (${contacts.length})` : `${t} (${contacts.filter(c => c.entity_type === t).length})`}
          </button>
        ))}
      </div>

      {/* Contact grid */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 16px" }}>No Contacts Yet</p>
          <button onClick={openNew} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer" }}>+ Add First Contact</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {filtered.map(contact => {
            const tc = TYPE_COLORS[contact.entity_type] || TYPE_COLORS.dealer
            return (
              <div key={contact.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${tc.color}`, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: tc.color, background: tc.bg, padding: "2px 7px" }}>{contact.entity_type}</span>
                      {contact.is_primary && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4A93A", background: "rgba(196,169,58,0.1)", padding: "2px 7px" }}>Primary</span>}
                    </div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>{contact.name}</p>
                    {contact.title && <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{contact.title}</p>}
                    {contact.entity_name && <p style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{contact.entity_name}</p>}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => openEdit(contact)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: "2px" }}><Pencil size={13} /></button>
                    <button onClick={() => setDeleteConfirm(contact)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: "2px" }}><Trash2 size={13} /></button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
                      <Mail size={12} color="#555" />
                      <span style={{ fontSize: "12px", color: "#6A9CC8", fontFamily: "'Barlow', sans-serif" }}>{contact.email}</span>
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
                      <Phone size={12} color="#555" />
                      <span style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif" }}>{contact.phone}</span>
                    </a>
                  )}
                  {contact.mobile && contact.mobile !== contact.phone && (
                    <a href={`tel:${contact.mobile}`} style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
                      <Phone size={12} color="#444" />
                      <span style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif" }}>{contact.mobile} (mobile)</span>
                    </a>
                  )}
                </div>
                {contact.notes && <p style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif", marginTop: "10px", fontStyle: "italic" }}>{contact.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setModal(false)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", position: "sticky", top: 0, zIndex: 10 }}>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>{editId ? "Edit Contact" : "New Contact"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input style={inputStyle} placeholder="John Smith" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Title / Role</label>
                  <input style={inputStyle} placeholder="Sales Rep" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" style={inputStyle} placeholder="john@company.com" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} placeholder="303-555-0100" value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Mobile</label>
                  <input style={inputStyle} placeholder="303-555-0101" value={form.mobile} onChange={e => setForm((f: any) => ({ ...f, mobile: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Contact Type</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={form.entity_type} onChange={e => setForm((f: any) => ({ ...f, entity_type: e.target.value }))}>
                    {ENTITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Company / Entity Name</label>
                <input style={inputStyle} placeholder="Golf Pride Grips" value={form.entity_name} onChange={e => setForm((f: any) => ({ ...f, entity_name: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" id="is_primary" checked={form.is_primary} onChange={e => setForm((f: any) => ({ ...f, is_primary: e.target.checked }))} style={{ cursor: "pointer" }} />
                <label htmlFor="is_primary" style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Primary contact for this account</label>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} placeholder="Any notes..." value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>
              <button onClick={handleSave} disabled={saving || !form.name} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || !form.name ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: saving || !form.name ? "not-allowed" : "pointer" }}>
                {saving ? "Saving..." : editId ? "Update Contact →" : "Add Contact →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "360px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>Delete Contact?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>Delete <strong style={{ color: "#fff" }}>{deleteConfirm.name}</strong>? This cannot be undone.</p>
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
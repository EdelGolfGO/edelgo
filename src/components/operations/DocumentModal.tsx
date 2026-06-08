"use client"

import { useState, useRef } from "react"
import { X, Upload, Plus, Trash2, Calendar, FileText, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase"

type DocumentType = "po" | "factory_invoice" | "distributor_invoice"

type LineItem = {
  id: string
  product_name: string
  sku: string
  quantity: number
  unit_cost: number
}

type DocumentModalProps = {
  type: DocumentType
  onClose: () => void
  onSave: (data: any) => void
  existingPOs?: { id: string; po_number: string }[]
  editData?: any // pre-filled data for edit mode
  editId?: string // record ID for update
}

const DEFAULT_FACTORY = "Virage Tech Industrial Co., Ltd."

const TYPE_CONFIG: Record<DocumentType, any> = {
  po: {
    title: "Purchase Order",
    eyebrow: "To China Factory — We Pay",
    eyebrowColor: "#A91E22",
    badge: "OUTBOUND",
    badgeColor: "#A91E22",
    badgeBg: "rgba(169,30,34,0.1)",
    numberLabel: "PO Number",
    numberPlaceholder: "PO-2026-042",
    partyLabel: "Factory Name",
    partyPlaceholder: DEFAULT_FACTORY,
    dateLabel: "Order Date",
    showExpectedShip: true,
    showLinkedPO: false,
    amountLabel: "Total PO Amount",
    depositLabel: "50% Deposit — Due at PO Placement",
    finalLabel: "50% Final — Due 14 Days After Ship",
    description: "Purchase order sent to the China factory. We pay 50% at placement, 50% within 14 days of shipment.",
  },
  factory_invoice: {
    title: "Factory Invoice",
    eyebrow: "From China Factory — We Pay",
    eyebrowColor: "#A91E22",
    badge: "WE PAY",
    badgeColor: "#A91E22",
    badgeBg: "rgba(169,30,34,0.1)",
    numberLabel: "Invoice Number",
    numberPlaceholder: "FACTORY-INV-2026-041",
    partyLabel: "Factory Name",
    partyPlaceholder: DEFAULT_FACTORY,
    dateLabel: "Invoice Date",
    showExpectedShip: false,
    showLinkedPO: true,
    amountLabel: "Invoice Amount",
    depositLabel: "50% Deposit — Due at PO Placement",
    finalLabel: "50% Final — Due 14 Days After Ship",
    description: "Invoice received from the China factory tied to a PO. We owe them money.",
  },
  distributor_invoice: {
    title: "Distributor Invoice",
    eyebrow: "To Distributor — We Receive Payment",
    eyebrowColor: "#5A9E5A",
    badge: "WE RECEIVE",
    badgeColor: "#5A9E5A",
    badgeBg: "rgba(90,158,90,0.1)",
    numberLabel: "Invoice Number",
    numberPlaceholder: "INV-2026-092",
    partyLabel: "Distributor / Dealer Name",
    partyPlaceholder: "Golf Galaxy – Denver",
    dateLabel: "Invoice Date",
    showExpectedShip: false,
    showLinkedPO: false,
    amountLabel: "Invoice Amount",
    depositLabel: "50% Deposit — Due Day +14",
    finalLabel: "50% Final — Due 45 Days After Ship",
    description: "Invoice we send to a distributor or dealer. They owe us money.",
  },
}

function SmartDateInput({ value, onChange, label }: { value: string; onChange: (val: string) => void; label: string }) {
  const today = new Date()
  const [showPicker, setShowPicker] = useState(false)
  const parts = value ? value.split("-") : ["", "", ""]
  const year = parts[0] || ""
  const month = parts[1] || ""
  const day = parts[2] || ""
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)
  const [calYear, setCalYear] = useState(() => value ? parseInt(parts[0]) || today.getFullYear() : today.getFullYear())
  const [calMonth, setCalMonth] = useState(() => value ? (parseInt(parts[1]) - 1) || today.getMonth() : today.getMonth())

  function update(newYear: string, newMonth: string, newDay: string) {
    const y = newYear.length === 4 ? newYear : newYear.padStart(4, "0")
    const m = newMonth.padStart(2, "0")
    const d = newDay.padStart(2, "0")
    if (newYear || newMonth || newDay) onChange(`${y}-${m}-${d}`)
  }
  function handleMonth(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2)
    update(year, val, day)
    if (val.length === 2 || (val.length === 1 && parseInt(val) > 1)) { dayRef.current?.focus(); dayRef.current?.select() }
  }
  function handleDay(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2)
    update(year, month, val)
    if (val.length === 2 || (val.length === 1 && parseInt(val) > 3)) { yearRef.current?.focus(); yearRef.current?.select() }
  }
  function handleYear(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4)
    update(val, month, day)
  }
  function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
  function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay() }
  function selectCalDay(d: number) {
    const m = String(calMonth + 1).padStart(2, "0")
    const dd = String(d).padStart(2, "0")
    onChange(`${calYear}-${m}-${dd}`)
    setShowPicker(false)
  }
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#666", marginBottom: "6px" }
  const segStyle = { background: "#13161A", border: "none", color: "#fff", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", textAlign: "center" as const, padding: "9px 4px" }

  return (
    <div style={{ position: "relative" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)" }}>
        <input ref={monthRef} type="text" inputMode="numeric" placeholder="MM" value={month} onChange={handleMonth} onFocus={e => e.target.select()} style={{ ...segStyle, width: "36px" }} />
        <span style={{ color: "#444", userSelect: "none" as const }}>/</span>
        <input ref={dayRef} type="text" inputMode="numeric" placeholder="DD" value={day} onChange={handleDay} onFocus={e => e.target.select()} style={{ ...segStyle, width: "36px" }} />
        <span style={{ color: "#444", userSelect: "none" as const }}>/</span>
        <input ref={yearRef} type="text" inputMode="numeric" placeholder="YYYY" value={year} onChange={handleYear} onFocus={e => e.target.select()} style={{ ...segStyle, width: "54px" }} />
        <button type="button" onClick={() => setShowPicker(p => !p)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "6px 10px", display: "flex", alignItems: "center" }}>
          <Calendar size={15} color={showPicker ? "#A91E22" : "#555"} />
        </button>
      </div>
      {showPicker && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 400, background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.12)", borderTop: "2px solid #A91E22", width: "260px", padding: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <button type="button" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1) } else setCalMonth(m => m-1) }} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "16px", padding: "2px 6px" }}>‹</button>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff" }}>{MONTHS[calMonth]} {calYear}</span>
            <button type="button" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1) } else setCalMonth(m => m+1) }} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "16px", padding: "2px 6px" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "4px" }}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} style={{ textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", color: "#444", padding: "2px 0" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {Array.from({ length: getFirstDay(calYear, calMonth) }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: getDaysInMonth(calYear, calMonth) }).map((_, i) => {
              const d = i + 1
              const isSelected = value === `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`
              const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()
              return <button key={d} type="button" onClick={() => selectCalDay(d)} style={{ background: isSelected ? "#A91E22" : isToday ? "rgba(169,30,34,0.15)" : "transparent", border: "none", color: isSelected ? "#fff" : isToday ? "#A91E22" : "#AAA", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: isSelected ? 700 : 400, padding: "4px 2px", cursor: "pointer", textAlign: "center", borderRadius: "2px" }}>{d}</button>
            })}
          </div>
          <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={() => { const t = new Date(); setCalMonth(t.getMonth()); setCalYear(t.getFullYear()); selectCalDay(t.getDate()) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "none", border: "none", cursor: "pointer" }}>Today</button>
            <button type="button" onClick={() => setShowPicker(false)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", background: "none", border: "none", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DocumentModal({ type, onClose, onSave, existingPOs = [], editData, editId }: DocumentModalProps) {
  const config = TYPE_CONFIG[type]
  const isEdit = !!editId
  const [step, setStep] = useState<"details" | "items" | "upload">("details")
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; file?: File; url?: string }[]>(() => {
    if (editData?.document_urls) {
      try { return JSON.parse(editData.document_urls) } catch { return [] }
    }
    return []
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const [form, setForm] = useState({
    number: editData?.po_number || editData?.invoice_number || "",
    party: editData?.factory_name || editData?.dealer_name || (type === "po" || type === "factory_invoice" ? DEFAULT_FACTORY : ""),
    date: editData?.order_date || editData?.invoice_date || new Date().toISOString().split("T")[0],
    expected_ship_date: editData?.expected_ship_date || "",
    total_amount: editData?.total_amount?.toString() || "",
    linked_po: editData?.linked_po_number || "",
    notes: editData?.notes || "",
  })

  const [items, setItems] = useState<LineItem[]>([
    { id: "1", product_name: "", sku: "", quantity: 0, unit_cost: 0 },
  ])

  function updateForm(key: string, value: string) { setForm(prev => ({ ...prev, [key]: value })) }
  function addItem() { setItems(prev => [...prev, { id: Date.now().toString(), product_name: "", sku: "", quantity: 0, unit_cost: 0 }]) }
  function updateItem(id: string, key: keyof LineItem, value: string | number) { setItems(prev => prev.map(item => item.id === id ? { ...item, [key]: value } : item)) }
  function removeItem(id: string) { setItems(prev => prev.filter(item => item.id !== id)) }
  function getItemsTotal() { return items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0) }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setUploading(true)
    const supabase = createClient()
    const newFiles = await Promise.all(files.map(async (file) => {
      const path = `${type}/${Date.now()}-${file.name.replace(/\s/g, "_")}`
      const { error } = await supabase.storage.from("Documents").upload(path, file, { upsert: true })
      if (error) { console.error("Upload error:", error); return { name: file.name, file, url: undefined } }
      const { data: urlData } = supabase.storage.from("Documents").getPublicUrl(path)
      return { name: file.name, file, url: urlData.publicUrl }
    }))
    setUploadedFiles(prev => [...prev, ...newFiles])
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    const supabase = createClient()
    const documentUrls = uploadedFiles.filter(f => f.url).map(f => ({ name: f.name, url: f.url }))

    try {
      if (type === "po") {
        const payload = {
          po_number: form.number,
          factory_name: form.party,
          order_date: form.date,
          expected_ship_date: form.expected_ship_date || null,
          total_amount: parseFloat(form.total_amount) || 0,
          notes: form.notes || null,
          document_urls: JSON.stringify(documentUrls),
        }
        if (isEdit) {
          const { error } = await supabase.from("purchase_orders").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editId)
          if (error) throw error
        } else {
          const { error } = await supabase.from("purchase_orders").insert({ ...payload, status: "placed", deposit_paid_date: form.date })
          if (error) throw error
        }
      }

      if (type === "factory_invoice" || type === "distributor_invoice") {
        const payload = {
          invoice_number: form.number,
          dealer_name: form.party,
          invoice_date: form.date,
          total_amount: parseFloat(form.total_amount) || 0,
          invoice_type: type === "factory_invoice" ? "factory" : "distributor",
          linked_po_number: form.linked_po || null,
          notes: form.notes || null,
          document_urls: JSON.stringify(documentUrls),
        }
        if (isEdit) {
          const { error } = await supabase.from("distributor_invoices").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editId)
          if (error) throw error
        } else {
          const { error } = await supabase.from("distributor_invoices").insert({ ...payload, status: "pending" })
          if (error) throw error
        }
      }

      onSave({ form, items, uploadedFiles })
    } catch (err: any) {
      setSaveError(err.message || "Error saving. Please try again.")
      setSaving(false)
    }
  }

  const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "9px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#666", marginBottom: "6px" }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={onClose}>
      <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${config.eyebrowColor}`, width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", position: "sticky", top: 0, zIndex: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: config.eyebrowColor, margin: 0 }}>{config.eyebrow}</p>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: config.badgeColor, background: config.badgeBg, padding: "2px 8px" }}>
                {isEdit ? "EDITING" : config.badge}
              </span>
            </div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 4px" }}>
              {isEdit ? `Edit ${config.title}` : `New ${config.title}`}
            </h2>
            <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0, fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>{config.description}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "4px", flexShrink: 0 }}><X size={20} /></button>
        </div>

        {/* Step tabs */}
        <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D" }}>
          {(["details", "items", "upload"] as const).map((s, i) => (
            <button key={s} onClick={() => setStep(s)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 20px", cursor: "pointer", border: "none", background: "transparent", color: step === s ? "#fff" : "#555", borderBottom: step === s ? `2px solid ${config.eyebrowColor}` : "2px solid transparent", marginBottom: "-1px" }}>
              {i + 1}. {s === "details" ? "Details" : s === "items" ? "Line Items" : "Documents"}
            </button>
          ))}
        </div>

        <div style={{ padding: "24px" }}>

          {/* STEP 1 */}
          {step === "details" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: config.badgeBg, border: `0.5px solid ${config.badgeColor}30`, padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", background: config.eyebrowColor, flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: config.eyebrowColor, fontFamily: "'Barlow', sans-serif", fontWeight: 500 }}>
                  {type === "factory_invoice" ? "This invoice is FROM the factory — money flows OUT from Edel" :
                   type === "distributor_invoice" ? "This invoice is TO a distributor — money flows IN to Edel" :
                   "This PO is TO the factory — triggers 50% deposit payment now"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>{config.numberLabel}</label>
                  <input style={inputStyle} placeholder={config.numberPlaceholder} value={form.number} onChange={e => updateForm("number", e.target.value)} />
                </div>
                <SmartDateInput label={config.dateLabel} value={form.date} onChange={v => updateForm("date", v)} />
              </div>

              <div>
                <label style={labelStyle}>{config.partyLabel}</label>
                <input style={inputStyle} placeholder={config.partyPlaceholder} value={form.party} onChange={e => updateForm("party", e.target.value)} />
              </div>

              {config.showLinkedPO && (
                <div>
                  <label style={labelStyle}>Linked Purchase Order</label>
                  <input style={inputStyle} placeholder="e.g. PO-2026-041" value={form.linked_po} onChange={e => updateForm("linked_po", e.target.value)} />
                  <p style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif", marginTop: "4px" }}>Enter the PO number this invoice is tied to</p>
                </div>
              )}

              {config.showExpectedShip && (
                <SmartDateInput label="Expected Ship Date" value={form.expected_ship_date} onChange={v => updateForm("expected_ship_date", v)} />
              )}

              <div>
                <label style={labelStyle}>{config.amountLabel}</label>
                <input type="number" style={inputStyle} placeholder="0.00" value={form.total_amount} onChange={e => updateForm("total_amount", e.target.value)} />
              </div>

              {form.total_amount && parseFloat(form.total_amount) > 0 && (
                <div style={{ background: "#13161A", border: `0.5px solid ${config.eyebrowColor}30`, padding: "16px" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Payment Schedule — {type === "distributor_invoice" ? "Money In" : "Money Out"}</p>
                  {[
                    { label: config.depositLabel, amount: parseFloat(form.total_amount) * 0.5 },
                    { label: config.finalLabel, amount: parseFloat(form.total_amount) * 0.5 },
                  ].map(p => (
                    <div key={p.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif" }}>{p.label}</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: config.eyebrowColor }}>${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Total</span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff" }}>${parseFloat(form.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} placeholder="Any additional notes..." value={form.notes} onChange={e => updateForm("notes", e.target.value)} />
              </div>

              <button onClick={() => setStep("items")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: config.eyebrowColor, border: "none", padding: "11px", cursor: "pointer", marginTop: "8px" }}>
                Next: Line Items →
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === "items" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>Add the products on this {type === "distributor_invoice" ? "invoice" : type === "factory_invoice" ? "factory invoice" : "PO"}.</p>
              <div style={{ background: "#13161A", border: "0.5px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 100px 80px 32px" }}>
                  {["Product", "SKU", "Qty", "Unit Cost", "Total", ""].map(h => (
                    <div key={h} style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</div>
                  ))}
                </div>
                {items.map(item => (
                  <div key={item.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 100px 80px 32px", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                    <input style={{ ...inputStyle, border: "none", borderRight: "0.5px solid rgba(255,255,255,0.06)" }} placeholder="Product name" value={item.product_name} onChange={e => updateItem(item.id, "product_name", e.target.value)} />
                    <input style={{ ...inputStyle, border: "none", borderRight: "0.5px solid rgba(255,255,255,0.06)" }} placeholder="SKU" value={item.sku} onChange={e => updateItem(item.id, "sku", e.target.value)} />
                    <input type="number" style={{ ...inputStyle, border: "none", borderRight: "0.5px solid rgba(255,255,255,0.06)", textAlign: "center" }} value={item.quantity || ""} onChange={e => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)} />
                    <input type="number" style={{ ...inputStyle, border: "none", borderRight: "0.5px solid rgba(255,255,255,0.06)" }} placeholder="0.00" value={item.unit_cost || ""} onChange={e => updateItem(item.id, "unit_cost", parseFloat(e.target.value) || 0)} />
                    <div style={{ padding: "9px 12px", fontSize: "13px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", borderRight: "0.5px solid rgba(255,255,255,0.06)" }}>${(item.quantity * item.unit_cost).toFixed(0)}</div>
                    <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={13} /></button>
                  </div>
                ))}
                <div style={{ padding: "10px 12px" }}>
                  <button onClick={addItem} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Plus size={12} /> Add Line Item</button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "16px", padding: "12px 0", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#666" }}>Line Items Total</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: "#fff" }}>${getItemsTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setStep("details")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>← Back</button>
                <button onClick={() => setStep("upload")} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: config.eyebrowColor, border: "none", padding: "10px", cursor: "pointer" }}>Next: Documents →</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                Upload or manage documents for this {type === "po" ? "purchase order" : "invoice"}. Files are stored securely and accessible any time.
              </p>

              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: uploading ? "rgba(169,30,34,0.05)" : "#13161A", border: `1px dashed ${uploading ? "#A91E22" : "rgba(255,255,255,0.15)"}`, padding: "40px 20px", cursor: uploading ? "not-allowed" : "pointer", textAlign: "center", transition: "all 0.2s" }}>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" multiple onChange={handleFileSelect} style={{ display: "none" }} disabled={uploading} />
                <Upload size={28} color={uploading ? "#A91E22" : "#444"} />
                <div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: uploading ? "#A91E22" : "#666", margin: "0 0 4px" }}>{uploading ? "Uploading..." : "Click to Upload"}</p>
                  <p style={{ fontSize: "12px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: 0 }}>PDF, PNG, JPG, Excel — up to 20MB each</p>
                </div>
              </label>

              {uploadedFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", margin: "0 0 4px" }}>Documents ({uploadedFiles.length})</p>
                  {uploadedFiles.map((file, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#13161A", border: `0.5px solid ${file.url ? "rgba(90,158,90,0.3)" : "rgba(255,255,255,0.08)"}`, padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                        <FileText size={14} color={file.url ? "#5A9E5A" : "#555"} />
                        <span style={{ fontSize: "13px", color: "#CCC", fontFamily: "'Barlow', sans-serif" }}>{file.name}</span>
                        {file.url && <span style={{ fontSize: "10px", color: "#5A9E5A", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>✓ Stored</span>}
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {file.url && (
                          <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", textDecoration: "none" }}>
                            <ExternalLink size={12} /> Open
                          </a>
                        )}
                        <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "#444", cursor: "pointer" }}><X size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {saveError && (
                <div style={{ background: "rgba(169,30,34,0.1)", border: "0.5px solid rgba(169,30,34,0.3)", padding: "10px 14px", fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>{saveError}</div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button onClick={() => setStep("items")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>← Back</button>
                <button onClick={handleSave} disabled={saving || uploading} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || uploading ? "#333" : config.eyebrowColor, border: "none", padding: "12px", cursor: saving || uploading ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving..." : uploading ? "Uploading..." : isEdit ? `Update ${config.title} →` : `Save ${config.title} →`}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
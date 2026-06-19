"use client"

import { useState, useEffect } from "react"
import { Plus, ChevronDown, FileText, ExternalLink, Upload, Trash2, Pencil } from "lucide-react"
import DocumentModal from "@/components/operations/DocumentModal"
import { createClient } from "@/lib/supabase"

type InvoiceStatus = "pending" | "deposit_received" | "shipped" | "final_pending" | "paid" | "overdue"
type InvoiceType = "distributor" | "factory"

type Invoice = {
  id: string
  invoice_number: string
  dealer_name: string
  invoice_date: string
  total_amount: number
  deposit_paid_date?: string
  ship_date?: string
  final_payment_paid_date?: string
  status: InvoiceStatus
  invoice_type: InvoiceType
  linked_po_number?: string
  notes?: string
  document_urls?: string
}

type DocLink = { name: string; url: string }

const STATUS_COLORS: Record<InvoiceStatus, { color: string; bg: string; label: string }> = {
  pending:          { color: "#888",    bg: "rgba(136,136,136,0.1)",  label: "Pending" },
  deposit_received: { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)", label: "Deposit Received" },
  shipped:          { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",  label: "Shipped" },
  final_pending:    { color: "#A91E22", bg: "rgba(169,30,34,0.1)",   label: "Final Pmt Pending" },
  paid:             { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",   label: "Paid in Full" },
  overdue:          { color: "#A91E22", bg: "rgba(169,30,34,0.2)",   label: "Overdue" },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

function parseDocUrls(raw?: string): DocLink[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<InvoiceType | "all">("all")
  const [modal, setModal] = useState<{ open: boolean; type: "distributor_invoice" | "factory_invoice"; editData?: any; editId?: string }>({ open: false, type: "distributor_invoice" })
  const [deleteConfirm, setDeleteConfirm] = useState<Invoice | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from("distributor_invoices").select("*").order("created_at", { ascending: false })
    if (data) setInvoices(data)
    setLoading(false)
  }

  async function updateInvoice(id: string, fields: Record<string, any>) {
    const supabase = createClient()
    await supabase.from("distributor_invoices").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id)
    loadInvoices()
  }

  async function deleteInvoice(invoice: Invoice) {
    const supabase = createClient()
    await supabase.from("distributor_invoices").delete().eq("id", invoice.id)
    setDeleteConfirm(null)
    setExpanded(null)
    loadInvoices()
  }

  async function handleAdditionalUpload(invoice: Invoice, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingFor(invoice.id)
    const supabase = createClient()
    const existing = parseDocUrls(invoice.document_urls)
    const newDocs: DocLink[] = []
    for (const file of files) {
      const path = `invoice/${Date.now()}-${file.name.replace(/\s/g, "_")}`
      const { error } = await supabase.storage.from("Documents").upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from("Documents").getPublicUrl(path)
        newDocs.push({ name: file.name, url: urlData.publicUrl })
      }
    }
    await supabase.from("distributor_invoices").update({ document_urls: JSON.stringify([...existing, ...newDocs]) }).eq("id", invoice.id)
    setUploadingFor(null)
    loadInvoices()
  }

  const distributorInvoices = invoices.filter(i => i.invoice_type === "distributor")
  const factoryInvoices = invoices.filter(i => i.invoice_type === "factory")
  const filtered = invoices.filter(i => typeFilter === "all" || i.invoice_type === typeFilter)

  const totalReceivable = distributorInvoices.filter(i => i.status !== "paid").reduce((sum, i) => {
    let owed = 0
    if (!i.deposit_paid_date) owed += i.total_amount * 0.5
    if (!i.final_payment_paid_date && i.ship_date) owed += i.total_amount * 0.5
    return sum + owed
  }, 0)

  const totalOwed = factoryInvoices.filter(i => i.status !== "paid").reduce((sum, i) => {
    let owed = 0
    if (!i.deposit_paid_date) owed += i.total_amount * 0.5
    if (!i.final_payment_paid_date && i.ship_date) owed += i.total_amount * 0.5
    return sum + owed
  }, 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Operations</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Invoices</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>Factory invoices we pay + distributor invoices we receive</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setModal({ open: true, type: "factory_invoice" })}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          ><Plus size={14} /> Factory Invoice</button>
          <button
            onClick={() => setModal({ open: true, type: "distributor_invoice" })}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          ><Plus size={14} /> Distributor Invoice</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ background: "#22262B", border: "0.5px solid rgba(90,158,90,0.2)", borderTop: "2px solid #5A9E5A", padding: "16px 20px" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#5A9E5A", marginBottom: "12px" }}>↓ Money In — Distributor Invoices</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            {[
              { label: "Total", value: distributorInvoices.length.toString(), color: "#fff" },
              { label: "Receivable", value: `$${totalReceivable.toLocaleString()}`, color: "#5A9E5A" },
              { label: "Paid", value: distributorInvoices.filter(i => i.status === "paid").length.toString(), color: "#5A9E5A" },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", marginBottom: "4px" }}>{s.label}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#22262B", border: "0.5px solid rgba(169,30,34,0.2)", borderTop: "2px solid #A91E22", padding: "16px 20px" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#A91E22", marginBottom: "12px" }}>↑ Money Out — Factory Invoices</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            {[
              { label: "Total", value: factoryInvoices.length.toString(), color: "#fff" },
              { label: "Owed", value: `$${totalOwed.toLocaleString()}`, color: "#A91E22" },
              { label: "Paid", value: factoryInvoices.filter(i => i.status === "paid").length.toString(), color: "#5A9E5A" },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", marginBottom: "4px" }}>{s.label}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Type filter */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {(["all", "distributor", "factory"] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", whiteSpace: "nowrap", color: typeFilter === t ? "#fff" : "#555", borderBottom: typeFilter === t ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {t === "all" ? `All (${invoices.length})` : t === "distributor" ? `↓ Distributor (${distributorInvoices.length})` : `↑ Factory (${factoryInvoices.length})`}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading invoices...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 20px" }}>No Invoices Yet</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={() => setModal({ open: true, type: "factory_invoice" })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 16px", cursor: "pointer" }}>+ Factory Invoice</button>
            <button onClick={() => setModal({ open: true, type: "distributor_invoice" })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "8px 16px", cursor: "pointer" }}>+ Distributor Invoice</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(invoice => {
            const isExpanded = expanded === invoice.id
            const statusInfo = STATUS_COLORS[invoice.status] || STATUS_COLORS.pending
            const isFactory = invoice.invoice_type === "factory"
            const accentColor = isFactory ? "#A91E22" : "#5A9E5A"
            const depositDue = addDays(invoice.invoice_date, 14)
            const finalDue = invoice.ship_date ? addDays(invoice.ship_date, isFactory ? 14 : 45) : null
            const depositDaysLeft = daysUntil(depositDue)
            const finalDaysLeft = finalDue ? daysUntil(finalDue) : null
            const docs = parseDocUrls(invoice.document_urls)

            return (
              <div key={invoice.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: `3px solid ${accentColor}` }}>
                <div onClick={() => setExpanded(isExpanded ? null : invoice.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 120px" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, background: `${accentColor}15`, padding: "2px 8px", display: "block", marginBottom: "4px", width: "fit-content" }}>
                      {isFactory ? "↑ We Pay" : "↓ We Receive"}
                    </span>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: accentColor, margin: 0, letterSpacing: "0.05em" }}>{invoice.invoice_number}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{invoice.dealer_name}</p>
                  </div>

                  <div style={{ flex: "0 0 160px" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>{statusInfo.label}</span>
                    {docs.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                        <FileText size={10} color="#5A9E5A" />
                        <span style={{ fontSize: "10px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif" }}>{docs.length} doc{docs.length !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {invoice.linked_po_number && <p style={{ fontSize: "10px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: "4px 0 0" }}>PO: {invoice.linked_po_number}</p>}
                  </div>

                  <div style={{ flex: 1, display: "flex", gap: "20px" }}>
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Date</p>
                      <p style={{ fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(invoice.invoice_date)}</p>
                    </div>
                    {!invoice.deposit_paid_date && (
                      <div>
                        <p style={{ fontSize: "9px", color: depositDaysLeft < 0 ? "#A91E22" : "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>
                          {isFactory ? "Deposit Due To Factory" : "Deposit Due From Dealer"}
                        </p>
                        <p style={{ fontSize: "12px", fontFamily: "'Barlow', sans-serif", margin: 0, color: depositDaysLeft < 0 ? "#A91E22" : depositDaysLeft < 7 ? "#C4A93A" : "#AAA" }}>
                          {formatDate(depositDue)}
                          <span style={{ fontSize: "10px", marginLeft: "4px" }}>({depositDaysLeft < 0 ? `${Math.abs(depositDaysLeft)}d overdue` : `${depositDaysLeft}d`})</span>
                        </p>
                      </div>
                    )}
                    {invoice.ship_date && (
                      <div>
                        <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Shipped</p>
                        <p style={{ fontSize: "12px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(invoice.ship_date)}</p>
                      </div>
                    )}
                    {finalDue && !invoice.final_payment_paid_date && (
                      <div>
                        <p style={{ fontSize: "9px", color: "#A91E22", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Final Pmt Due</p>
                        <p style={{ fontSize: "12px", fontFamily: "'Barlow', sans-serif", margin: 0, color: finalDaysLeft! < 0 ? "#A91E22" : finalDaysLeft! < 14 ? "#C4A93A" : "#AAA" }}>
                          {formatDate(finalDue)}
                          <span style={{ fontSize: "10px", marginLeft: "4px" }}>({finalDaysLeft! < 0 ? `${Math.abs(finalDaysLeft!)}d overdue` : `${finalDaysLeft}d`})</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: "0 0 120px", textAlign: "right" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>${invoice.total_amount.toLocaleString()}</p>
                    <p style={{ fontSize: "11px", color: accentColor, fontFamily: "'Barlow', sans-serif", margin: "2px 0 0", fontWeight: 500 }}>{isFactory ? "We owe" : "They owe"}</p>
                  </div>

                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>
                      Payment Schedule — {isFactory ? "Edel Pays Factory" : "Distributor Pays Edel"}
                    </p>
                    <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                      {[
                        { label: "50% Deposit", amount: `$${(invoice.total_amount * 0.5).toLocaleString()}`, due: isFactory ? "Due at PO placement" : `Due ${formatDate(depositDue)}`, paid: !!invoice.deposit_paid_date, paidDate: invoice.deposit_paid_date, direction: isFactory ? "Edel → Factory" : "Dealer → Edel" },
                        { label: "50% Final", amount: `$${(invoice.total_amount * 0.5).toLocaleString()}`, due: finalDue ? `Due ${formatDate(finalDue)}` : isFactory ? "Due 14 days after ship" : "Due 45 days after ship", paid: !!invoice.final_payment_paid_date, paidDate: invoice.final_payment_paid_date, direction: isFactory ? "Edel → Factory" : "Dealer → Edel" },
                      ].map(p => (
                        <div key={p.label} style={{ background: "#22262B", border: `0.5px solid ${p.paid ? "rgba(90,158,90,0.3)" : `${accentColor}30`}`, padding: "12px 16px", flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: p.paid ? "#5A9E5A" : accentColor }}>{p.label}</span>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: p.paid ? "#5A9E5A" : accentColor, background: p.paid ? "rgba(90,158,90,0.1)" : `${accentColor}15`, padding: "2px 6px" }}>{p.paid ? (isFactory ? "Paid" : "Received") : "Pending"}</span>
                          </div>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff", margin: "4px 0" }}>{p.amount}</p>
                          <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "0 0 2px" }}>{p.paid ? `${isFactory ? "Paid" : "Received"} ${formatDate(p.paidDate!)}` : p.due}</p>
                          <p style={{ fontSize: "10px", color: "#333", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{p.direction}</p>
                        </div>
                      ))}
                    </div>

                    {/* Documents */}
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "10px" }}>Documents</p>
                      {docs.length === 0 ? (
                        <p style={{ fontSize: "12px", color: "#333", fontFamily: "'Barlow', sans-serif", fontStyle: "italic" }}>No documents uploaded yet</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {docs.map((doc, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#22262B", border: "0.5px solid rgba(90,158,90,0.2)", padding: "8px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <FileText size={13} color="#5A9E5A" />
                                <span style={{ fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif" }}>{doc.name}</span>
                              </div>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6A9CC8", textDecoration: "none" }}>
                                <ExternalLink size={12} /> Open
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {invoice.notes && <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", marginBottom: "16px", fontStyle: "italic" }}>Note: {invoice.notes}</p>}

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <input type="file" accept=".pdf,.png,.jpg,.xlsx" multiple onChange={e => handleAdditionalUpload(invoice, e)} style={{ display: "none" }} />
                        <Upload size={12} /> {uploadingFor === invoice.id ? "Uploading..." : "Add Doc"}
                      </label>

                      <button
                        onClick={() => setModal({ open: true, type: isFactory ? "factory_invoice" : "distributor_invoice", editData: invoice, editId: invoice.id })}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                      ><Pencil size={12} /> Edit</button>

                      {!invoice.deposit_paid_date && (
                        <button onClick={() => updateInvoice(invoice.id, { deposit_paid_date: new Date().toISOString().split("T")[0], status: "deposit_received" })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: accentColor, border: "none", padding: "7px 14px", cursor: "pointer" }}>
                          {isFactory ? "Mark Deposit Paid" : "Mark Deposit Received"}
                        </button>
                      )}
                      {invoice.deposit_paid_date && !invoice.ship_date && (
                        <button onClick={() => updateInvoice(invoice.id, { ship_date: new Date().toISOString().split("T")[0], status: "shipped" })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#6A9CC8", border: "none", padding: "7px 14px", cursor: "pointer" }}>Mark as Shipped</button>
                      )}
                      {invoice.ship_date && !invoice.final_payment_paid_date && (
                        <button onClick={() => updateInvoice(invoice.id, { final_payment_paid_date: new Date().toISOString().split("T")[0], status: "paid" })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "7px 14px", cursor: "pointer" }}>
                          {isFactory ? "Mark Final Payment Paid" : "Mark Final Payment Received"}
                        </button>
                      )}

                      <button
                        onClick={() => setDeleteConfirm(invoice)}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}
                      ><Trash2 size={12} /> Delete</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit/New Modal */}
      {modal.open && (
        <DocumentModal
          type={modal.type}
          editData={modal.editData}
          editId={modal.editId}
          onClose={() => setModal({ open: false, type: "distributor_invoice" })}
          onSave={() => { setModal({ open: false, type: "distributor_invoice" }); loadInvoices() }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "380px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 8px" }}>Delete Invoice?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>
              Are you sure you want to delete <strong style={{ color: "#fff" }}>{deleteConfirm.invoice_number}</strong>?
            </p>
            <p style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteInvoice(deleteConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Delete Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
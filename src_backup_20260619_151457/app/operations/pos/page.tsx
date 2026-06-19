"use client"

import { useState, useEffect } from "react"
import { Plus, Upload, ChevronDown, FileText, ExternalLink, Trash2, Pencil, ChevronRight } from "lucide-react"
import DocumentModal from "@/components/operations/DocumentModal"
import { createClient } from "@/lib/supabase"

type POStatus = "draft" | "placed" | "in_production" | "shipped" | "received" | "cancelled"

type POItem = {
  id: string
  sku_code: string
  product_name: string
  quantity: number
  unit_cost: number
  total_cost: number
}

type PO = {
  id: string
  po_number: string
  factory_name: string
  order_date: string
  expected_ship_date: string
  actual_ship_date?: string
  status: POStatus
  total_amount: number
  deposit_paid_date?: string
  final_payment_paid_date?: string
  notes?: string
  document_urls?: string
  items: POItem[]
}

type DocLink = { name: string; url: string }

const STATUS_COLORS: Record<POStatus, { color: string; bg: string; label: string }> = {
  draft:         { color: "#888",    bg: "rgba(136,136,136,0.1)",  label: "Draft" },
  placed:        { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)", label: "Placed" },
  in_production: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",  label: "In Production" },
  shipped:       { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)", label: "Shipped" },
  received:      { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",   label: "Received" },
  cancelled:     { color: "#A91E22", bg: "rgba(169,30,34,0.1)",   label: "Cancelled" },
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function parseDocUrls(raw?: string): DocLink[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export default function POTrackerPage() {
  const [pos, setPOs] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPO, setExpandedPO] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; type: "po" | "factory_invoice"; editData?: any; editId?: string }>({ open: false, type: "po" })
  const [deleteConfirm, setDeleteConfirm] = useState<PO | null>(null)
  const [filterStatus, setFilterStatus] = useState<POStatus | "all">("all")
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  useEffect(() => { loadPOs() }, [])

  async function loadPOs() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("purchase_orders")
      .select("*, purchase_order_items(*)")
      .order("created_at", { ascending: false })

    if (data) {
      setPOs(data.map((po: any) => ({
        ...po,
        items: po.purchase_order_items || [],
      })))
    }
    setLoading(false)
  }

  async function updatePOStatus(id: string, status: POStatus, extraFields?: Record<string, any>) {
    const supabase = createClient()
    await supabase.from("purchase_orders").update({ status, ...extraFields, updated_at: new Date().toISOString() }).eq("id", id)
    loadPOs()
  }

  async function deletePO(po: PO) {
    const supabase = createClient()
    await supabase.from("purchase_orders").delete().eq("id", po.id)
    setDeleteConfirm(null)
    setExpandedPO(null)
    loadPOs()
  }

  async function handleAdditionalUpload(po: PO, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingFor(po.id)
    const supabase = createClient()
    const existing = parseDocUrls(po.document_urls)
    const newDocs: DocLink[] = []
    for (const file of files) {
      const path = `po/${Date.now()}-${file.name.replace(/\s/g, "_")}`
      const { error } = await supabase.storage.from("Documents").upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from("Documents").getPublicUrl(path)
        newDocs.push({ name: file.name, url: urlData.publicUrl })
      }
    }
    await supabase.from("purchase_orders").update({ document_urls: JSON.stringify([...existing, ...newDocs]) }).eq("id", po.id)
    setUploadingFor(null)
    loadPOs()
  }

  const filtered = filterStatus === "all" ? pos : pos.filter(p => p.status === filterStatus)
  const totalOutstanding = pos.filter(p => !p.final_payment_paid_date && p.status !== "cancelled").reduce((sum, p) => sum + p.total_amount * 0.5, 0)
  const totalDepositsOwed = pos.filter(p => !p.deposit_paid_date && p.status !== "cancelled").reduce((sum, p) => sum + p.total_amount * 0.5, 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Operations</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>PO Tracker</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>Track all purchase orders to the China factory</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setModal({ open: true, type: "po" })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> New PO
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Active POs", value: pos.filter(p => !["received","cancelled"].includes(p.status)).length.toString(), color: "#fff" },
          { label: "In Production", value: pos.filter(p => p.status === "in_production").length.toString(), color: "#C4A93A" },
          { label: "Final Payments Due", value: `$${totalOutstanding.toLocaleString()}`, color: "#A91E22" },
          { label: "Deposits Owed", value: `$${totalDepositsOwed.toLocaleString()}`, color: "#6A9CC8" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {(["all", "draft", "placed", "in_production", "shipped", "received"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: filterStatus === s ? "#fff" : "#555", borderBottom: filterStatus === s ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {s === "all" ? `All (${pos.length})` : s === "in_production" ? `In Production (${pos.filter(p=>p.status==="in_production").length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${pos.filter(p=>p.status===s).length})`}
          </button>
        ))}
      </div>

      {/* PO List */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading POs...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 8px" }}>
            {filterStatus === "all" ? "No POs Yet" : `No ${filterStatus.replace("_"," ")} POs`}
          </p>
          <p style={{ fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif", margin: "0 0 20px" }}>
            {filterStatus === "all" ? "Click 'New PO' to get started." : "No POs match this filter."}
          </p>
          {filterStatus === "all" && (
            <button onClick={() => setModal({ open: true, type: "po" })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer" }}>+ New PO</button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(po => {
            const expanded = expandedPO === po.id
            const itemsExpanded = expandedItems === po.id
            const daysToShip = po.expected_ship_date ? daysUntil(po.expected_ship_date) : null
            const finalDue = po.actual_ship_date ? new Date(new Date(po.actual_ship_date).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : null
            const statusInfo = STATUS_COLORS[po.status] || STATUS_COLORS.draft
            const docs = parseDocUrls(po.document_urls)

            return (
              <div key={po.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>

                {/* Main row */}
                <div onClick={() => setExpandedPO(expanded ? null : po.id)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 140px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{po.po_number}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{po.factory_name}</p>
                  </div>

                  <div style={{ flex: "0 0 130px" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>{statusInfo.label}</span>
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                      {docs.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                          <FileText size={10} color="#5A9E5A" />
                          <span style={{ fontSize: "10px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif" }}>{docs.length}</span>
                        </div>
                      )}
                      {po.items.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                          <span style={{ fontSize: "10px", color: "#6A9CC8", fontFamily: "'Barlow', sans-serif" }}>{po.items.length} items</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, display: "flex", gap: "24px" }}>
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Order Date</p>
                      <p style={{ fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(po.order_date)}</p>
                    </div>
                    {po.expected_ship_date && (
                      <div>
                        <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Expected Ship</p>
                        <p style={{ fontSize: "12px", margin: 0, fontFamily: "'Barlow', sans-serif", color: po.status === "shipped" || po.status === "received" ? "#5A9E5A" : daysToShip !== null && daysToShip < 14 ? "#A91E22" : daysToShip !== null && daysToShip < 30 ? "#C4A93A" : "#AAA" }}>
                          {formatDate(po.expected_ship_date)}
                          {po.status === "in_production" && daysToShip !== null && daysToShip > 0 && <span style={{ fontSize: "10px", marginLeft: "6px" }}>({daysToShip}d)</span>}
                        </p>
                      </div>
                    )}
                    {finalDue && !po.final_payment_paid_date && (
                      <div>
                        <p style={{ fontSize: "9px", color: "#A91E22", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Final Pmt Due</p>
                        <p style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(finalDue)}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: "0 0 120px", textAlign: "right" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>${po.total_amount.toLocaleString()}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>
                      {po.deposit_paid_date && !po.final_payment_paid_date ? "50% paid" : po.final_payment_paid_date ? "Paid in full" : "Deposit pending"}
                    </p>
                  </div>

                  <ChevronDown size={16} color="#444" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", background: "#1E2226" }}>

                    {/* Payment timeline */}
                    <div style={{ padding: "16px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Payment Timeline</p>
                      <div style={{ display: "flex", gap: "12px" }}>
                        {[
                          { label: "50% Deposit", amount: `$${(po.total_amount * 0.5).toLocaleString()}`, due: "Due at PO placement", paid: po.deposit_paid_date, paidDate: po.deposit_paid_date },
                          { label: "50% Final", amount: `$${(po.total_amount * 0.5).toLocaleString()}`, due: po.actual_ship_date ? `Due ${formatDate(new Date(new Date(po.actual_ship_date).getTime() + 14*24*60*60*1000).toISOString().split("T")[0])}` : "Due 14 days after ship", paid: po.final_payment_paid_date, paidDate: po.final_payment_paid_date },
                        ].map(payment => (
                          <div key={payment.label} style={{ background: "#22262B", border: `0.5px solid ${payment.paid ? "rgba(90,158,90,0.3)" : "rgba(169,30,34,0.2)"}`, padding: "12px 16px", flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: payment.paid ? "#5A9E5A" : "#A91E22" }}>{payment.label}</span>
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: payment.paid ? "#5A9E5A" : "#A91E22", background: payment.paid ? "rgba(90,158,90,0.1)" : "rgba(169,30,34,0.1)", padding: "2px 6px" }}>{payment.paid ? "Paid" : "Pending"}</span>
                            </div>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff", margin: "4px 0" }}>{payment.amount}</p>
                            <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{payment.paid ? `Paid ${formatDate(payment.paidDate!)}` : payment.due}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Line Items */}
                    <div style={{ padding: "16px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                      <div
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: itemsExpanded ? "12px" : "0" }}
                        onClick={() => setExpandedItems(itemsExpanded ? null : po.id)}
                      >
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", margin: 0 }}>
                          Line Items {po.items.length > 0 ? `(${po.items.length})` : ""}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {po.items.length > 0 && (
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8" }}>
                              {itemsExpanded ? "Hide" : "Show"}
                            </span>
                          )}
                          <ChevronRight size={14} color="#444" style={{ transform: itemsExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
                        </div>
                      </div>

                      {itemsExpanded && (
                        po.items.length === 0 ? (
                          <p style={{ fontSize: "12px", color: "#333", fontFamily: "'Barlow', sans-serif", fontStyle: "italic" }}>No line items recorded for this PO</p>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                {["Product", "SKU", "Qty", "Unit Cost", "Total"].map(h => (
                                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", padding: "6px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {po.items.map(item => (
                                <tr key={item.id}>
                                  <td style={{ padding: "8px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.product_name}</td>
                                  <td style={{ padding: "8px 12px", fontSize: "11px", color: "#666", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku_code || "—"}</td>
                                  <td style={{ padding: "8px 12px", fontSize: "13px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.quantity}</td>
                                  <td style={{ padding: "8px 12px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${item.unit_cost.toFixed(2)}</td>
                                  <td style={{ padding: "8px 12px", fontSize: "13px", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(item.quantity * item.unit_cost).toLocaleString()}</td>
                                </tr>
                              ))}
                              <tr>
                                <td colSpan={4} style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", textAlign: "right" }}>PO Total</td>
                                <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>
                                  ${po.items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0).toLocaleString()}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )
                      )}
                    </div>

                    {/* Documents */}
                    <div style={{ padding: "16px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
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

                    {po.notes && <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", padding: "0 20px 16px", fontStyle: "italic" }}>Note: {po.notes}</p>}

                    {/* Actions */}
                    <div style={{ padding: "16px 20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <input type="file" accept=".pdf,.png,.jpg,.xlsx" multiple onChange={e => handleAdditionalUpload(po, e)} style={{ display: "none" }} />
                        <Upload size={12} /> {uploadingFor === po.id ? "Uploading..." : "Add Doc"}
                      </label>

                      <button
                        onClick={() => setModal({ open: true, type: "po", editData: po, editId: po.id })}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                      ><Pencil size={12} /> Edit PO</button>

                      {po.status === "placed" && <button onClick={() => updatePOStatus(po.id, "in_production")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#C4A93A", border: "none", padding: "7px 14px", cursor: "pointer" }}>Mark In Production</button>}
                      {po.status === "in_production" && <button onClick={() => updatePOStatus(po.id, "shipped", { actual_ship_date: new Date().toISOString().split("T")[0] })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "7px 14px", cursor: "pointer" }}>Mark as Shipped</button>}
                      {po.status === "shipped" && <button onClick={() => updatePOStatus(po.id, "received")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#6A9CC8", border: "none", padding: "7px 14px", cursor: "pointer" }}>Mark Received</button>}
                      {po.status === "shipped" && !po.final_payment_paid_date && <button onClick={() => updatePOStatus(po.id, po.status, { final_payment_paid_date: new Date().toISOString().split("T")[0] })} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "7px 14px", cursor: "pointer" }}>Mark Final Payment Paid</button>}

                      <button
                        onClick={() => setDeleteConfirm(po)}
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

      {/* Modal */}
      {modal.open && (
        <DocumentModal
          type={modal.type}
          editData={modal.editData}
          editId={modal.editId}
          onClose={() => setModal({ open: false, type: "po" })}
          onSave={() => { setModal({ open: false, type: "po" }); loadPOs() }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "380px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 8px" }}>Delete PO?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>
              Are you sure you want to delete <strong style={{ color: "#fff" }}>{deleteConfirm.po_number}</strong>?
            </p>
            <p style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deletePO(deleteConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Delete PO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
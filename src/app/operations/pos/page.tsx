"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Upload, ChevronDown, X } from "lucide-react"
import DocumentModal from "@/components/operations/DocumentModal"

type POStatus = "draft" | "placed" | "in_production" | "shipped" | "received" | "cancelled"

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
  items: POItem[]
}

type POItem = {
  id: string
  product_name: string
  sku: string
  quantity: number
  unit_cost: number
}

const STATUS_COLORS: Record<POStatus, { color: string; bg: string; label: string }> = {
  draft:         { color: "#888",    bg: "rgba(136,136,136,0.1)",  label: "Draft" },
  placed:        { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)", label: "Placed" },
  in_production: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",  label: "In Production" },
  shipped:       { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)", label: "Shipped" },
  received:      { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",   label: "Received" },
  cancelled:     { color: "#A91E22", bg: "rgba(169,30,34,0.1)",   label: "Cancelled" },
}

const SAMPLE_POS: PO[] = [
  {
    id: "po-001",
    po_number: "PO-2026-041",
    factory_name: "Edel China Factory",
    order_date: "2026-04-15",
    expected_ship_date: "2026-07-14",
    status: "in_production",
    total_amount: 48500,
    deposit_paid_date: "2026-04-15",
    notes: "Spring 2026 putter run",
    items: [
      { id: "1", product_name: "EAS Putter Head", sku: "HEAD-EAS-01", quantity: 60, unit_cost: 420 },
      { id: "2", product_name: "Array Putter Head", sku: "HEAD-ARR-01", quantity: 55, unit_cost: 380 },
      { id: "3", product_name: "SMS Wedge Head 56°", sku: "HEAD-SMS-56", quantity: 80, unit_cost: 185 },
    ],
  },
  {
    id: "po-002",
    po_number: "PO-2026-038",
    factory_name: "Edel China Factory",
    order_date: "2026-03-01",
    expected_ship_date: "2026-05-30",
    actual_ship_date: "2026-06-02",
    status: "shipped",
    total_amount: 32000,
    deposit_paid_date: "2026-03-01",
    items: [
      { id: "1", product_name: "SMS Pro Wedge Head", sku: "HEAD-SMSP-01", quantity: 100, unit_cost: 210 },
      { id: "2", product_name: "Putter Shaft Steel", sku: "SHAFT-PUT-01", quantity: 120, unit_cost: 28 },
    ],
  },
  {
    id: "po-003",
    po_number: "PO-2026-035",
    factory_name: "Edel China Factory",
    order_date: "2026-02-10",
    expected_ship_date: "2026-05-10",
    actual_ship_date: "2026-05-08",
    status: "received",
    total_amount: 21500,
    deposit_paid_date: "2026-02-10",
    final_payment_paid_date: "2026-05-20",
    items: [
      { id: "1", product_name: "EAS Putter Head", sku: "HEAD-EAS-01", quantity: 40, unit_cost: 420 },
      { id: "2", product_name: "Ferrule Black", sku: "FERR-BLK-01", quantity: 500, unit_cost: 2 },
    ],
  },
]

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  })
}

export default function POTrackerPage() {
  const router = useRouter()
  const [pos, setPOs] = useState<PO[]>(SAMPLE_POS)
  const [expandedPO, setExpandedPO] = useState<string | null>(null)
  const [newPOModal, setNewPOModal] = useState(false)
  const [modalType, setModalType] = useState<"po" | "factory_invoice">("po")
  const [filterStatus, setFilterStatus] = useState<POStatus | "all">("all")

  const filtered = filterStatus === "all" ? pos : pos.filter(p => p.status === filterStatus)

  const totalOutstanding = pos
    .filter(p => !p.final_payment_paid_date && p.status !== "cancelled")
    .reduce((sum, p) => sum + p.total_amount * 0.5, 0)

  const totalDepositsOwed = pos
    .filter(p => !p.deposit_paid_date && p.status !== "cancelled")
    .reduce((sum, p) => sum + p.total_amount * 0.5, 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)",
      }}>
        <div>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
            fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase",
            color: "#A91E22", marginBottom: "4px",
          }}>Operations</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>PO Tracker</h1>
          <p style={{
            fontSize: "12px", color: "#888", marginTop: "5px",
            fontFamily: "'Barlow', sans-serif", textTransform: "none",
            letterSpacing: "normal", fontWeight: 400,
          }}>Track all purchase orders to the China factory</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => { setModalType("factory_invoice"); setNewPOModal(true) }}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase", color: "#888",
              background: "transparent", border: "1px solid #333", padding: "8px 16px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            }}><Plus size={14} /> Factory Invoice</button>
          <button
            onClick={() => { setModalType("po"); setNewPOModal(true) }}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff",
              background: "#A91E22", border: "none", padding: "8px 18px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            }}><Plus size={14} /> New PO</button>
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
          <div key={stat.label} style={{
            background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)",
            borderTop: "2px solid #2A2A2A", padding: "18px 20px",
          }}>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
              fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase",
              color: "#888", marginBottom: "8px",
            }}>{stat.label}</p>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px",
              fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0,
            }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{
        display: "flex", gap: "0",
        borderBottom: "0.5px solid rgba(255,255,255,0.10)",
      }}>
        {(["all", "draft", "placed", "in_production", "shipped", "received"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "10px 16px", cursor: "pointer", border: "none",
              background: "transparent",
              color: filterStatus === s ? "#fff" : "#555",
              borderBottom: filterStatus === s ? "2px solid #A91E22" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >{s === "all" ? `All (${pos.length})` : s === "in_production" ? "In Production" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
        ))}
      </div>

      {/* PO List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(po => {
          const expanded = expandedPO === po.id
          const daysToShip = daysUntil(po.expected_ship_date)
          const finalDue = po.actual_ship_date
            ? new Date(new Date(po.actual_ship_date).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
            : null
          const statusInfo = STATUS_COLORS[po.status]

          return (
            <div key={po.id} style={{
              background: "#22262B",
              border: "0.5px solid rgba(255,255,255,0.10)",
            }}>
              {/* PO Row */}
              <div
                onClick={() => setExpandedPO(expanded ? null : po.id)}
                style={{
                  padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: "16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: "0 0 140px" }}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "14px", fontWeight: 700,
                    color: "#A91E22", margin: 0, letterSpacing: "0.05em",
                  }}>{po.po_number}</p>
                  <p style={{
                    fontSize: "11px", color: "#555",
                    fontFamily: "'Barlow', sans-serif", margin: "2px 0 0",
                  }}>{po.factory_name}</p>
                </div>

                <div style={{ flex: "0 0 130px" }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "10px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: statusInfo.color, background: statusInfo.bg,
                    padding: "3px 10px",
                  }}>{statusInfo.label}</span>
                </div>

                <div style={{ flex: 1, display: "flex", gap: "24px" }}>
                  <div>
                    <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Order Date</p>
                    <p style={{ fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(po.order_date)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Expected Ship</p>
                    <p style={{
                      fontSize: "12px", margin: 0, fontFamily: "'Barlow', sans-serif",
                      color: po.status === "shipped" || po.status === "received" ? "#5A9E5A" :
                             daysToShip < 14 ? "#A91E22" :
                             daysToShip < 30 ? "#C4A93A" : "#AAA",
                    }}>
                      {formatDate(po.expected_ship_date)}
                      {po.status === "in_production" && daysToShip > 0 && (
                        <span style={{ fontSize: "10px", marginLeft: "6px", color: daysToShip < 14 ? "#A91E22" : "#555" }}>
                          ({daysToShip}d)
                        </span>
                      )}
                    </p>
                  </div>
                  {finalDue && !po.final_payment_paid_date && (
                    <div>
                      <p style={{ fontSize: "9px", color: "#A91E22", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Final Pmt Due</p>
                      <p style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(finalDue)}</p>
                    </div>
                  )}
                </div>

                <div style={{ flex: "0 0 120px", textAlign: "right" }}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0,
                  }}>${po.total_amount.toLocaleString()}</p>
                  <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>
                    {po.deposit_paid_date && !po.final_payment_paid_date ? "50% paid" :
                     po.final_payment_paid_date ? "Paid in full" : "Deposit pending"}
                  </p>
                </div>

                <ChevronDown
                  size={16}
                  color="#444"
                  style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}
                />
              </div>

              {/* Expanded details */}
              {expanded && (
                <div style={{
                  borderTop: "0.5px solid rgba(255,255,255,0.08)",
                  padding: "16px 20px",
                  background: "#1E2226",
                }}>
                  <div style={{ marginBottom: "20px" }}>
                    <p style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                      fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
                      color: "#555", marginBottom: "12px",
                    }}>Payment Timeline</p>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {[
                        {
                          label: "50% Deposit",
                          amount: `$${(po.total_amount * 0.5).toLocaleString()}`,
                          due: "Due at PO placement",
                          paid: po.deposit_paid_date,
                          paidDate: po.deposit_paid_date,
                        },
                        {
                          label: "50% Final",
                          amount: `$${(po.total_amount * 0.5).toLocaleString()}`,
                          due: po.actual_ship_date ? `Due ${formatDate(new Date(new Date(po.actual_ship_date).getTime() + 14*24*60*60*1000).toISOString().split("T")[0])}` : "Due 14 days after ship",
                          paid: po.final_payment_paid_date,
                          paidDate: po.final_payment_paid_date,
                        },
                      ].map(payment => (
                        <div key={payment.label} style={{
                          background: "#22262B",
                          border: `0.5px solid ${payment.paid ? "rgba(90,158,90,0.3)" : "rgba(169,30,34,0.2)"}`,
                          padding: "12px 16px", flex: "1", minWidth: "200px",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{
                              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                              fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                              color: payment.paid ? "#5A9E5A" : "#A91E22",
                            }}>{payment.label}</span>
                            <span style={{
                              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                              fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                              color: payment.paid ? "#5A9E5A" : "#A91E22",
                              background: payment.paid ? "rgba(90,158,90,0.1)" : "rgba(169,30,34,0.1)",
                              padding: "2px 6px",
                            }}>{payment.paid ? "Paid" : "Pending"}</span>
                          </div>
                          <p style={{
                            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px",
                            fontWeight: 700, color: "#fff", margin: "4px 0",
                          }}>{payment.amount}</p>
                          <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                            {payment.paid ? `Paid ${formatDate(payment.paidDate!)}` : payment.due}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <p style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                      fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
                      color: "#555", marginBottom: "10px",
                    }}>Line Items</p>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Product", "SKU", "Qty", "Unit Cost", "Total"].map(h => (
                            <th key={h} style={{
                              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px",
                              fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
                              color: "#444", padding: "6px 12px", textAlign: "left",
                              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map(item => (
                          <tr key={item.id}>
                            <td style={{ padding: "8px 12px", fontSize: "13px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.product_name}</td>
                            <td style={{ padding: "8px 12px", fontSize: "12px", color: "#666", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku}</td>
                            <td style={{ padding: "8px 12px", fontSize: "13px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.quantity}</td>
                            <td style={{ padding: "8px 12px", fontSize: "13px", color: "#AAA", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${item.unit_cost.toFixed(2)}</td>
                            <td style={{ padding: "8px 12px", fontSize: "13px", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(item.quantity * item.unit_cost).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                      fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                      color: "#888", background: "transparent", border: "1px solid #333",
                      padding: "7px 14px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}><Upload size={12} /> Upload Doc</button>
                    <button style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                      fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                      color: "#888", background: "transparent", border: "1px solid #333",
                      padding: "7px 14px", cursor: "pointer",
                    }}>Edit PO</button>
                    {po.status === "in_production" && (
                      <button style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                        fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "#fff", background: "#A91E22", border: "none",
                        padding: "7px 14px", cursor: "pointer",
                      }}>Mark as Shipped</button>
                    )}
                    {po.status === "shipped" && !po.final_payment_paid_date && (
                      <button style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                        fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "#fff", background: "#5A9E5A", border: "none",
                        padding: "7px 14px", cursor: "pointer",
                      }}>Mark Final Payment Paid</button>
                    )}
                  </div>

                  {po.notes && (
                    <p style={{
                      fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif",
                      marginTop: "12px", fontStyle: "italic",
                    }}>Note: {po.notes}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {newPOModal && (
        <DocumentModal
          type={modalType}
          onClose={() => setNewPOModal(false)}
          onSave={(data) => {
            console.log("Saved:", data)
            setNewPOModal(false)
          }}
        />
      )}

    </div>
  )
}
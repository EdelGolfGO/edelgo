"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronDown } from "lucide-react"

type InvoiceStatus = "pending" | "deposit_received" | "shipped" | "final_pending" | "paid" | "overdue"

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
  notes?: string
}

const STATUS_COLORS: Record<InvoiceStatus, { color: string; bg: string; label: string }> = {
  pending:          { color: "#888",    bg: "rgba(136,136,136,0.1)",  label: "Pending Deposit" },
  deposit_received: { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)", label: "Deposit Received" },
  shipped:          { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",  label: "Shipped" },
  final_pending:    { color: "#A91E22", bg: "rgba(169,30,34,0.1)",   label: "Final Pmt Pending" },
  paid:             { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",   label: "Paid in Full" },
  overdue:          { color: "#A91E22", bg: "rgba(169,30,34,0.2)",   label: "Overdue" },
}

const SAMPLE_INVOICES: Invoice[] = [
  {
    id: "inv-001",
    invoice_number: "INV-2026-088",
    dealer_name: "Golf Galaxy – Denver",
    invoice_date: "2026-05-01",
    total_amount: 12750,
    deposit_paid_date: "2026-05-10",
    ship_date: "2026-07-14",
    status: "deposit_received",
    notes: "Spring putter order",
  },
  {
    id: "inv-002",
    invoice_number: "INV-2026-085",
    dealer_name: "PGA Tour Superstore",
    invoice_date: "2026-04-15",
    total_amount: 28400,
    deposit_paid_date: "2026-04-22",
    ship_date: "2026-07-14",
    status: "deposit_received",
  },
  {
    id: "inv-003",
    invoice_number: "INV-2026-079",
    dealer_name: "Pinehurst Pro Shop",
    invoice_date: "2026-03-10",
    total_amount: 8600,
    deposit_paid_date: "2026-03-18",
    ship_date: "2026-06-02",
    final_payment_paid_date: "2026-07-01",
    status: "paid",
  },
  {
    id: "inv-004",
    invoice_number: "INV-2026-091",
    dealer_name: "Fairway & Greene",
    invoice_date: "2026-05-20",
    total_amount: 6200,
    status: "pending",
  },
  {
    id: "inv-005",
    invoice_number: "INV-2026-071",
    dealer_name: "The Caddy Shack",
    invoice_date: "2026-02-28",
    total_amount: 4800,
    deposit_paid_date: "2026-03-08",
    ship_date: "2026-05-28",
    status: "final_pending",
  },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  })
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>(SAMPLE_INVOICES)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all")

  const filtered = filter === "all" ? invoices : invoices.filter(i => i.status === filter)

  const totalReceivable = invoices
    .filter(i => i.status !== "paid" && i.status !== "overdue")
    .reduce((sum, i) => {
      let owed = 0
      if (!i.deposit_paid_date) owed += i.total_amount * 0.5
      if (!i.final_payment_paid_date && i.ship_date) owed += i.total_amount * 0.5
      return sum + owed
    }, 0)

  const overdueCount = invoices.filter(i => {
    if (i.status === "paid") return false
    if (!i.deposit_paid_date) {
      const due = addDays(i.invoice_date, 14)
      if (daysUntil(due) < 0) return true
    }
    if (i.ship_date && !i.final_payment_paid_date) {
      const due = addDays(i.ship_date, 45)
      if (daysUntil(due) < 0) return true
    }
    return false
  }).length

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
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Invoices</h1>
          <p style={{
            fontSize: "12px", color: "#888", marginTop: "5px",
            fontFamily: "'Barlow', sans-serif", textTransform: "none",
            letterSpacing: "normal", fontWeight: 400,
          }}>Track distributor invoices and payment status</p>
        </div>
        <button style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff",
          background: "#A91E22", border: "none", padding: "8px 18px",
          cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
        }}><Plus size={14} /> New Invoice</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Total Invoices", value: invoices.length.toString(), color: "#fff" },
          { label: "Pending Deposit", value: invoices.filter(i => i.status === "pending").length.toString(), color: "#888" },
          { label: "Total Receivable", value: `$${totalReceivable.toLocaleString()}`, color: "#6A9CC8" },
          { label: "Overdue", value: overdueCount.toString(), color: overdueCount > 0 ? "#A91E22" : "#5A9E5A" },
        ].map(stat => (
          <div key={stat.label} style={{
            background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)",
            borderTop: `2px solid ${stat.color === "#A91E22" ? "#A91E22" : "#2A2A2A"}`,
            padding: "18px 20px",
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
        display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)",
      }}>
        {(["all", "pending", "deposit_received", "shipped", "final_pending", "paid"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "10px 14px", cursor: "pointer", border: "none",
              background: "transparent", whiteSpace: "nowrap",
              color: filter === s ? "#fff" : "#555",
              borderBottom: filter === s ? "2px solid #A91E22" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {s === "all" ? `All (${invoices.length})` :
             s === "deposit_received" ? "Deposit Recv'd" :
             s === "final_pending" ? "Final Pending" :
             s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(invoice => {
          const isExpanded = expanded === invoice.id
          const statusInfo = STATUS_COLORS[invoice.status]
          const depositDue = addDays(invoice.invoice_date, 14)
          const finalDue = invoice.ship_date ? addDays(invoice.ship_date, 45) : null
          const depositDaysLeft = daysUntil(depositDue)
          const finalDaysLeft = finalDue ? daysUntil(finalDue) : null

          return (
            <div key={invoice.id} style={{
              background: "#22262B",
              border: "0.5px solid rgba(255,255,255,0.10)",
            }}>
              <div
                onClick={() => setExpanded(isExpanded ? null : invoice.id)}
                style={{
                  padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: "16px",
                  cursor: "pointer",
                }}
              >
                {/* Invoice number */}
                <div style={{ flex: "0 0 150px" }}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "14px", fontWeight: 700,
                    color: "#A91E22", margin: 0, letterSpacing: "0.05em",
                  }}>{invoice.invoice_number}</p>
                  <p style={{
                    fontSize: "11px", color: "#555",
                    fontFamily: "'Barlow', sans-serif", margin: "2px 0 0",
                  }}>{invoice.dealer_name}</p>
                </div>

                {/* Status */}
                <div style={{ flex: "0 0 160px" }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "10px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: statusInfo.color, background: statusInfo.bg,
                    padding: "3px 10px",
                  }}>{statusInfo.label}</span>
                </div>

                {/* Key dates */}
                <div style={{ flex: 1, display: "flex", gap: "20px" }}>
                  <div>
                    <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Invoiced</p>
                    <p style={{ fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(invoice.invoice_date)}</p>
                  </div>
                  {!invoice.deposit_paid_date && (
                    <div>
                      <p style={{ fontSize: "9px", color: depositDaysLeft < 0 ? "#A91E22" : "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>
                        Deposit Due
                      </p>
                      <p style={{
                        fontSize: "12px", fontFamily: "'Barlow', sans-serif", margin: 0,
                        color: depositDaysLeft < 0 ? "#A91E22" : depositDaysLeft < 7 ? "#C4A93A" : "#AAA",
                      }}>
                        {formatDate(depositDue)}
                        <span style={{ fontSize: "10px", marginLeft: "4px", color: depositDaysLeft < 0 ? "#A91E22" : "#555" }}>
                          ({depositDaysLeft < 0 ? `${Math.abs(depositDaysLeft)}d overdue` : `${depositDaysLeft}d`})
                        </span>
                      </p>
                    </div>
                  )}
                  {invoice.ship_date && (
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Ship Date</p>
                      <p style={{ fontSize: "12px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(invoice.ship_date)}</p>
                    </div>
                  )}
                  {finalDue && !invoice.final_payment_paid_date && (
                    <div>
                      <p style={{ fontSize: "9px", color: "#A91E22", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Final Pmt Due</p>
                      <p style={{
                        fontSize: "12px", fontFamily: "'Barlow', sans-serif", margin: 0,
                        color: finalDaysLeft! < 0 ? "#A91E22" : finalDaysLeft! < 14 ? "#C4A93A" : "#AAA",
                      }}>
                        {formatDate(finalDue)}
                        <span style={{ fontSize: "10px", marginLeft: "4px" }}>
                          ({finalDaysLeft! < 0 ? `${Math.abs(finalDaysLeft!)}d overdue` : `${finalDaysLeft}d`})
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div style={{ flex: "0 0 120px", textAlign: "right" }}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0,
                  }}>${invoice.total_amount.toLocaleString()}</p>
                  <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>
                    {invoice.status === "paid" ? "Paid in full" :
                     invoice.deposit_paid_date ? `$${(invoice.total_amount * 0.5).toLocaleString()} received` :
                     `$${(invoice.total_amount * 0.5).toLocaleString()} deposit due`}
                  </p>
                </div>

                <ChevronDown
                  size={16} color="#444"
                  style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }}
                />
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div style={{
                  borderTop: "0.5px solid rgba(255,255,255,0.08)",
                  padding: "16px 20px", background: "#1E2226",
                }}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                    fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
                    color: "#555", marginBottom: "12px",
                  }}>Payment Schedule</p>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                    {[
                      {
                        label: "50% Deposit",
                        amount: `$${(invoice.total_amount * 0.5).toLocaleString()}`,
                        due: `Due ${formatDate(depositDue)}`,
                        paid: !!invoice.deposit_paid_date,
                        paidDate: invoice.deposit_paid_date,
                      },
                      {
                        label: "50% Final",
                        amount: `$${(invoice.total_amount * 0.5).toLocaleString()}`,
                        due: finalDue ? `Due ${formatDate(finalDue)}` : "Due 45 days after ship",
                        paid: !!invoice.final_payment_paid_date,
                        paidDate: invoice.final_payment_paid_date,
                      },
                    ].map(p => (
                      <div key={p.label} style={{
                        background: "#22262B",
                        border: `0.5px solid ${p.paid ? "rgba(90,158,90,0.3)" : "rgba(169,30,34,0.2)"}`,
                        padding: "12px 16px", flex: 1,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{
                            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                            fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                            color: p.paid ? "#5A9E5A" : "#A91E22",
                          }}>{p.label}</span>
                          <span style={{
                            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                            fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                            color: p.paid ? "#5A9E5A" : "#A91E22",
                            background: p.paid ? "rgba(90,158,90,0.1)" : "rgba(169,30,34,0.1)",
                            padding: "2px 6px",
                          }}>{p.paid ? "Received" : "Pending"}</span>
                        </div>
                        <p style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px",
                          fontWeight: 700, color: "#fff", margin: "4px 0",
                        }}>{p.amount}</p>
                        <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                          {p.paid ? `Received ${formatDate(p.paidDate!)}` : p.due}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    {!invoice.deposit_paid_date && (
                      <button style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                        fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "#fff", background: "#A91E22", border: "none",
                        padding: "7px 14px", cursor: "pointer",
                      }}>Mark Deposit Received</button>
                    )}
                    {invoice.deposit_paid_date && !invoice.ship_date && (
                      <button style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                        fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "#fff", background: "#6A9CC8", border: "none",
                        padding: "7px 14px", cursor: "pointer",
                      }}>Mark as Shipped</button>
                    )}
                    {invoice.ship_date && !invoice.final_payment_paid_date && (
                      <button style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                        fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "#fff", background: "#5A9E5A", border: "none",
                        padding: "7px 14px", cursor: "pointer",
                      }}>Mark Final Payment Received</button>
                    )}
                    <button style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                      fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                      color: "#888", background: "transparent", border: "1px solid #333",
                      padding: "7px 14px", cursor: "pointer",
                    }}>Edit Invoice</button>
                  </div>

                  {invoice.notes && (
                    <p style={{
                      fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif",
                      marginTop: "12px", fontStyle: "italic",
                    }}>Note: {invoice.notes}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
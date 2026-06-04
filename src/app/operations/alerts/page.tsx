"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Clock, CheckCircle, XCircle, ChevronRight, Bell } from "lucide-react"

type AlertSeverity = "critical" | "warning" | "info" | "completed"

type Alert = {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  amount?: number
  reference: string
  dueDate: string
  category: "payment_in" | "payment_out" | "shipment" | "po"
  actionLabel: string
  actionHref: string
}

const SEVERITY_CONFIG = {
  critical: { color: "#A91E22", bg: "rgba(169,30,34,0.10)", border: "rgba(169,30,34,0.25)", icon: XCircle,    label: "Critical" },
  warning:  { color: "#C4A93A", bg: "rgba(196,169,58,0.10)", border: "rgba(196,169,58,0.25)", icon: AlertTriangle, label: "Due Soon" },
  info:     { color: "#6A9CC8", bg: "rgba(106,156,200,0.10)", border: "rgba(106,156,200,0.25)", icon: Clock,  label: "Upcoming" },
  completed:{ color: "#5A9E5A", bg: "rgba(90,158,90,0.10)", border: "rgba(90,158,90,0.25)", icon: CheckCircle, label: "Completed" },
}

const SAMPLE_ALERTS: Alert[] = [
  {
    id: "a1",
    severity: "critical",
    title: "Factory Final Payment Overdue",
    description: "Final 50% payment to Edel China Factory for PO-2026-038 was due June 16. Now 18 days overdue.",
    amount: 16000,
    reference: "PO-2026-038",
    dueDate: "2026-06-16",
    category: "payment_out",
    actionLabel: "View PO",
    actionHref: "/operations/pos",
  },
  {
    id: "a2",
    severity: "critical",
    title: "Distributor Deposit Overdue",
    description: "50% deposit from Fairway & Greene for INV-2026-091 was due June 3. Now 4 days overdue.",
    amount: 3100,
    reference: "INV-2026-091",
    dueDate: "2026-06-03",
    category: "payment_in",
    actionLabel: "View Invoice",
    actionHref: "/operations/invoices",
  },
  {
    id: "a3",
    severity: "warning",
    title: "Distributor Deposit Due in 4 Days",
    description: "50% deposit from Fairway & Greene for INV-2026-091 is due July 4. Send a reminder.",
    amount: 3100,
    reference: "INV-2026-091",
    dueDate: "2026-07-04",
    category: "payment_in",
    actionLabel: "View Invoice",
    actionHref: "/operations/invoices",
  },
  {
    id: "a4",
    severity: "warning",
    title: "PO-2026-041 Ships in 34 Days",
    description: "Spring 2026 putter run expected to ship July 8. Confirm factory is on schedule.",
    reference: "PO-2026-041",
    dueDate: "2026-07-08",
    category: "shipment",
    actionLabel: "View PO",
    actionHref: "/operations/pos",
  },
  {
    id: "a5",
    severity: "info",
    title: "Factory Final Payment Due in 48 Days",
    description: "Final 50% payment to Edel China Factory for PO-2026-041 due July 22 (14 days after ship).",
    amount: 24250,
    reference: "PO-2026-041",
    dueDate: "2026-07-22",
    category: "payment_out",
    actionLabel: "View PO",
    actionHref: "/operations/pos",
  },
  {
    id: "a6",
    severity: "info",
    title: "Golf Galaxy Final Payment Due Aug 1",
    description: "Final 50% from Golf Galaxy – Denver for INV-2026-088 due August 1 (45 days after ship).",
    amount: 6375,
    reference: "INV-2026-088",
    dueDate: "2026-08-01",
    category: "payment_in",
    actionLabel: "View Invoice",
    actionHref: "/operations/invoices",
  },
  {
    id: "a7",
    severity: "info",
    title: "PGA Tour Superstore Final Payment Due Aug 22",
    description: "Final 50% from PGA Tour Superstore for INV-2026-085 due August 22.",
    amount: 14200,
    reference: "INV-2026-085",
    dueDate: "2026-08-22",
    category: "payment_in",
    actionLabel: "View Invoice",
    actionHref: "/operations/invoices",
  },
  {
    id: "a8",
    severity: "completed",
    title: "Golf Galaxy Deposit Received",
    description: "50% deposit of $6,375 received from Golf Galaxy – Denver on May 10.",
    amount: 6375,
    reference: "INV-2026-088",
    dueDate: "2026-05-10",
    category: "payment_in",
    actionLabel: "View Invoice",
    actionHref: "/operations/invoices",
  },
  {
    id: "a9",
    severity: "completed",
    title: "PGA Tour Superstore Deposit Received",
    description: "50% deposit of $14,200 received from PGA Tour Superstore on April 22.",
    amount: 14200,
    reference: "INV-2026-085",
    dueDate: "2026-04-22",
    category: "payment_in",
    actionLabel: "View Invoice",
    actionHref: "/operations/invoices",
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

export default function AlertsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<AlertSeverity | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<Alert["category"] | "all">("all")
  const [dismissed, setDismissed] = useState<string[]>([])

  const visible = SAMPLE_ALERTS.filter(a => {
    if (dismissed.includes(a.id)) return false
    if (filter !== "all" && a.severity !== filter) return false
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false
    return true
  })

  const criticalCount = SAMPLE_ALERTS.filter(a => a.severity === "critical" && !dismissed.includes(a.id)).length
  const warningCount = SAMPLE_ALERTS.filter(a => a.severity === "warning" && !dismissed.includes(a.id)).length
  const totalOwed = SAMPLE_ALERTS
    .filter(a => a.category === "payment_out" && a.severity !== "completed" && !dismissed.includes(a.id) && a.amount)
    .reduce((sum, a) => sum + (a.amount || 0), 0)
  const totalReceivable = SAMPLE_ALERTS
    .filter(a => a.category === "payment_in" && a.severity !== "completed" && !dismissed.includes(a.id) && a.amount)
    .reduce((sum, a) => sum + (a.amount || 0), 0)

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
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Alerts</h1>
          <p style={{
            fontSize: "12px", color: "#888", marginTop: "5px",
            fontFamily: "'Barlow', sans-serif", textTransform: "none",
            letterSpacing: "normal", fontWeight: 400,
          }}>Payment deadlines, shipment warnings, and action items</p>
        </div>
        {criticalCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(169,30,34,0.1)", border: "0.5px solid rgba(169,30,34,0.3)",
            padding: "10px 16px",
          }}>
            <AlertTriangle size={16} color="#A91E22" />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px",
              fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "#A91E22",
            }}>{criticalCount} Critical Alert{criticalCount !== 1 ? "s" : ""} Require Action</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Critical", value: criticalCount.toString(), color: criticalCount > 0 ? "#A91E22" : "#5A9E5A", top: criticalCount > 0 ? "#A91E22" : "#2A2A2A" },
          { label: "Due Soon", value: warningCount.toString(), color: warningCount > 0 ? "#C4A93A" : "#5A9E5A", top: "#2A2A2A" },
          { label: "Total Owed to Factory", value: `$${totalOwed.toLocaleString()}`, color: "#A91E22", top: "#A91E22" },
          { label: "Total Receivable", value: `$${totalReceivable.toLocaleString()}`, color: "#5A9E5A", top: "#2A2A2A" },
        ].map(stat => (
          <div key={stat.label} style={{
            background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)",
            borderTop: `2px solid ${stat.top}`, padding: "18px 20px",
          }}>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
              fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase",
              color: "#888", marginBottom: "8px",
            }}>{stat.label}</p>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px",
              fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0,
            }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
          {(["all", "critical", "warning", "info", "completed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "11px", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "8px 14px", cursor: "pointer", border: "none",
                background: "transparent", whiteSpace: "nowrap",
                color: filter === s ? "#fff" : "#555",
                borderBottom: filter === s ? "2px solid #A91E22" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >{s === "all" ? `All (${SAMPLE_ALERTS.length})` : SEVERITY_CONFIG[s].label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
          {(["all", "payment_in", "payment_out", "shipment", "po"] as const).map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "5px 10px", cursor: "pointer",
                color: categoryFilter === c ? "#fff" : "#555",
                background: categoryFilter === c ? "rgba(255,255,255,0.08)" : "transparent",
                border: "0.5px solid " + (categoryFilter === c ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"),
              }}
            >
              {c === "all" ? "All Types" :
               c === "payment_in" ? "↓ Money In" :
               c === "payment_out" ? "↑ Money Out" :
               c === "shipment" ? "✈ Shipments" : "📋 POs"}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {visible.length === 0 ? (
          <div style={{
            background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)",
            padding: "60px 20px", textAlign: "center",
          }}>
            <CheckCircle size={32} color="#5A9E5A" style={{ margin: "0 auto 12px" }} />
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px",
              fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              color: "#5A9E5A", margin: "0 0 4px",
            }}>All Clear</p>
            <p style={{ fontSize: "13px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
              No alerts matching this filter.
            </p>
          </div>
        ) : (
          visible.map(alert => {
            const config = SEVERITY_CONFIG[alert.severity]
            const Icon = config.icon
            const daysLeft = daysUntil(alert.dueDate)

            return (
              <div key={alert.id} style={{
                background: "#22262B",
                border: `0.5px solid ${config.border}`,
                borderLeft: `3px solid ${config.color}`,
                display: "flex", alignItems: "flex-start", gap: "16px",
                padding: "16px 20px",
              }}>
                <div style={{
                  width: "36px", height: "36px", flexShrink: 0,
                  background: config.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={18} color={config.color} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                        fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                        color: config.color, marginRight: "8px",
                      }}>{config.label}</span>
                      <span style={{ fontSize: "10px", color: "#444", fontFamily: "'Barlow', sans-serif" }}>
                        {alert.reference}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {alert.amount && (
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px",
                          fontWeight: 700, color: config.color,
                        }}>${alert.amount.toLocaleString()}</span>
                      )}
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                        fontWeight: 600, color: daysLeft < 0 ? "#A91E22" : daysLeft < 7 ? "#C4A93A" : "#555",
                      }}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` :
                         daysLeft === 0 ? "Due today" : `${daysLeft}d`}
                      </span>
                    </div>
                  </div>

                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                    color: "#fff", margin: "0 0 4px",
                  }}>{alert.title}</p>

                  <p style={{
                    fontSize: "12px", color: "#777", fontFamily: "'Barlow', sans-serif",
                    margin: "0 0 10px", fontWeight: 400,
                    textTransform: "none", letterSpacing: "normal",
                  }}>{alert.description}</p>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif" }}>
                      {alert.severity === "completed" ? "Completed" : `Due ${formatDate(alert.dueDate)}`}
                    </span>
                    <button
                      onClick={() => router.push(alert.actionHref)}
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                        fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: config.color, background: config.bg,
                        border: `0.5px solid ${config.border}`,
                        padding: "4px 10px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "4px",
                      }}
                    >{alert.actionLabel} <ChevronRight size={11} /></button>
                    {alert.severity !== "completed" && (
                      <button
                        onClick={() => setDismissed(prev => [...prev, alert.id])}
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                          fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                          color: "#333", background: "transparent",
                          border: "0.5px solid rgba(255,255,255,0.06)",
                          padding: "4px 10px", cursor: "pointer",
                        }}
                      >Dismiss</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}
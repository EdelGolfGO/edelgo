"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Clock, CheckCircle, XCircle, ChevronRight, Bell } from "lucide-react"
import { createClient } from "@/lib/supabase"

type AlertSeverity = "critical" | "warning" | "info" | "completed"
type AlertCategory = "payment_in" | "payment_out" | "shipment" | "po"

type Alert = {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  amount?: number
  reference: string
  dueDate: string
  category: AlertCategory
  actionLabel: string
  actionHref: string
}

const SEVERITY_CONFIG = {
  critical:  { color: "#A91E22", bg: "rgba(169,30,34,0.10)",  border: "rgba(169,30,34,0.25)",  icon: XCircle,       label: "Critical" },
  warning:   { color: "#C4A93A", bg: "rgba(196,169,58,0.10)", border: "rgba(196,169,58,0.25)", icon: AlertTriangle, label: "Due Soon" },
  info:      { color: "#6A9CC8", bg: "rgba(106,156,200,0.10)",border: "rgba(106,156,200,0.25)",icon: Clock,         label: "Upcoming" },
  completed: { color: "#5A9E5A", bg: "rgba(90,158,90,0.10)",  border: "rgba(90,158,90,0.25)", icon: CheckCircle,   label: "Completed" },
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function daysUntil(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + "T00:00:00")
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getSeverity(daysLeft: number, isPaid: boolean): AlertSeverity {
  if (isPaid) return "completed"
  if (daysLeft < 0) return "critical"
  if (daysLeft <= 7) return "warning"
  return "info"
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  })
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AlertSeverity | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory | "all">("all")
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => { loadAlerts() }, [])

  async function loadAlerts() {
    setLoading(true)
    const supabase = createClient()

    const [posResult, invoicesResult] = await Promise.all([
      supabase.from("purchase_orders").select("*").neq("status", "cancelled"),
      supabase.from("distributor_invoices").select("*"),
    ])

    const newAlerts: Alert[] = []

    // Process POs
    for (const po of posResult.data || []) {
      const depositDaysLeft = daysUntil(po.order_date)
      const depositSeverity = getSeverity(depositDaysLeft, !!po.deposit_paid_date)

      // Deposit to factory
      newAlerts.push({
        id: `po-dep-${po.id}`,
        severity: depositSeverity,
        title: depositSeverity === "completed"
          ? `Deposit Paid — ${po.po_number}`
          : depositDaysLeft < 0
          ? `Factory Deposit Overdue — ${po.po_number}`
          : `Factory Deposit Due${depositDaysLeft <= 7 ? " Soon" : ""} — ${po.po_number}`,
        description: depositSeverity === "completed"
          ? `50% deposit of $${(po.total_amount * 0.5).toLocaleString()} paid to ${po.factory_name} on ${formatDate(po.deposit_paid_date)}.`
          : `50% deposit of $${(po.total_amount * 0.5).toLocaleString()} due to ${po.factory_name}. ${depositDaysLeft < 0 ? `${Math.abs(depositDaysLeft)} days overdue.` : `Due ${formatDate(po.order_date)}.`}`,
        amount: po.total_amount * 0.5,
        reference: po.po_number,
        dueDate: po.order_date,
        category: "payment_out",
        actionLabel: "View PO",
        actionHref: "/operations/pos",
      })

      // Final payment to factory (only if shipped)
      if (po.actual_ship_date) {
        const finalDue = addDays(po.actual_ship_date, 14)
        const finalDaysLeft = daysUntil(finalDue)
        const finalSeverity = getSeverity(finalDaysLeft, !!po.final_payment_paid_date)

        newAlerts.push({
          id: `po-final-${po.id}`,
          severity: finalSeverity,
          title: finalSeverity === "completed"
            ? `Final Payment Sent — ${po.po_number}`
            : finalDaysLeft < 0
            ? `Factory Final Payment Overdue — ${po.po_number}`
            : `Factory Final Payment Due${finalDaysLeft <= 7 ? " Soon" : ""} — ${po.po_number}`,
          description: finalSeverity === "completed"
            ? `Final 50% of $${(po.total_amount * 0.5).toLocaleString()} paid to ${po.factory_name}.`
            : `Final 50% payment of $${(po.total_amount * 0.5).toLocaleString()} due to ${po.factory_name} by ${formatDate(finalDue)}. ${finalDaysLeft < 0 ? `${Math.abs(finalDaysLeft)} days overdue.` : `${finalDaysLeft} days remaining.`}`,
          amount: po.total_amount * 0.5,
          reference: po.po_number,
          dueDate: finalDue,
          category: "payment_out",
          actionLabel: "View PO",
          actionHref: "/operations/pos",
        })
      }

      // Ship date warning (in production only)
      if (po.status === "in_production" && po.expected_ship_date) {
        const shipDaysLeft = daysUntil(po.expected_ship_date)
        const shipSeverity = shipDaysLeft < 0 ? "critical" : shipDaysLeft <= 14 ? "warning" : "info"

        newAlerts.push({
          id: `po-ship-${po.id}`,
          severity: shipSeverity,
          title: shipDaysLeft < 0
            ? `Ship Date Passed — ${po.po_number}`
            : `${po.po_number} Expected to Ship in ${shipDaysLeft} Days`,
          description: `${po.factory_name} expected ship date: ${formatDate(po.expected_ship_date)}. ${shipDaysLeft < 0 ? "Shipment is overdue — confirm status with factory." : "Confirm factory is on schedule."}`,
          reference: po.po_number,
          dueDate: po.expected_ship_date,
          category: "shipment",
          actionLabel: "View PO",
          actionHref: "/operations/pos",
        })
      }
    }

    // Process invoices
    for (const inv of invoicesResult.data || []) {
      const isFactory = inv.invoice_type === "factory"
      const depositDue = addDays(inv.invoice_date, 14)
      const depositDaysLeft = daysUntil(depositDue)
      const depositSeverity = getSeverity(depositDaysLeft, !!inv.deposit_paid_date)

      newAlerts.push({
        id: `inv-dep-${inv.id}`,
        severity: depositSeverity,
        title: depositSeverity === "completed"
          ? isFactory
            ? `Deposit Paid to Factory — ${inv.invoice_number}`
            : `Deposit Received — ${inv.invoice_number}`
          : depositDaysLeft < 0
          ? isFactory
            ? `Factory Invoice Deposit Overdue — ${inv.invoice_number}`
            : `Distributor Deposit Overdue — ${inv.invoice_number}`
          : isFactory
          ? `Factory Deposit Due${depositDaysLeft <= 7 ? " Soon" : ""} — ${inv.invoice_number}`
          : `Deposit Due from ${inv.dealer_name}${depositDaysLeft <= 7 ? " — Due Soon" : ""}`,
        description: depositSeverity === "completed"
          ? `50% deposit of $${(inv.total_amount * 0.5).toLocaleString()} ${isFactory ? `paid to ${inv.dealer_name}` : `received from ${inv.dealer_name}`}.`
          : `50% deposit of $${(inv.total_amount * 0.5).toLocaleString()} ${isFactory ? `due to ${inv.dealer_name}` : `due from ${inv.dealer_name}`} by ${formatDate(depositDue)}. ${depositDaysLeft < 0 ? `${Math.abs(depositDaysLeft)} days overdue.` : `${depositDaysLeft} days remaining.`}`,
        amount: inv.total_amount * 0.5,
        reference: inv.invoice_number,
        dueDate: depositDue,
        category: isFactory ? "payment_out" : "payment_in",
        actionLabel: "View Invoice",
        actionHref: "/operations/invoices",
      })

      // Final payment
      if (inv.ship_date) {
        const finalDue = addDays(inv.ship_date, isFactory ? 14 : 45)
        const finalDaysLeft = daysUntil(finalDue)
        const finalSeverity = getSeverity(finalDaysLeft, !!inv.final_payment_paid_date)

        newAlerts.push({
          id: `inv-final-${inv.id}`,
          severity: finalSeverity,
          title: finalSeverity === "completed"
            ? isFactory
              ? `Final Payment Sent — ${inv.invoice_number}`
              : `Final Payment Received — ${inv.invoice_number}`
            : finalDaysLeft < 0
            ? isFactory
              ? `Factory Final Payment Overdue — ${inv.invoice_number}`
              : `Distributor Final Payment Overdue — ${inv.invoice_number}`
            : isFactory
            ? `Factory Final Due${finalDaysLeft <= 7 ? " Soon" : ""} — ${inv.invoice_number}`
            : `Final Payment Due from ${inv.dealer_name}${finalDaysLeft <= 7 ? " — Due Soon" : ""}`,
          description: finalSeverity === "completed"
            ? `Final 50% of $${(inv.total_amount * 0.5).toLocaleString()} ${isFactory ? "paid" : "received"}.`
            : `Final 50% of $${(inv.total_amount * 0.5).toLocaleString()} ${isFactory ? `due to ${inv.dealer_name}` : `due from ${inv.dealer_name}`} by ${formatDate(finalDue)}. ${finalDaysLeft < 0 ? `${Math.abs(finalDaysLeft)} days overdue.` : `${finalDaysLeft} days remaining.`}`,
          amount: inv.total_amount * 0.5,
          reference: inv.invoice_number,
          dueDate: finalDue,
          category: isFactory ? "payment_out" : "payment_in",
          actionLabel: "View Invoice",
          actionHref: "/operations/invoices",
        })
      }
    }

    // Sort: critical first, then by date
    newAlerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2, completed: 3 }
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity]
      return a.dueDate.localeCompare(b.dueDate)
    })

    setAlerts(newAlerts)
    setLoading(false)
  }

  const visible = alerts.filter(a => {
    if (dismissed.includes(a.id)) return false
    if (filter !== "all" && a.severity !== filter) return false
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false
    return true
  })

  const criticalCount = alerts.filter(a => a.severity === "critical" && !dismissed.includes(a.id)).length
  const warningCount = alerts.filter(a => a.severity === "warning" && !dismissed.includes(a.id)).length
  const totalOwed = alerts.filter(a => a.category === "payment_out" && a.severity !== "completed" && !dismissed.includes(a.id) && a.amount).reduce((sum, a) => sum + (a.amount || 0), 0)
  const totalReceivable = alerts.filter(a => a.category === "payment_in" && a.severity !== "completed" && !dismissed.includes(a.id) && a.amount).reduce((sum, a) => sum + (a.amount || 0), 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Operations</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Alerts</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
            {loading ? "Loading alerts..." : `${alerts.length} alerts from your POs and invoices`}
          </p>
        </div>
        {criticalCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(169,30,34,0.1)", border: "0.5px solid rgba(169,30,34,0.3)", padding: "10px 16px" }}>
            <AlertTriangle size={16} color="#A91E22" />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A91E22" }}>
              {criticalCount} Critical Alert{criticalCount !== 1 ? "s" : ""} Require Action
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Critical", value: criticalCount.toString(), color: criticalCount > 0 ? "#A91E22" : "#5A9E5A", top: criticalCount > 0 ? "#A91E22" : "#2A2A2A" },
          { label: "Due Soon", value: warningCount.toString(), color: warningCount > 0 ? "#C4A93A" : "#5A9E5A", top: "#2A2A2A" },
          { label: "Total Owed to Factory", value: `$${Math.round(totalOwed).toLocaleString()}`, color: "#A91E22", top: "#A91E22" },
          { label: "Total Receivable", value: `$${Math.round(totalReceivable).toLocaleString()}`, color: "#5A9E5A", top: "#2A2A2A" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${stat.top}`, padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
          {(["all", "critical", "warning", "info", "completed"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 14px", cursor: "pointer", border: "none", background: "transparent", whiteSpace: "nowrap", color: filter === s ? "#fff" : "#555", borderBottom: filter === s ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
              {s === "all" ? `All (${alerts.length})` : SEVERITY_CONFIG[s].label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
          {(["all", "payment_in", "payment_out", "shipment"] as const).map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 10px", cursor: "pointer", color: categoryFilter === c ? "#fff" : "#555", background: categoryFilter === c ? "rgba(255,255,255,0.08)" : "transparent", border: "0.5px solid " + (categoryFilter === c ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)") }}>
              {c === "all" ? "All Types" : c === "payment_in" ? "↓ Money In" : c === "payment_out" ? "↑ Money Out" : "✈ Shipments"}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading alerts...</div>
      ) : visible.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <CheckCircle size={32} color="#5A9E5A" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5A9E5A", margin: "0 0 4px" }}>All Clear</p>
          <p style={{ fontSize: "13px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: 0 }}>No alerts matching this filter.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {visible.map(alert => {
            const config = SEVERITY_CONFIG[alert.severity]
            const Icon = config.icon
            const daysLeft = daysUntil(alert.dueDate)

            return (
              <div key={alert.id} style={{ background: "#22262B", border: `0.5px solid ${config.border}`, borderLeft: `3px solid ${config.color}`, display: "flex", alignItems: "flex-start", gap: "16px", padding: "16px 20px" }}>
                <div style={{ width: "36px", height: "36px", flexShrink: 0, background: config.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} color={config.color} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: config.color, marginRight: "8px" }}>{config.label}</span>
                      <span style={{ fontSize: "10px", color: "#444", fontFamily: "'Barlow', sans-serif" }}>{alert.reference}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {alert.amount && (
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: config.color }}>${alert.amount.toLocaleString()}</span>
                      )}
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, color: daysLeft < 0 ? "#A91E22" : daysLeft < 7 ? "#C4A93A" : "#555" }}>
                        {alert.severity === "completed" ? "Done" : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Today" : `${daysLeft}d`}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#fff", margin: "0 0 4px" }}>{alert.title}</p>
                  <p style={{ fontSize: "12px", color: "#777", fontFamily: "'Barlow', sans-serif", margin: "0 0 10px", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>{alert.description}</p>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif" }}>
                      {alert.severity === "completed" ? "Completed" : `Due ${formatDate(alert.dueDate)}`}
                    </span>
                    <button onClick={() => router.push(alert.actionHref)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: config.color, background: config.bg, border: `0.5px solid ${config.border}`, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                      {alert.actionLabel} <ChevronRight size={11} />
                    </button>
                    {alert.severity !== "completed" && (
                      <button onClick={() => setDismissed(prev => [...prev, alert.id])} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#333", background: "transparent", border: "0.5px solid rgba(255,255,255,0.06)", padding: "4px 10px", cursor: "pointer" }}>
                        Dismiss
                      </button>
                    )}
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
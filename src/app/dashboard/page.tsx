"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    openOrders: 0,
    pendingInvoices: 0,
    activePOs: 0,
    lowStockSkus: 0,
    criticalSkus: 0,
    totalReceivable: 0,
    totalOwed: 0,
  })
  const [recentPOs, setRecentPOs] = useState<any[]>([])
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [overdueAlerts, setOverdueAlerts] = useState<any[]>([])

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    const supabase = createClient()

    const [posResult, invoicesResult, inventoryResult, ordersResult] = await Promise.all([
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("distributor_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory").select("*, sku:skus(sku_code, name)"),
      supabase.from("b2b_orders").select("*").order("created_at", { ascending: false }).limit(5),
    ])

    const pos = posResult.data || []
    const invoices = invoicesResult.data || []
    const inventory = inventoryResult.data || []

    // Stats
    const activePOs = pos.filter(p => !["received", "cancelled"].includes(p.status)).length
    const pendingInvoices = invoices.filter(i => i.status !== "paid").length
    const openOrders = ordersResult.data?.filter(o => !["fulfilled", "cancelled"].includes(o.status)).length || 0

    const lowStock = inventory.filter(i => i.qty_available <= i.min_stock && i.qty_available > 0)
    const criticalStock = inventory.filter(i => i.qty_available <= 0)

    const totalReceivable = invoices
      .filter(i => i.invoice_type === "distributor" && i.status !== "paid")
      .reduce((sum, i) => {
        let owed = 0
        if (!i.deposit_paid_date) owed += i.total_amount * 0.5
        if (!i.final_payment_paid_date && i.ship_date) owed += i.total_amount * 0.5
        return sum + owed
      }, 0)

    const totalOwed = invoices
      .filter(i => i.invoice_type === "factory" && i.status !== "paid")
      .reduce((sum, i) => {
        let owed = 0
        if (!i.deposit_paid_date) owed += i.total_amount * 0.5
        if (!i.final_payment_paid_date && i.ship_date) owed += i.total_amount * 0.5
        return sum + owed
      }, 0)

    // Overdue alerts
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdue: any[] = []

    for (const inv of invoices) {
      if (inv.status === "paid") continue
      const depositDue = new Date(inv.invoice_date)
      depositDue.setDate(depositDue.getDate() + 14)
      if (!inv.deposit_paid_date && depositDue < today) {
        overdue.push({ type: inv.invoice_type === "factory" ? "Factory Deposit Overdue" : "Distributor Deposit Overdue", ref: inv.invoice_number, amount: inv.total_amount * 0.5, days: Math.ceil((today.getTime() - depositDue.getTime()) / (1000 * 60 * 60 * 24)) })
      }
    }

    setStats({ openOrders, pendingInvoices, activePOs, lowStockSkus: lowStock.length, criticalSkus: criticalStock.length, totalReceivable, totalOwed })
    setRecentPOs(pos.slice(0, 4))
    setRecentInvoices(invoices.slice(0, 4))
    setOverdueAlerts(overdue.slice(0, 3))
    setLoading(false)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const PO_STATUS_COLORS: Record<string, string> = {
    draft: "#888", placed: "#6A9CC8", in_production: "#C4A93A",
    shipped: "#7AAB6A", received: "#5A9E5A", cancelled: "#A91E22",
  }

  const INV_STATUS_COLORS: Record<string, string> = {
    pending: "#888", deposit_received: "#6A9CC8", shipped: "#C4A93A",
    paid: "#5A9E5A", overdue: "#A91E22",
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening"
  const dayStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Admin Dashboard</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>{greeting}</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
            {dayStr} {loading ? "— Loading..." : `· ${stats.activePOs} active POs · ${stats.pendingInvoices} pending invoices`}
          </p>
        </div>
        <button onClick={() => router.push("/orders/new")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px 20px", cursor: "pointer" }}>
          + New Order
        </button>
      </div>

      {/* Overdue banner */}
      {overdueAlerts.length > 0 && (
        <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.3)", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => router.push("/operations/alerts")}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A91E22" }}>
            ⚠ {overdueAlerts.length} Overdue Payment{overdueAlerts.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>
            {overdueAlerts.map(a => a.ref).join(", ")}
          </span>
          <span style={{ marginLeft: "auto", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22" }}>View Alerts →</span>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Active POs", value: loading ? "—" : stats.activePOs.toString(), color: "#fff", top: "#2A2A2A", href: "/operations/pos" },
          { label: "Pending Invoices", value: loading ? "—" : stats.pendingInvoices.toString(), color: stats.pendingInvoices > 0 ? "#C4A93A" : "#5A9E5A", top: "#2A2A2A", href: "/operations/invoices" },
          { label: "Receivable", value: loading ? "—" : `$${Math.round(stats.totalReceivable).toLocaleString()}`, color: "#5A9E5A", top: "#5A9E5A", href: "/operations/invoices" },
          { label: "Owed to Factory", value: loading ? "—" : `$${Math.round(stats.totalOwed).toLocaleString()}`, color: "#A91E22", top: "#A91E22", href: "/operations/pos" },
        ].map(stat => (
          <div key={stat.label} onClick={() => router.push(stat.href)} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${stat.top}`, padding: "18px 20px", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#262B30"}
            onMouseLeave={e => e.currentTarget.style.background = "#22262B"}
          >
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Second row stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {[
          { label: "Open B2B Orders", value: loading ? "—" : stats.openOrders.toString(), color: "#6A9CC8", href: "/orders/all" },
          { label: "Low Stock SKUs", value: loading ? "—" : stats.lowStockSkus.toString(), color: stats.lowStockSkus > 0 ? "#C4A93A" : "#5A9E5A", href: "/inventory/forecast" },
          { label: "Critical Stock", value: loading ? "—" : stats.criticalSkus.toString(), color: stats.criticalSkus > 0 ? "#A91E22" : "#5A9E5A", href: "/inventory/forecast" },
        ].map(stat => (
          <div key={stat.label} onClick={() => router.push(stat.href)} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "16px 20px", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#262B30"}
            onMouseLeave={e => e.currentTarget.style.background = "#22262B"}
          >
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "6px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Recent POs */}
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666" }}>Recent Purchase Orders</span>
            <button onClick={() => router.push("/operations/pos")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "none", cursor: "pointer" }}>View All →</button>
          </div>
          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#333", fontSize: "12px", fontFamily: "'Barlow', sans-serif" }}>Loading...</div>
          ) : recentPOs.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#333", fontSize: "12px", fontFamily: "'Barlow', sans-serif" }}>No POs yet — <span style={{ color: "#A91E22", cursor: "pointer" }} onClick={() => router.push("/operations/pos")}>create one</span></div>
          ) : (
            recentPOs.map(po => (
              <div key={po.id} onClick={() => router.push("/operations/pos")} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.04em" }}>{po.po_number}</p>
                  <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{po.factory_name} · {formatDate(po.order_date)}</p>
                </div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: PO_STATUS_COLORS[po.status] || "#888", background: `${PO_STATUS_COLORS[po.status]}18` || "rgba(136,136,136,0.1)", padding: "2px 8px" }}>
                  {po.status.replace("_", " ")}
                </span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#CCC" }}>${po.total_amount?.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

        {/* Recent Invoices */}
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666" }}>Recent Invoices</span>
            <button onClick={() => router.push("/operations/invoices")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "none", cursor: "pointer" }}>View All →</button>
          </div>
          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#333", fontSize: "12px", fontFamily: "'Barlow', sans-serif" }}>Loading...</div>
          ) : recentInvoices.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#333", fontSize: "12px", fontFamily: "'Barlow', sans-serif" }}>No invoices yet — <span style={{ color: "#5A9E5A", cursor: "pointer" }} onClick={() => router.push("/operations/invoices")}>create one</span></div>
          ) : (
            recentInvoices.map(inv => {
              const isFactory = inv.invoice_type === "factory"
              const accentColor = isFactory ? "#A91E22" : "#5A9E5A"
              return (
                <div key={inv.id} onClick={() => router.push("/operations/invoices")} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accentColor, background: `${accentColor}15`, padding: "1px 6px" }}>
                        {isFactory ? "↑ We Pay" : "↓ We Receive"}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: accentColor, margin: 0, letterSpacing: "0.04em" }}>{inv.invoice_number}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{inv.dealer_name} · {formatDate(inv.invoice_date)}</p>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INV_STATUS_COLORS[inv.status] || "#888", padding: "2px 8px", background: `${INV_STATUS_COLORS[inv.status] || "#888"}18` }}>
                    {inv.status.replace("_", " ")}
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#CCC" }}>${inv.total_amount?.toLocaleString()}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "New PO", desc: "Send to factory", href: "/operations/pos", color: "#A91E22" },
          { label: "New Invoice", desc: "Bill a dealer", href: "/operations/invoices", color: "#5A9E5A" },
          { label: "Reorder Forecast", desc: "Check low stock", href: "/inventory/forecast", color: "#C4A93A" },
          { label: "BoM Builder", desc: "Edit components", href: "/inventory/boms", color: "#6A9CC8" },
        ].map(link => (
          <div key={link.label} onClick={() => router.push(link.href)} style={{ background: "#22262B", border: `0.5px solid rgba(255,255,255,0.08)`, borderTop: `2px solid ${link.color}`, padding: "14px 16px", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#262B30"}
            onMouseLeave={e => e.currentTarget.style.background = "#22262B"}
          >
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: link.color, margin: "0 0 4px" }}>{link.label}</p>
            <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{link.desc}</p>
          </div>
        ))}
      </div>

    </div>
  )
}
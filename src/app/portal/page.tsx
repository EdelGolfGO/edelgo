"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ShoppingCart, Clock, FileText, Plus } from "lucide-react"

export default function PortalDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileResult, ordersResult, invoicesResult] = await Promise.all([
      supabase.from("profiles").select("*, dealer:dealers(*)").eq("id", user.id).single(),
      supabase.from("b2b_orders").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("distributor_invoices").select("*").eq("invoice_type", "distributor").order("created_at", { ascending: false }).limit(5),
    ])

    if (profileResult.data) setProfile(profileResult.data)
    if (ordersResult.data) setOrders(ordersResult.data)
    if (invoicesResult.data) setInvoices(invoicesResult.data)
    setLoading(false)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
    draft:         { color: "#888",    bg: "rgba(136,136,136,0.1)",  label: "Draft" },
    pending:       { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",  label: "Pending Review" },
    approved:      { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)", label: "Approved" },
    in_production: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",  label: "In Production" },
    shipped:       { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)", label: "Shipped" },
    fulfilled:     { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",   label: "Fulfilled" },
    cancelled:     { color: "#A91E22", bg: "rgba(169,30,34,0.1)",   label: "Cancelled" },
  }

  const openOrders = orders.filter(o => !["fulfilled", "cancelled"].includes(o.status))
  const pendingInvoices = invoices.filter(i => i.status !== "paid")

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening"
  const dealerName = profile?.dealer?.company || profile?.dealer?.name || profile?.full_name || "there"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* Header */}
      <div style={{ paddingBottom: "20px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "6px" }}>Dealer Portal</p>
        <h1 style={{ fontSize: "36px", color: "#fff", margin: "0 0 6px" }}>{greeting}, {dealerName}</h1>
        <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          {profile?.dealer?.payment_terms && ` · Payment terms: ${profile.dealer.payment_terms.replace("_", "/").toUpperCase()}`}
        </p>
      </div>

      {/* Quick action cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        <div onClick={() => router.push("/portal/order")} style={{ background: "#A91E22", padding: "24px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "10px" }}
          onMouseEnter={e => e.currentTarget.style.background = "#8B1519"}
          onMouseLeave={e => e.currentTarget.style.background = "#A91E22"}
        >
          <ShoppingCart size={24} color="#fff" />
          <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", margin: "0 0 4px" }}>Place New Order</p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontFamily: "'Barlow', sans-serif", margin: 0 }}>Browse catalog and submit</p>
          </div>
        </div>

        <div onClick={() => router.push("/portal/orders")} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "24px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "10px" }}
          onMouseEnter={e => e.currentTarget.style.background = "#262B30"}
          onMouseLeave={e => e.currentTarget.style.background = "#22262B"}
        >
          <Clock size={24} color="#6A9CC8" />
          <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", margin: "0 0 4px" }}>My Orders</p>
            <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
              {openOrders.length > 0 ? `${openOrders.length} active order${openOrders.length !== 1 ? "s" : ""}` : "View order history"}
            </p>
          </div>
        </div>

        <div onClick={() => router.push("/portal/invoices")} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "24px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "10px" }}
          onMouseEnter={e => e.currentTarget.style.background = "#262B30"}
          onMouseLeave={e => e.currentTarget.style.background = "#22262B"}
        >
          <FileText size={24} color="#5A9E5A" />
          <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", margin: "0 0 4px" }}>Invoices</p>
            <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
              {pendingInvoices.length > 0 ? `${pendingInvoices.length} pending payment` : "All paid up"}
            </p>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666" }}>Recent Orders</span>
          <button onClick={() => router.push("/portal/orders")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "none", cursor: "pointer" }}>View All →</button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#333", fontSize: "13px", fontFamily: "'Barlow', sans-serif" }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: "0 0 16px" }}>No orders yet. Ready to place your first order?</p>
            <button onClick={() => router.push("/portal/order")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 20px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Plus size={14} /> Place First Order
            </button>
          </div>
        ) : (
          orders.map(order => {
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending
            return (
              <div key={order.id} onClick={() => router.push(`/portal/orders/${order.id}`)} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{order.order_number || `Order #${order.id.slice(0, 8)}`}</p>
                  <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{formatDate(order.created_at)}</p>
                </div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>{statusInfo.label}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>${(order.total_amount || 0).toLocaleString()}</span>
              </div>
            )
          })
        )}
      </div>

      {/* Account info */}
      {profile?.dealer && (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "20px" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "14px" }}>Account Details</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
            {[
              { label: "Account Type", value: profile.dealer.dealer_type?.charAt(0).toUpperCase() + profile.dealer.dealer_type?.slice(1) },
              { label: "Payment Terms", value: profile.dealer.payment_terms?.replace("_", "/").toUpperCase() },
              { label: "Pricing Tier", value: profile.pricing_tier?.charAt(0).toUpperCase() + profile.pricing_tier?.slice(1) },
              { label: "Discount", value: profile.dealer.discount_percent ? `${profile.dealer.discount_percent}%` : "None" },
            ].map(item => (
              <div key={item.label}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 4px" }}>{item.label}</p>
                <p style={{ fontSize: "13px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{item.value || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { ChevronDown } from "lucide-react"

type OrderItem = {
  id: string
  product_name: string
  sku_code: string
  quantity: number
  unit_price: number
  total_price: number
}

type Order = {
  id: string
  order_number: string
  status: string
  total_amount: number
  notes: string
  submitted_at: string
  created_at: string
  items: OrderItem[]
}

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  draft:         { color: "#888",    bg: "rgba(136,136,136,0.1)",  label: "Draft" },
  pending:       { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",   label: "Pending Review" },
  approved:      { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)",  label: "Approved" },
  in_production: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",   label: "In Production" },
  shipped:       { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)",  label: "Shipped" },
  fulfilled:     { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",    label: "Fulfilled" },
  cancelled:     { color: "#A91E22", bg: "rgba(169,30,34,0.1)",    label: "Cancelled" },
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from("profiles").select("dealer_id").eq("id", user.id).single()
    if (!profile?.dealer_id) { setLoading(false); return }

    const { data } = await supabase
      .from("b2b_orders")
      .select(`
        *,
        items:b2b_order_items(
          id, sku_code, product_name, quantity, unit_price, total_price
        )
      `)
      .eq("dealer_id", profile.dealer_id)
      .order("created_at", { ascending: false })

    if (data) setOrders(data as any)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading orders...</div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Dealer Portal</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>My Orders</h1>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>{orders.length} order{orders.length !== 1 ? "s" : ""} total</p>
      </div>

      {orders.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: 0 }}>No Orders Yet</p>
          <p style={{ fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif", margin: "8px 0 0" }}>Place your first order using the Place Order tab.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {orders.map(order => {
            const isExpanded = expanded === order.id
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending
            const items = order.items || []

            return (
              <div key={order.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
                <div onClick={() => setExpanded(isExpanded ? null : order.id)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 140px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{order.order_number}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{formatDate(order.submitted_at || order.created_at)}</p>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>
                    {statusInfo.label}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>
                    ${(order.total_amount || 0).toLocaleString()}
                  </p>
                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>
                    {items.length > 0 ? (
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "10px" }}>Order Contents</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["Product", "SKU", "Qty", "Unit Price", "Total"].map(h => (
                                <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", padding: "6px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id}>
                                <td style={{ padding: "8px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.product_name}</td>
                                <td style={{ padding: "8px 12px", fontSize: "11px", color: "#666", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku_code || "—"}</td>
                                <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.quantity}</td>
                                <td style={{ padding: "8px 12px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(item.unit_price || 0).toFixed(2)}</td>
                                <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${((item.unit_price || 0) * item.quantity).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={4} style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", textAlign: "right" }}>Order Total</td>
                              <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>${(order.total_amount || 0).toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: "12px", color: "#444", fontFamily: "'Barlow', sans-serif" }}>No line items available.</p>
                    )}
                    {order.notes && (
                      <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", marginTop: "12px", fontStyle: "italic" }}>Notes: {order.notes}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
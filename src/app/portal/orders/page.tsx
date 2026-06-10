"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ChevronDown, Plus } from "lucide-react"

export default function PortalOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("b2b_orders")
      .select(`
        *,
        items:b2b_order_items(
          id, sku_code, product_name, quantity, unit_price, total_price
        )
      `)
      .order("created_at", { ascending: false })
    if (data) setOrders(data)
    setLoading(false)
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

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Dealer Portal</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>My Orders</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>{orders.length} total orders</p>
        </div>
        <button onClick={() => router.push("/portal/order")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <Plus size={14} /> New Order
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {(["all", "pending", "approved", "in_production", "shipped", "fulfilled"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 14px", cursor: "pointer", border: "none", background: "transparent", whiteSpace: "nowrap", color: filter === s ? "#fff" : "#555", borderBottom: filter === s ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {s === "all" ? `All (${orders.length})` : s === "in_production" ? "In Production" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 16px" }}>No orders yet</p>
          <button onClick={() => router.push("/portal/order")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer" }}>Place First Order</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(order => {
            const isExpanded = expanded === order.id
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending
            const canEdit = order.status === "draft" || order.status === "pending"

            return (
              <div key={order.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
                <div onClick={() => setExpanded(isExpanded ? null : order.id)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{order.order_number || `#${order.id.slice(0, 8)}`}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{formatDate(order.created_at)} · {order.items?.length || 0} items</p>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>{statusInfo.label}</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff" }}>${(order.total_amount || 0).toLocaleString()}</span>
                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>
                    {order.items && order.items.length > 0 && (
                      <div style={{ marginBottom: "16px" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "10px" }}>Line Items</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["SKU", "Product", "Qty", "Unit Price", "Total"].map(h => (
                                <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", padding: "6px 10px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item: any) => (
                              <tr key={item.id}>
                                <td style={{ padding: "8px 10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku_code}</td>
                                <td style={{ padding: "8px 10px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.product_name}</td>
                                <td style={{ padding: "8px 10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.quantity}</td>
                                <td style={{ padding: "8px 10px", fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(item.unit_price || 0).toFixed(2)}</td>
                                <td style={{ padding: "8px 10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(item.total_price || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {order.notes && <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", marginBottom: "16px", fontStyle: "italic" }}>Note: {order.notes}</p>}

                    <div style={{ display: "flex", gap: "10px" }}>
                      {canEdit && (
                        <button onClick={() => router.push(`/portal/order?edit=${order.id}`)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer" }}>
                          Edit Order
                        </button>
                      )}
                      <button onClick={() => router.push("/portal/order")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "7px 14px", cursor: "pointer" }}>
                        Reorder
                      </button>
                    </div>
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
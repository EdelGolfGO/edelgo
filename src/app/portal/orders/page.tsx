"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { ChevronDown, FileText, Download } from "lucide-react"
import MessageThread from "@/components/dealers/MessageThread"

type OrderItem = {
  id: string
  product_name: string
  sku_code: string
  quantity: number
  unit_price: number
  total_price: number
}

type OrderDoc = {
  id: string
  order_id: string
  name: string
  url: string
  category: string
  uploaded_at: string
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
  estimated_ship_date?: string | null
}

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  draft:         { color: "#B5BAC2",    bg: "rgba(136,136,136,0.1)",  label: "Draft" },
  pending:       { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",   label: "Pending Review" },
  approved:      { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)",  label: "Approved" },
  in_production: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",   label: "In Production" },
  shipped:       { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)",  label: "Shipped" },
  fulfilled:     { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",    label: "Fulfilled" },
  cancelled:     { color: "#A91E22", bg: "rgba(169,30,34,0.1)",    label: "Cancelled" },
}

const DOC_CATEGORY_LABELS: Record<string, string> = {
  coo: "Certificate of Origin",
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  customs: "Customs Document",
  other: "Document",
}

const DOC_CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  coo: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
  commercial_invoice: { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  packing_list: { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)" },
  customs: { color: "#A91E22", bg: "rgba(169,30,34,0.1)" },
  other: { color: "#8B919A", bg: "rgba(255,255,255,0.06)" },
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [docsByOrder, setDocsByOrder] = useState<Record<string, OrderDoc[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dealerId, setDealerId] = useState<string | null>(null)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from("profiles").select("dealer_id").eq("id", user.id).single()
    if (!profile?.dealer_id) { setLoading(false); return }
    setDealerId(profile.dealer_id)

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

    if (data) {
      setOrders(data as any)

      // Fetch documents for these orders that have been marked visible to
      // dealers. RLS already restricts this to the dealer's own orders, but
      // we also filter visible_to_dealer here explicitly for clarity.
      const orderIds = data.map((o: any) => o.id)
      if (orderIds.length > 0) {
        const { data: docsData } = await supabase
          .from("order_documents")
          .select("*")
          .in("order_id", orderIds)
          .eq("visible_to_dealer", true)
          .order("uploaded_at", { ascending: false })

        if (docsData) {
          const grouped: Record<string, OrderDoc[]> = {}
          docsData.forEach((d: any) => {
            if (!grouped[d.order_id]) grouped[d.order_id] = []
            grouped[d.order_id].push(d)
          })
          setDocsByOrder(grouped)
        }
      }
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading orders...</div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Dealer Portal</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>My Orders</h1>
        <p style={{ fontSize: "12px", color: "#B5BAC2", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>{orders.length} order{orders.length !== 1 ? "s" : ""} total</p>
      </div>

      {orders.length === 0 ? (
        <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#787E87", margin: 0 }}>No Orders Yet</p>
          <p style={{ fontSize: "13px", color: "#666C75", fontFamily: "'Barlow', sans-serif", margin: "8px 0 0" }}>Place your first order using the Place Order tab.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {orders.map(order => {
            const isExpanded = expanded === order.id
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending
            const items = order.items || []
            const docs = docsByOrder[order.id] || []

            return (
              <div key={order.id} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)" }}>
                <div onClick={() => setExpanded(isExpanded ? null : order.id)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 140px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{order.order_number}</p>
                    <p style={{ fontSize: "11px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{formatDate(order.submitted_at || order.created_at)}</p>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>
                    {statusInfo.label}
                  </span>
                  <div style={{ flex: 1, display: "flex", gap: "16px", alignItems: "center" }}>
                    <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </p>
                    {docs.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <FileText size={12} color="#5A9E5A" />
                        <span style={{ fontSize: "11px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif" }}>{docs.length} document{docs.length !== 1 ? "s" : ""} available</span>
                      </div>
                    )}
                    {order.estimated_ship_date && (
                      <span style={{ fontSize: "11px", color: "#6A9CC8", fontFamily: "'Barlow', sans-serif" }}>Est. ship {formatDate(order.estimated_ship_date)}</span>
                    )}
                  </div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>
                    ${(order.total_amount || 0).toLocaleString()}
                  </p>
                  <ChevronDown size={16} color="#787E87" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#2B3038" }}>
                    {order.estimated_ship_date && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(106,156,200,0.08)", border: "0.5px solid rgba(106,156,200,0.25)", padding: "10px 14px", marginBottom: "16px" }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6A9CC8" }}>Estimated Ship Date</span>
                        <span style={{ fontSize: "13px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", fontWeight: 700 }}>{formatDate(order.estimated_ship_date)}</span>
                      </div>
                    )}
                    {items.length > 0 ? (
                      <div style={{ marginBottom: docs.length > 0 ? "16px" : 0 }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "10px" }}>Order Contents</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["Product", "SKU", "Qty", "Unit Price", "Total"].map(h => (
                                <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87", padding: "6px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id}>
                                <td style={{ padding: "8px 12px", fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.product_name}</td>
                                <td style={{ padding: "8px 12px", fontSize: "11px", color: "#9BA0A8", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku_code || "—"}</td>
                                <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#E0E2E6", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.quantity}</td>
                                <td style={{ padding: "8px 12px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(item.unit_price || 0).toFixed(2)}</td>
                                <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${((item.unit_price || 0) * item.quantity).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={4} style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B919A", textAlign: "right" }}>Order Total</td>
                              <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>${(order.total_amount || 0).toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: "12px", color: "#787E87", fontFamily: "'Barlow', sans-serif" }}>No line items available.</p>
                    )}

                    {/* Customs / shipping documents shared by Edel Golf for this order */}
                    {docs.length > 0 && (
                      <div style={{ marginBottom: order.notes ? "16px" : 0 }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "10px" }}>Documents</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {docs.map(doc => {
                            const catStyle = DOC_CATEGORY_COLORS[doc.category] || DOC_CATEGORY_COLORS.other
                            return (
                              <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#262B32", border: "0.5px solid rgba(90,158,90,0.2)", padding: "10px 14px", textDecoration: "none" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <FileText size={14} color={catStyle.color} />
                                  <span style={{ fontSize: "13px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif" }}>{doc.name}</span>
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: catStyle.color, background: catStyle.bg, padding: "2px 7px" }}>
                                    {DOC_CATEGORY_LABELS[doc.category] || "Document"}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6A9CC8" }}>
                                  <Download size={13} />
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Download</span>
                                </div>
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {order.notes && (
                      <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", fontStyle: "italic", marginBottom: "16px" }}>Notes: {order.notes}</p>
                    )}

                    {/* Per-order message thread — questions specific to this order */}
                    {dealerId && (
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "10px" }}>
                          Questions About This Order
                        </p>
                        <MessageThread dealerId={dealerId} orderId={order.id} currentUserRole="dealer" compact />
                      </div>
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
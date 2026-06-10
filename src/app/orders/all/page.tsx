"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronDown, Search, Pencil, Printer, X, Save } from "lucide-react"
import { createClient } from "@/lib/supabase"

type OrderStatus = "draft" | "pending" | "approved" | "in_production" | "shipped" | "fulfilled" | "cancelled"

type OrderItem = {
  id: string
  product_name: string
  sku_code: string
  quantity: number
  unit_price: number
  total_price: number
  configuration: any
}

type Order = {
  id: string
  order_number: string
  dealer_id: string
  dealer_name: string
  status: OrderStatus
  total_amount: number
  notes: string
  submitted_at: string
  approved_at: string
  shipped_at: string
  created_at: string
  items: OrderItem[]
}

const STATUS_COLORS: Record<OrderStatus, { color: string; bg: string; label: string }> = {
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

function printOrder(order: Order) {
  const items = order.items || []
  const win = window.open("", "_blank")
  if (!win) return
  win.document.write(`
    <html><head><title>Order ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h1 { font-size: 24px; margin: 0 0 4px; }
      .sub { font-size: 12px; color: #666; margin-bottom: 24px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
      .meta-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; display: block; margin-bottom: 2px; }
      .meta-item span { font-size: 14px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #111; color: #fff; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
      td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
      .total-row td { font-weight: bold; border-top: 2px solid #111; }
      .footer { margin-top: 32px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
      @media print { body { padding: 16px; } }
    </style></head><body>
    <h1>Order ${order.order_number}</h1>
    <div class="sub">Edel Golf · EdelFit Platform · Printed ${new Date().toLocaleDateString()}</div>
    <div class="meta">
      <div class="meta-item"><label>Dealer</label><span>${order.dealer_name || "—"}</span></div>
      <div class="meta-item"><label>Status</label><span>${STATUS_COLORS[order.status]?.label || order.status}</span></div>
      <div class="meta-item"><label>Date</label><span>${formatDate(order.submitted_at || order.created_at)}</span></div>
    </div>
    <table>
      <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>
        ${items.map(i => `<tr>
          <td>${i.product_name}</td>
          <td>${i.sku_code || "—"}</td>
          <td>${i.quantity}</td>
          <td>$${(i.unit_price || 0).toFixed(2)}</td>
          <td>$${(i.unit_price * i.quantity || 0).toFixed(2)}</td>
        </tr>`).join("")}
        <tr class="total-row"><td colspan="4" style="text-align:right">Order Total</td><td>$${(order.total_amount || 0).toLocaleString()}</td></tr>
      </tbody>
    </table>
    ${order.notes ? `<p style="font-size:12px;color:#666;font-style:italic">Notes: ${order.notes}</p>` : ""}
    <div class="footer">EdelFit · myedelfit.com · Edel Golf Internal Use Only</div>
    <script>window.onload = () => { window.print() }</script>
    </body></html>
  `)
  win.document.close()
}

export default function AllOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<OrderStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [editModal, setEditModal] = useState<Order | null>(null)
  const [editItems, setEditItems] = useState<OrderItem[]>([])
  const [editNotes, setEditNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [notifyDealer, setNotifyDealer] = useState(true)
  const [changeReason, setChangeReason] = useState("")

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("b2b_orders")
      .select(`
        *,
        items:b2b_order_items(
          id, sku_code, product_name, quantity, unit_price, total_price, configuration
        )
      `)
      .order("created_at", { ascending: false })
    if (data) setOrders(data as any)
    setLoading(false)
  }

  async function updateStatus(id: string, status: OrderStatus) {
    const supabase = createClient()
    const extra: any = { updated_at: new Date().toISOString() }
    if (status === "approved") extra.approved_at = new Date().toISOString()
    if (status === "shipped") extra.shipped_at = new Date().toISOString()
    await supabase.from("b2b_orders").update({ status, ...extra }).eq("id", id)

    // Notify dealer of status change
    const order = orders.find(o => o.id === id)
    if (order?.dealer_id) {
      await supabase.from("portal_notifications").insert({
        type: "order_status_update",
        title: `Order ${order.order_number} Updated`,
        message: `Your order status has been updated to: ${STATUS_COLORS[status]?.label || status}`,
        reference_id: id,
        reference_type: "b2b_order",
        dealer_id: order.dealer_id,
      })
    }
    loadOrders()
  }

  function openEdit(order: Order) {
    setEditModal(order)
    setEditItems(order.items.map(i => ({ ...i })))
    setEditNotes(order.notes || "")
    setChangeReason("")
    setNotifyDealer(true)
  }

  function updateEditItem(id: string, key: string, value: any) {
    setEditItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
  }

  function removeEditItem(id: string) {
    setEditItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleSaveEdit() {
    if (!editModal) return
    setSaving(true)
    const supabase = createClient()

    // Update each item
    for (const item of editItems) {
      await supabase.from("b2b_order_items")
        .update({ quantity: item.quantity, unit_price: item.unit_price })
        .eq("id", item.id)
    }

    // Recalculate total
    const newTotal = editItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
    await supabase.from("b2b_orders").update({
      notes: editNotes,
      total_amount: newTotal,
      updated_at: new Date().toISOString(),
    }).eq("id", editModal.id)

    // Notify dealer if checked
    if (notifyDealer && editModal.dealer_id) {
      await supabase.from("portal_notifications").insert({
        type: "order_modified",
        title: `Order ${editModal.order_number} Modified`,
        message: changeReason
          ? `An admin made changes to your order: ${changeReason}`
          : `An admin has made changes to your order ${editModal.order_number}. Please log in to review the updated order.`,
        reference_id: editModal.id,
        reference_type: "b2b_order",
        dealer_id: editModal.dealer_id,
      })
    }

    setSaving(false)
    setEditModal(null)
    loadOrders()
  }

  const filtered = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false
    if (search && !o.order_number?.toLowerCase().includes(search.toLowerCase()) && !o.dealer_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendingCount = orders.filter(o => o.status === "pending").length
  const totalValue = orders.filter(o => !["cancelled", "draft"].includes(o.status)).reduce((sum, o) => sum + (o.total_amount || 0), 0)

  const inputStyle = { background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "6px 10px", fontSize: "12px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, outline: "none", boxSizing: "border-box" as const }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Orders</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>All Orders</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
            {loading ? "Loading..." : `${orders.length} total orders`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "200px" }} />
          </div>
          <button onClick={() => router.push("/orders/new")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> New Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Total Orders", value: orders.length.toString(), color: "#fff", top: "#2A2A2A" },
          { label: "Pending Review", value: pendingCount.toString(), color: pendingCount > 0 ? "#C4A93A" : "#5A9E5A", top: pendingCount > 0 ? "#C4A93A" : "#2A2A2A" },
          { label: "Active Orders", value: orders.filter(o => ["approved","in_production","shipped"].includes(o.status)).length.toString(), color: "#6A9CC8", top: "#2A2A2A" },
          { label: "Total Value", value: `$${totalValue.toLocaleString()}`, color: "#5A9E5A", top: "#2A2A2A" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${stat.top}`, padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {(["all", "pending", "approved", "in_production", "shipped", "fulfilled", "cancelled"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 14px", cursor: "pointer", border: "none", background: "transparent", whiteSpace: "nowrap", color: filter === s ? "#fff" : "#555", borderBottom: filter === s ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {s === "all" ? `All (${orders.length})` : s === "in_production" ? `In Production (${orders.filter(o=>o.status===s).length})` : `${s.charAt(0).toUpperCase()+s.slice(1)} (${orders.filter(o=>o.status===s).length})`}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 8px" }}>
            {filter === "all" ? "No Orders Yet" : `No ${filter.replace("_"," ")} orders`}
          </p>
          {filter === "all" && (
            <button onClick={() => router.push("/orders/new")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", marginTop: "8px" }}>+ New Order</button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(order => {
            const isExpanded = expanded === order.id
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending

            return (
              <div key={order.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
                <div onClick={() => setExpanded(isExpanded ? null : order.id)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 150px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{order.order_number || "—"}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{order.dealer_name}</p>
                  </div>
                  <div style={{ flex: "0 0 140px" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>{statusInfo.label}</span>
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: "24px" }}>
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Submitted</p>
                      <p style={{ fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(order.submitted_at || order.created_at)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Items</p>
                      <p style={{ fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{(order.items || []).length} line item{(order.items || []).length !== 1 ? "s" : ""}</p>
                    </div>
                    {order.approved_at && (
                      <div>
                        <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Approved</p>
                        <p style={{ fontSize: "12px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(order.approved_at)}</p>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: "0 0 120px", textAlign: "right" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>${(order.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>

                    {/* Line items */}
                    {order.items && order.items.length > 0 ? (
                      <div style={{ marginBottom: "16px" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "10px" }}>Line Items</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["Product", "SKU", "Configuration", "Qty", "Unit Price", "Total"].map(h => (
                                <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", padding: "6px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map(item => (
                              <tr key={item.id}>
                                <td style={{ padding: "8px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.product_name}</td>
                                <td style={{ padding: "8px 12px", fontSize: "11px", color: "#666", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku_code || "—"}</td>
                                <td style={{ padding: "8px 12px", fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                                  {item.configuration && Object.keys(item.configuration).length > 0 ? Object.entries(item.configuration).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}
                                </td>
                                <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.quantity}</td>
                                <td style={{ padding: "8px 12px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(item.unit_price || 0).toFixed(2)}</td>
                                <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${((item.unit_price || 0) * item.quantity).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={5} style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", textAlign: "right" }}>Order Total</td>
                              <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>${(order.total_amount || 0).toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: "12px", color: "#444", fontFamily: "'Barlow', sans-serif", marginBottom: "16px" }}>No line items found.</p>
                    )}

                    {order.notes && <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", marginBottom: "16px", fontStyle: "italic" }}>Note: {order.notes}</p>}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                      {order.status === "pending" && (
                        <button onClick={() => updateStatus(order.id, "approved")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "7px 14px", cursor: "pointer" }}>✓ Approve Order</button>
                      )}
                      {order.status === "approved" && (
                        <button onClick={() => updateStatus(order.id, "in_production")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#C4A93A", border: "none", padding: "7px 14px", cursor: "pointer" }}>Mark In Production</button>
                      )}
                      {order.status === "in_production" && (
                        <button onClick={() => updateStatus(order.id, "shipped")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#6A9CC8", border: "none", padding: "7px 14px", cursor: "pointer" }}>Mark Shipped</button>
                      )}
                      {order.status === "shipped" && (
                        <button onClick={() => updateStatus(order.id, "fulfilled")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "7px 14px", cursor: "pointer" }}>Mark Fulfilled</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); openEdit(order) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6A9CC8", background: "transparent", border: "1px solid rgba(106,156,200,0.3)", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Pencil size={11} /> Edit Order
                      </button>
                      <button onClick={e => { e.stopPropagation(); printOrder(order) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Printer size={11} /> Print Order
                      </button>
                      {!["fulfilled", "cancelled"].includes(order.status) && (
                        <button onClick={() => updateStatus(order.id, "cancelled")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "7px 14px", cursor: "pointer", marginLeft: "auto" }}>Cancel Order</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Order Modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setEditModal(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #6A9CC8", width: "100%", maxWidth: "700px", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", position: "sticky", top: 0, zIndex: 10 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6A9CC8", margin: "0 0 4px" }}>Edit Order</p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>{editModal.order_number} — {editModal.dealer_name}</h2>
              </div>
              <button onClick={() => setEditModal(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Line items */}
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "10px" }}>Line Items</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {editItems.map(item => (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 40px", gap: "10px", alignItems: "center", background: "#22262B", border: "0.5px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{item.sku_code}</p>
                        <p style={{ fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{item.product_name}</p>
                      </div>
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#444", marginBottom: "3px" }}>Qty</p>
                        <input type="number" style={{ ...inputStyle, width: "100%" }} min={1} value={item.quantity} onChange={e => updateEditItem(item.id, "quantity", parseInt(e.target.value) || 1)} />
                      </div>
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#444", marginBottom: "3px" }}>Unit Price</p>
                        <input type="number" style={{ ...inputStyle, width: "100%" }} value={item.unit_price} onChange={e => updateEditItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} />
                      </div>
                      <button onClick={() => removeEditItem(item.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "2px" }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "right", marginTop: "10px" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                    New Total: ${editItems.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "6px" }}>Order Notes</p>
                <textarea style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", resize: "none", minHeight: "60px", boxSizing: "border-box" as const }} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>

              {/* Dealer notification */}
              <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.08)", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <input type="checkbox" id="notify_dealer" checked={notifyDealer} onChange={e => setNotifyDealer(e.target.checked)} style={{ cursor: "pointer" }} />
                  <label htmlFor="notify_dealer" style={{ fontSize: "13px", color: "#CCC", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Notify dealer of changes</label>
                </div>
                {notifyDealer && (
                  <div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#444", marginBottom: "5px" }}>Reason for change (optional — shown to dealer)</p>
                    <input style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }} placeholder="e.g. Item out of stock, price correction..." value={changeReason} onChange={e => setChangeReason(e.target.value)} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setEditModal(null)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving ? "#333" : "#6A9CC8", border: "none", padding: "12px", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Save size={14} /> {saving ? "Saving..." : "Save Changes →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
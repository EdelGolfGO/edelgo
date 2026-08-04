"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronDown, Search, Pencil, Printer, X, Save, Upload, FileText, ExternalLink } from "lucide-react"
import MessageThread from "@/components/dealers/MessageThread"
import { createClient } from "@/lib/supabase"

type OrderStatus = "draft" | "pending" | "pending_review" | "approved" | "in_production" | "shipped" | "fulfilled" | "cancelled"

type OrderItem = {
  id: string
  product_name: string
  sku_code: string
  quantity: number
  unit_price: number
  total_price: number
  configuration: any
}

type OrderType = "all" | "wholesale" | "fitter" | "retail" | "international" | "factory" | "misc"

type OrderDoc = {
  id: string
  order_id: string
  name: string
  url: string
  category: string
  visible_to_dealer: boolean
  uploaded_at: string
}

type Order = {
  id: string
  order_number: string
  dealer_id: string
  dealer_name: string
  status: OrderStatus
  order_type: string
  total_amount: number
  notes: string
  submitted_at: string
  approved_at: string
  shipped_at: string
  estimated_ship_date?: string | null
  created_at: string
  items: OrderItem[]
  dealer?: { fulfillment_source: string } | null
}

const STATUS_COLORS: Record<OrderStatus, { color: string; bg: string; label: string }> = {
  draft:          { color: "#B5BAC2",    bg: "rgba(136,136,136,0.1)",  label: "Draft" },
  pending:        { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",   label: "Pending Review" },
  pending_review: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",   label: "Pending Review" },
  approved:       { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)",  label: "Approved" },
  in_production:  { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",   label: "In Production" },
  shipped:        { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)",  label: "Shipped" },
  fulfilled:      { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",    label: "Fulfilled" },
  cancelled:      { color: "#A91E22", bg: "rgba(169,30,34,0.1)",    label: "Cancelled" },
}

const ORDER_DOC_CATEGORIES = [
  { value: "coo", label: "Certificate of Origin (COO)" },
  { value: "commercial_invoice", label: "Commercial Invoice (CI)" },
  { value: "packing_list", label: "Packing List" },
  { value: "customs", label: "Other Customs Doc" },
  { value: "other", label: "Other" },
]

const ORDER_DOC_COLORS: Record<string, { color: string; bg: string }> = {
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

function printOrder(order: Order) {
  const items = order.items || []
  const win = window.open("", "_blank")
  if (!win) return
  win.document.write(`
    <html><head><title>Order ${order.order_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h1 { font-size: 24px; margin: 0 0 4px; }
      .sub { font-size: 12px; color: #9BA0A8; margin-bottom: 24px; }
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
    ${order.notes ? `<p style="font-size:12px;color:#9BA0A8;font-style:italic">Notes: ${order.notes}</p>` : ""}
    <div class="footer">EdelFit · myedelfit.com · Edel Golf Internal Use Only</div>
    <script>window.onload = () => { window.print() }</script>
    </body></html>
  `)
  win.document.close()
}

export default function AllOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [docsByOrder, setDocsByOrder] = useState<Record<string, OrderDoc[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<OrderStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [orderType, setOrderType] = useState<OrderType>("all")
  const [editModal, setEditModal] = useState<Order | null>(null)
  const [editItems, setEditItems] = useState<OrderItem[]>([])
  const [editNotes, setEditNotes] = useState("")
  const [estimatedShipDate, setEstimatedShipDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [notifyDealer, setNotifyDealer] = useState(true)
  const [changeReason, setChangeReason] = useState("")
  const [uploadingDocsFor, setUploadingDocsFor] = useState<string | null>(null)
  const [docUploadCategory, setDocUploadCategory] = useState("coo")
  const [shipBackflushConfirm, setShipBackflushConfirm] = useState<Order | null>(null)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const supabase = createClient()
    const [{ data }, { data: docsData }] = await Promise.all([
      supabase
        .from("b2b_orders")
        .select(`
          *,
          items:b2b_order_items(
            id, sku_code, product_name, quantity, unit_price, total_price, configuration
          ),
          dealer:dealers(fulfillment_source)
        `)
        .order("created_at", { ascending: false }),
      supabase.from("order_documents").select("*").order("uploaded_at", { ascending: false }),
    ])
    if (data) setOrders(data as any)
    if (docsData) {
      const grouped: Record<string, OrderDoc[]> = {}
      docsData.forEach((d: any) => {
        if (!grouped[d.order_id]) grouped[d.order_id] = []
        grouped[d.order_id].push(d)
      })
      setDocsByOrder(grouped)
    }
    setLoading(false)
  }

  // Maps a freeform configuration value (e.g. "KBS Tour V - Wedge 125g") to a
  // real component SKU by fuzzy name match — same approach as the Shopify
  // order webhook, since dealer order configuration data is the same kind of
  // freeform display text rather than SKU codes.
  async function findComponentByName(supabase: any, nameFragment: string) {
    const { data } = await supabase
      .from("skus")
      .select("id, sku_code, name")
      .eq("is_active", true)
      .in("sku_type", ["component", "consumable"])
      .ilike("name", `%${nameFragment}%`)
      .limit(1)
    return data && data.length > 0 ? data[0] : null
  }

  const SPEC_KEYS = new Set(["Hand", "Lie Angle", "Length"])
  const COMPONENT_KEYS = new Set(["Shaft", "Grip", "Ferrule", "Edel x BB&F Ferrule"])

  // Creates Work Orders for any customizable line items on a dealer order,
  // run when the order is approved. Non-customizable line items on the same
  // order are recorded as companion items so shipping can coordinate them
  // alongside whatever custom builds came from the same order.
  async function createWorkOrdersForOrder(order: Order) {
    const supabase = createClient()
    const stockLineItems: { sku_code: string; sku_name: string; quantity: number }[] = []
    const createdWorkOrderIds: string[] = []

    for (const item of order.items || []) {
      const skuCode = (item.sku_code || "").trim()
      if (!skuCode) continue

      const skuSelect = "id, sku_code, name, is_customizable, generic_parent_sku_id, generic_parent:skus!generic_parent_sku_id(id, sku_code, name, is_customizable)"
      let { data: sku } = await supabase.from("skus").select(skuSelect).eq("sku_code", skuCode).single()
      if (!sku) {
        const fallback = await supabase.from("skus").select(skuSelect).eq("shopify_sku_code", skuCode).single()
        if (fallback.data) sku = fallback.data
      }

      if (!sku) continue

      const genericParent = (sku as any).generic_parent
      const buildTarget = genericParent?.is_customizable ? genericParent : (sku.is_customizable ? sku : null)

      if (!buildTarget) {
        stockLineItems.push({ sku_code: sku.sku_code, sku_name: sku.name, quantity: item.quantity || 1 })
        continue
      }

      const specNotes: string[] = []
      const componentMatches: { component_sku_id: string }[] = []

      if (genericParent?.is_customizable && sku.id !== buildTarget.id) {
        componentMatches.push({ component_sku_id: sku.id })
      }

      const configuration = item.configuration || {}
      for (const [key, value] of Object.entries(configuration)) {
        if (!value) continue
        if (SPEC_KEYS.has(key)) {
          specNotes.push(`${key}: ${value}`)
        } else if (COMPONENT_KEYS.has(key)) {
          const match = await findComponentByName(supabase, value as string)
          if (match) {
            componentMatches.push({ component_sku_id: match.id })
          } else {
            specNotes.push(`${key}: ${value} (no matching component SKU found — needs manual review)`)
          }
        }
      }

      const { data: newWO } = await supabase
        .from("work_orders")
        .insert({
          sales_order_reference: order.order_number,
          sku_id: buildTarget.id,
          customer_name: order.dealer_name,
          status: "pending",
          source: "dealer",
          notes: specNotes.length > 0 ? specNotes.join(" · ") : null,
        })
        .select()
        .single()

      if (newWO) {
        createdWorkOrderIds.push(newWO.id)
        if (componentMatches.length > 0) {
          await supabase.from("work_order_items").insert(
            componentMatches.map(m => ({ work_order_id: newWO.id, component_sku_id: m.component_sku_id, quantity: 1 }))
          )
        }
      }
    }

    if (stockLineItems.length > 0 && createdWorkOrderIds.length > 0) {
      const companionRows = createdWorkOrderIds.flatMap(woId =>
        stockLineItems.map(item => ({
          work_order_id: woId,
          sku_code: item.sku_code,
          sku_name: item.sku_name,
          quantity: item.quantity,
        }))
      )
      await supabase.from("work_order_companion_items").insert(companionRows)
    }
  }

  // Backflush domestic component inventory for an order's line items by
  // decomposing each sold SKU through its active BoM — the same approach as
  // Work Order backflush, since we don't know which specific components a
  // dealer's stock build consumed until the order is placed. Drop-ship
  // dealers (Korea/other) never call this — their orders don't touch
  // domestic inventory at all.
  async function backflushOrderInventory(order: Order) {
    const supabase = createClient()
    for (const item of order.items || []) {
      const skuCode = (item.sku_code || "").trim()
      if (!skuCode) continue

      let { data: sku } = await supabase.from("skus").select("id").eq("sku_code", skuCode).single()
      if (!sku) {
        const fallback = await supabase.from("skus").select("id").eq("shopify_sku_code", skuCode).single()
        if (fallback.data) sku = fallback.data
      }
      if (!sku) continue

      const { data: bomHeader } = await supabase.from("bom_headers").select("id").eq("sku_id", sku.id).eq("is_active", true).single()
      if (!bomHeader) continue // no BoM defined — nothing to backflush for this line item

      const { data: bomItems } = await supabase.from("bom_items").select("component_sku_id, quantity").eq("bom_id", bomHeader.id)
      for (const bomItem of bomItems || []) {
        if (!bomItem.component_sku_id) continue
        const totalDeduct = bomItem.quantity * item.quantity
        const { data: inv } = await supabase.from("inventory").select("id, qty_on_hand").eq("sku_id", bomItem.component_sku_id).single()
        if (inv) {
          await supabase.from("inventory").update({
            qty_on_hand: Math.max(0, inv.qty_on_hand - totalDeduct),
            updated_at: new Date().toISOString(),
          }).eq("id", inv.id)
        }
      }
    }
  }

  async function handleShipAndBackflushOrder(order: Order) {
    await backflushOrderInventory(order)
    await updateStatus(order.id, "shipped")
    setShipBackflushConfirm(null)
  }

  async function updateStatus(id: string, status: OrderStatus) {
    const supabase = createClient()
    const extra: any = { updated_at: new Date().toISOString() }
    if (status === "approved") extra.approved_at = new Date().toISOString()
    if (status === "shipped") extra.shipped_at = new Date().toISOString()
    await supabase.from("b2b_orders").update({ status, ...extra }).eq("id", id)

    const order = orders.find(o => o.id === id)

    if (status === "approved" && order) {
      await createWorkOrdersForOrder(order)
    }

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
    setEstimatedShipDate((order as any).estimated_ship_date || "")
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

    const keepIds = editItems.map(i => i.id)
    if (keepIds.length > 0) {
      await supabase.from("b2b_order_items")
        .delete()
        .eq("order_id", editModal.id)
        .not("id", "in", `(${keepIds.join(",")})`)
    } else {
      await supabase.from("b2b_order_items")
        .delete()
        .eq("order_id", editModal.id)
    }

    for (const item of editItems) {
      await supabase.from("b2b_order_items")
        .update({ quantity: item.quantity, unit_price: item.unit_price })
        .eq("id", item.id)
    }

    const newTotal = editItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
    await supabase.from("b2b_orders").update({
      notes: editNotes,
      estimated_ship_date: estimatedShipDate || null,
      total_amount: newTotal,
      updated_at: new Date().toISOString(),
    }).eq("id", editModal.id)

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

  // Uploads a customs/clearance document tied to a specific order. Visible to
  // the dealer in their portal immediately (visible_to_dealer defaults true) —
  // toggle this off first if you want to review internally before releasing it.
  async function handleOrderDocUpload(order: Order, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingDocsFor(order.id)
    const supabase = createClient()
    for (const file of files) {
      const path = `orders/${order.id}/${Date.now()}-${file.name.replace(/\s/g, "_")}`
      const { error } = await supabase.storage.from("Documents").upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from("Documents").getPublicUrl(path)
        await supabase.from("order_documents").insert({
          order_id: order.id,
          name: file.name,
          url: urlData.publicUrl,
          category: docUploadCategory,
          visible_to_dealer: true,
        })
      }
    }
    setUploadingDocsFor(null)
    loadOrders()
  }

  async function toggleDocVisibility(doc: OrderDoc) {
    const supabase = createClient()
    await supabase.from("order_documents").update({ visible_to_dealer: !doc.visible_to_dealer }).eq("id", doc.id)
    loadOrders()
  }

  async function deleteOrderDoc(doc: OrderDoc) {
    const supabase = createClient()
    await supabase.from("order_documents").delete().eq("id", doc.id)
    loadOrders()
  }

  // Helper — both pending and pending_review count as "needs approval"
  const isPending = (o: Order) => o.status === "pending" || o.status === "pending_review"

  const filtered = orders.filter(o => {
    if (filter === "pending_review") return isPending(o)
    if (filter !== "all" && o.status !== filter) return false
    if (orderType !== "all" && (o.order_type || "wholesale") !== orderType) return false
    if (search && !o.order_number?.toLowerCase().includes(search.toLowerCase()) && !o.dealer_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendingCount = orders.filter(isPending).length
  const totalValue = orders.filter(o => !["cancelled", "draft"].includes(o.status)).reduce((sum, o) => sum + (o.total_amount || 0), 0)

  const inputStyle = {
    background: "#23282E",
    border: "0.5px solid rgba(255,255,255,0.12)",
    color: "#fff",
    padding: "6px 10px",
    fontSize: "12px",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    outline: "none",
    boxSizing: "border-box" as const
  }

  const filterTabs: { key: OrderStatus | "all"; label: string; count: number }[] = [
    { key: "all",          label: "All",            count: orders.length },
    { key: "pending_review", label: "Pending Review", count: pendingCount },
    { key: "approved",     label: "Approved",       count: orders.filter(o => o.status === "approved").length },
    { key: "in_production",label: "In Production",  count: orders.filter(o => o.status === "in_production").length },
    { key: "shipped",      label: "Shipped",        count: orders.filter(o => o.status === "shipped").length },
    { key: "fulfilled",    label: "Fulfilled",      count: orders.filter(o => o.status === "fulfilled").length },
    { key: "cancelled",    label: "Cancelled",      count: orders.filter(o => o.status === "cancelled").length },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Orders</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>All Orders</h1>
          <p style={{ fontSize: "12px", color: "#B5BAC2", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
            {loading ? "Loading..." : `${orders.length} total orders`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#787E87" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "200px" }} />
          </div>
          <button onClick={() => router.push("/orders/new")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> New Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Total Orders",   value: orders.length.toString(), color: "#fff", top: "#3A3F47" },
          { label: "Pending Review", value: pendingCount.toString(), color: pendingCount > 0 ? "#C4A93A" : "#5A9E5A", top: pendingCount > 0 ? "#C4A93A" : "#3A3F47" },
          { label: "Active Orders",  value: orders.filter(o => ["approved","in_production","shipped"].includes(o.status)).length.toString(), color: "#6A9CC8", top: "#3A3F47" },
          { label: "Total Value",    value: `$${totalValue.toLocaleString()}`, color: "#5A9E5A", top: "#3A3F47" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${stat.top}`, padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#B5BAC2", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {filterTabs.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 14px", cursor: "pointer", border: "none", background: "transparent", whiteSpace: "nowrap", color: filter === tab.key ? "#fff" : "#8B919A", borderBottom: filter === tab.key ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Order type toggles */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87" }}>Type:</span>
        {(["all", "wholesale", "fitter", "retail", "international", "factory", "misc"] as const).map(t => (
          <button key={t} onClick={() => setOrderType(t)}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 12px", cursor: "pointer", border: "none", background: orderType === t ? "#A91E22" : "transparent", color: orderType === t ? "#fff" : "#8B919A", outline: orderType === t ? "none" : "1px solid #3A3F47" }}>
            {t === "all" ? `All (${orders.length})` : `${t.charAt(0).toUpperCase() + t.slice(1)} (${orders.filter(o => (o.order_type || "wholesale") === t).length})`}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#787E87", margin: "0 0 8px" }}>
            {filter === "all" ? "No Orders Yet" : `No ${filter.replace("_", " ")} orders`}
          </p>
          {filter === "all" && (
            <button onClick={() => router.push("/orders/new")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", marginTop: "8px" }}>+ New Order</button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(order => {
            const isExpanded = expanded === order.id
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending_review
            const orderDocs = docsByOrder[order.id] || []

            return (
              <div key={order.id} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)" }}>
                <div onClick={() => setExpanded(isExpanded ? null : order.id)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 150px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{order.order_number || "—"}</p>
                    <p style={{ fontSize: "11px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{order.dealer_name}</p>
                  </div>
                  <div style={{ flex: "0 0 140px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>{statusInfo.label}</span>
                    {order.order_type && order.order_type !== "wholesale" && (
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", background: "rgba(106,156,200,0.1)", padding: "2px 8px", alignSelf: "flex-start" }}>{order.order_type}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: "24px" }}>
                    <div>
                      <p style={{ fontSize: "9px", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Submitted</p>
                      <p style={{ fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(order.submitted_at || order.created_at)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "9px", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Items</p>
                      <p style={{ fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{(order.items || []).length} line item{(order.items || []).length !== 1 ? "s" : ""}</p>
                    </div>
                    {orderDocs.length > 0 && (
                      <div>
                        <p style={{ fontSize: "9px", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Docs</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                          <FileText size={11} color="#5A9E5A" />
                          <span style={{ fontSize: "12px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif" }}>{orderDocs.length}</span>
                        </div>
                      </div>
                    )}
                    {order.approved_at && (
                      <div>
                        <p style={{ fontSize: "9px", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Approved</p>
                        <p style={{ fontSize: "12px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{formatDate(order.approved_at)}</p>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: "0 0 120px", textAlign: "right" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>${(order.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <ChevronDown size={16} color="#787E87" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#2B3038" }}>

                    {order.items && order.items.length > 0 ? (
                      <div style={{ marginBottom: "16px" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "10px" }}>Line Items</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["Product", "SKU", "Configuration", "Qty", "Unit Price", "Total"].map(h => (
                                <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87", padding: "6px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map(item => (
                              <tr key={item.id}>
                                <td style={{ padding: "8px 12px", fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.product_name}</td>
                                <td style={{ padding: "8px 12px", fontSize: "11px", color: "#9BA0A8", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku_code || "—"}</td>
                                <td style={{ padding: "8px 12px", fontSize: "11px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                                  {item.configuration && Object.keys(item.configuration).length > 0 ? Object.entries(item.configuration).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}
                                </td>
                                <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#E0E2E6", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.quantity}</td>
                                <td style={{ padding: "8px 12px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(item.unit_price || 0).toFixed(2)}</td>
                                <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${((item.unit_price || 0) * item.quantity).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={5} style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B919A", textAlign: "right" }}>Order Total</td>
                              <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>${(order.total_amount || 0).toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: "12px", color: "#787E87", fontFamily: "'Barlow', sans-serif", marginBottom: "16px" }}>No line items found.</p>
                    )}

                    {order.notes && <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", marginBottom: "16px", fontStyle: "italic" }}>Note: {order.notes}</p>}

                    {/* Order documents — customs/clearance, visible to dealer in their portal */}
                    <div style={{ marginBottom: "16px", background: "#262B32", border: "0.5px solid rgba(255,255,255,0.08)", padding: "14px 16px" }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "10px" }}>
                        Customs &amp; Order Documents
                      </p>
                      <p style={{ fontSize: "11px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: "0 0 12px" }}>
                        Documents marked visible appear in this dealer's portal immediately — useful for COO/CI on international orders to avoid customs delays.
                      </p>

                      <div style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                        <select value={docUploadCategory} onChange={e => setDocUploadCategory(e.target.value)} style={{ ...inputStyle, width: "220px", cursor: "pointer" }}>
                          {ORDER_DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#6A9CC8", border: "none", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" multiple onChange={e => handleOrderDocUpload(order, e)} style={{ display: "none" }} />
                          <Upload size={12} /> {uploadingDocsFor === order.id ? "Uploading..." : "Upload Document"}
                        </label>
                      </div>

                      {orderDocs.length === 0 ? (
                        <p style={{ fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif", fontStyle: "italic" }}>No documents uploaded for this order yet</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} onClick={e => e.stopPropagation()}>
                          {orderDocs.map(doc => {
                            const catStyle = ORDER_DOC_COLORS[doc.category] || ORDER_DOC_COLORS.other
                            return (
                              <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.08)", padding: "9px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <FileText size={13} color={catStyle.color} />
                                  <span style={{ fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif" }}>{doc.name}</span>
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: catStyle.color, background: catStyle.bg, padding: "2px 7px" }}>
                                    {ORDER_DOC_CATEGORIES.find(c => c.value === doc.category)?.label}
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                  <button onClick={() => toggleDocVisibility(doc)}
                                    title={doc.visible_to_dealer ? "Visible to dealer — click to hide" : "Hidden from dealer — click to show"}
                                    style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: doc.visible_to_dealer ? "#5A9E5A" : "#787E87", background: doc.visible_to_dealer ? "rgba(90,158,90,0.1)" : "rgba(255,255,255,0.06)", border: "none", padding: "3px 8px", cursor: "pointer" }}>
                                    {doc.visible_to_dealer ? "Visible to Dealer" : "Hidden"}
                                  </button>
                                  <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", textDecoration: "none" }}>
                                    <ExternalLink size={12} /> Open
                                  </a>
                                  <button onClick={() => deleteOrderDoc(doc)} style={{ background: "none", border: "none", color: "#666C75", cursor: "pointer", display: "flex" }}><X size={14} /></button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Per-order message thread with the dealer */}
                    {order.dealer_id && (
                      <div style={{ marginBottom: "16px" }} onClick={e => e.stopPropagation()}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "10px" }}>
                          Messages — {order.dealer_name}
                        </p>
                        <MessageThread dealerId={order.dealer_id} orderId={order.id} currentUserRole="admin" compact />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                      {isPending(order) && (
                        <button onClick={() => updateStatus(order.id, "approved")}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "7px 14px", cursor: "pointer" }}>
                          ✓ Approve Order
                        </button>
                      )}
                      {order.status === "approved" && (
                        <button onClick={() => updateStatus(order.id, "in_production")}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#C4A93A", border: "none", padding: "7px 14px", cursor: "pointer" }}>
                          Mark In Production
                        </button>
                      )}
                      {order.status === "in_production" && (
                        order.dealer?.fulfillment_source === "drop_ship" ? (
                          <button onClick={() => updateStatus(order.id, "shipped")}
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#6A9CC8", border: "none", padding: "7px 14px", cursor: "pointer" }}>
                            Mark Shipped
                          </button>
                        ) : (
                          <button onClick={() => setShipBackflushConfirm(order)}
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "7px 14px", cursor: "pointer" }}>
                            Ship & Backflush
                          </button>
                        )
                      )}
                      {order.status === "shipped" && (
                        <button onClick={() => updateStatus(order.id, "fulfilled")}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "7px 14px", cursor: "pointer" }}>
                          Mark Fulfilled
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); openEdit(order) }}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6A9CC8", background: "transparent", border: "1px solid rgba(106,156,200,0.3)", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Pencil size={11} /> Edit Order
                      </button>
                      <button onClick={e => { e.stopPropagation(); printOrder(order) }}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B5BAC2", background: "transparent", border: "1px solid #666C75", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Printer size={11} /> Print Order
                      </button>
                      {!["fulfilled", "cancelled"].includes(order.status) && (
                        <button onClick={() => updateStatus(order.id, "cancelled")}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "7px 14px", cursor: "pointer", marginLeft: "auto" }}>
                          Cancel Order
                        </button>
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
          <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #6A9CC8", width: "100%", maxWidth: "700px", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#20242A", position: "sticky", top: 0, zIndex: 10 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6A9CC8", margin: "0 0 4px" }}>Edit Order</p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>{editModal.order_number} — {editModal.dealer_name}</h2>
              </div>
              <button onClick={() => setEditModal(null)} style={{ background: "none", border: "none", color: "#8B919A", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "10px" }}>Line Items</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {editItems.map(item => (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 40px", gap: "10px", alignItems: "center", background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{item.sku_code}</p>
                        <p style={{ fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{item.product_name}</p>
                      </div>
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#787E87", marginBottom: "3px" }}>Qty</p>
                        <input type="number" style={{ ...inputStyle, width: "100%" }} min={1} value={item.quantity} onChange={e => updateEditItem(item.id, "quantity", parseInt(e.target.value) || 1)} />
                      </div>
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#787E87", marginBottom: "3px" }}>Unit Price</p>
                        <input type="number" style={{ ...inputStyle, width: "100%" }} value={item.unit_price} onChange={e => updateEditItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} />
                      </div>
                      <button onClick={() => removeEditItem(item.id)} style={{ background: "none", border: "none", color: "#8B919A", cursor: "pointer", padding: "2px" }}><X size={14} /></button>
                    </div>
                  ))}
                  {editItems.length === 0 && (
                    <p style={{ fontSize: "12px", color: "#787E87", fontFamily: "'Barlow', sans-serif", padding: "16px 0" }}>No line items.</p>
                  )}
                </div>
                <div style={{ textAlign: "right", marginTop: "10px" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                    New Total: ${editItems.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "6px" }}>Estimated Ship Date</p>
                <input type="date" value={estimatedShipDate} onChange={e => setEstimatedShipDate(e.target.value)} style={{ width: "100%", background: "#23282E", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const, marginBottom: "16px" }} />
                <p style={{ fontSize: "11px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: "-12px 0 0 0", marginBottom: "16px" }}>Shown to the dealer in their portal once set.</p>

                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "6px" }}>Order Notes</p>
                <textarea style={{ width: "100%", background: "#23282E", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", resize: "none", minHeight: "60px", boxSizing: "border-box" as const }} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>

              <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.08)", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <input type="checkbox" id="notify_dealer" checked={notifyDealer} onChange={e => setNotifyDealer(e.target.checked)} style={{ cursor: "pointer" }} />
                  <label htmlFor="notify_dealer" style={{ fontSize: "13px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Notify dealer of changes</label>
                </div>
                {notifyDealer && (
                  <div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#787E87", marginBottom: "5px" }}>Reason for change (optional)</p>
                    <input style={{ width: "100%", background: "#23282E", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }} placeholder="e.g. Item out of stock, price correction..." value={changeReason} onChange={e => setChangeReason(e.target.value)} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setEditModal(null)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9BA0A8", background: "transparent", border: "1px solid #666C75", padding: "10px 20px", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving ? "#666C75" : "#6A9CC8", border: "none", padding: "12px", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Save size={14} /> {saving ? "Saving..." : "Save Changes →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ship & Backflush confirmation — domestic-stock dealer orders only */}
      {shipBackflushConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setShipBackflushConfirm(null)}>
          <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.14)", borderTop: "2px solid #5A9E5A", padding: "32px", width: "440px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>Ship & Backflush?</h2>
            <p style={{ fontSize: "13px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px" }}>
              This will deduct domestic component inventory for every line item on order <strong style={{ color: "#fff" }}>{shipBackflushConfirm.order_number}</strong> (decomposed through each product's BoM) and mark it <strong style={{ color: "#fff" }}>Shipped</strong>.
            </p>
            <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "0 0 20px" }}>This cannot be undone automatically — make sure the order is actually complete and shipping.</p>
            <div style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", padding: "12px", marginBottom: "20px" }}>
              {(shipBackflushConfirm.items || []).map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontFamily: "'Barlow', sans-serif", color: "#B5BAC2", padding: "3px 0" }}>
                  <span>{item.sku_code} — {item.product_name}</span>
                  <span>× {item.quantity}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "11px", color: "#666C75", fontFamily: "'Barlow', sans-serif", margin: "0 0 16px", fontStyle: "italic" }}>
              Component-level deduction will be calculated from each product's active BoM at the moment you confirm.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShipBackflushConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B919A", background: "transparent", border: "1px solid #3A3F47", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleShipAndBackflushOrder(shipBackflushConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "10px", cursor: "pointer" }}>Ship & Backflush</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, Trash2, Search, CheckCircle, Package } from "lucide-react"
import { createClient } from "@/lib/supabase"

const supabase = createClient()

type SKU = {
  id: string
  sku_code: string
  name: string
  unit_cost: number | null
  sku_type: string
  unit_of_measure?: string | null
  cost_per_uom?: number | null
}

type WorkOrderItem = {
  id: string
  work_order_id: string
  component_sku_id: string | null
  quantity: number
  unit_cost: number | null
  notes: string | null
  component?: SKU
}

type WorkOrder = {
  id: string
  sales_order_reference: string | null
  sku_id: string | null
  customer_name: string | null
  status: "pending" | "in_production" | "completed" | "shipped" | "cancelled"
  notes: string | null
  source?: "shopify" | "dealer" | "manual"
  created_at: string
  completed_at: string | null
  shipped_at: string | null
  sku?: { sku_code: string; name: string }
  items?: WorkOrderItem[]
  companion_items?: { id: string; sku_code: string; sku_name: string; quantity: number }[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", in_production: "In Production", completed: "Completed", shipped: "Shipped", cancelled: "Cancelled",
}
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: "rgba(196,169,58,0.1)", color: "#C4A93A" },
  in_production: { bg: "rgba(106,156,200,0.12)", color: "#6A9CC8" },
  completed: { bg: "rgba(90,158,90,0.1)", color: "#5A9E5A" },
  shipped: { bg: "rgba(136,136,136,0.1)", color: "#787E87" },
  cancelled: { bg: "rgba(169,30,34,0.1)", color: "#A91E22" },
}
const UOM_LABELS: Record<string, string> = {
  fl_oz: "fl oz", ml: "ml", linear_ft: "linear ft", linear_in: "linear in", g: "g", oz: "oz", each: "each",
}
const SOURCE_LABELS: Record<string, string> = { shopify: "Shopify DTC", dealer: "Dealer Order", manual: "Manual" }
const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  shopify: { bg: "rgba(106,156,200,0.12)", color: "#6A9CC8" },
  dealer: { bg: "rgba(196,169,58,0.1)", color: "#C4A93A" },
  manual: { bg: "rgba(255,255,255,0.06)", color: "#8B919A" },
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customizableSkus, setCustomizableSkus] = useState<SKU[]>([])
  const [allComponents, setAllComponents] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [showCompleted, setShowCompleted] = useState(false)
  const [modal, setModal] = useState(false)
  const [editingWO, setEditingWO] = useState<WorkOrder | null>(null)
  const [woForm, setWoForm] = useState({ sku_id: "", sales_order_reference: "", customer_name: "", notes: "" })
  const [items, setItems] = useState<{ component_sku_id: string; sku?: SKU; quantity: number; unit_cost: number }[]>([])
  const [pickerTab, setPickerTab] = useState<"component" | "consumable">("component")
  const [componentSearch, setComponentSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [shipConfirm, setShipConfirm] = useState<WorkOrder | null>(null)
  const [shipGroupConfirm, setShipGroupConfirm] = useState<WorkOrder[] | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: woData }, { data: skuData }, { data: allSkuData }] = await Promise.all([
      supabase.from("work_orders").select("*, sku:skus(sku_code, name)").order("created_at", { ascending: false }),
      supabase.from("skus").select("id, sku_code, name, unit_cost, sku_type").eq("is_customizable", true).eq("is_active", true).order("sku_code"),
      supabase.from("skus").select("id, sku_code, name, unit_cost, sku_type, unit_of_measure, cost_per_uom").eq("is_active", true).order("sku_code"),
    ])

    if (skuData) setCustomizableSkus(skuData)
    if (allSkuData) setAllComponents(allSkuData)

    if (woData) {
      const ids = woData.map((w: any) => w.id)
      const [{ data: itemsData }, { data: companionData }] = await Promise.all([
        supabase.from("work_order_items")
          .select("*, component:skus(id, sku_code, name, unit_cost, sku_type, unit_of_measure, cost_per_uom)")
          .in("work_order_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("work_order_companion_items")
          .select("*")
          .in("work_order_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      ])

      const merged = woData.map((wo: any) => ({
        ...wo,
        items: (itemsData || []).filter((i: any) => i.work_order_id === wo.id),
        companion_items: (companionData || []).filter((c: any) => c.work_order_id === wo.id),
      }))
      setWorkOrders(merged)
    }
    setLoading(false)
  }

  function toggleGroupExpanded(groupKey: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  function openNewWO() {
    setEditingWO(null)
    setWoForm({ sku_id: "", sales_order_reference: "", customer_name: "", notes: "" })
    setItems([])
    setPickerTab("component")
    setComponentSearch("")
    setModal(true)
  }

  function openEditWO(wo: WorkOrder) {
    setEditingWO(wo)
    setWoForm({
      sku_id: wo.sku_id || "",
      sales_order_reference: wo.sales_order_reference || "",
      customer_name: wo.customer_name || "",
      notes: wo.notes || "",
    })
    setItems((wo.items || []).map(i => ({
      component_sku_id: i.component_sku_id || "",
      sku: i.component,
      quantity: i.quantity,
      unit_cost: i.unit_cost || i.component?.unit_cost || 0,
    })))
    setPickerTab("component")
    setComponentSearch("")
    setModal(true)
  }

  function addComponent(sku: SKU) {
    const existing = items.find(l => l.component_sku_id === sku.id)
    if (existing) {
      setItems(prev => prev.map(l => l.component_sku_id === sku.id ? { ...l, quantity: l.quantity + 1 } : l))
    } else {
      const defaultCost = sku.sku_type === "consumable" ? (sku.cost_per_uom || 0) : (sku.unit_cost || 0)
      setItems(prev => [...prev, { component_sku_id: sku.id, sku, quantity: 1, unit_cost: defaultCost }])
    }
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(l => l.component_sku_id !== id))
  }

  function updateItem(id: string, key: string, value: any) {
    setItems(prev => prev.map(l => l.component_sku_id === id ? { ...l, [key]: value } : l))
  }

  async function handleSaveWO() {
    setSaving(true)
    let woId = editingWO?.id

    const payload = {
      sku_id: woForm.sku_id || null,
      sales_order_reference: woForm.sales_order_reference || null,
      customer_name: woForm.customer_name || null,
      notes: woForm.notes || null,
      updated_at: new Date().toISOString(),
    }

    if (woId) {
      await supabase.from("work_orders").update(payload).eq("id", woId)
      await supabase.from("work_order_items").delete().eq("work_order_id", woId)
    } else {
      const { data: newWO } = await supabase.from("work_orders").insert({ ...payload, status: "pending" }).select().single()
      woId = newWO?.id
    }

    if (woId && items.length > 0) {
      await supabase.from("work_order_items").insert(
        items.map(line => ({
          work_order_id: woId,
          component_sku_id: line.component_sku_id || null,
          quantity: line.quantity,
          unit_cost: line.unit_cost || null,
        }))
      )
    }

    setSaving(false)
    setModal(false)
    loadAll()
  }

  async function updateStatus(wo: WorkOrder, status: WorkOrder["status"]) {
    const updates: any = { status, updated_at: new Date().toISOString() }
    if (status === "completed") updates.completed_at = new Date().toISOString()
    await supabase.from("work_orders").update(updates).eq("id", wo.id)
    loadAll()
  }

  // Backflush: deduct every component on this work order from inventory, then mark shipped
  // Core backflush logic for a single work order — deducts every component
  // from inventory and marks it shipped. Used both for single-item ship
  // actions and as a building block for shipping a whole multi-item order
  // group at once.
  async function backflushOne(wo: WorkOrder) {
    for (const item of wo.items || []) {
      if (!item.component_sku_id) continue
      const { data: inv } = await supabase.from("inventory").select("id, qty_on_hand").eq("sku_id", item.component_sku_id).single()
      if (inv) {
        await supabase.from("inventory").update({
          qty_on_hand: Math.max(0, inv.qty_on_hand - item.quantity),
          updated_at: new Date().toISOString(),
        }).eq("id", inv.id)
      }
    }
    await supabase.from("work_orders").update({
      status: "shipped",
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", wo.id)
  }

  async function handleShipAndBackflush(wo: WorkOrder) {
    await backflushOne(wo)
    setShipConfirm(null)
    loadAll()
  }

  // Ships every work order in a group at once — used when all line items on
  // a multi-product order have reached "completed" and should go out together
  // rather than requiring N separate ship actions.
  async function handleShipAndBackflushGroup(groupItems: WorkOrder[]) {
    for (const wo of groupItems) {
      await backflushOne(wo)
    }
    setShipGroupConfirm(null)
    loadAll()
  }

  const activeWorkOrders = workOrders.filter(w => w.status !== "shipped" && w.status !== "cancelled")
  const historyWorkOrders = workOrders.filter(w => w.status === "shipped" || w.status === "cancelled")
  const displayedWOs = showCompleted ? historyWorkOrders : activeWorkOrders

  const filteredWOs = displayedWOs.filter(w =>
    !search ||
    w.sales_order_reference?.toLowerCase().includes(search.toLowerCase()) ||
    w.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    w.sku?.sku_code.toLowerCase().includes(search.toLowerCase())
  )

  // Group by sales order reference so a single Shopify order with multiple
  // customizable line items (e.g. 3 wedges in one order) appears as one card
  // with each build nested inside, instead of N separate top-level cards.
  // Work orders with no reference each get their own group (using their id as
  // a unique key) rather than being lumped together under a blank label.
  const groupedWOs = filteredWOs.reduce((groups: Record<string, WorkOrder[]>, wo) => {
    const key = wo.sales_order_reference || `__no_ref_${wo.id}`
    if (!groups[key]) groups[key] = []
    groups[key].push(wo)
    return groups
  }, {})
  const orderGroups = Object.entries(groupedWOs).sort((a, b) =>
    new Date(b[1][0].created_at).getTime() - new Date(a[1][0].created_at).getTime()
  )

  const pickerSkus = allComponents.filter(s => s.sku_type === pickerTab)
  const filteredComponents = pickerSkus.filter(s =>
    !componentSearch ||
    s.sku_code.toLowerCase().includes(componentSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(componentSearch.toLowerCase())
  )
  const componentCount = allComponents.filter(s => s.sku_type === "component").length
  const consumableCount = allComponents.filter(s => s.sku_type === "consumable").length

  const getMaterialCost = () => items.reduce((sum, l) => sum + (l.unit_cost || 0) * l.quantity, 0)

  const inputStyle = { background: "#262B32", border: "0.5px solid rgba(255,255,255,0.16)", color: "#fff", padding: "7px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#8B919A", marginBottom: "4px" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.14)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Operations</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Work Orders</h1>
          <p style={{ fontSize: "12px", color: "#B5BAC2", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>
            Custom builds in progress — components are backflushed from inventory on ship
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#787E87" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search order ref, customer, SKU..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.14)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "240px" }} />
          </div>
          <button onClick={openNewWO} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> New Work Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Pending", value: workOrders.filter(w => w.status === "pending").length, color: "#C4A93A" },
          { label: "In Production", value: workOrders.filter(w => w.status === "in_production").length, color: "#6A9CC8" },
          { label: "Completed — Ready to Ship", value: workOrders.filter(w => w.status === "completed").length, color: "#5A9E5A" },
          { label: "Shipped (All Time)", value: workOrders.filter(w => w.status === "shipped").length, color: "#B5BAC2" },
        ].map(s => (
          <div key={s.label} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.14)", borderTop: "2px solid #3A3F47", padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#B5BAC2", marginBottom: "8px" }}>{s.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Active/History toggle */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.14)" }}>
        {[
          { key: false, label: `Active (${activeWorkOrders.length})` },
          { key: true, label: `Shipped / Cancelled History (${historyWorkOrders.length})` },
        ].map(t => (
          <button key={String(t.key)} onClick={() => setShowCompleted(t.key)}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: showCompleted === t.key ? "#fff" : "#8B919A", borderBottom: showCompleted === t.key ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {t.label}
          </button>
        ))}
      </div>

      {!loading && customizableSkus.length === 0 && (
        <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: "3px solid #C4A93A", padding: "16px 20px" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#C4A93A", margin: "0 0 4px" }}>No Customizable Products Set Up</p>
          <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
            Go to <strong style={{ color: "#B5BAC2" }}>Inventory → SKUs</strong> and mark products as customizable to create work orders for them.
          </p>
        </div>
      )}

      {/* Work Order List */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {orderGroups.length === 0 ? (
            <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", padding: "50px 20px", textAlign: "center" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", color: "#787E87", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {showCompleted ? "No shipped or cancelled work orders yet" : "No active work orders"}
              </p>
            </div>
          ) : orderGroups.map(([groupKey, groupItems]) => {
            const orderRef = groupItems[0].sales_order_reference
            const customerName = groupItems[0].customer_name
            const source = groupItems[0].source || "manual"
            const sourceStyle = SOURCE_COLORS[source]
            const isMultiItem = groupItems.length > 1
            const isGroupExpanded = expandedGroups.has(groupKey)
            const companionItems = groupItems[0].companion_items || []
            const statusCounts = groupItems.reduce((acc: Record<string, number>, wo) => {
              acc[wo.status] = (acc[wo.status] || 0) + 1
              return acc
            }, {})
            const allCompleted = groupItems.every(wo => wo.status === "completed")

            return (
              <div key={groupKey} style={{ background: isMultiItem ? "#262B32" : "transparent", border: isMultiItem ? "0.5px solid rgba(255,255,255,0.18)" : "none", padding: isMultiItem ? "12px" : "0" }}>
                {isMultiItem && (
                  <div onClick={() => toggleGroupExpanded(groupKey)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 10px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <ChevronDown size={14} color="#787E87" style={{ transform: isGroupExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>
                        {orderRef || "No Order Ref"}
                      </p>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8B919A", background: "rgba(255,255,255,0.06)", padding: "2px 8px" }}>
                        {groupItems.length} builds
                      </span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: sourceStyle.color, background: sourceStyle.bg, padding: "2px 7px" }}>
                        {SOURCE_LABELS[source]}
                      </span>
                      {companionItems.length > 0 && (
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C4A93A", background: "rgba(196,169,58,0.1)", padding: "2px 7px" }}>
                          +{companionItems.length} stock item{companionItems.length !== 1 ? "s" : ""} on order
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {allCompleted && (
                        <button onClick={e => { e.stopPropagation(); setShipGroupConfirm(groupItems) }}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                          <Package size={12} /> Ship All & Backflush ({groupItems.length})
                        </button>
                      )}
                      {!isGroupExpanded && Object.entries(statusCounts).map(([st, count]) => (
                        <span key={st} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: STATUS_COLORS[st].color, background: STATUS_COLORS[st].bg, padding: "2px 7px" }}>
                          {count} {STATUS_LABELS[st]}
                        </span>
                      ))}
                      <p style={{ fontSize: "12px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{customerName || "—"}</p>
                    </div>
                  </div>
                )}
                {(!isMultiItem || isGroupExpanded) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {isMultiItem && companionItems.length > 0 && (
                    <div style={{ background: "rgba(196,169,58,0.06)", border: "0.5px dashed rgba(196,169,58,0.3)", padding: "10px 14px" }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4A93A", margin: "0 0 6px" }}>
                        Also on this order — pull & ship, not built (ship together)
                      </p>
                      {companionItems.map(ci => (
                        <div key={ci.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontFamily: "'Barlow', sans-serif", color: "#B5BAC2", padding: "2px 0" }}>
                          <span>{ci.sku_code} — {ci.sku_name}</span>
                          <span style={{ color: "#8B919A" }}>× {ci.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {groupItems.map(wo => {
                    const isExpanded = expanded === wo.id
                    const statusStyle = STATUS_COLORS[wo.status]
                    const materialCost = (wo.items || []).reduce((sum, i) => sum + (i.unit_cost || i.component?.unit_cost || 0) * i.quantity, 0)

                    return (
                      <div key={wo.id} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.14)", borderLeft: `3px solid ${statusStyle.color}` }}>
                        <div onClick={() => setExpanded(isExpanded ? null : wo.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                          <div style={{ flex: "0 0 200px" }}>
                            {!isMultiItem && (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>
                                  {wo.sales_order_reference || "No Order Ref"}
                                </p>
                                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: sourceStyle.color, background: sourceStyle.bg, padding: "1px 6px" }}>
                                  {SOURCE_LABELS[source]}
                                </span>
                              </div>
                            )}
                            <p style={{ fontSize: "11px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: isMultiItem ? 0 : "2px 0 0" }}>
                              {wo.sku?.sku_code} — {wo.sku?.name}
                            </p>
                          </div>
                          {!isMultiItem && (
                            <div style={{ flex: "0 0 160px" }}>
                              <p style={{ fontSize: "12px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{wo.customer_name || "—"}</p>
                            </div>
                          )}
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: statusStyle.color, background: statusStyle.bg, padding: "3px 8px" }}>
                            {STATUS_LABELS[wo.status]}
                          </span>
                          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                            {wo.status === "pending" && (
                              <button onClick={e => { e.stopPropagation(); updateStatus(wo, "in_production") }}
                                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", background: "transparent", border: "1px solid rgba(106,156,200,0.3)", padding: "5px 12px", cursor: "pointer" }}>
                                Start Production
                              </button>
                            )}
                            {wo.status === "in_production" && (
                              <button onClick={e => { e.stopPropagation(); updateStatus(wo, "completed") }}
                                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A9E5A", background: "transparent", border: "1px solid rgba(90,158,90,0.3)", padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                                <CheckCircle size={12} /> Mark Completed
                              </button>
                            )}
                            {wo.status === "completed" && (
                              <button onClick={e => { e.stopPropagation(); setShipConfirm(wo) }}
                                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                                <Package size={12} /> Ship & Backflush
                              </button>
                            )}
                            {(wo.status === "pending" || wo.status === "in_production") && (
                              <button onClick={e => { e.stopPropagation(); openEditWO(wo) }}
                                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "5px 12px", cursor: "pointer" }}>
                                Edit
                              </button>
                            )}
                          </div>
                          <ChevronDown size={16} color="#787E87" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.14)", padding: "16px 20px", background: "#262B32" }}>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "12px" }}>Build Components</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {(wo.items || []).length === 0 ? (
                                <p style={{ fontSize: "12px", color: "#787E87", fontFamily: "'Barlow', sans-serif" }}>No components added yet.</p>
                              ) : (wo.items || []).map(item => (
                                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 90px 80px 80px 100px", gap: "12px", alignItems: "center", padding: "8px 12px", background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.08)" }}>
                                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{item.component?.sku_code}</p>
                                  <p style={{ fontSize: "11px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{item.component?.name}</p>
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 6px", background: item.component?.sku_type === "consumable" ? "rgba(106,156,200,0.12)" : "rgba(196,169,58,0.1)", color: item.component?.sku_type === "consumable" ? "#6A9CC8" : "#C4A93A", justifySelf: "start" }}>
                                    {item.component?.sku_type === "consumable" ? "Consumable" : "Component"}
                                  </span>
                                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff", margin: 0, textAlign: "center" }}>
                                    {item.component?.sku_type === "consumable" ? `${item.quantity} ${UOM_LABELS[item.component?.unit_of_measure || ""] || ""}` : `× ${item.quantity}`}
                                  </p>
                                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", color: "#787E87", margin: 0, textAlign: "right" }}>${(item.unit_cost || item.component?.unit_cost || 0).toFixed(2)}</p>
                                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#E0E2E6", margin: 0, textAlign: "right" }}>${((item.unit_cost || item.component?.unit_cost || 0) * item.quantity).toFixed(2)}</p>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px", paddingTop: "12px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                              <div style={{ textAlign: "right" }}>
                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87", margin: "0 0 2px" }}>Total Material Cost</p>
                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#E8C84A", margin: 0 }}>${materialCost.toFixed(2)}</p>
                              </div>
                            </div>
                            {wo.notes && (
                              <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", marginTop: "12px" }}>
                                <strong style={{ color: "#B5BAC2" }}>Notes:</strong> {wo.notes}
                              </p>
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
          })}
        </div>
      )}

      {/* Add/Edit Work Order Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setModal(false)}>
          <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.14)", borderTop: "2px solid #A91E22", width: "100%", maxWidth: "960px", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.10)", background: "#20242A", flexShrink: 0 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>Operations</p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>
                  {editingWO ? "Edit Work Order" : "New Work Order"}
                </h2>
              </div>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "#8B919A", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden", minHeight: 0 }}>

              {/* Left — component picker */}
              <div style={{ borderRight: "0.5px solid rgba(255,255,255,0.10)", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)", background: "#20242A", flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                    <button onClick={() => setPickerTab("component")}
                      style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "7px", cursor: "pointer", border: "none", background: pickerTab === "component" ? "rgba(196,169,58,0.18)" : "#262B32", color: pickerTab === "component" ? "#C4A93A" : "#8B919A" }}>
                      Components ({componentCount})
                    </button>
                    <button onClick={() => setPickerTab("consumable")}
                      style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "7px", cursor: "pointer", border: "none", background: pickerTab === "consumable" ? "rgba(106,156,200,0.18)" : "#262B32", color: pickerTab === "consumable" ? "#6A9CC8" : "#8B919A" }}>
                      Consumables ({consumableCount})
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <Search size={12} color="#787E87" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }} />
                    <input placeholder={`Search ${pickerTab === "component" ? "components" : "consumables"}...`} value={componentSearch} onChange={e => setComponentSearch(e.target.value)}
                      style={{ ...inputStyle, width: "100%", paddingLeft: "26px" }} />
                  </div>
                </div>
                <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
                  {filteredComponents.map(sku => {
                    const alreadyAdded = items.some(l => l.component_sku_id === sku.id)
                    return (
                      <div key={sku.id} onClick={() => addComponent(sku)}
                        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", cursor: "pointer", background: alreadyAdded ? "rgba(169,30,34,0.08)" : "transparent", border: `0.5px solid ${alreadyAdded ? "rgba(169,30,34,0.25)" : "transparent"}`, marginBottom: "2px" }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: alreadyAdded ? "#A91E22" : "#E0E2E6", margin: 0 }}>{sku.sku_code}</p>
                          <p style={{ fontSize: "11px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0" }}>{sku.name}</p>
                        </div>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#8B919A" }}>
                          {sku.sku_type === "consumable" ? (sku.cost_per_uom ? `$${sku.cost_per_uom.toFixed(4)}/${UOM_LABELS[sku.unit_of_measure || ""] || "unit"}` : "—") : (sku.unit_cost ? `$${sku.unit_cost.toFixed(2)}` : "—")}
                        </span>
                        <div style={{ width: "20px", height: "20px", background: alreadyAdded ? "#A91E22" : "#3A3F47", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Plus size={12} color="#fff" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right — order details + build sheet */}
              <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)", background: "#20242A", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Product (Customizable SKU)</label>
                    <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={woForm.sku_id} onChange={e => setWoForm(f => ({ ...f, sku_id: e.target.value }))}>
                      <option value="">Select product...</option>
                      {customizableSkus.map(s => <option key={s.id} value={s.id}>{s.sku_code} — {s.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>Sales Order Ref</label>
                      <input style={{ ...inputStyle, width: "100%" }} placeholder="EF-100234" value={woForm.sales_order_reference} onChange={e => setWoForm(f => ({ ...f, sales_order_reference: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Customer Name</label>
                      <input style={{ ...inputStyle, width: "100%" }} placeholder="John Smith" value={woForm.customer_name} onChange={e => setWoForm(f => ({ ...f, customer_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Notes (build specs — length, lie angle, etc.)</label>
                    <textarea style={{ ...inputStyle, width: "100%", minHeight: "50px", resize: "vertical" as const }} placeholder="35in length, 2° flat, etc." value={woForm.notes} onChange={e => setWoForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>

                <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B919A", padding: "8px 8px 4px" }}>
                    Build Components — {items.length} line{items.length !== 1 ? "s" : ""}
                  </p>
                  {items.length === 0 ? (
                    <div style={{ padding: "30px", textAlign: "center", color: "#666C75", fontSize: "12px", fontFamily: "'Barlow', sans-serif" }}>
                      No components yet. Click items on the left to add them.
                    </div>
                  ) : items.map(line => (
                    <div key={line.component_sku_id} style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", padding: "10px 12px", marginBottom: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{line.sku?.sku_code}</p>
                          <p style={{ fontSize: "11px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{line.sku?.name}</p>
                        </div>
                        <button onClick={() => removeItem(line.component_sku_id)} style={{ background: "none", border: "none", color: "#666C75", cursor: "pointer", padding: "2px" }}><X size={14} /></button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <label style={labelStyle}>{line.sku?.sku_type === "consumable" ? `Amount (${UOM_LABELS[line.sku?.unit_of_measure || ""] || "units"})` : "Qty"}</label>
                          <input type="number" step={line.sku?.sku_type === "consumable" ? "0.01" : "1"} style={{ ...inputStyle, width: "100%" }} value={line.quantity}
                            onChange={e => updateItem(line.component_sku_id, "quantity", parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Unit Cost ($)</label>
                          <input type="number" style={{ ...inputStyle, width: "100%" }} value={line.unit_cost || ""} placeholder="0.00"
                            onChange={e => updateItem(line.component_sku_id, "unit_cost", parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: "16px", borderTop: "0.5px solid rgba(255,255,255,0.10)", background: "#20242A", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87", margin: 0 }}>Total Material Cost</p>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#E8C84A", margin: 0 }}>${getMaterialCost().toFixed(2)}</p>
                  </div>
                  <button onClick={handleSaveWO} disabled={saving || !woForm.sku_id || items.length === 0}
                    style={{ width: "100%", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || !woForm.sku_id || items.length === 0 ? "#3A3F47" : "#A91E22", border: "none", padding: "11px", cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "Saving..." : editingWO ? "Update Work Order →" : "Create Work Order →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ship & Backflush confirmation */}
      {shipConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setShipConfirm(null)}>
          <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.14)", borderTop: "2px solid #5A9E5A", padding: "32px", width: "440px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>Ship & Backflush?</h2>
            <p style={{ fontSize: "13px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px" }}>
              This will deduct every component on this work order from inventory and mark it <strong style={{ color: "#fff" }}>Shipped</strong>.
            </p>
            <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "0 0 20px" }}>This cannot be undone automatically — make sure the build is actually complete and shipping.</p>
            <div style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", padding: "12px", marginBottom: "20px" }}>
              {(shipConfirm.items || []).map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontFamily: "'Barlow', sans-serif", color: "#B5BAC2", padding: "3px 0" }}>
                  <span>{item.component?.sku_code}</span>
                  <span>−{item.quantity} {item.component?.sku_type === "consumable" ? (UOM_LABELS[item.component?.unit_of_measure || ""] || "") : "units"}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShipConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B919A", background: "transparent", border: "1px solid #3A3F47", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleShipAndBackflush(shipConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "10px", cursor: "pointer" }}>Ship & Backflush</button>
            </div>
          </div>
        </div>
      )}

      {/* Ship All & Backflush confirmation — for a full multi-item order */}
      {shipGroupConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setShipGroupConfirm(null)}>
          <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.14)", borderTop: "2px solid #5A9E5A", padding: "32px", width: "480px", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>
              Ship All & Backflush — {shipGroupConfirm.length} Builds?
            </h2>
            <p style={{ fontSize: "13px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px" }}>
              This will deduct components for <strong style={{ color: "#fff" }}>all {shipGroupConfirm.length} builds</strong> on order <strong style={{ color: "#fff" }}>{shipGroupConfirm[0]?.sales_order_reference}</strong> and mark them all <strong style={{ color: "#fff" }}>Shipped</strong> together.
            </p>
            <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "0 0 20px" }}>This cannot be undone automatically — make sure every build is actually complete and ready to ship.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {shipGroupConfirm.map(wo => (
                <div key={wo.id} style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", padding: "10px 12px" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: "0 0 6px" }}>{wo.sku?.sku_code} — {wo.sku?.name}</p>
                  {(wo.items || []).map(item => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontFamily: "'Barlow', sans-serif", color: "#B5BAC2", padding: "2px 0" }}>
                      <span>{item.component?.sku_code}</span>
                      <span>−{item.quantity} {item.component?.sku_type === "consumable" ? (UOM_LABELS[item.component?.unit_of_measure || ""] || "") : "units"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShipGroupConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B919A", background: "transparent", border: "1px solid #3A3F47", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleShipAndBackflushGroup(shipGroupConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#5A9E5A", border: "none", padding: "10px", cursor: "pointer" }}>Ship All & Backflush</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
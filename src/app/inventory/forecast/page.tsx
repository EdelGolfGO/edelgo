"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ShoppingCart, TrendingUp, Info } from "lucide-react"
import { createClient } from "@/lib/supabase"

type InventoryItem = {
  id: string
  sku_id: string
  qty_on_hand: number
  qty_reserved: number
  qty_on_order: number
  qty_available: number
  min_stock: number
  max_stock: number
  reorder_qty: number
  sku: {
    sku_code: string
    name: string
    unit_cost: number
    lead_time_days: number
    product: { name: string; category: string }
  }
}

type RunRateWindow = 30 | 60 | 90

const DEFAULT_LEAD_TIME = 14 // fallback when a SKU has no lead_time_days set

export default function ForecastPage() {
  const router = useRouter()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"available_asc" | "available_desc" | "reorder_cost_desc" | "sku_asc" | "category">("available_asc")
  const [runRateWindow, setRunRateWindow] = useState<RunRateWindow>(60)
  const [runRates, setRunRates] = useState<Record<string, number>>({}) // sku_id -> units/day
  const [runRatesLoading, setRunRatesLoading] = useState(true)

  useEffect(() => { loadInventory() }, [])
  useEffect(() => { loadRunRates() }, [runRateWindow])

  async function loadInventory() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("inventory")
      .select("*, sku:skus(sku_code, name, unit_cost, lead_time_days, product:products(name, category))")
      .order("qty_available", { ascending: true })
    if (data) setInventory(data as any)
    setLoading(false)
  }

  // Run rate is consumption per day over a trailing window, computed the
  // same way as Sales History's Component Usage tab: real component picks
  // from shipped Work Orders, plus BoM decomposition of stock items sold to
  // domestic-stock dealers, plus — the one addition beyond Sales History —
  // direct sales quantity for stock SKUs that have no BoM at all (apparel,
  // accessories), since there's nothing to decompose for those and their
  // own sale IS the depletion event. Drop-ship dealer orders never touch
  // domestic inventory, so they're excluded throughout, consistent with
  // Ship & Backflush.
  async function loadRunRates() {
    setRunRatesLoading(true)
    const supabase = createClient()
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - runRateWindow)
    const windowStartStr = windowStart.toISOString().split("T")[0]

    const [skusResult, ordersResult, workOrdersResult] = await Promise.all([
      supabase.from("skus").select(`
        id, sku_code, shopify_sku_code, is_customizable, generic_parent_sku_id,
        generic_parent:skus!generic_parent_sku_id(is_customizable)
      `),
      supabase.from("b2b_orders").select(`
        id, shipped_at, status,
        items:b2b_order_items(sku_code, quantity),
        dealer:dealers(fulfillment_source)
      `).in("status", ["shipped", "fulfilled"]).gte("shipped_at", windowStartStr),
      supabase.from("work_orders").select(`
        id, shipped_at, status,
        items:work_order_items(component_sku_id, quantity)
      `).eq("status", "shipped").gte("shipped_at", windowStartStr),
    ])

    const skus = skusResult.data || []
    const skuByCode: Record<string, any> = {}
    skus.forEach(s => {
      skuByCode[s.sku_code] = s
      if (s.shopify_sku_code) skuByCode[s.shopify_sku_code] = s
    })

    const consumption: Record<string, number> = {}
    const bomCache: Record<string, { component_sku_id: string; quantity: number }[] | null> = {}

    async function getBomComponents(skuId: string) {
      if (skuId in bomCache) return bomCache[skuId]
      const { data: bomHeader } = await supabase.from("bom_headers").select("id").eq("sku_id", skuId).eq("is_active", true).single()
      if (!bomHeader) { bomCache[skuId] = null; return null }
      const { data: bomItems } = await supabase.from("bom_items").select("component_sku_id, quantity").eq("bom_id", bomHeader.id)
      bomCache[skuId] = bomItems || []
      return bomCache[skuId]
    }

    for (const order of ordersResult.data || []) {
      const isDomestic = (order as any).dealer?.fulfillment_source !== "drop_ship"
      if (!isDomestic) continue
      for (const item of (order as any).items || []) {
        const sku = skuByCode[item.sku_code]
        if (!sku) continue
        const genericParent = (sku as any).generic_parent
        const isBuildTarget = sku.is_customizable || genericParent?.is_customizable
        if (isBuildTarget) continue // counted via Work Order items below instead

        const bomComponents = await getBomComponents(sku.id)
        if (bomComponents && bomComponents.length > 0) {
          for (const bi of bomComponents) {
            if (!bi.component_sku_id) continue
            consumption[bi.component_sku_id] = (consumption[bi.component_sku_id] || 0) + (bi.quantity || 0) * (item.quantity || 0)
          }
        } else {
          // No BoM — this SKU's own sale is the depletion event.
          consumption[sku.id] = (consumption[sku.id] || 0) + (item.quantity || 0)
        }
      }
    }

    for (const wo of workOrdersResult.data || []) {
      for (const item of (wo as any).items || []) {
        if (!item.component_sku_id) continue
        consumption[item.component_sku_id] = (consumption[item.component_sku_id] || 0) + (item.quantity || 0)
      }
    }

    const rates: Record<string, number> = {}
    for (const [skuId, total] of Object.entries(consumption)) {
      rates[skuId] = total / runRateWindow
    }
    setRunRates(rates)
    setRunRatesLoading(false)
  }

  function getStockStatus(item: InventoryItem) {
    if (item.qty_available <= 0) return "critical"
    if (item.qty_available <= item.min_stock) return "low"
    return "ok"
  }

  function getReorderQty(item: InventoryItem) {
    return Math.max(item.reorder_qty, item.max_stock - item.qty_available)
  }

  function getReorderCost(item: InventoryItem) {
    return getReorderQty(item) * (item.sku?.unit_cost || 0)
  }

  function getRunRate(item: InventoryItem) {
    return runRates[item.sku_id] || 0
  }

  function getDaysLeft(item: InventoryItem) {
    const rate = getRunRate(item)
    if (rate <= 0) return null // no recent consumption signal
    return item.qty_available / rate
  }

  function getLeadTime(item: InventoryItem) {
    return item.sku?.lead_time_days || DEFAULT_LEAD_TIME
  }

  // The real value-add over the static min/max system: SKUs that look fine
  // by qty_available > min_stock, but whose actual sell-through rate means
  // they'll run dry before a reorder placed today would even arrive.
  function isSellingFasterThanExpected(item: InventoryItem) {
    const daysLeft = getDaysLeft(item)
    if (daysLeft === null) return false
    if (item.qty_available <= item.min_stock) return false // already caught by the static system
    return daysLeft < getLeadTime(item)
  }

  function toggleSelect(id: string) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedItems.size === filteredNeedsReorder.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredNeedsReorder.map(i => i.id)))
    }
  }

  const availableCategories = Array.from(
    new Set(inventory.map(i => i.sku?.product?.category).filter(Boolean))
  ) as string[]

  const sortItems = (items: InventoryItem[]) => [...items].sort((a, b) => {
    switch (sortBy) {
      case "available_asc": return a.qty_available - b.qty_available
      case "available_desc": return b.qty_available - a.qty_available
      case "reorder_cost_desc": return getReorderCost(b) - getReorderCost(a)
      case "sku_asc": return a.sku?.sku_code.localeCompare(b.sku?.sku_code)
      case "category": return (a.sku?.product?.category || "").localeCompare(b.sku?.product?.category || "")
      default: return 0
    }
  })

  const filteredInventory = sortItems(
    inventory.filter(i => categoryFilter === "all" || i.sku?.product?.category === categoryFilter)
  )

  const needsReorder = inventory.filter(i => i.qty_available <= i.min_stock)
  const filteredNeedsReorder = sortItems(
    needsReorder.filter(i => categoryFilter === "all" || i.sku?.product?.category === categoryFilter)
  )
  const totalReorderCost = filteredNeedsReorder.reduce((sum, i) => sum + getReorderCost(i), 0)

  const sellingFaster = sortItems(
    inventory.filter(i => isSellingFasterThanExpected(i) && (categoryFilter === "all" || i.sku?.product?.category === categoryFilter))
  )

  const selectStyle = { background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 12px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", cursor: "pointer" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Reorder Forecast</h1>
          <p style={{ fontSize: "12px", color: "#B5BAC2", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
            SKUs at or below minimum stock — select to generate a PO
          </p>
        </div>
        {selectedItems.size > 0 && (
          <button
            onClick={() => router.push("/operations/pos")}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          ><ShoppingCart size={14} /> Generate PO ({selectedItems.size} SKUs)</button>
        )}
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "SKUs Need Reorder", value: filteredNeedsReorder.length.toString(), color: filteredNeedsReorder.length > 0 ? "#A91E22" : "#5A9E5A", top: filteredNeedsReorder.length > 0 ? "#A91E22" : "#3A3F47" },
          { label: "Est. Reorder Cost", value: `$${Math.round(totalReorderCost).toLocaleString()}`, color: "#C4A93A", top: "#3A3F47" },
          { label: "Selling Faster Than Expected", value: sellingFaster.length.toString(), color: sellingFaster.length > 0 ? "#C4A93A" : "#5A9E5A", top: sellingFaster.length > 0 ? "#C4A93A" : "#3A3F47" },
          { label: "Selected for PO", value: selectedItems.size.toString(), color: "#6A9CC8", top: "#3A3F47" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${stat.top}`, padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#B5BAC2", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + Sort + Run Rate Window controls */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Categories</option>
          {availableCategories.sort().map(cat => (
            <option key={cat} value={cat}>{cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={selectStyle}>
          <option value="available_asc">Available: Low → High</option>
          <option value="available_desc">Available: High → Low</option>
          <option value="reorder_cost_desc">Reorder Cost: High → Low</option>
          <option value="category">Category</option>
          <option value="sku_asc">SKU Code A–Z</option>
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
          <TrendingUp size={13} color="#6A9CC8" />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B919A" }}>Run Rate Window:</span>
          {([30, 60, 90] as RunRateWindow[]).map(w => (
            <button key={w} onClick={() => setRunRateWindow(w)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", padding: "5px 11px", cursor: "pointer", border: "none", background: runRateWindow === w ? "#6A9CC8" : "transparent", color: runRateWindow === w ? "#fff" : "#8B919A", outline: runRateWindow === w ? "none" : "1px solid #3A3F47" }}>
              {w}d
            </button>
          ))}
        </div>
        {categoryFilter !== "all" && (
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6A9CC8", background: "rgba(106,156,200,0.1)", padding: "4px 10px" }}>
            {categoryFilter.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Only
          </span>
        )}
      </div>

      <div style={{ background: "rgba(106,156,200,0.08)", border: "0.5px solid rgba(106,156,200,0.25)", padding: "10px 14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
        <Info size={14} color="#6A9CC8" style={{ flexShrink: 0, marginTop: "2px" }} />
        <p style={{ fontSize: "11px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
          Run rate is domestic component consumption per day over the trailing window — real Work Order selections, BoM-decomposed stock sales, plus direct sales for items with no BoM. Min/Max thresholds below are unchanged and still drive PO generation; run rate is a second signal layered on top.
        </p>
      </div>

      {/* Selling Faster Than Expected — the new insight static min/max misses */}
      {sellingFaster.length > 0 && (
        <div style={{ background: "#2E343C", border: "0.5px solid rgba(196,169,58,0.25)", borderTop: "2px solid #C4A93A" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#262B32", display: "flex", alignItems: "center", gap: "10px" }}>
            <TrendingUp size={14} color="#C4A93A" />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#C4A93A" }}>
              Selling Faster Than Expected — {sellingFaster.length} SKUs
            </span>
            <span style={{ fontSize: "11px", color: "#8B919A", fontFamily: "'Barlow', sans-serif" }}>Above min stock, but running out before lead time allows a reorder to land</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#262B32" }}>
                {["SKU", "Product", "Available", "Min", "Run Rate /day", "Days Left", "Lead Time"].map(h => (
                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B919A", padding: "8px 14px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellingFaster.map(item => {
                const rate = getRunRate(item)
                const daysLeft = getDaysLeft(item)
                const leadTime = getLeadTime(item)
                return (
                  <tr key={item.id} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku?.sku_code}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku?.name}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#5A9E5A", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.qty_available}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.min_stock}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#C4A93A", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{rate.toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{daysLeft !== null ? Math.round(daysLeft) : "—"}d</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{leadTime}d</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Visual stock chart */}
      <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#262B32", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9BA0A8" }}>
            Stock Level Visual — {categoryFilter === "all" ? "All SKUs" : categoryFilter.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
          </span>
          <div style={{ display: "flex", gap: "16px" }}>
            {[{ color: "#A91E22", label: "Critical" }, { color: "#C4A93A", label: "Low" }, { color: "#5A9E5A", label: "OK" }, { color: "#6A9CC8", label: "On Order" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", background: l.color }} />
                <span style={{ fontSize: "10px", color: "#8B919A", fontFamily: "'Barlow', sans-serif" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
          ) : (
            filteredInventory.map(item => {
              const status = getStockStatus(item)
              const barColor = status === "critical" ? "#A91E22" : status === "low" ? "#C4A93A" : "#5A9E5A"
              const availPct = item.max_stock > 0 ? Math.min(100, (item.qty_available / item.max_stock) * 100) : 0
              const onOrderPct = item.max_stock > 0 ? Math.min(100 - availPct, (item.qty_on_order / item.max_stock) * 100) : 0
              const minPct = item.max_stock > 0 ? (item.min_stock / item.max_stock) * 100 : 20
              const rate = getRunRate(item)
              const daysLeft = getDaysLeft(item)

              return (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 80px 120px", gap: "12px", alignItems: "center" }}>
                  <div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#E0E2E6", margin: 0, letterSpacing: "0.04em" }}>{item.sku?.sku_code}</p>
                    <p style={{ fontSize: "10px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sku?.name}</p>
                  </div>
                  <div style={{ position: "relative", height: "20px", background: "rgba(255,255,255,0.04)", borderRadius: "2px" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${availPct}%`, background: barColor, borderRadius: "2px", transition: "width 0.3s" }} />
                    {onOrderPct > 0 && (
                      <div style={{ position: "absolute", left: `${availPct}%`, top: 0, height: "100%", width: `${onOrderPct}%`, background: "rgba(106,156,200,0.4)", borderRadius: "0 2px 2px 0" }} />
                    )}
                    <div style={{ position: "absolute", left: `${minPct}%`, top: 0, height: "100%", width: "2px", background: "rgba(255,255,255,0.3)" }} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: barColor }}>{item.qty_available}</span>
                    <span style={{ fontSize: "10px", color: "#787E87", fontFamily: "'Barlow', sans-serif" }}> / {item.max_stock}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {runRatesLoading ? (
                      <span style={{ fontSize: "10px", color: "#666C75", fontFamily: "'Barlow', sans-serif" }}>...</span>
                    ) : rate > 0 ? (
                      <>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#6A9CC8" }}>{rate.toFixed(2)}/day</span>
                        <p style={{ fontSize: "9px", color: daysLeft !== null && daysLeft < getLeadTime(item) ? "#C4A93A" : "#787E87", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0" }}>
                          {daysLeft !== null ? `${Math.round(daysLeft)}d left` : ""}
                        </p>
                      </>
                    ) : (
                      <span style={{ fontSize: "10px", color: "#666C75", fontFamily: "'Barlow', sans-serif" }}>No usage</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Reorder table */}
      {filteredNeedsReorder.length > 0 && (
        <div style={{ background: "#2E343C", border: "0.5px solid rgba(169,30,34,0.2)", borderTop: "2px solid #A91E22" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#262B32", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle size={14} color="#A91E22" />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#A91E22" }}>
                Reorder Required — {filteredNeedsReorder.length} SKUs
              </span>
            </div>
            <button
              onClick={selectAll}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B5BAC2", background: "transparent", border: "1px solid #666C75", padding: "5px 10px", cursor: "pointer" }}
            >
              {selectedItems.size === filteredNeedsReorder.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#262B32" }}>
                <th style={{ width: "40px", padding: "8px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}></th>
                {["SKU", "Product", "Category", "Available", "Min", "Run Rate /day", "Days Left", "Reorder Qty", "Est. Cost", "Action"].map(h => (
                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B919A", padding: "8px 14px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredNeedsReorder.map(item => {
                const status = getStockStatus(item)
                const reorderQty = getReorderQty(item)
                const reorderCost = getReorderCost(item)
                const isSelected = selectedItems.has(item.id)
                const rate = getRunRate(item)
                const daysLeft = getDaysLeft(item)

                return (
                  <tr key={item.id} style={{ background: isSelected ? "rgba(169,30,34,0.05)" : "transparent", cursor: "pointer" }}
                    onClick={() => toggleSelect(item.id)}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)" }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                  >
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ width: "16px", height: "16px", border: `1.5px solid ${isSelected ? "#A91E22" : "#787E87"}`, background: isSelected ? "#A91E22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isSelected && <span style={{ color: "#fff", fontSize: "10px", lineHeight: 1 }}>✓</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>{item.sku?.sku_code}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku?.name}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#B5BAC2", background: "rgba(255,255,255,0.05)", padding: "2px 7px" }}>
                        {item.sku?.product?.category?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: status === "critical" ? "#A91E22" : "#C4A93A" }}>{item.qty_available}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#9BA0A8", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.min_stock}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: rate > 0 ? "#6A9CC8" : "#666C75", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {rate > 0 ? rate.toFixed(2) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: daysLeft !== null ? "#A91E22" : "#666C75", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {daysLeft !== null ? `${Math.round(daysLeft)}d` : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff" }}>{reorderQty}</span>
                      <span style={{ fontSize: "10px", color: "#8B919A", marginLeft: "4px", fontFamily: "'Barlow', sans-serif" }}>units</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#C4A93A", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      ${Math.round(reorderCost).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isSelected ? "#A91E22" : "#8B919A" }}>
                        {isSelected ? "✓ Selected" : "Click to Select"}
                      </span>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: "#262B32" }}>
                <td colSpan={9} style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B919A", textAlign: "right" }}>
                  Total Reorder Cost
                </td>
                <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>
                  ${Math.round(totalReorderCost).toLocaleString()}
                </td>
                <td style={{ padding: "10px 14px" }} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {filteredNeedsReorder.length === 0 && !loading && (
        <div style={{ background: "#2E343C", border: "0.5px solid rgba(90,158,90,0.2)", borderTop: "2px solid #5A9E5A", padding: "40px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5A9E5A", margin: "0 0 6px" }}>
            {categoryFilter !== "all" ? `No Reorders Needed — ${categoryFilter.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}` : "All Stock Levels Healthy"}
          </p>
          <p style={{ fontSize: "13px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: 0 }}>No SKUs are below minimum stock threshold.</p>
        </div>
      )}
    </div>
  )
}
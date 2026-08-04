"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Download, Save, Info } from "lucide-react"

type SalesEntry = {
  sku_id: string
  sku_code: string
  name: string
  unit_cost: number
  freight_cost: number
  duties_cost: number
  other_landed_cost: number
  units_sold: number
  revenue: number
}

type UsageEntry = {
  sku_id: string
  sku_code: string
  name: string
  quantity_used: number
}

type DatePreset = "this_quarter" | "last_quarter" | "this_year" | "last_12_months" | "all_time" | "custom"

function formatISODate(d: Date) {
  return d.toISOString().split("T")[0]
}

function getPresetRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date()
  let start = new Date(now)
  let end = new Date(now)

  if (preset === "this_quarter") {
    const q = Math.floor(now.getMonth() / 3)
    start = new Date(now.getFullYear(), q * 3, 1)
  } else if (preset === "last_quarter") {
    let q = Math.floor(now.getMonth() / 3) - 1
    let year = now.getFullYear()
    if (q < 0) { q = 3; year -= 1 }
    start = new Date(year, q * 3, 1)
    end = new Date(year, q * 3 + 3, 0)
  } else if (preset === "this_year") {
    start = new Date(now.getFullYear(), 0, 1)
  } else if (preset === "last_12_months") {
    start = new Date(now)
    start.setMonth(start.getMonth() - 12)
  } else if (preset === "all_time") {
    start = new Date(2000, 0, 1)
  }

  return { start: formatISODate(start), end: formatISODate(end) }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  this_quarter: "This Quarter",
  last_quarter: "Last Quarter",
  this_year: "This Year",
  last_12_months: "Last 12 Months",
  all_time: "All Time",
  custom: "Custom Range",
}

export default function SalesHistoryPage() {
  const [activeTab, setActiveTab] = useState<"sales" | "usage">("sales")
  const [preset, setPreset] = useState<DatePreset>("this_quarter")
  const [dateRange, setDateRange] = useState(getPresetRange("this_quarter"))
  const [entries, setEntries] = useState<SalesEntry[]>([])
  const [usageEntries, setUsageEntries] = useState<UsageEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [showAllSkus, setShowAllSkus] = useState(false)

  useEffect(() => { loadData() }, [dateRange])

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p !== "custom") setDateRange(getPresetRange(p))
  }

  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    const [skusResult, ordersResult, workOrdersResult] = await Promise.all([
      supabase.from("skus").select(`
        id, sku_code, shopify_sku_code, name, unit_cost,
        freight_cost, duties_cost, other_landed_cost,
        is_customizable, generic_parent_sku_id,
        generic_parent:skus!generic_parent_sku_id(is_customizable)
      `),
      supabase.from("b2b_orders").select(`
        id, shipped_at, status,
        items:b2b_order_items(sku_code, quantity, unit_price),
        dealer:dealers(fulfillment_source)
      `).in("status", ["shipped", "fulfilled"]).gte("shipped_at", dateRange.start).lte("shipped_at", dateRange.end),
      supabase.from("work_orders").select(`
        id, shipped_at, status,
        items:work_order_items(component_sku_id, quantity)
      `).eq("status", "shipped").gte("shipped_at", dateRange.start).lte("shipped_at", dateRange.end),
    ])

    const skus = skusResult.data || []

    // Matches an order line item's SKU code back to a current SKU record —
    // tries the real sku_code first, then falls back to shopify_sku_code,
    // so historical sales still aggregate correctly even after a SKU has
    // since been renamed (same pattern used to fix the Shopify webhook).
    const skuByCode: Record<string, any> = {}
    skus.forEach(s => {
      skuByCode[s.sku_code] = s
      if (s.shopify_sku_code) skuByCode[s.shopify_sku_code] = s
    })

    const unitsSold: Record<string, number> = {}
    const revenue: Record<string, number> = {}
    // Stock line items (no Work Order — not customizable, no customizable
    // generic parent) sold to domestic-stock dealers, queued up for BoM
    // decomposition below so their component consumption is still counted.
    const stockLineItems: { sku: any; quantity: number }[] = []

    for (const order of ordersResult.data || []) {
      const isDomestic = (order as any).dealer?.fulfillment_source !== "drop_ship"
      for (const item of (order as any).items || []) {
        const sku = skuByCode[item.sku_code]
        if (!sku) continue
        unitsSold[sku.id] = (unitsSold[sku.id] || 0) + (item.quantity || 0)
        revenue[sku.id] = (revenue[sku.id] || 0) + (item.unit_price || 0) * (item.quantity || 0)

        const genericParent = (sku as any).generic_parent
        const isBuildTarget = sku.is_customizable || genericParent?.is_customizable
        if (!isBuildTarget && isDomestic) {
          stockLineItems.push({ sku, quantity: item.quantity || 0 })
        }
      }
    }

    // Component usage, source 1: real selections made on shipped Work
    // Orders — the actual shaft/grip/ferrule picked at order time, not an
    // estimate. Covers both dealer and Shopify DTC channels.
    const componentUsage: Record<string, number> = {}
    for (const wo of workOrdersResult.data || []) {
      for (const item of (wo as any).items || []) {
        if (!item.component_sku_id) continue
        componentUsage[item.component_sku_id] = (componentUsage[item.component_sku_id] || 0) + (item.quantity || 0)
      }
    }

    // Component usage, source 2: BoM decomposition for stock items sold to
    // domestic-stock dealers, which never create a Work Order — same
    // approach as Ship & Backflush, so this stays consistent with what
    // actually leaves domestic inventory.
    for (const { sku, quantity } of stockLineItems) {
      const { data: bomHeader } = await supabase.from("bom_headers").select("id").eq("sku_id", sku.id).eq("is_active", true).single()
      if (!bomHeader) continue
      const { data: bomItems } = await supabase.from("bom_items").select("component_sku_id, quantity").eq("bom_id", bomHeader.id)
      for (const bi of bomItems || []) {
        if (!bi.component_sku_id) continue
        componentUsage[bi.component_sku_id] = (componentUsage[bi.component_sku_id] || 0) + (bi.quantity || 0) * quantity
      }
    }

    const salesEntries: SalesEntry[] = skus.map(s => ({
      sku_id: s.id,
      sku_code: s.sku_code,
      name: s.name,
      unit_cost: s.unit_cost || 0,
      freight_cost: s.freight_cost || 0,
      duties_cost: s.duties_cost || 0,
      other_landed_cost: s.other_landed_cost || 0,
      units_sold: unitsSold[s.id] || 0,
      revenue: revenue[s.id] || 0,
    }))

    const usage: UsageEntry[] = Object.entries(componentUsage).map(([skuId, qty]) => {
      const sku = skus.find(s => s.id === skuId)
      return { sku_id: skuId, sku_code: sku?.sku_code || "—", name: sku?.name || "Unknown component (inactive or deleted SKU)", quantity_used: qty }
    }).sort((a, b) => b.quantity_used - a.quantity_used)

    setEntries(salesEntries)
    setUsageEntries(usage)
    setDirtyIds(new Set())
    setLoading(false)
  }

  function updateEntry(sku_id: string, key: "freight_cost" | "duties_cost" | "other_landed_cost", value: number) {
    setEntries(prev => prev.map(e => e.sku_id === sku_id ? { ...e, [key]: value } : e))
    setDirtyIds(prev => new Set(prev).add(sku_id))
  }

  async function saveCostData() {
    setSaving(true)
    const supabase = createClient()
    for (const id of dirtyIds) {
      const entry = entries.find(e => e.sku_id === id)
      if (!entry) continue
      await supabase.from("skus").update({
        freight_cost: entry.freight_cost,
        duties_cost: entry.duties_cost,
        other_landed_cost: entry.other_landed_cost,
        updated_at: new Date().toISOString(),
      }).eq("id", id)
    }
    setSaving(false)
    setDirtyIds(new Set())
  }

  function landedCost(e: SalesEntry) {
    return e.unit_cost + e.freight_cost + e.duties_cost + e.other_landed_cost
  }

  const filteredEntries = showAllSkus ? entries : entries.filter(e => e.units_sold > 0)
  const totalRevenue = filteredEntries.reduce((sum, e) => sum + e.revenue, 0)
  const totalCogs = filteredEntries.reduce((sum, e) => sum + landedCost(e) * e.units_sold, 0)
  const grossProfit = totalRevenue - totalCogs
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  function exportCSV() {
    const headers = ["SKU Code", "Name", "Units Sold", "Revenue", "Factory Cost", "Freight", "Duties", "Other", "Landed Cost", "Total COGS", "Gross Profit"]
    const rows = filteredEntries.map(e => {
      const lc = landedCost(e)
      const cogs = lc * e.units_sold
      return [e.sku_code, e.name, e.units_sold, e.revenue.toFixed(2), e.unit_cost.toFixed(2), e.freight_cost.toFixed(2), e.duties_cost.toFixed(2), e.other_landed_cost.toFixed(2), lc.toFixed(2), cogs.toFixed(2), (e.revenue - cogs).toFixed(2)]
    })
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `EdelFit_SalesHistory_${dateRange.start}_to_${dateRange.end}.csv`
    a.click()
  }

  const inputStyle = { background: "#23282E", border: "0.5px solid rgba(255,255,255,0.08)", color: "#fff", padding: "5px 8px", fontSize: "12px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, outline: "none", width: "85px", textAlign: "right" as const }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Finance</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Sales History</h1>
          <p style={{ fontSize: "12px", color: "#B5BAC2", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>
            Real sales, COGS, and component usage — pulled from shipped orders and Work Orders, not manual entry
          </p>
        </div>
        {activeTab === "sales" && (
          <button onClick={exportCSV} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B5BAC2", background: "transparent", border: "1px solid #666C75", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      {/* Date range */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p => (
          <button key={p} onClick={() => applyPreset(p)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "7px 14px", cursor: "pointer", border: "none", background: preset === p ? "#A91E22" : "transparent", color: preset === p ? "#fff" : "#8B919A", outline: preset === p ? "none" : "1px solid #3A3F47" }}>
            {PRESET_LABELS[p]}
          </button>
        ))}
        {preset === "custom" && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "8px" }}>
            <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "7px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none" }} />
            <span style={{ color: "#787E87", fontSize: "12px" }}>to</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "7px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none" }} />
          </div>
        )}
        <span style={{ fontSize: "11px", color: "#666C75", fontFamily: "'Barlow', sans-serif", marginLeft: "auto" }}>{dateRange.start} → {dateRange.end}</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {(["sales", "usage"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: activeTab === t ? "#fff" : "#8B919A", borderBottom: activeTab === t ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {t === "sales" ? "Sales & COGS" : `Component Usage (${usageEntries.length})`}
          </button>
        ))}
      </div>

      {activeTab === "sales" ? (
        <>
          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
            {[
              { label: "Total Revenue", value: `$${Math.round(totalRevenue).toLocaleString()}`, color: "#5A9E5A" },
              { label: "Total COGS", value: `$${Math.round(totalCogs).toLocaleString()}`, color: "#A91E22" },
              { label: "Gross Profit", value: `$${Math.round(grossProfit).toLocaleString()}`, color: grossProfit >= 0 ? "#5A9E5A" : "#A91E22" },
              { label: "Gross Margin", value: totalRevenue > 0 ? `${grossMargin.toFixed(1)}%` : "—", color: "#6A9CC8" },
            ].map(s => (
              <div key={s.label} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #3A3F47", padding: "18px 20px" }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#B5BAC2", marginBottom: "8px" }}>{s.label}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input type="checkbox" id="show_all" checked={showAllSkus} onChange={e => setShowAllSkus(e.target.checked)} style={{ cursor: "pointer" }} />
            <label htmlFor="show_all" style={{ fontSize: "12px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Show all SKUs (including ones with zero sales this period)</label>
            {dirtyIds.size > 0 && (
              <button onClick={saveCostData} disabled={saving} style={{ marginLeft: "auto", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: saving ? "#666C75" : "#6A9CC8", border: "none", padding: "8px 16px", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                <Save size={13} /> {saving ? "Saving..." : `Save Cost Data (${dirtyIds.size})`}
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase" }}>Loading...</div>
          ) : filteredEntries.length === 0 ? (
            <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase" }}>
              No sales in this date range
            </div>
          ) : (
            <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
                <thead>
                  <tr style={{ background: "#262B32" }}>
                    {["SKU", "Name", "Units Sold", "Revenue", "Factory Cost", "Freight", "Duties", "Other", "Landed Cost", "Total COGS", "Gross Profit"].map(h => (
                      <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B919A", padding: "10px 10px", textAlign: h === "SKU" || h === "Name" ? "left" : "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(entry => {
                    const lc = landedCost(entry)
                    const totalCogsRow = lc * entry.units_sold
                    const gp = entry.revenue - totalCogsRow
                    return (
                      <tr key={entry.sku_id}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "8px 10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{entry.sku_code}</td>
                        <td style={{ padding: "8px 10px", fontSize: "11px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</td>
                        <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff" }}>{entry.units_sold}</span>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#5A9E5A" }}>${entry.revenue.toFixed(2)}</span>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }} title="Edit on the SKU page">
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#9BA0A8" }}>${entry.unit_cost.toFixed(2)}</span>
                        </td>
                        {(["freight_cost", "duties_cost", "other_landed_cost"] as const).map(key => (
                          <td key={key} style={{ padding: "4px 6px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                            <input type="number" style={inputStyle} value={entry[key] || ""} placeholder="0.00" onChange={e => updateEntry(entry.sku_id, key, parseFloat(e.target.value) || 0)} />
                          </td>
                        ))}
                        <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff" }}>${lc.toFixed(2)}</span>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22" }}>${totalCogsRow.toFixed(2)}</span>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: gp >= 0 ? "#5A9E5A" : "#A91E22" }}>${gp.toFixed(2)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#262B32" }}>
                    <td colSpan={9} style={{ padding: "10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B919A", textAlign: "right" }}>Totals</td>
                    <td style={{ padding: "10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", textAlign: "right" }}>${totalCogs.toFixed(2)}</td>
                    <td style={{ padding: "10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#5A9E5A", textAlign: "right" }}>${grossProfit.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ background: "rgba(106,156,200,0.08)", border: "0.5px solid rgba(106,156,200,0.25)", padding: "12px 16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <Info size={15} color="#6A9CC8" style={{ flexShrink: 0, marginTop: "2px" }} />
            <p style={{ fontSize: "12px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
              Components from customizable builds use the actual shaft/grip/ferrule selected at order time (from Work Orders), not an estimate. Stock items sold to domestic-stock dealers are decomposed through their BoM, same as Ship &amp; Backflush. <strong style={{ color: "#fff" }}>Known gap:</strong> Work Order component quantities are currently recorded per line item regardless of the ordered quantity, so a single order line with quantity &gt; 1 may undercount usage here — worth fixing in Work Order creation if this view needs to be fully precise.
            </p>
          </div>

          {loading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase" }}>Loading...</div>
          ) : usageEntries.length === 0 ? (
            <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase" }}>
              No component usage in this date range
            </div>
          ) : (
            <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#262B32" }}>
                    {["Component SKU", "Name", "Quantity Used"].map(h => (
                      <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B919A", padding: "10px 14px", textAlign: h === "Quantity Used" ? "right" : "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usageEntries.map(u => (
                    <tr key={u.sku_id}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{u.sku_code}</td>
                      <td style={{ padding: "10px 14px", fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{u.name}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#6A9CC8" }}>{u.quantity_used}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
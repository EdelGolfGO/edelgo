"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, TrendingDown, Package, BarChart2 } from "lucide-react"
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
    product: { name: string; category: string }
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  built_club: "#A91E22",
  head_only: "#6A9CC8",
  component: "#C4A93A",
  accessory: "#7AAB6A",
  apparel: "#888",
}

export default function InventoryPage() {
  const router = useRouter()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "low" | "critical" | "healthy">("all")
  const [search, setSearch] = useState("")

  useEffect(() => { loadInventory() }, [])

  async function loadInventory() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("inventory")
      .select("*, sku:skus(sku_code, name, unit_cost, product:products(name, category))")
      .order("qty_available", { ascending: true })
    if (data) setInventory(data as any)
    setLoading(false)
  }

  function getStockStatus(item: InventoryItem) {
    if (item.qty_available <= 0) return "critical"
    if (item.qty_available <= item.min_stock) return "low"
    if (item.qty_available >= item.max_stock * 0.8) return "healthy"
    return "ok"
  }

  const filtered = inventory.filter(item => {
    const status = getStockStatus(item)
    if (filter === "low" && status !== "low") return false
    if (filter === "critical" && status !== "critical") return false
    if (filter === "healthy" && status !== "healthy") return false
    if (search && !item.sku?.name.toLowerCase().includes(search.toLowerCase()) && !item.sku?.sku_code.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const criticalCount = inventory.filter(i => getStockStatus(i) === "critical").length
  const lowCount = inventory.filter(i => getStockStatus(i) === "low").length
  const totalValue = inventory.reduce((sum, i) => sum + i.qty_on_hand * (i.sku?.unit_cost || 0), 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Catalog</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Inventory</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
            Domestic stock levels across all SKUs
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => router.push("/inventory/forecast")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <BarChart2 size={14} /> Forecast
          </button>
          <button onClick={() => router.push("/inventory/boms")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Package size={14} /> BoMs
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Total SKUs", value: inventory.length.toString(), color: "#fff", top: "#2A2A2A" },
          { label: "Critical (Out/Near 0)", value: criticalCount.toString(), color: criticalCount > 0 ? "#A91E22" : "#5A9E5A", top: criticalCount > 0 ? "#A91E22" : "#2A2A2A" },
          { label: "Low Stock", value: lowCount.toString(), color: lowCount > 0 ? "#C4A93A" : "#5A9E5A", top: lowCount > 0 ? "#C4A93A" : "#2A2A2A" },
          { label: "Inventory Value", value: `$${Math.round(totalValue).toLocaleString()}`, color: "#6A9CC8", top: "#2A2A2A" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${stat.top}`, padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
          {(["all", "critical", "low", "healthy"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 14px", cursor: "pointer", border: "none", background: "transparent", color: filter === f ? "#fff" : "#555", borderBottom: filter === f ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
              {f === "all" ? `All (${inventory.length})` :
               f === "critical" ? `Critical (${criticalCount})` :
               f === "low" ? `Low (${lowCount})` :
               `Healthy (${inventory.filter(i => getStockStatus(i) === "healthy").length})`}
            </button>
          ))}
        </div>
        <input
          placeholder="Search SKU or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: "auto", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }}
        />
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading inventory...</div>
      ) : (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1A1E22" }}>
                {["SKU", "Product", "Category", "On Hand", "Reserved", "Available", "On Order", "Min", "Max", "Status"].map(h => (
                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", padding: "10px 14px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const status = getStockStatus(item)
                const statusColor = status === "critical" ? "#A91E22" : status === "low" ? "#C4A93A" : "#5A9E5A"
                const statusLabel = status === "critical" ? "Critical" : status === "low" ? "Low" : status === "healthy" ? "Healthy" : "OK"
                const pct = item.max_stock > 0 ? Math.min(100, (item.qty_available / item.max_stock) * 100) : 0
                const catColor = CATEGORY_COLORS[item.sku?.product?.category || ""] || "#888"

                return (
                  <tr key={item.id} style={{ cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>{item.sku?.sku_code}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku?.name}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: catColor, background: `${catColor}18`, padding: "2px 7px" }}>
                        {item.sku?.product?.category?.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "13px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.qty_on_hand}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#666", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.qty_reserved}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: statusColor }}>{item.qty_available}</span>
                        <div style={{ width: "60px", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: statusColor, borderRadius: "2px", transition: "width 0.3s" }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: item.qty_on_order > 0 ? "#6A9CC8" : "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: item.qty_on_order > 0 ? 700 : 400, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.qty_on_order}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#555", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.min_stock}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#555", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.max_stock}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor, background: `${statusColor}18`, padding: "2px 8px" }}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif" }}>
              No inventory records match this filter.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
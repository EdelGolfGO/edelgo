"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ShoppingCart } from "lucide-react"
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

export default function ForecastPage() {
  const router = useRouter()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

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
    return "ok"
  }

  function getReorderQty(item: InventoryItem) {
    return Math.max(item.reorder_qty, item.max_stock - item.qty_available)
  }

  function getReorderCost(item: InventoryItem) {
    return getReorderQty(item) * (item.sku?.unit_cost || 0)
  }

  const needsReorder = inventory.filter(i => i.qty_available <= i.min_stock)
  const totalReorderCost = needsReorder.reduce((sum, i) => sum + getReorderCost(i), 0)

  function toggleSelect(id: string) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedItems.size === needsReorder.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(needsReorder.map(i => i.id)))
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Reorder Forecast</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {[
          { label: "SKUs Need Reorder", value: needsReorder.length.toString(), color: needsReorder.length > 0 ? "#A91E22" : "#5A9E5A", top: needsReorder.length > 0 ? "#A91E22" : "#2A2A2A" },
          { label: "Est. Reorder Cost", value: `$${Math.round(totalReorderCost).toLocaleString()}`, color: "#C4A93A", top: "#2A2A2A" },
          { label: "Selected for PO", value: selectedItems.size.toString(), color: "#6A9CC8", top: "#2A2A2A" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${stat.top}`, padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Visual stock chart */}
      <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666" }}>Stock Level Visual — All SKUs</span>
          <div style={{ display: "flex", gap: "16px" }}>
            {[{ color: "#A91E22", label: "Critical" }, { color: "#C4A93A", label: "Low" }, { color: "#5A9E5A", label: "OK" }, { color: "#6A9CC8", label: "On Order" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", background: l.color }} />
                <span style={{ fontSize: "10px", color: "#555", fontFamily: "'Barlow', sans-serif" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
          ) : (
            inventory.map(item => {
              const status = getStockStatus(item)
              const barColor = status === "critical" ? "#A91E22" : status === "low" ? "#C4A93A" : "#5A9E5A"
              const availPct = item.max_stock > 0 ? Math.min(100, (item.qty_available / item.max_stock) * 100) : 0
              const onOrderPct = item.max_stock > 0 ? Math.min(100 - availPct, (item.qty_on_order / item.max_stock) * 100) : 0
              const minPct = item.max_stock > 0 ? (item.min_stock / item.max_stock) * 100 : 20

              return (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 80px", gap: "12px", alignItems: "center" }}>
                  <div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#CCC", margin: 0, letterSpacing: "0.04em" }}>{item.sku?.sku_code}</p>
                    <p style={{ fontSize: "10px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sku?.name}</p>
                  </div>
                  <div style={{ position: "relative", height: "20px", background: "rgba(255,255,255,0.04)", borderRadius: "2px" }}>
                    {/* Available stock bar */}
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${availPct}%`, background: barColor, borderRadius: "2px", transition: "width 0.3s" }} />
                    {/* On order bar */}
                    {onOrderPct > 0 && (
                      <div style={{ position: "absolute", left: `${availPct}%`, top: 0, height: "100%", width: `${onOrderPct}%`, background: "rgba(106,156,200,0.4)", borderRadius: "0 2px 2px 0" }} />
                    )}
                    {/* Min stock line */}
                    <div style={{ position: "absolute", left: `${minPct}%`, top: 0, height: "100%", width: "2px", background: "rgba(255,255,255,0.3)" }} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: barColor }}>{item.qty_available}</span>
                    <span style={{ fontSize: "10px", color: "#444", fontFamily: "'Barlow', sans-serif" }}> / {item.max_stock}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Reorder table */}
      {needsReorder.length > 0 && (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(169,30,34,0.2)", borderTop: "2px solid #A91E22" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle size={14} color="#A91E22" />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#A91E22" }}>
                Reorder Required — {needsReorder.length} SKUs
              </span>
            </div>
            <button
              onClick={selectAll}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "5px 10px", cursor: "pointer" }}
            >
              {selectedItems.size === needsReorder.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1A1E22" }}>
                <th style={{ width: "40px", padding: "8px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}></th>
                {["SKU", "Product", "Available", "Min", "Reorder Qty", "Est. Cost", "Action"].map(h => (
                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", padding: "8px 14px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {needsReorder.map(item => {
                const status = getStockStatus(item)
                const reorderQty = getReorderQty(item)
                const reorderCost = getReorderCost(item)
                const isSelected = selectedItems.has(item.id)

                return (
                  <tr key={item.id} style={{ background: isSelected ? "rgba(169,30,34,0.05)" : "transparent", cursor: "pointer" }}
                    onClick={() => toggleSelect(item.id)}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)" }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                  >
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ width: "16px", height: "16px", border: `1.5px solid ${isSelected ? "#A91E22" : "#444"}`, background: isSelected ? "#A91E22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isSelected && <span style={{ color: "#fff", fontSize: "10px", lineHeight: 1 }}>✓</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>{item.sku?.sku_code}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku?.name}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: status === "critical" ? "#A91E22" : "#C4A93A" }}>{item.qty_available}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#666", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.min_stock}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff" }}>{reorderQty}</span>
                      <span style={{ fontSize: "10px", color: "#555", marginLeft: "4px", fontFamily: "'Barlow', sans-serif" }}>units</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#C4A93A", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      ${Math.round(reorderCost).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isSelected ? "#A91E22" : "#555" }}>
                        {isSelected ? "✓ Selected" : "Click to Select"}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {/* Total row */}
              <tr style={{ background: "#1A1E22" }}>
                <td colSpan={6} style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", textAlign: "right" }}>
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

      {needsReorder.length === 0 && !loading && (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(90,158,90,0.2)", borderTop: "2px solid #5A9E5A", padding: "40px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5A9E5A", margin: "0 0 6px" }}>All Stock Levels Healthy</p>
          <p style={{ fontSize: "13px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>No SKUs are below minimum stock threshold.</p>
        </div>
      )}
    </div>
  )
}
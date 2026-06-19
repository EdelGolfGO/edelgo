"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, TrendingDown, Package, BarChart2, Pencil, X, Save } from "lucide-react"
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
    is_component: boolean
    product: { name: string; category: string }
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  built_club: "#A91E22",
  head_only: "#6A9CC8",
  part: "#C4A93A",
  accessory: "#7AAB6A",
  apparel: "#888",
}

export default function InventoryPage() {
  const router = useRouter()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "low" | "critical" | "healthy">("all")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [editModal, setEditModal] = useState<InventoryItem | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadInventory() }, [])

  async function loadInventory() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("inventory")
      .select("*, sku:skus(sku_code, name, unit_cost, is_component, product:products(name, category))")
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

  function openEdit(item: InventoryItem) {
    setEditForm({
      qty_on_hand: item.qty_on_hand?.toString() ?? "0",
      min_stock: item.min_stock?.toString() ?? "5",
      max_stock: item.max_stock?.toString() ?? "50",
      reorder_qty: item.reorder_qty?.toString() ?? "20",
    })
    setEditModal(item)
  }

  async function handleSaveEdit() {
    if (!editModal) return
    setSaving(true)
    const supabase = createClient()

    const qtyOnHand = parseInt(editForm.qty_on_hand) || 0
    const minStock = parseInt(editForm.min_stock) || 0
    const maxStock = parseInt(editForm.max_stock) || 0
    const reorderQty = parseInt(editForm.reorder_qty) || 0

    await supabase.from("inventory").update({
      qty_on_hand: qtyOnHand,
      min_stock: minStock,
      max_stock: maxStock,
      reorder_qty: reorderQty,
      updated_at: new Date().toISOString(),
    }).eq("id", editModal.id)

    setSaving(false)
    setEditModal(null)
    loadInventory()
  }

  const filtered = inventory.filter(item => {
    const status = getStockStatus(item)
    if (filter === "low" && status !== "low") return false
    if (filter === "critical" && status !== "critical") return false
    if (filter === "healthy" && status !== "healthy") return false
    if (categoryFilter !== "all" && item.sku?.product?.category !== categoryFilter) return false
    if (search && !item.sku?.name.toLowerCase().includes(search.toLowerCase()) && !item.sku?.sku_code.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Derive available categories from loaded inventory
  const availableCategories = Array.from(new Set(inventory.map(i => i.sku?.product?.category).filter(Boolean))) as string[]

  const criticalCount = inventory.filter(i => getStockStatus(i) === "critical").length
  const lowCount = inventory.filter(i => getStockStatus(i) === "low").length
  const totalValue = inventory.reduce((sum, i) => sum + i.qty_on_hand * (i.sku?.unit_cost || 0), 0)

  const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "9px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#666", marginBottom: "6px" }

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
              {f === "all" ? `All (${filtered.length})` :
               f === "critical" ? `Critical (${criticalCount})` :
               f === "low" ? `Low (${lowCount})` :
               `Healthy (${inventory.filter(i => getStockStatus(i) === "healthy").length})`}
            </button>
          ))}
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: categoryFilter !== "all" ? "#fff" : "#888", padding: "8px 12px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", cursor: "pointer" }}>
          <option value="all">All Categories</option>
          {availableCategories.sort().map(cat => (
            <option key={cat} value={cat}>{cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
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
                {["SKU", "Product", "Type", "Category", "On Hand", "Reserved", "Available", "On Order", "Min", "Max", "Status", ""].map(h => (
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
                  <tr key={item.id} style={{ cursor: "default" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>{item.sku?.sku_code}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{item.sku?.name}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", background: item.sku?.is_component ? "rgba(196,169,58,0.1)" : "rgba(169,30,34,0.15)", color: item.sku?.is_component ? "#C4A93A" : "#E87878" }}>
                        {item.sku?.is_component ? "Component" : "Built Product"}
                      </span>
                    </td>
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
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <button onClick={() => openEdit(item)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: "2px", display: "flex" }} title="Edit min/max stock levels">
                        <Pencil size={13} />
                      </button>
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

      {/* Edit min/max modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setEditModal(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #6A9CC8", width: "100%", maxWidth: "440px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D" }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6A9CC8", margin: "0 0 3px" }}>Edit Stock Levels</p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: 0 }}>{editModal.sku?.sku_code}</h2>
                <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{editModal.sku?.name}</p>
              </div>
              <button onClick={() => setEditModal(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* On Hand — primary edit field */}
              <div>
                <label style={labelStyle}>Qty On Hand</label>
                <input type="number" style={{ ...inputStyle, fontSize: "20px", fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", padding: "12px", borderColor: "rgba(106,156,200,0.4)" }} value={editForm.qty_on_hand} onChange={e => setEditForm((v: any) => ({ ...v, qty_on_hand: e.target.value }))} min={0} />
                <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "5px 0 0" }}>
                  Current physical count in stock. Updates the Available qty immediately.
                </p>
              </div>

              <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", paddingTop: "16px" }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#444", margin: "0 0 12px" }}>Stock Thresholds</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Min Stock</label>
                    <input type="number" style={inputStyle} value={editForm.min_stock} onChange={e => setEditForm((v: any) => ({ ...v, min_stock: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Max Stock</label>
                    <input type="number" style={inputStyle} value={editForm.max_stock} onChange={e => setEditForm((v: any) => ({ ...v, max_stock: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Reorder Qty</label>
                    <input type="number" style={inputStyle} value={editForm.reorder_qty} onChange={e => setEditForm((v: any) => ({ ...v, reorder_qty: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setEditModal(null)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving ? "#333" : "#6A9CC8", border: "none", padding: "12px", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Save size={14} /> {saving ? "Saving..." : "Save →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
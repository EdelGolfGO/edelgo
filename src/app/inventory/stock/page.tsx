"use client"

import { useState, useEffect } from "react"
import { Search, Pencil, X, Save, TrendingDown } from "lucide-react"
import { createClient } from "@/lib/supabase"

type StockRecord = {
  id: string
  sku_id: string
  qty_on_hand: number
  qty_reserved: number
  qty_on_order: number
  min_stock: number
  max_stock: number
  reorder_qty: number
  sku: {
    sku_code: string
    name: string
    image_url: string | null
    product: { name: string; category: string }
  }
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  built_club: { color: "#A91E22", bg: "rgba(169,30,34,0.1)" },
  head_only:  { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  component:  { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
  accessory:  { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)" },
  apparel:    { color: "#888",    bg: "rgba(136,136,136,0.1)" },
}

export default function StockLevelsPage() {
  const [records, setRecords] = useState<StockRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [editModal, setEditModal] = useState<StockRecord | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("inventory")
      .select(`
        *,
        sku:skus(
          sku_code, name, image_url,
          product:products(name, category)
        )
      `)
      .order("sku_id")
    if (data) setRecords(data as any)
    setLoading(false)
  }

  function openEdit(record: StockRecord) {
    setEditForm({
      qty_on_hand: record.qty_on_hand?.toString() || "0",
      qty_reserved: record.qty_reserved?.toString() || "0",
      qty_on_order: record.qty_on_order?.toString() || "0",
      min_stock: record.min_stock?.toString() || "5",
      max_stock: record.max_stock?.toString() || "50",
      reorder_qty: record.reorder_qty?.toString() || "20",
      adjustment_reason: "",
    })
    setEditModal(record)
  }

  async function handleSave() {
    if (!editModal) return
    setSaving(true)
    const supabase = createClient()

    const oldQty = editModal.qty_on_hand
    const newQty = parseInt(editForm.qty_on_hand) || 0

    await supabase.from("inventory").update({
      qty_on_hand: newQty,
      qty_reserved: parseInt(editForm.qty_reserved) || 0,
      qty_on_order: parseInt(editForm.qty_on_order) || 0,
      min_stock: parseInt(editForm.min_stock) || 0,
      max_stock: parseInt(editForm.max_stock) || 0,
      reorder_qty: parseInt(editForm.reorder_qty) || 0,
      updated_at: new Date().toISOString(),
    }).eq("id", editModal.id)

    // Log adjustment if qty changed
    if (oldQty !== newQty) {
      await supabase.from("inventory_transactions").insert({
        sku_id: editModal.sku_id,
        transaction_type: "adjustment",
        quantity_change: newQty - oldQty,
        quantity_before: oldQty,
        quantity_after: newQty,
        notes: editForm.adjustment_reason || "Manual adjustment",
      })
    }

    setSaving(false)
    setEditModal(null)
    loadData()
  }

  const categories = [...new Set(records.map(r => r.sku?.product?.category).filter(Boolean))]

  const filtered = records.filter(r => {
    if (categoryFilter !== "all" && r.sku?.product?.category !== categoryFilter) return false
    if (statusFilter === "low" && r.qty_on_hand > r.min_stock) return false
    if (statusFilter === "critical" && r.qty_on_hand > 0) return false
    if (statusFilter === "healthy" && r.qty_on_hand <= r.min_stock) return false
    if (search && !r.sku?.sku_code?.toLowerCase().includes(search.toLowerCase()) && !r.sku?.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalSkus = records.length
  const lowStock = records.filter(r => r.qty_on_hand <= r.min_stock && r.qty_on_hand > 0).length
  const outOfStock = records.filter(r => r.qty_on_hand <= 0).length
  const healthy = records.filter(r => r.qty_on_hand > r.min_stock).length

  const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "9px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#666", marginBottom: "6px" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Stock Levels</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>{totalSkus} SKUs tracked</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }} />
          </div>
          <button onClick={() => window.location.href = "/inventory/forecast"} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <TrendingDown size={13} /> Reorder Forecast
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Total SKUs", value: totalSkus, color: "#fff", top: "#2A2A2A", filter: "all" },
          { label: "Healthy Stock", value: healthy, color: "#5A9E5A", top: "#5A9E5A", filter: "healthy" },
          { label: "Low Stock", value: lowStock, color: "#C4A93A", top: lowStock > 0 ? "#C4A93A" : "#2A2A2A", filter: "low" },
          { label: "Out of Stock", value: outOfStock, color: "#A91E22", top: outOfStock > 0 ? "#A91E22" : "#2A2A2A", filter: "critical" },
        ].map(s => (
          <div key={s.label} onClick={() => setStatusFilter(statusFilter === s.filter ? "all" : s.filter)} style={{ background: "#22262B", border: `0.5px solid ${statusFilter === s.filter ? s.top : "rgba(255,255,255,0.10)"}`, borderTop: `2px solid ${s.top}`, padding: "18px 20px", cursor: "pointer" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{s.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 12px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", cursor: "pointer" }}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#444" }}>{filtered.length} SKUs shown</span>
      </div>

      {/* Stock table */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase" }}>No SKUs match this filter</div>
      ) : (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1A1E22" }}>
                {["", "SKU", "Name", "Category", "On Hand", "Reserved", "On Order", "Min", "Max", "Status", ""].map((h, i) => (
                  <th key={i} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", padding: "10px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(record => {
                const cat = record.sku?.product?.category || "component"
                const cc = CATEGORY_COLORS[cat] || CATEGORY_COLORS.component
                const qty = record.qty_on_hand ?? 0
                const isCritical = qty <= 0
                const isLow = qty > 0 && qty <= record.min_stock
                const isHealthy = qty > record.min_stock
                const statusColor = isCritical ? "#A91E22" : isLow ? "#C4A93A" : "#5A9E5A"
                const statusLabel = isCritical ? "Out of Stock" : isLow ? "Low Stock" : "Healthy"
                const statusBg = isCritical ? "rgba(169,30,34,0.1)" : isLow ? "rgba(196,169,58,0.1)" : "rgba(90,158,90,0.1)"

                return (
                  <tr key={record.id}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", width: "44px" }}>
                      {record.sku?.image_url ? (
                        <img src={record.sku.image_url} alt="" style={{ width: "36px", height: "36px", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "36px", height: "36px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.06)" }} />
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{record.sku?.sku_code}</td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.sku?.name}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: cc.color, background: cc.bg, padding: "2px 7px" }}>
                        {cat.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: statusColor }}>{qty}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{record.qty_reserved ?? 0}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#6A9CC8", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{record.qty_on_order ?? 0}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", color: "#444", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{record.min_stock}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", color: "#444", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{record.max_stock}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor, background: statusBg, padding: "2px 8px" }}>{statusLabel}</span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <button onClick={() => openEdit(record)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: "2px" }} title="Edit stock levels">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setEditModal(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #6A9CC8", width: "100%", maxWidth: "520px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                {editModal.sku?.image_url && <img src={editModal.sku.image_url} alt="" style={{ width: "44px", height: "44px", objectFit: "cover", flexShrink: 0 }} />}
                <div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6A9CC8", margin: "0 0 3px" }}>Adjust Stock</p>
                  <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: 0 }}>{editModal.sku?.sku_code}</h2>
                  <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{editModal.sku?.name}</p>
                </div>
              </div>
              <button onClick={() => setEditModal(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                {[
                  { label: "Qty On Hand", key: "qty_on_hand", highlight: true },
                  { label: "Qty Reserved", key: "qty_reserved" },
                  { label: "Qty On Order", key: "qty_on_order" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ ...labelStyle, color: f.highlight ? "#6A9CC8" : "#666" }}>{f.label}</label>
                    <input type="number" style={{ ...inputStyle, borderColor: f.highlight ? "rgba(106,156,200,0.3)" : "rgba(255,255,255,0.12)" }} value={editForm[f.key]} onChange={e => setEditForm((v: any) => ({ ...v, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                {[
                  { label: "Min Stock", key: "min_stock" },
                  { label: "Max Stock", key: "max_stock" },
                  { label: "Reorder Qty", key: "reorder_qty" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={labelStyle}>{f.label}</label>
                    <input type="number" style={inputStyle} value={editForm[f.key]} onChange={e => setEditForm((v: any) => ({ ...v, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div>
                <label style={labelStyle}>Adjustment Reason (optional)</label>
                <input style={inputStyle} placeholder="e.g. Physical count, Received shipment, Damage..." value={editForm.adjustment_reason} onChange={e => setEditForm((v: any) => ({ ...v, adjustment_reason: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setEditModal(null)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving ? "#333" : "#6A9CC8", border: "none", padding: "12px", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Save size={14} /> {saving ? "Saving..." : "Save Stock Levels →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
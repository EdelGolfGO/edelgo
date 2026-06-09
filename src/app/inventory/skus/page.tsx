"use client"

import { useState, useEffect } from "react"
import { Plus, X, Search, Pencil, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase"

type SKU = {
  id: string
  sku_code: string
  name: string
  description: string
  unit_cost: number
  msrp: number
  wholesaler_price: number
  fitter_price: number
  is_active: boolean
  lead_time_days: number
  product: { name: string; category: string }
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  built_club: { color: "#A91E22", bg: "rgba(169,30,34,0.1)" },
  head_only:  { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  component:  { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
  accessory:  { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)" },
  apparel:    { color: "#888",    bg: "rgba(136,136,136,0.1)" },
}

export default function SKUsPage() {
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => { loadSKUs() }, [])

  async function loadSKUs() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("skus")
      .select("*, product:products(name, category)")
      .order("sku_code")
    if (data) setSkus(data as any)
    setLoading(false)
  }

  const categories = [...new Set(skus.map(s => s.product?.category).filter(Boolean))]

  const filtered = skus.filter(s => {
    if (categoryFilter !== "all" && s.product?.category !== categoryFilter) return false
    if (search && !s.sku_code.toLowerCase().includes(search.toLowerCase()) && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>SKUs</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>{skus.length} SKUs in catalog</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }} />
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <button onClick={() => setCategoryFilter("all")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: categoryFilter === "all" ? "#fff" : "#555", borderBottom: categoryFilter === "all" ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
          All ({skus.length})
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: categoryFilter === cat ? "#fff" : "#555", borderBottom: categoryFilter === cat ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap" }}>
            {cat.replace("_", " ")} ({skus.filter(s => s.product?.category === cat).length})
          </button>
        ))}
      </div>

      {/* SKU Table */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading SKUs...</div>
      ) : (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1A1E22" }}>
                {["SKU Code", "Name", "Category", "Unit Cost", "MSRP", "Wholesale", "Fitter", "Lead Time", "Status"].map(h => (
                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", padding: "10px 14px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(sku => {
                const cat = sku.product?.category || "component"
                const cc = CATEGORY_COLORS[cat] || CATEGORY_COLORS.component
                return (
                  <tr key={sku.id}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>{sku.sku_code}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{sku.name}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: cc.color, background: cc.bg, padding: "2px 7px" }}>
                        {cat.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${sku.unit_cost?.toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${sku.msrp?.toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#888", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${sku.wholesaler_price?.toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#888", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${sku.fitter_price?.toFixed(2) || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{sku.lead_time_days ? `${sku.lead_time_days}d` : "—"}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: sku.is_active ? "#5A9E5A" : "#555", background: sku.is_active ? "rgba(90,158,90,0.1)" : "rgba(136,136,136,0.1)", padding: "2px 7px" }}>
                        {sku.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif" }}>
              No SKUs match this filter.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { Search, Check } from "lucide-react"
import { createClient } from "@/lib/supabase"

type SKU = {
  id: string
  sku_code: string
  name: string
  is_customizable?: boolean
  product: { category: string }
}

type DealerSkuAccessPickerProps = {
  // For a brand-new dealer (approval flow), there's no dealer_id yet — pass
  // null and use selectedIds/onChange to manage selection in local state
  // until the dealer record exists, then save it all at once on approve.
  dealerId?: string | null
  selectedIds: Set<string>
  onChange: (ids: Set<string>) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  built_club: "Built Clubs",
  head_only: "Head Only",
  part: "Parts",
  accessory: "Accessories",
  apparel: "Apparel",
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  built_club: { color: "#A91E22", bg: "rgba(169,30,34,0.1)" },
  head_only: { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  part: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
  accessory: { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)" },
  apparel: { color: "#B5BAC2", bg: "rgba(136,136,136,0.1)" },
}

export default function DealerSkuAccessPicker({ dealerId, selectedIds, onChange }: DealerSkuAccessPickerProps) {
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => { loadSkus() }, [])

  async function loadSkus() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("skus")
      .select("id, sku_code, name, is_customizable, product:products(category)")
      .eq("is_active", true)
      .order("sku_code")
    if (data) setSkus(data as any)
    setLoading(false)
  }

  const categories = [...new Set(skus.map(s => (s as any).product?.category).filter(Boolean))]

  const filtered = skus.filter(s => {
    const cat = (s as any).product?.category
    if (categoryFilter !== "all" && cat !== categoryFilter) return false
    if (search && !s.sku_code.toLowerCase().includes(search.toLowerCase()) && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  // Adds every SKU currently in a given category to the selection at once —
  // the "bucket" add Gavin asked for, so granting "all Built Clubs" doesn't
  // require clicking 200 individual checkboxes.
  function addBucket(category: string) {
    const idsInCategory = skus.filter(s => (s as any).product?.category === category).map(s => s.id)
    const next = new Set(selectedIds)
    idsInCategory.forEach(id => next.add(id))
    onChange(next)
  }

  function removeBucket(category: string) {
    const idsInCategory = skus.filter(s => (s as any).product?.category === category).map(s => s.id)
    const next = new Set(selectedIds)
    idsInCategory.forEach(id => next.delete(id))
    onChange(next)
  }

  function selectAll() {
    onChange(new Set(filtered.map(s => s.id)))
  }

  function clearAll() {
    onChange(new Set())
  }

  const inputStyle = { background: "#23282E", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Bucket add/remove by category */}
      <div>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87", margin: "0 0 8px" }}>
          Quick Add by Category
        </p>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {categories.map(cat => {
            const catStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS.part
            const idsInCategory = skus.filter(s => (s as any).product?.category === cat).map(s => s.id)
            const allSelected = idsInCategory.length > 0 && idsInCategory.every(id => selectedIds.has(id))
            return (
              <button key={cat} onClick={() => allSelected ? removeBucket(cat) : addBucket(cat)}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: allSelected ? "#fff" : catStyle.color, background: allSelected ? catStyle.color : catStyle.bg, border: "none", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                {allSelected && <Check size={11} />}
                All {CATEGORY_LABELS[cat] || cat} ({idsInCategory.length})
              </button>
            )
          })}
        </div>
      </div>

      {/* Search + filter + select all/clear */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={12} color="#787E87" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: "100%", paddingLeft: "26px" }} />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
        <button onClick={selectAll} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", background: "transparent", border: "1px solid rgba(106,156,200,0.3)", padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>
          Select Shown
        </button>
        <button onClick={clearAll} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8B919A", background: "transparent", border: "1px solid #3A3F47", padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>
          Clear All
        </button>
      </div>

      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#6A9CC8", margin: 0 }}>
        {selectedIds.size} SKU{selectedIds.size !== 1 ? "s" : ""} granted
      </p>

      {/* SKU list */}
      <div style={{ maxHeight: "320px", overflowY: "auto", background: "#23282E", border: "0.5px solid rgba(255,255,255,0.08)" }}>
        {loading ? (
          <p style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif" }}>Loading SKUs...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif" }}>No SKUs match your filters.</p>
        ) : filtered.map(sku => {
          const cat = (sku as any).product?.category
          const catStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS.part
          const isSelected = selectedIds.has(sku.id)
          return (
            <div key={sku.id} onClick={() => toggleOne(sku.id)}
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", cursor: "pointer", background: isSelected ? "rgba(106,156,200,0.06)" : "transparent", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
              <input type="checkbox" checked={isSelected} onChange={() => toggleOne(sku.id)} onClick={e => e.stopPropagation()} style={{ cursor: "pointer" }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", flexShrink: 0 }}>{sku.sku_code}</span>
              <span style={{ fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sku.name}</span>
              {sku.is_customizable && (
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#C4A93A", background: "rgba(196,169,58,0.1)", padding: "1px 6px", flexShrink: 0 }}>Custom</span>
              )}
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: catStyle.color, background: catStyle.bg, padding: "1px 6px", flexShrink: 0 }}>
                {CATEGORY_LABELS[cat] || cat}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
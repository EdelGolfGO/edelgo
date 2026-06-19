"use client"

import { useState, useEffect } from "react"
import { Plus, X, Search, ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Product = {
  id: string
  name: string
  category: string
  description: string
  is_active: boolean
  shopify_product_id: string
  cin7_product_id: string
  skus: { id: string; sku_code: string; name: string; msrp: number }[]
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  built_club: { color: "#A91E22", bg: "rgba(169,30,34,0.1)" },
  head_only:  { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  component:  { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
  accessory:  { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)" },
  apparel:    { color: "#B5BAC2",    bg: "rgba(136,136,136,0.1)" },
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("products")
      .select("*, skus(id, sku_code, name, msrp)")
      .order("category")
      .order("name")
    if (data) setProducts(data as any)
    setLoading(false)
  }

  const categories = [...new Set(products.map(p => p.category))]

  const filtered = products.filter(p => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Products</h1>
          <p style={{ fontSize: "12px", color: "#B5BAC2", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>{products.length} products across {categories.length} categories</p>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={13} color="#787E87" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }} />
        </div>
      </div>

      {/* Stats by category */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
        {Object.entries(CATEGORY_COLORS).map(([cat, cc]) => {
          const count = products.filter(p => p.category === cat).length
          return (
            <div key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)} style={{ background: "#2E343C", border: `0.5px solid ${categoryFilter === cat ? cc.color : "rgba(255,255,255,0.10)"}`, borderTop: `2px solid ${categoryFilter === cat ? cc.color : "#3A3F47"}`, padding: "14px 16px", cursor: "pointer" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B919A", marginBottom: "6px" }}>{cat.replace("_", " ")}</p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: count > 0 ? cc.color : "#666C75", margin: 0 }}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Product list */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading products...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(product => {
            const cc = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.component
            const isExpanded = expanded === product.id
            return (
              <div key={product.id} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: `3px solid ${cc.color}` }}>
                <div onClick={() => setExpanded(isExpanded ? null : product.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: cc.color, background: cc.bg, padding: "2px 8px" }}>{product.category.replace("_", " ")}</span>
                      {product.shopify_product_id && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A9E5A", background: "rgba(90,158,90,0.1)", padding: "2px 6px" }}>Shopify</span>}
                      {product.cin7_product_id && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", background: "rgba(106,156,200,0.1)", padding: "2px 6px" }}>Cin7</span>}
                    </div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "0.04em" }}>{product.name}</p>
                    {product.description && <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "3px 0 0" }}>{product.description}</p>}
                  </div>
                  <div style={{ flex: "0 0 100px", textAlign: "right" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#9BA0A8", margin: 0 }}>{product.skus?.length || 0} SKUs</p>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: product.is_active ? "#5A9E5A" : "#787E87", background: product.is_active ? "rgba(90,158,90,0.1)" : "rgba(136,136,136,0.1)", padding: "3px 8px", flexShrink: 0 }}>
                    {product.is_active ? "Active" : "Inactive"}
                  </span>
                  <ChevronDown size={16} color="#787E87" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && product.skus && product.skus.length > 0 && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "12px 20px", background: "#2B3038" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#787E87", marginBottom: "10px" }}>SKUs</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {product.skus.map(sku => (
                        <div key={sku.id} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "7px 12px", background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", letterSpacing: "0.04em", flex: "0 0 140px" }}>{sku.sku_code}</span>
                          <span style={{ fontSize: "12px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", flex: 1 }}>{sku.name}</span>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#E0E2E6" }}>${sku.msrp?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
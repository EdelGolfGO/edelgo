"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Save, Download } from "lucide-react"

type SKUPricing = {
  id: string
  sku_code: string
  name: string
  msrp: number
  tier1: number // wholesaler
  tier2: number // fitter
  tier3: number // distributor
  unit_cost: number
  product: { name: string; category: string }
}

export default function PricingPage() {
  const [skus, setSkus] = useState<SKUPricing[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkT1, setBulkT1] = useState("")
  const [bulkT2, setBulkT2] = useState("")
  const [bulkT3, setBulkT3] = useState("")

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from("skus").select("id, sku_code, name, msrp, wholesaler_price, fitter_price, distributor_price, unit_cost, product:products(name, category)").order("sku_code")
    if (data) {
      setSkus(data.map((s: any) => ({
        id: s.id,
        sku_code: s.sku_code,
        name: s.name,
        msrp: s.msrp || 0,
        tier1: s.wholesaler_price || 0,
        tier2: s.fitter_price || 0,
        tier3: s.distributor_price || 0,
        unit_cost: s.unit_cost || 0,
        product: s.product,
      })))
    }
    setLoading(false)
  }

  function updatePrice(id: string, tier: string, value: number) {
    setSkus(prev => prev.map(s => s.id === id ? { ...s, [tier]: value } : s))
  }

  async function handleSaveAll() {
    setSaving(true)
    const supabase = createClient()
    for (const sku of filtered) {
      await supabase.from("skus").update({
        wholesaler_price: sku.tier1,
        fitter_price: sku.tier2,
        distributor_price: sku.tier3,
        updated_at: new Date().toISOString(),
      }).eq("id", sku.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function applyBulkMsrp() {
    const t1 = parseFloat(bulkT1) / 100
    const t2 = parseFloat(bulkT2) / 100
    const t3 = parseFloat(bulkT3) / 100
    setSkus(prev => prev.map(s => ({
      ...s,
      tier1: t1 ? parseFloat((s.msrp * t1).toFixed(2)) : s.tier1,
      tier2: t2 ? parseFloat((s.msrp * t2).toFixed(2)) : s.tier2,
      tier3: t3 ? parseFloat((s.msrp * t3).toFixed(2)) : s.tier3,
    })))
  }

  function exportCSV() {
    const headers = ["SKU Code", "Product", "MSRP", "Tier 1 - Wholesale", "T1 % of MSRP", "Tier 2 - Fitter", "T2 % of MSRP", "Tier 3 - Distributor", "T3 % of MSRP"]
    const rows = skus.map(s => [
      s.sku_code,
      s.name,
      s.msrp.toFixed(2),
      s.tier1.toFixed(2),
      s.msrp > 0 ? `${(s.tier1 / s.msrp * 100).toFixed(0)}%` : "—",
      s.tier2.toFixed(2),
      s.msrp > 0 ? `${(s.tier2 / s.msrp * 100).toFixed(0)}%` : "—",
      s.tier3.toFixed(2),
      s.msrp > 0 ? `${(s.tier3 / s.msrp * 100).toFixed(0)}%` : "—",
    ])
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `EdelFit_PriceTable_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const categories = [...new Set(skus.map(s => s.product?.category).filter(Boolean))]
  const filtered = skus.filter(s => {
    if (categoryFilter !== "all" && s.product?.category !== categoryFilter) return false
    if (search && !s.sku_code.toLowerCase().includes(search.toLowerCase()) && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inputStyle = { background: "#13161A", border: "0.5px solid rgba(255,255,255,0.08)", color: "#fff", padding: "5px 8px", fontSize: "12px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, outline: "none", width: "90px", textAlign: "right" as const, boxSizing: "border-box" as const }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Finance</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Pricing Tiers</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>Manage Tier 1 (Wholesale), Tier 2 (Fitter), Tier 3 (Distributor) pricing</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={exportCSV} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Download size={13} /> Download Price Table
          </button>
          <button onClick={handleSaveAll} disabled={saving} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: saved ? "#5A9E5A" : saving ? "#333" : "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Save size={14} /> {saved ? "Saved!" : saving ? "Saving..." : "Save All Changes"}
          </button>
        </div>
      </div>

      {/* Tier legend */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {[
          { label: "Tier 1 — Wholesaler", desc: "Standard wholesale accounts", color: "#6A9CC8" },
          { label: "Tier 2 — Fitter", desc: "Club fitters and fitting studios", color: "#C4A93A" },
          { label: "Tier 3 — Distributor", desc: "Custom / International distributors", color: "#A91E22" },
        ].map(t => (
          <div key={t.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${t.color}`, padding: "14px 16px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: t.color, margin: "0 0 4px" }}>{t.label}</p>
            <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{t.desc}</p>
          </div>
        ))}
      </div>

      {/* Bulk % of MSRP calculator */}
      <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "16px 20px" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Bulk Set by % of MSRP</p>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          {[
            { label: "Tier 1 %", val: bulkT1, set: setBulkT1, color: "#6A9CC8" },
            { label: "Tier 2 %", val: bulkT2, set: setBulkT2, color: "#C4A93A" },
            { label: "Tier 3 %", val: bulkT3, set: setBulkT3, color: "#A91E22" },
          ].map(t => (
            <div key={t.label}>
              <label style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: t.color, marginBottom: "5px" }}>{t.label}</label>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input type="number" style={{ ...inputStyle, width: "70px" }} placeholder="60" value={t.val} onChange={e => t.set(e.target.value)} />
                <span style={{ color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700 }}>%</span>
              </div>
            </div>
          ))}
          <button onClick={applyBulkMsrp} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 16px", cursor: "pointer" }}>
            Apply to {categoryFilter === "all" ? "All" : categoryFilter.replace("_", " ")} SKUs
          </button>
          <p style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: 0 }}>Leave blank to skip that tier</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "200px" }} />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 12px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", cursor: "pointer" }}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#444", letterSpacing: "0.08em" }}>{filtered.length} SKUs</span>
      </div>

      {/* Pricing table */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase" }}>Loading...</div>
      ) : (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1A1E22" }}>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", padding: "10px 14px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>SKU</th>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", padding: "10px 14px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>Name</th>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", padding: "10px 14px", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>MSRP</th>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6A9CC8", padding: "10px 14px", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>Tier 1 — Wholesale</th>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", padding: "10px 6px", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>% MSRP</th>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4A93A", padding: "10px 14px", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>Tier 2 — Fitter</th>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", padding: "10px 6px", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>% MSRP</th>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A91E22", padding: "10px 14px", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>Tier 3 — Distributor</th>
                <th style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", padding: "10px 6px", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>% MSRP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sku => (
                <tr key={sku.id}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "7px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{sku.sku_code}</td>
                  <td style={{ padding: "7px 14px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sku.name}</td>
                  <td style={{ padding: "7px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#888" }}>${sku.msrp.toFixed(2)}</span>
                  </td>
                  <td style={{ padding: "4px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                    <input type="number" style={{ ...inputStyle, borderColor: "rgba(106,156,200,0.2)" }} value={sku.tier1 || ""} placeholder="0.00" onChange={e => updatePrice(sku.id, "tier1", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td style={{ padding: "7px 6px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", color: "#444" }}>{sku.msrp > 0 && sku.tier1 > 0 ? `${(sku.tier1 / sku.msrp * 100).toFixed(0)}%` : "—"}</span>
                  </td>
                  <td style={{ padding: "4px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                    <input type="number" style={{ ...inputStyle, borderColor: "rgba(196,169,58,0.2)" }} value={sku.tier2 || ""} placeholder="0.00" onChange={e => updatePrice(sku.id, "tier2", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td style={{ padding: "7px 6px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", color: "#444" }}>{sku.msrp > 0 && sku.tier2 > 0 ? `${(sku.tier2 / sku.msrp * 100).toFixed(0)}%` : "—"}</span>
                  </td>
                  <td style={{ padding: "4px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                    <input type="number" style={{ ...inputStyle, borderColor: "rgba(169,30,34,0.2)" }} value={sku.tier3 || ""} placeholder="0.00" onChange={e => updatePrice(sku.id, "tier3", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td style={{ padding: "7px 6px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", color: "#444" }}>{sku.msrp > 0 && sku.tier3 > 0 ? `${(sku.tier3 / sku.msrp * 100).toFixed(0)}%` : "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
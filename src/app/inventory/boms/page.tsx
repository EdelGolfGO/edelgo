"use client"

import { useState, useEffect } from "react"
import { Plus, ChevronDown, Package } from "lucide-react"
import { createClient } from "@/lib/supabase"

type BomEntry = {
  id: string
  quantity: number
  component: {
    sku_code: string
    name: string
    unit_cost: number
    inventory: { qty_available: number }[]
  }
}

type FinishedSku = {
  id: string
  sku_code: string
  name: string
  unit_cost: number
  product: { name: string; category: string }
  boms: BomEntry[]
}

export default function BomsPage() {
  const [skus, setSkus] = useState<FinishedSku[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => { loadBoms() }, [])

  async function loadBoms() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("skus")
      .select(`
        id, sku_code, name, unit_cost,
        product:products(name, category),
        boms(
          id, quantity,
          component:skus!boms_component_sku_id_fkey(
            sku_code, name, unit_cost,
            inventory(qty_available)
          )
        )
      `)
      .not("boms", "is", null)
      .order("sku_code")

    if (data) {
      const withBoms = data.filter((s: any) => s.boms && s.boms.length > 0)
      setSkus(withBoms as any)
    }
    setLoading(false)
  }

  function canBuild(sku: FinishedSku, qty: number = 1) {
    return sku.boms.every(bom => {
      const avail = bom.component.inventory?.[0]?.qty_available || 0
      return avail >= bom.quantity * qty
    })
  }

  function maxBuildable(sku: FinishedSku) {
    if (sku.boms.length === 0) return 0
    return Math.min(...sku.boms.map(bom => {
      const avail = bom.component.inventory?.[0]?.qty_available || 0
      return Math.floor(avail / bom.quantity)
    }))
  }

  function totalComponentCost(sku: FinishedSku) {
    return sku.boms.reduce((sum, bom) => sum + bom.quantity * bom.component.unit_cost, 0)
  }

  const filtered = skus.filter(s =>
    !search ||
    s.sku_code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Bill of Materials</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
            Component breakdown for every finished SKU — shows buildable quantity based on current stock
          </p>
        </div>
        <input
          placeholder="Search SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }}
        />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {[
          { label: "Finished SKUs with BoM", value: skus.length.toString(), color: "#fff" },
          { label: "Can Build Now", value: skus.filter(s => canBuild(s)).length.toString(), color: "#5A9E5A" },
          { label: "Blocked by Stock", value: skus.filter(s => !canBuild(s)).length.toString(), color: "#A91E22" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* BoM list */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading BoMs...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 8px" }}>No BoMs Found</p>
          <p style={{ fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif", margin: 0 }}>No finished SKUs have bill of materials defined yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(sku => {
            const isExpanded = expanded === sku.id
            const buildable = maxBuildable(sku)
            const canBuildNow = canBuild(sku)
            const compCost = totalComponentCost(sku)

            return (
              <div key={sku.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: `3px solid ${canBuildNow ? "#5A9E5A" : "#A91E22"}` }}>
                <div onClick={() => setExpanded(isExpanded ? null : sku.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>

                  <div style={{ flex: "0 0 160px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{sku.sku_code}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{sku.name}</p>
                  </div>

                  <div style={{ flex: "0 0 120px" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: canBuildNow ? "#5A9E5A" : "#A91E22", background: canBuildNow ? "rgba(90,158,90,0.1)" : "rgba(169,30,34,0.1)", padding: "3px 10px" }}>
                      {canBuildNow ? "Can Build" : "Blocked"}
                    </span>
                  </div>

                  <div style={{ flex: 1, display: "flex", gap: "32px" }}>
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Components</p>
                      <p style={{ fontSize: "13px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, margin: 0 }}>{sku.boms.length}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Max Buildable</p>
                      <p style={{ fontSize: "13px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, margin: 0, color: buildable > 0 ? "#5A9E5A" : "#A91E22" }}>{buildable} units</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Component Cost</p>
                      <p style={{ fontSize: "13px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, margin: 0 }}>${compCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>MSRP</p>
                      <p style={{ fontSize: "13px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, margin: 0 }}>${sku.unit_cost.toFixed(2)}</p>
                    </div>
                  </div>

                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Components Required (per unit)</p>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Component SKU", "Name", "Qty Required", "In Stock", "Covers", "Unit Cost", "Line Cost"].map(h => (
                            <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", padding: "6px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sku.boms.map(bom => {
                          const avail = bom.component.inventory?.[0]?.qty_available || 0
                          const covers = bom.quantity > 0 ? Math.floor(avail / bom.quantity) : 0
                          const sufficient = avail >= bom.quantity
                          return (
                            <tr key={bom.id}>
                              <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>{bom.component.sku_code}</td>
                              <td style={{ padding: "8px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{bom.component.name}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{bom.quantity}</td>
                              <td style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: sufficient ? "#5A9E5A" : "#A91E22" }}>{avail}</span>
                              </td>
                              <td style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: covers > 0 ? "#6A9CC8" : "#A91E22" }}>{covers} builds</span>
                              </td>
                              <td style={{ padding: "8px 12px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${bom.component.unit_cost.toFixed(2)}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>${(bom.quantity * bom.component.unit_cost).toFixed(2)}</td>
                            </tr>
                          )
                        })}
                        <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                          <td colSpan={6} style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", textAlign: "right" }}>Total Component Cost</td>
                          <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>${compCost.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
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
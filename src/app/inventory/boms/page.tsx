"use client"

import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, Trash2, Mail, Phone, Clock, DollarSign, Search } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Supplier = {
  id: string
  name: string
  company: string
  category: string
  email: string
  phone: string
  lead_time_days: number
}

type ComponentSKU = {
  id: string
  sku_code: string
  name: string
  unit_cost: number
  lead_time_days: number
  supplier?: Supplier
}

type FinishedSKU = {
  id: string
  sku_code: string
  name: string
  unit_cost: number
  product: { name: string; category: string }
  boms: BomEntry[]
}

type BomEntry = {
  id: string
  quantity: number
  unit_cost: number
  lead_time_days: number
  component: ComponentSKU
  supplier?: Supplier
}

type NewBomLine = {
  component_sku_id: string
  quantity: number
  unit_cost: number
  lead_time_days: number
  supplier_id: string
}

export default function BomsPage() {
  const [finishedSkus, setFinishedSkus] = useState<FinishedSKU[]>([])
  const [componentSkus, setComponentSkus] = useState<ComponentSKU[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [newLines, setNewLines] = useState<NewBomLine[]>([{ component_sku_id: "", quantity: 1, unit_cost: 0, lead_time_days: 0, supplier_id: "" }])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const [skusResult, componentsResult, suppliersResult] = await Promise.all([
      supabase.from("skus").select(`
        id, sku_code, name, unit_cost,
        product:products(name, category),
        boms(
          id, quantity, unit_cost, lead_time_days,
          component:skus!boms_component_sku_id_fkey(id, sku_code, name, unit_cost, lead_time_days),
          supplier:suppliers(id, name, company, category, email, phone, lead_time_days)
        )
      `).order("sku_code"),
      supabase.from("skus").select("id, sku_code, name, unit_cost, lead_time_days, supplier:suppliers(id, name, company, category, email, phone, lead_time_days)").order("sku_code"),
      supabase.from("suppliers").select("*").order("name"),
    ])

    if (skusResult.data) setFinishedSkus(skusResult.data as any)
    if (componentsResult.data) setComponentSkus(componentsResult.data as any)
    if (suppliersResult.data) setSuppliers(suppliersResult.data)
    setLoading(false)
  }

  function maxBuildable(sku: FinishedSKU) {
    if (!sku.boms || sku.boms.length === 0) return null
    return null // would need inventory data — placeholder
  }

  function totalComponentCost(sku: FinishedSKU) {
    return sku.boms?.reduce((sum, b) => sum + b.quantity * (b.unit_cost || b.component?.unit_cost || 0), 0) || 0
  }

  function longestLeadTime(sku: FinishedSKU) {
    if (!sku.boms || sku.boms.length === 0) return 0
    return Math.max(...sku.boms.map(b => b.lead_time_days || b.supplier?.lead_time_days || b.component?.lead_time_days || 0))
  }

  async function handleAddComponents(skuId: string) {
    const validLines = newLines.filter(l => l.component_sku_id)
    if (validLines.length === 0) return
    setSaving(true)
    const supabase = createClient()
    for (const line of validLines) {
      await supabase.from("boms").upsert({
        finished_sku_id: skuId,
        component_sku_id: line.component_sku_id,
        quantity: line.quantity,
        unit_cost: line.unit_cost || null,
        lead_time_days: line.lead_time_days || null,
        supplier_id: line.supplier_id || null,
      }, { onConflict: "finished_sku_id,component_sku_id" })
    }
    setSaving(false)
    setAddingFor(null)
    setNewLines([{ component_sku_id: "", quantity: 1, unit_cost: 0, lead_time_days: 0, supplier_id: "" }])
    loadAll()
  }

  async function handleDeleteBom(bomId: string) {
    const supabase = createClient()
    await supabase.from("boms").delete().eq("id", bomId)
    loadAll()
  }

  const filtered = finishedSkus.filter(s =>
    !search ||
    s.sku_code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const withBoms = finishedSkus.filter(s => s.boms && s.boms.length > 0)
  const withoutBoms = finishedSkus.filter(s => !s.boms || s.boms.length === 0)

  const inputStyle = { background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "7px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#555", marginBottom: "4px" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Bill of Materials</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
            Component breakdown, supplier contacts, costs, and lead times for every SKU
          </p>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {[
          { label: "Total SKUs", value: finishedSkus.length.toString(), color: "#fff" },
          { label: "BoMs Defined", value: withBoms.length.toString(), color: "#5A9E5A" },
          { label: "Missing BoMs", value: withoutBoms.length.toString(), color: withoutBoms.length > 0 ? "#C4A93A" : "#5A9E5A" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* SKU List */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading BoMs...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(sku => {
            const hasBoms = sku.boms && sku.boms.length > 0
            const isExpanded = expanded === sku.id
            const isAddingComponents = addingFor === sku.id
            const compCost = totalComponentCost(sku)
            const leadTime = longestLeadTime(sku)
            const accentColor = hasBoms ? "#5A9E5A" : "#C4A93A"

            return (
              <div key={sku.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: `3px solid ${accentColor}` }}>

                {/* SKU row */}
                <div onClick={() => setExpanded(isExpanded ? null : sku.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 180px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{sku.sku_code}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{sku.name}</p>
                  </div>

                  <div style={{ flex: "0 0 100px" }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accentColor, background: hasBoms ? "rgba(90,158,90,0.1)" : "rgba(196,169,58,0.1)", padding: "3px 8px" }}>
                      {hasBoms ? `${sku.boms.length} components` : "No BoM"}
                    </span>
                  </div>

                  <div style={{ flex: 1, display: "flex", gap: "24px" }}>
                    {hasBoms && (
                      <>
                        <div>
                          <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Component Cost</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", margin: 0 }}>${compCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Longest Lead Time</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: leadTime > 30 ? "#A91E22" : leadTime > 14 ? "#C4A93A" : "#CCC", margin: 0 }}>
                            {leadTime > 0 ? `${leadTime} days` : "—"}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>MSRP</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", margin: 0 }}>${sku.unit_cost?.toFixed(2)}</p>
                        </div>
                        {compCost > 0 && sku.unit_cost > 0 && (
                          <div>
                            <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Margin</p>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#5A9E5A", margin: 0 }}>
                              {(((sku.unit_cost - compCost) / sku.unit_cost) * 100).toFixed(0)}%
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {/* Expanded BoM detail */}
                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", background: "#1E2226" }}>

                    {hasBoms && (
                      <div style={{ padding: "16px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Components</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {sku.boms.map(bom => {
                            const effectiveCost = bom.unit_cost || bom.component?.unit_cost || 0
                            const effectiveLeadTime = bom.lead_time_days || bom.supplier?.lead_time_days || bom.component?.lead_time_days || 0
                            const supplier = bom.supplier

                            return (
                              <div key={bom.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.06)", padding: "12px 16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "160px 80px 100px 100px 1fr auto", gap: "12px", alignItems: "start" }}>
                                  <div>
                                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: "0 0 2px", letterSpacing: "0.04em" }}>{bom.component?.sku_code}</p>
                                    <p style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{bom.component?.name}</p>
                                  </div>
                                  <div>
                                    <p style={labelStyle}>Qty</p>
                                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>{bom.quantity}</p>
                                  </div>
                                  <div>
                                    <p style={labelStyle}>Unit Cost</p>
                                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", margin: 0 }}>${effectiveCost.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p style={labelStyle}>Lead Time</p>
                                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: effectiveLeadTime > 30 ? "#A91E22" : effectiveLeadTime > 14 ? "#C4A93A" : "#CCC", margin: 0 }}>
                                      {effectiveLeadTime > 0 ? `${effectiveLeadTime}d` : "—"}
                                    </p>
                                  </div>
                                  <div>
                                    {supplier ? (
                                      <div>
                                        <p style={labelStyle}>Supplier</p>
                                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#6A9CC8", margin: "0 0 4px" }}>{supplier.name}</p>
                                        {supplier.email && (
                                          <a href={`mailto:${supplier.email}`} style={{ display: "flex", alignItems: "center", gap: "5px", textDecoration: "none", marginBottom: "2px" }}>
                                            <Mail size={10} color="#444" />
                                            <span style={{ fontSize: "11px", color: "#6A9CC8", fontFamily: "'Barlow', sans-serif" }}>{supplier.email}</span>
                                          </a>
                                        )}
                                        {supplier.phone && (
                                          <a href={`tel:${supplier.phone}`} style={{ display: "flex", alignItems: "center", gap: "5px", textDecoration: "none" }}>
                                            <Phone size={10} color="#444" />
                                            <span style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif" }}>{supplier.phone}</span>
                                          </a>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <p style={labelStyle}>Supplier</p>
                                        <p style={{ fontSize: "11px", color: "#333", fontFamily: "'Barlow', sans-serif", fontStyle: "italic", margin: 0 }}>No supplier linked</p>
                                      </div>
                                    )}
                                  </div>
                                  <button onClick={() => handleDeleteBom(bom.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "4px", alignSelf: "center" }}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "0.5px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "flex-end" }}>
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>Line Total: </span>
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#CCC", marginLeft: "8px" }}>${(bom.quantity * effectiveCost).toFixed(2)}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Summary row */}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "24px", marginTop: "12px", paddingTop: "12px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Total Component Cost</p>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>${compCost.toFixed(2)}</p>
                          </div>
                          {sku.unit_cost > 0 && (
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Gross Margin</p>
                              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#5A9E5A", margin: 0 }}>
                                ${(sku.unit_cost - compCost).toFixed(2)} ({(((sku.unit_cost - compCost) / sku.unit_cost) * 100).toFixed(0)}%)
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Add components form */}
                    {isAddingComponents ? (
                      <div style={{ padding: "16px 20px" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Add Components</p>
                        {newLines.map((line, idx) => (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 80px 100px 80px 1fr auto", gap: "10px", marginBottom: "10px", alignItems: "end" }}>
                            <div>
                              {idx === 0 && <label style={labelStyle}>Component SKU</label>}
                              <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={line.component_sku_id} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, component_sku_id: e.target.value } : l))}>
                                <option value="">Select component...</option>
                                {componentSkus.map(s => <option key={s.id} value={s.id}>{s.sku_code} — {s.name}</option>)}
                              </select>
                            </div>
                            <div>
                              {idx === 0 && <label style={labelStyle}>Qty</label>}
                              <input type="number" style={{ ...inputStyle, width: "100%", textAlign: "center" }} value={line.quantity} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: parseInt(e.target.value) || 1 } : l))} min={1} />
                            </div>
                            <div>
                              {idx === 0 && <label style={labelStyle}>Unit Cost ($)</label>}
                              <input type="number" style={{ ...inputStyle, width: "100%" }} placeholder="0.00" value={line.unit_cost || ""} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, unit_cost: parseFloat(e.target.value) || 0 } : l))} />
                            </div>
                            <div>
                              {idx === 0 && <label style={labelStyle}>Lead (days)</label>}
                              <input type="number" style={{ ...inputStyle, width: "100%" }} placeholder="0" value={line.lead_time_days || ""} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, lead_time_days: parseInt(e.target.value) || 0 } : l))} />
                            </div>
                            <div>
                              {idx === 0 && <label style={labelStyle}>Supplier</label>}
                              <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={line.supplier_id} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, supplier_id: e.target.value } : l))}>
                                <option value="">No supplier</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </div>
                            <button onClick={() => setNewLines(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "7px" }}>
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                          <button onClick={() => setNewLines(prev => [...prev, { component_sku_id: "", quantity: 1, unit_cost: 0, lead_time_days: 0, supplier_id: "" }])} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Plus size={12} /> Add Row
                          </button>
                          <button onClick={() => { setAddingFor(null); setNewLines([{ component_sku_id: "", quantity: 1, unit_cost: 0, lead_time_days: 0, supplier_id: "" }]) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer" }}>Cancel</button>
                          <button onClick={() => handleAddComponents(sku.id)} disabled={saving} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: saving ? "#333" : "#A91E22", border: "none", padding: "7px 18px", cursor: saving ? "not-allowed" : "pointer" }}>
                            {saving ? "Saving..." : "Save Components →"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "14px 20px" }}>
                        <button onClick={() => { setAddingFor(sku.id); setNewLines([{ component_sku_id: "", quantity: 1, unit_cost: 0, lead_time_days: 0, supplier_id: "" }]) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "7px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Plus size={12} /> {hasBoms ? "Add More Components" : "Create BoM"}
                        </button>
                      </div>
                    )}
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
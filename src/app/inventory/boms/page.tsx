"use client"

import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, Trash2, Search, DollarSign } from "lucide-react"
import { createClient } from "@/lib/supabase"

type SKU = {
  id: string
  sku_code: string
  name: string
  unit_cost: number
  product: { name: string; category: string }
}

type BomLine = {
  component_sku_id: string
  sku?: SKU
  quantity: number
  unit_cost: number
  notes: string
}

type FinishedSKU = {
  id: string
  sku_code: string
  name: string
  msrp: number
  unit_cost: number
  product: { name: string; category: string }
  boms: any[]
}

export default function BomsPage() {
  const [finishedSkus, setFinishedSkus] = useState<FinishedSKU[]>([])
  const [allSkus, setAllSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [modal, setModal] = useState(false)
  const [modalStep, setModalStep] = useState<"select_product" | "add_components">("select_product")
  const [selectedFinishedSku, setSelectedFinishedSku] = useState<FinishedSKU | null>(null)
  const [bomLines, setBomLines] = useState<BomLine[]>([])
  const [componentSearch, setComponentSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ bomId: string; skuName: string } | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const [skusResult, allSkusResult] = await Promise.all([
      supabase.from("skus").select(`
        id, sku_code, name, msrp, unit_cost,
        product:products(name, category),
        boms(
          id, quantity, unit_cost, notes,
          component:skus!boms_component_sku_id_fkey(id, sku_code, name, unit_cost)
        )
      `).order("sku_code"),
      supabase.from("skus").select("id, sku_code, name, unit_cost, product:products(name, category)").order("sku_code"),
    ])
    if (skusResult.data) setFinishedSkus(skusResult.data as any)
    if (allSkusResult.data) setAllSkus(allSkusResult.data as any)
    setLoading(false)
  }

  function openNewBom() {
    setSelectedFinishedSku(null)
    setBomLines([])
    setComponentSearch("")
    setModalStep("select_product")
    setModal(true)
  }

  function openEditBom(sku: FinishedSKU) {
    setSelectedFinishedSku(sku)
    setBomLines(sku.boms.map(b => ({
      component_sku_id: b.component?.id || "",
      sku: b.component,
      quantity: b.quantity,
      unit_cost: b.unit_cost || b.component?.unit_cost || 0,
      notes: b.notes || "",
    })))
    setModalStep("add_components")
    setModal(true)
  }

  function addComponent(sku: SKU) {
    const existing = bomLines.find(l => l.component_sku_id === sku.id)
    if (existing) {
      setBomLines(prev => prev.map(l => l.component_sku_id === sku.id ? { ...l, quantity: l.quantity + 1 } : l))
    } else {
      setBomLines(prev => [...prev, {
        component_sku_id: sku.id,
        sku,
        quantity: 1,
        unit_cost: sku.unit_cost || 0,
        notes: "",
      }])
    }
  }

  function removeLine(id: string) {
    setBomLines(prev => prev.filter(l => l.component_sku_id !== id))
  }

  function updateLine(id: string, key: string, value: any) {
    setBomLines(prev => prev.map(l => l.component_sku_id === id ? { ...l, [key]: value } : l))
  }

  function getTotalBomCost() {
    return bomLines.reduce((sum, l) => sum + (l.unit_cost || 0) * l.quantity, 0)
  }

  async function handleSaveBom() {
    if (!selectedFinishedSku || bomLines.length === 0) return
    setSaving(true)
    const supabase = createClient()

    // Delete existing boms for this SKU
    await supabase.from("boms").delete().eq("finished_sku_id", selectedFinishedSku.id)

    // Insert new lines
    await supabase.from("boms").insert(
      bomLines.map(line => ({
        finished_sku_id: selectedFinishedSku.id,
        component_sku_id: line.component_sku_id,
        quantity: line.quantity,
        unit_cost: line.unit_cost || null,
        notes: line.notes || null,
      }))
    )

    setSaving(false)
    setModal(false)
    loadAll()
  }

  async function handleDeleteBom(bomId: string) {
    const supabase = createClient()
    await supabase.from("boms").delete().eq("id", bomId)
    setDeleteConfirm(null)
    loadAll()
  }

  const filteredFinished = finishedSkus.filter(s =>
    !search ||
    s.sku_code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredComponents = allSkus.filter(s =>
    !componentSearch ||
    s.sku_code.toLowerCase().includes(componentSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(componentSearch.toLowerCase())
  ).filter(s => selectedFinishedSku ? s.id !== selectedFinishedSku.id : true)

  const withBoms = finishedSkus.filter(s => s.boms?.length > 0)
  const withoutBoms = finishedSkus.filter(s => !s.boms?.length)

  const inputStyle = { background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "7px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#555", marginBottom: "4px" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Bill of Materials</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>
            Component breakdowns and build costs for every SKU
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "200px" }} />
          </div>
          <button onClick={openNewBom} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add New BoM
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {[
          { label: "Total SKUs", value: finishedSkus.length.toString(), color: "#fff" },
          { label: "BoMs Defined", value: withBoms.length.toString(), color: "#5A9E5A" },
          { label: "Missing BoMs", value: withoutBoms.length.toString(), color: withoutBoms.length > 0 ? "#C4A93A" : "#5A9E5A" },
        ].map(s => (
          <div key={s.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{s.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* SKU List */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredFinished.map(sku => {
            const hasBoms = sku.boms?.length > 0
            const isExpanded = expanded === sku.id
            const totalCost = sku.boms?.reduce((sum: number, b: any) => sum + (b.unit_cost || b.component?.unit_cost || 0) * b.quantity, 0) || 0
            const margin = sku.msrp > 0 && totalCost > 0 ? ((sku.msrp - totalCost) / sku.msrp * 100).toFixed(0) : null

            return (
              <div key={sku.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: `3px solid ${hasBoms ? "#5A9E5A" : "#C4A93A"}` }}>
                <div onClick={() => setExpanded(isExpanded ? null : sku.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 180px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{sku.sku_code}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{sku.name}</p>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: hasBoms ? "#5A9E5A" : "#C4A93A", background: hasBoms ? "rgba(90,158,90,0.1)" : "rgba(196,169,58,0.1)", padding: "3px 8px" }}>
                    {hasBoms ? `${sku.boms.length} components` : "No BoM"}
                  </span>
                  <div style={{ flex: 1, display: "flex", gap: "24px" }}>
                    {hasBoms && (
                      <>
                        <div>
                          <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Build Cost</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#CCC", margin: 0 }}>${totalCost.toFixed(2)}</p>
                        </div>
                        {sku.msrp > 0 && (
                          <div>
                            <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>MSRP</p>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#CCC", margin: 0 }}>${sku.msrp.toFixed(2)}</p>
                          </div>
                        )}
                        {margin && (
                          <div>
                            <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Margin</p>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#5A9E5A", margin: 0 }}>{margin}%</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button onClick={e => { e.stopPropagation(); openEditBom(sku) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "5px 12px", cursor: "pointer" }}>
                    {hasBoms ? "Edit BoM" : "Create BoM"}
                  </button>
                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && hasBoms && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Components</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {sku.boms.map((bom: any) => (
                        <div key={bom.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px 100px 40px", gap: "12px", alignItems: "center", padding: "8px 12px", background: "#22262B", border: "0.5px solid rgba(255,255,255,0.05)" }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{bom.component?.sku_code}</p>
                          <p style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{bom.component?.name}</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff", margin: 0, textAlign: "center" }}>× {bom.quantity}</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#CCC", margin: 0, textAlign: "right" }}>${((bom.unit_cost || bom.component?.unit_cost || 0) * bom.quantity).toFixed(2)}</p>
                          <button onClick={() => setDeleteConfirm({ bomId: bom.id, skuName: bom.component?.name })} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "2px" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "24px", marginTop: "12px", paddingTop: "12px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Total Build Cost</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>${totalCost.toFixed(2)}</p>
                      </div>
                      {sku.msrp > 0 && totalCost > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Gross Margin</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#5A9E5A", margin: 0 }}>
                            ${(sku.msrp - totalCost).toFixed(2)} ({margin}%)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit BoM Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setModal(false)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", width: "100%", maxWidth: "900px", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", flexShrink: 0 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>
                  {modalStep === "select_product" ? "Step 1 of 2" : "Step 2 of 2"}
                </p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>
                  {modalStep === "select_product" ? "Select Finished Product" : `Build BoM — ${selectedFinishedSku?.sku_code}`}
                </h2>
              </div>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><X size={20} /></button>
            </div>

            {/* Step 1 — Select product */}
            {modalStep === "select_product" && (
              <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
                <p style={{ fontSize: "13px", color: "#666", fontFamily: "'Barlow', sans-serif", marginBottom: "16px" }}>
                  Select which finished SKU you want to build a BoM for.
                </p>
                <div style={{ position: "relative", marginBottom: "16px" }}>
                  <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
                  <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {filteredFinished.map(sku => (
                    <div key={sku.id} onClick={() => { setSelectedFinishedSku(sku); setBomLines(sku.boms?.map((b: any) => ({ component_sku_id: b.component?.id || "", sku: b.component, quantity: b.quantity, unit_cost: b.unit_cost || b.component?.unit_cost || 0, notes: b.notes || "" })) || []); setModalStep("add_components") }} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 16px", background: "#22262B", border: "0.5px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(169,30,34,0.3)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{sku.sku_code}</p>
                        <p style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{sku.name}</p>
                      </div>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: sku.boms?.length > 0 ? "#5A9E5A" : "#555", padding: "2px 8px", background: sku.boms?.length > 0 ? "rgba(90,158,90,0.1)" : "rgba(136,136,136,0.1)" }}>
                        {sku.boms?.length > 0 ? `${sku.boms.length} components` : "No BoM"}
                      </span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", color: "#555" }}>→</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 — Add components */}
            {modalStep === "add_components" && selectedFinishedSku && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden" }}>

                {/* Left — component picker */}
                <div style={{ borderRight: "0.5px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", marginBottom: "8px" }}>Add Components</p>
                    <div style={{ position: "relative" }}>
                      <Search size={12} color="#444" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }} />
                      <input placeholder="Search components..." value={componentSearch} onChange={e => setComponentSearch(e.target.value)} style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "7px 10px 7px 26px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }} />
                    </div>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
                    {filteredComponents.map(sku => {
                      const alreadyAdded = bomLines.some(l => l.component_sku_id === sku.id)
                      return (
                        <div key={sku.id} onClick={() => addComponent(sku)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", cursor: "pointer", background: alreadyAdded ? "rgba(169,30,34,0.05)" : "transparent", border: `0.5px solid ${alreadyAdded ? "rgba(169,30,34,0.2)" : "transparent"}`, marginBottom: "2px" }}
                          onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                          onMouseLeave={e => { if (!alreadyAdded) e.currentTarget.style.background = "transparent" }}
                        >
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: alreadyAdded ? "#A91E22" : "#CCC", margin: 0 }}>{sku.sku_code}</p>
                            <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0" }}>{sku.name}</p>
                          </div>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#555" }}>{sku.unit_cost ? `$${sku.unit_cost.toFixed(2)}` : "—"}</span>
                          <div style={{ width: "20px", height: "20px", background: alreadyAdded ? "#A91E22" : "#333", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Plus size={12} color="#fff" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right — BoM sheet */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", margin: 0 }}>
                      BoM for {selectedFinishedSku.sku_code} — {bomLines.length} component{bomLines.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
                    {bomLines.length === 0 ? (
                      <div style={{ padding: "40px", textAlign: "center", color: "#333", fontSize: "13px", fontFamily: "'Barlow', sans-serif" }}>
                        No components yet.<br />Click items on the left to add them.
                      </div>
                    ) : (
                      bomLines.map(line => (
                        <div key={line.component_sku_id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.06)", padding: "10px 12px", marginBottom: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <div>
                              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{line.sku?.sku_code}</p>
                              <p style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{line.sku?.name}</p>
                            </div>
                            <button onClick={() => removeLine(line.component_sku_id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "2px" }}>
                              <X size={14} />
                            </button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <div>
                              <label style={labelStyle}>Quantity</label>
                              <input type="number" style={{ ...inputStyle, width: "100%" }} value={line.quantity} min={1} onChange={e => updateLine(line.component_sku_id, "quantity", parseInt(e.target.value) || 1)} />
                            </div>
                            <div>
                              <label style={labelStyle}>Unit Cost ($)</label>
                              <input type="number" style={{ ...inputStyle, width: "100%" }} value={line.unit_cost || ""} placeholder="0.00" onChange={e => updateLine(line.component_sku_id, "unit_cost", parseFloat(e.target.value) || 0)} />
                            </div>
                          </div>
                          <div style={{ marginTop: "6px", textAlign: "right" }}>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#CCC" }}>
                              Line total: ${((line.unit_cost || 0) * line.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Total + save */}
                  <div style={{ padding: "16px", borderTop: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Total Build Cost</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, color: "#fff", margin: 0 }}>${getTotalBomCost().toFixed(2)}</p>
                      </div>
                      {selectedFinishedSku.msrp > 0 && getTotalBomCost() > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>vs MSRP ${selectedFinishedSku.msrp.toFixed(2)}</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#5A9E5A", margin: 0 }}>
                            {((selectedFinishedSku.msrp - getTotalBomCost()) / selectedFinishedSku.msrp * 100).toFixed(0)}% margin
                          </p>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button onClick={() => setModalStep("select_product")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", background: "transparent", border: "1px solid #333", padding: "8px 14px", cursor: "pointer" }}>← Back</button>
                      <button onClick={handleSaveBom} disabled={saving || bomLines.length === 0} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || bomLines.length === 0 ? "#333" : "#A91E22", border: "none", padding: "11px", cursor: saving ? "not-allowed" : "pointer" }}>
                        {saving ? "Saving..." : "Save BoM →"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "380px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>Remove Component?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>Remove <strong style={{ color: "#fff" }}>{deleteConfirm.skuName}</strong> from this BoM?</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDeleteBom(deleteConfirm.bomId)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
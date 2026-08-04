"use client"

import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, Trash2, Search } from "lucide-react"
import { createClient } from "@/lib/supabase"

const supabase = createClient()

type SKU = {
  id: string
  sku_code: string
  name: string
  unit_cost: number | null
  msrp: number | null
  sku_type: string
  product?: { name: string; category: string }
  unit_of_measure?: string | null
  cost_per_uom?: number | null
}

const UOM_LABELS: Record<string, string> = {
  fl_oz: "fl oz", ml: "ml", linear_ft: "linear ft", linear_in: "linear in",
  g: "g", oz: "oz", each: "each",
}

type BomHeader = {
  id: string
  sku_id: string
  version: number
  is_active: boolean
  labor_minutes: number
  labor_rate_per_hour: number
  notes: string | null
}

type BomItem = {
  id: string
  bom_id: string
  component_sku_id: string | null
  quantity: number
  unit_cost: number | null
  lead_time_days: number | null
  supplier_id: string | null
  notes: string | null
  component?: { id: string; sku_code: string; name: string; unit_cost: number | null; sku_type: string; unit_of_measure?: string | null; cost_per_uom?: number | null }
  supplier?: { name: string }
}

type FinishedSKU = SKU & {
  bom_header?: BomHeader
  bom_items?: BomItem[]
}

type Supplier = { id: string; name: string }

export default function BomsPage() {
  const [finishedSkus, setFinishedSkus] = useState<FinishedSKU[]>([])
  const [allSkus, setAllSkus] = useState<SKU[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [builderRate, setBuilderRate] = useState(20)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [dashboardTab, setDashboardTab] = useState<"active" | "built_products">("active")
  const [modal, setModal] = useState(false)
  const [modalStep, setModalStep] = useState<"select_product" | "add_components">("select_product")
  const [selectedSku, setSelectedSku] = useState<FinishedSKU | null>(null)
  const [bomLines, setBomLines] = useState<{
    component_sku_id: string
    sku?: SKU
    quantity: number
    unit_cost: number
    lead_time_days: number
    supplier_id: string
    notes: string
  }[]>([])
  const [laborMinutes, setLaborMinutes] = useState("0")
  const [laborRate, setLaborRate] = useState("20")
  const [componentSearch, setComponentSearch] = useState("")
  const [pickerTab, setPickerTab] = useState<"component" | "consumable">("component")
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ itemId: string; name: string } | null>(null)
  const [deleteBomConfirm, setDeleteBomConfirm] = useState<{ skuId: string; headerId: string; skuCode: string } | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)

    const [{ data: skuData }, { data: allSkuData }, { data: supplierData }, { data: headersData }, { data: itemsData }, { data: settingsData }] = await Promise.all([
      supabase.from("skus").select("id, sku_code, name, unit_cost, msrp, sku_type, is_active, product:products(name, category)").eq("is_active", true).order("sku_code"),
      supabase.from("skus").select("id, sku_code, name, unit_cost, msrp, sku_type, unit_of_measure, cost_per_uom").eq("is_active", true).order("sku_code"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("bom_headers").select("*").eq("is_active", true),
      supabase.from("bom_items").select(`
        *,
        component:skus!bom_items_component_sku_id_fkey(id, sku_code, name, unit_cost, sku_type, unit_of_measure, cost_per_uom),
        supplier:suppliers!bom_items_supplier_id_fkey(name)
      `),
      supabase.from("settings").select("key, value").eq("key", "builder_hourly_rate")
    ])

    if (allSkuData) setAllSkus(allSkuData as SKU[])
    if (supplierData) setSuppliers(supplierData)
    if (settingsData?.[0]) setBuilderRate(parseFloat(settingsData[0].value))

    if (skuData && headersData && itemsData) {
      // A product needs a BoM if it's physically assembled from parts — that's
      // a property of its product category (built_club, head_only), not its
      // sku_type. sku_type still matters for the component/consumable picker,
      // but category is the correct gate for "does this need a BoM at all."
      const buildableCategories = ["built_club", "head_only"]
      const merged: FinishedSKU[] = skuData
        .filter((sku: any) => buildableCategories.includes(sku.product?.category))
        .map((sku: any) => {
          const header = headersData.find((h: BomHeader) => h.sku_id === sku.id)
          const items = header ? itemsData.filter((i: BomItem) => i.bom_id === header.id) : []
          return { ...sku, bom_header: header, bom_items: items }
        })
      setFinishedSkus(merged)
    }

    setLoading(false)
  }

  function openNewBom() {
    setSelectedSku(null)
    setBomLines([])
    setLaborMinutes("0")
    setLaborRate(String(builderRate))
    setComponentSearch("")
    setPickerTab("component")
    setModalStep("select_product")
    setModal(true)
  }

  function openEditBom(sku: FinishedSKU) {
    setSelectedSku(sku)
    setBomLines((sku.bom_items || []).map(i => ({
      component_sku_id: i.component_sku_id || "",
      sku: i.component as SKU,
      quantity: i.quantity,
      unit_cost: i.unit_cost || i.component?.unit_cost || 0,
      lead_time_days: i.lead_time_days || 0,
      supplier_id: i.supplier_id || "",
      notes: i.notes || ""
    })))
    setLaborMinutes(String(sku.bom_header?.labor_minutes || 0))
    setLaborRate(String(sku.bom_header?.labor_rate_per_hour || builderRate))
    setPickerTab("component")
    setModalStep("add_components")
    setModal(true)
  }

  function selectSkuForBom(sku: FinishedSKU) {
    setSelectedSku(sku)
    setBomLines((sku.bom_items || []).map(i => ({
      component_sku_id: i.component_sku_id || "",
      sku: i.component as SKU,
      quantity: i.quantity,
      unit_cost: i.unit_cost || i.component?.unit_cost || 0,
      lead_time_days: i.lead_time_days || 0,
      supplier_id: i.supplier_id || "",
      notes: i.notes || ""
    })))
    setLaborMinutes(String(sku.bom_header?.labor_minutes || 0))
    setLaborRate(String(sku.bom_header?.labor_rate_per_hour || builderRate))
    setPickerTab("component")
    setModalStep("add_components")
  }

  function addComponent(sku: SKU) {
    const existing = bomLines.find(l => l.component_sku_id === sku.id)
    if (existing) {
      setBomLines(prev => prev.map(l => l.component_sku_id === sku.id ? { ...l, quantity: l.quantity + 1 } : l))
    } else {
      const defaultCost = sku.sku_type === "consumable" ? (sku.cost_per_uom || 0) : (sku.unit_cost || 0)
      setBomLines(prev => [...prev, {
        component_sku_id: sku.id,
        sku,
        quantity: sku.sku_type === "consumable" ? 1 : 1,
        unit_cost: defaultCost,
        lead_time_days: 0,
        supplier_id: "",
        notes: ""
      }])
    }
  }

  function removeLine(id: string) {
    setBomLines(prev => prev.filter(l => l.component_sku_id !== id))
  }

  function updateLine(id: string, key: string, value: any) {
    setBomLines(prev => prev.map(l => l.component_sku_id === id ? { ...l, [key]: value } : l))
  }

  function getMaterialCost() {
    return bomLines.reduce((sum, l) => sum + (l.unit_cost || 0) * l.quantity, 0)
  }

  function getLaborCost() {
    const mins = parseFloat(laborMinutes) || 0
    const rate = parseFloat(laborRate) || 0
    return (mins / 60) * rate
  }

  function getTotalCogs() {
    return getMaterialCost() + getLaborCost()
  }

  async function handleSaveBom() {
    if (!selectedSku || bomLines.length === 0) return
    setSaving(true)

    const mins = parseFloat(laborMinutes) || 0
    const rate = parseFloat(laborRate) || 0

    let headerId = selectedSku.bom_header?.id

    if (headerId) {
      await supabase.from("bom_headers").update({
        labor_minutes: mins,
        labor_rate_per_hour: rate,
        updated_at: new Date().toISOString()
      }).eq("id", headerId)
    } else {
      const { data: newHeader } = await supabase.from("bom_headers").insert({
        sku_id: selectedSku.id,
        version: 1,
        is_active: true,
        labor_minutes: mins,
        labor_rate_per_hour: rate
      }).select().single()
      headerId = newHeader?.id
    }

    if (!headerId) { setSaving(false); return }

    await supabase.from("bom_items").delete().eq("bom_id", headerId)
    await supabase.from("bom_items").insert(
      bomLines.map(line => ({
        bom_id: headerId,
        component_sku_id: line.component_sku_id || null,
        quantity: line.quantity,
        unit_cost: line.unit_cost || null,
        lead_time_days: line.lead_time_days || null,
        supplier_id: line.supplier_id || null,
        notes: line.notes || null
      }))
    )

    setSaving(false)
    setModal(false)
    loadAll()
  }

  async function handleDeleteItem(itemId: string) {
    await supabase.from("bom_items").delete().eq("id", itemId)
    setDeleteConfirm(null)
    loadAll()
  }

  async function handleDeleteBom(headerId: string) {
    await supabase.from("bom_items").delete().eq("bom_id", headerId)
    await supabase.from("bom_headers").delete().eq("id", headerId)
    setDeleteBomConfirm(null)
    loadAll()
  }

  const withBoms = finishedSkus.filter(s => s.bom_header)
  const withoutBoms = finishedSkus.filter(s => !s.bom_header)

  const dashboardSkus = dashboardTab === "active" ? withBoms : finishedSkus

  const filteredSkus = dashboardSkus.filter(s =>
    !search ||
    s.sku_code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const pickerSkus = allSkus.filter(s => s.sku_type === pickerTab)
  const filteredComponents = pickerSkus.filter(s =>
    !componentSearch ||
    s.sku_code.toLowerCase().includes(componentSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(componentSearch.toLowerCase())
  )
  const componentTypeCount = allSkus.filter(s => s.sku_type === "component").length
  const consumableTypeCount = allSkus.filter(s => s.sku_type === "consumable").length

  const inputStyle = {
    background: "#13161A",
    border: "0.5px solid rgba(255,255,255,0.12)",
    color: "#fff",
    padding: "7px 10px",
    fontSize: "12px",
    fontFamily: "'Barlow', sans-serif",
    outline: "none",
    boxSizing: "border-box" as const
  }

  const labelStyle = {
    display: "block" as const,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "#555",
    marginBottom: "4px"
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Bill of Materials</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>
            Component breakdowns, labor costs, and COGS per built product
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search built products..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }} />
          </div>
          <button onClick={openNewBom}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add New BoM
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {[
          { label: "Built Products", value: finishedSkus.length.toString(), color: "#fff" },
          { label: "BoMs Defined", value: withBoms.length.toString(), color: "#5A9E5A" },
          { label: "Missing BoMs", value: withoutBoms.length.toString(), color: withoutBoms.length > 0 ? "#C4A93A" : "#5A9E5A" },
        ].map(s => (
          <div key={s.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{s.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {[
          { key: "active", label: `Active BoMs (${withBoms.length})` },
          { key: "built_products", label: `Built Products (${finishedSkus.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setDashboardTab(t.key as any)}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: dashboardTab === t.key ? "#fff" : "#555", borderBottom: dashboardTab === t.key ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
            {t.label}
          </button>
        ))}
      </div>

      {!loading && finishedSkus.length === 0 && (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.08)", borderLeft: "3px solid #C4A93A", padding: "16px 20px" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#C4A93A", margin: "0 0 4px" }}>No Built Products Yet</p>
          <p style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
            Go to <strong style={{ color: "#aaa" }}>Inventory → SKUs</strong> and set the product's category to "Built Club" or "Head Only" to have it appear here.
          </p>
        </div>
      )}

      {!loading && dashboardTab === "active" && withBoms.length === 0 && finishedSkus.length > 0 && (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.08)", borderLeft: "3px solid #C4A93A", padding: "16px 20px" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#C4A93A", margin: "0 0 4px" }}>No Active BoMs Yet</p>
          <p style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
            Switch to the <strong style={{ color: "#aaa" }}>Built Products</strong> tab to create your first BoM.
          </p>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredSkus.map(sku => {
            const hasBom = !!sku.bom_header
            const isExpanded = expanded === sku.id
            const materialCost = (sku.bom_items || []).reduce((sum, i) => sum + (i.unit_cost || i.component?.unit_cost || 0) * i.quantity, 0)
            const laborCost = sku.bom_header ? ((sku.bom_header.labor_minutes / 60) * sku.bom_header.labor_rate_per_hour) : 0
            const totalCogs = materialCost + laborCost
            const margin = sku.msrp && sku.msrp > 0 && totalCogs > 0 ? ((sku.msrp - totalCogs) / sku.msrp * 100).toFixed(0) : null

            return (
              <div key={sku.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: `3px solid ${hasBom ? "#5A9E5A" : "#C4A93A"}` }}>
                <div onClick={() => setExpanded(isExpanded ? null : sku.id)}
                  style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 180px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{sku.sku_code}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{sku.name}</p>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: hasBom ? "#5A9E5A" : "#C4A93A", background: hasBom ? "rgba(90,158,90,0.1)" : "rgba(196,169,58,0.1)", padding: "3px 8px" }}>
                    {hasBom ? `${sku.bom_items?.length || 0} components` : "No BoM"}
                  </span>
                  <div style={{ flex: 1, display: "flex", gap: "24px" }}>
                    {hasBom && (
                      <>
                        <div>
                          <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Materials</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#CCC", margin: 0 }}>${materialCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Labor</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#CCC", margin: 0 }}>${laborCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>COGS/Unit</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#E8C84A", margin: 0 }}>${totalCogs.toFixed(2)}</p>
                        </div>
                        {sku.msrp && sku.msrp > 0 && (
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
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button onClick={e => { e.stopPropagation(); openEditBom(sku) }}
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "5px 12px", cursor: "pointer" }}>
                      {hasBom ? "Edit BoM" : "Create BoM"}
                    </button>
                    {hasBom && (
                      <button onClick={e => { e.stopPropagation(); setDeleteBomConfirm({ skuId: sku.id, headerId: sku.bom_header!.id, skuCode: sku.sku_code }) }}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#555", background: "transparent", border: "1px solid #333", padding: "5px 10px", cursor: "pointer" }}
                        title="Delete this BoM">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && hasBom && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>
                    <div style={{ display: "flex", gap: "24px", marginBottom: "12px", paddingBottom: "12px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Est. Build Time / Product</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#888", margin: 0 }}>{sku.bom_header?.labor_minutes || 0} min</p>
                      </div>
                      <div>
                        <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Labor Rate</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#888", margin: 0 }}>${sku.bom_header?.labor_rate_per_hour || 0}/hr</p>
                      </div>
                      <div>
                        <p style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Labor Cost/Unit</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#E8C84A", margin: 0 }}>${laborCost.toFixed(2)}</p>
                      </div>
                    </div>

                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Components</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {(sku.bom_items || []).map(item => (
                        <div key={item.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 90px 80px 80px 100px 40px", gap: "12px", alignItems: "center", padding: "8px 12px", background: "#22262B", border: "0.5px solid rgba(255,255,255,0.05)" }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{item.component?.sku_code}</p>
                          <p style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{item.component?.name}</p>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 6px", background: item.component?.sku_type === "consumable" ? "rgba(106,156,200,0.12)" : "rgba(196,169,58,0.1)", color: item.component?.sku_type === "consumable" ? "#6A9CC8" : "#C4A93A", justifySelf: "start" }}>
                            {item.component?.sku_type === "consumable" ? "Consumable" : "Component"}
                          </span>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff", margin: 0, textAlign: "center" }}>
                            {item.component?.sku_type === "consumable"
                              ? `${item.quantity} ${UOM_LABELS[item.component?.unit_of_measure || ""] || ""}`
                              : `× ${item.quantity}`}
                          </p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", color: "#666", margin: 0, textAlign: "right" }}>
                            ${(item.unit_cost || item.component?.unit_cost || item.component?.cost_per_uom || 0).toFixed(item.component?.sku_type === "consumable" ? 4 : 2)}
                          </p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#CCC", margin: 0, textAlign: "right" }}>${((item.unit_cost || item.component?.unit_cost || item.component?.cost_per_uom || 0) * item.quantity).toFixed(2)}</p>
                          <button onClick={() => setDeleteConfirm({ itemId: item.id, name: item.component?.name || "component" })}
                            style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "2px" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "32px", marginTop: "12px", paddingTop: "12px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Materials</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#CCC", margin: 0 }}>${materialCost.toFixed(2)}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Labor</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#CCC", margin: 0 }}>${laborCost.toFixed(2)}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Total COGS/Unit</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#E8C84A", margin: 0 }}>${totalCogs.toFixed(2)}</p>
                      </div>
                      {sku.msrp && sku.msrp > 0 && totalCogs > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Gross Margin</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#5A9E5A", margin: 0 }}>
                            ${(sku.msrp - totalCogs).toFixed(2)} ({margin}%)
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

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setModal(false)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", width: "100%", maxWidth: "960px", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", flexShrink: 0 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>
                  {modalStep === "select_product" ? "Step 1 of 2" : "Step 2 of 2"}
                </p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>
                  {modalStep === "select_product" ? "Select Built Product" : `Build BoM — ${selectedSku?.sku_code}`}
                </h2>
              </div>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><X size={20} /></button>
            </div>

            {modalStep === "select_product" && (
              <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
                <p style={{ fontSize: "13px", color: "#666", fontFamily: "'Barlow', sans-serif", marginBottom: "16px" }}>
                  Select a built product to create or edit its BoM. Only products categorized as "Built Club" or "Head Only" appear here.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {finishedSkus.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", color: "#444", fontSize: "13px", fontFamily: "'Barlow', sans-serif" }}>
                      No built products found. Go to SKUs and set the category to "Built Club" or "Head Only" first.
                    </div>
                  ) : (
                    finishedSkus.map(sku => (
                      <div
                        key={sku.id}
                        onClick={() => selectSkuForBom(sku)}
                        style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 16px", background: "#22262B", border: "0.5px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "border-color 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(169,30,34,0.4)"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.04em" }}>{sku.sku_code}</p>
                          <p style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{sku.name}</p>
                        </div>
                        {sku.msrp && (
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", color: "#555" }}>MSRP ${sku.msrp.toFixed(2)}</span>
                        )}
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                          color: sku.bom_header ? "#5A9E5A" : "#C4A93A",
                          background: sku.bom_header ? "rgba(90,158,90,0.1)" : "rgba(196,169,58,0.1)",
                          padding: "3px 8px"
                        }}>
                          {sku.bom_header ? `${sku.bom_items?.length || 0} components` : "No BoM"}
                        </span>
                        <span style={{ color: "#444", fontSize: "14px" }}>→</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {modalStep === "add_components" && selectedSku && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden" }}>

                <div style={{ borderRight: "0.5px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                      <button onClick={() => setPickerTab("component")}
                        style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "7px", cursor: "pointer", border: "none", background: pickerTab === "component" ? "rgba(196,169,58,0.18)" : "#13161A", color: pickerTab === "component" ? "#C4A93A" : "#555" }}>
                        Components ({componentTypeCount})
                      </button>
                      <button onClick={() => setPickerTab("consumable")}
                        style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "7px", cursor: "pointer", border: "none", background: pickerTab === "consumable" ? "rgba(106,156,200,0.18)" : "#13161A", color: pickerTab === "consumable" ? "#6A9CC8" : "#555" }}>
                        Consumables ({consumableTypeCount})
                      </button>
                    </div>
                    <div style={{ position: "relative" }}>
                      <Search size={12} color="#444" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }} />
                      <input placeholder={`Search ${pickerTab === "component" ? "components" : "consumables"}...`} value={componentSearch} onChange={e => setComponentSearch(e.target.value)}
                        style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "7px 10px 7px 26px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }} />
                    </div>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
                    {filteredComponents.length === 0 ? (
                      <div style={{ padding: "32px", textAlign: "center", color: "#444", fontSize: "12px", fontFamily: "'Barlow', sans-serif" }}>
                        No {pickerTab === "component" ? "components" : "consumables"} found. Go to SKUs and add some marked as "{pickerTab === "component" ? "Component" : "Consumable"}".
                      </div>
                    ) : filteredComponents.map(sku => {
                      const alreadyAdded = bomLines.some(l => l.component_sku_id === sku.id)
                      return (
                        <div key={sku.id} onClick={() => addComponent(sku)}
                          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", cursor: "pointer", background: alreadyAdded ? "rgba(169,30,34,0.05)" : "transparent", border: `0.5px solid ${alreadyAdded ? "rgba(169,30,34,0.2)" : "transparent"}`, marginBottom: "2px" }}
                          onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                          onMouseLeave={e => { if (!alreadyAdded) e.currentTarget.style.background = alreadyAdded ? "rgba(169,30,34,0.05)" : "transparent" }}
                        >
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: alreadyAdded ? "#A91E22" : "#CCC", margin: 0 }}>{sku.sku_code}</p>
                            <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0" }}>{sku.name}</p>
                          </div>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#555" }}>
                            {sku.sku_type === "consumable"
                              ? (sku.cost_per_uom ? `$${sku.cost_per_uom.toFixed(4)}/${UOM_LABELS[sku.unit_of_measure || ""] || "unit"}` : "—")
                              : (sku.unit_cost ? `$${sku.unit_cost.toFixed(2)}` : "—")}
                          </span>
                          <div style={{ width: "20px", height: "20px", background: alreadyAdded ? "#A91E22" : "#333", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Plus size={12} color="#fff" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", margin: 0 }}>
                        BoM for {selectedSku.sku_code} — {bomLines.length} line{bomLines.length !== 1 ? "s" : ""}
                      </p>
                      <button onClick={() => setModalStep("select_product")}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#555", background: "transparent", border: "1px solid #333", padding: "4px 10px", cursor: "pointer" }}>
                        ← Change
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div>
                        <label style={labelStyle}>Est. Build Time Per Product (minutes)</label>
                        <input type="number" value={laborMinutes} onChange={e => setLaborMinutes(e.target.value)}
                          style={{ ...inputStyle, width: "100%" }} placeholder="0" />
                      </div>
                      <div>
                        <label style={labelStyle}>Labor Rate ($/hr)</label>
                        <input type="number" value={laborRate} onChange={e => setLaborRate(e.target.value)}
                          style={{ ...inputStyle, width: "100%" }} placeholder={String(builderRate)} />
                      </div>
                    </div>
                    {parseFloat(laborMinutes) > 0 && (
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", color: "#E8C84A", margin: "6px 0 0", fontWeight: 700 }}>
                        Labor cost/unit: ${getLaborCost().toFixed(2)}
                      </p>
                    )}
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
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{line.sku?.sku_code}</p>
                                {line.sku?.sku_type === "consumable" && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "1px 5px", background: "rgba(106,156,200,0.15)", color: "#6A9CC8" }}>
                                    Consumable · {UOM_LABELS[line.sku?.unit_of_measure || ""] || ""}
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{line.sku?.name}</p>
                            </div>
                            <button onClick={() => removeLine(line.component_sku_id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "2px" }}>
                              <X size={14} />
                            </button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                            <div>
                              <label style={labelStyle}>
                                {line.sku?.sku_type === "consumable" ? `Amount Used (${UOM_LABELS[line.sku?.unit_of_measure || ""] || "units"})` : "Qty"}
                              </label>
                              <input type="number" step={line.sku?.sku_type === "consumable" ? "0.01" : "1"} style={{ ...inputStyle, width: "100%" }} value={line.quantity} min={0}
                                onChange={e => updateLine(line.component_sku_id, "quantity", parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                              <label style={labelStyle}>
                                {line.sku?.sku_type === "consumable" ? `Cost / ${UOM_LABELS[line.sku?.unit_of_measure || ""] || "unit"} ($)` : "Unit Cost ($)"}
                              </label>
                              <input type="number" style={{ ...inputStyle, width: "100%" }} value={line.unit_cost || ""} placeholder="0.00"
                                onChange={e => updateLine(line.component_sku_id, "unit_cost", parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                              <label style={labelStyle}>Lead Time (days)</label>
                              <input type="number" style={{ ...inputStyle, width: "100%" }} value={line.lead_time_days || ""} placeholder="0"
                                onChange={e => updateLine(line.component_sku_id, "lead_time_days", parseInt(e.target.value) || 0)} />
                            </div>
                          </div>
                          <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <select value={line.supplier_id} onChange={e => updateLine(line.component_sku_id, "supplier_id", e.target.value)}
                              style={{ ...inputStyle, flex: 1, marginRight: "8px" }}>
                              <option value="">No supplier</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#CCC", whiteSpace: "nowrap" }}>
                              ${((line.unit_cost || 0) * line.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ padding: "16px", borderTop: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ display: "flex", gap: "20px" }}>
                        <div>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Materials</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#CCC", margin: 0 }}>${getMaterialCost().toFixed(2)}</p>
                        </div>
                        <div>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Labor</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#CCC", margin: 0 }}>${getLaborCost().toFixed(2)}</p>
                        </div>
                        <div>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>Total COGS/Unit</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#E8C84A", margin: 0 }}>${getTotalCogs().toFixed(2)}</p>
                        </div>
                      </div>
                      {selectedSku.msrp && selectedSku.msrp > 0 && getTotalCogs() > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", margin: "0 0 2px" }}>vs MSRP ${selectedSku.msrp.toFixed(2)}</p>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#5A9E5A", margin: 0 }}>
                            {((selectedSku.msrp - getTotalCogs()) / selectedSku.msrp * 100).toFixed(0)}% margin
                          </p>
                        </div>
                      )}
                    </div>
                    <button onClick={handleSaveBom} disabled={saving || bomLines.length === 0}
                      style={{ width: "100%", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || bomLines.length === 0 ? "#333" : "#A91E22", border: "none", padding: "11px", cursor: saving ? "not-allowed" : "pointer" }}>
                      {saving ? "Saving..." : "Save BoM →"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "380px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>Remove Item?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>Remove <strong style={{ color: "#fff" }}>{deleteConfirm.name}</strong> from this BoM?</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDeleteItem(deleteConfirm.itemId)}
                style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {deleteBomConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setDeleteBomConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "420px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>Delete BoM?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px" }}>
              This will permanently delete the BoM for <strong style={{ color: "#fff" }}>{deleteBomConfirm.skuCode}</strong>, including all component lines.
            </p>
            <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>
              The SKU itself will not be affected — only the BoM definition will be removed.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteBomConfirm(null)}
                style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDeleteBom(deleteBomConfirm.headerId)}
                style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Delete BoM</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
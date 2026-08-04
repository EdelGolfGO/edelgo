"use client"

import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, Mail, Phone, MapPin, Pencil, Trash2, Factory as FactoryIcon, Upload, FileText, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Factory = {
  id: string
  name: string
  address_line1: string
  address_line2: string
  city: string
  state_province: string
  postal_code: string
  country: string
  phone: string
  email: string
  contact_name: string
  default_payment_terms: string
  default_shipment_method: string
  notes: string
  is_active: boolean
}

type FactoryDoc = {
  id: string
  factory_id: string
  name: string
  url: string
  category: string
  uploaded_at: string
}

type ProductRow = {
  sku_id: string
  sku_code: string
  name: string
  unit_cost: number
  freight_cost: number
  duties_cost: number
  other_landed_cost: number
  msrp: number
}

const emptyForm = {
  name: "", address_line1: "", address_line2: "", city: "", state_province: "", postal_code: "", country: "",
  phone: "", email: "", contact_name: "", default_payment_terms: "50% PO", default_shipment_method: "", notes: "", is_active: true,
}

const DOC_CATEGORIES = [
  { value: "price_sheet", label: "Price Sheet" },
  { value: "catalog", label: "Catalog" },
  { value: "certification", label: "Certification" },
  { value: "other", label: "Other" },
]

const DOC_CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  price_sheet: { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)" },
  catalog: { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  certification: { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
  other: { color: "#8B919A", bg: "rgba(255,255,255,0.06)" },
}

export default function FactoriesPage() {
  const [factories, setFactories] = useState<Factory[]>([])
  const [docsByFactory, setDocsByFactory] = useState<Record<string, FactoryDoc[]>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, "details" | "products" | "documents">>({})
  const [deleteConfirm, setDeleteConfirm] = useState<Factory | null>(null)
  const [search, setSearch] = useState("")
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [uploadCategory, setUploadCategory] = useState("price_sheet")

  // Products tab — SKUs linked to this factory via their "Made At (Factory)"
  // field, with editable landed-cost pricing that writes straight back to
  // skus.unit_cost / freight_cost / duties_cost / other_landed_cost. This is
  // now the canonical place to maintain a factory's price sheet as real data.
  const [productsByFactory, setProductsByFactory] = useState<Record<string, ProductRow[]>>({})
  const [productsLoaded, setProductsLoaded] = useState<Record<string, boolean>>({})
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Set<string>>>({})
  const [dirtyProducts, setDirtyProducts] = useState<Record<string, Set<string>>>({})
  const [savingProducts, setSavingProducts] = useState<string | null>(null)

  useEffect(() => { loadFactories() }, [])

  async function loadFactories() {
    setLoading(true)
    const supabase = createClient()
    const [{ data: factoriesData }, { data: docsData }] = await Promise.all([
      supabase.from("factories").select("*").order("name"),
      supabase.from("factory_documents").select("*").order("uploaded_at", { ascending: false }),
    ])
    if (factoriesData) setFactories(factoriesData)
    if (docsData) {
      const grouped: Record<string, FactoryDoc[]> = {}
      docsData.forEach((d: any) => {
        if (!grouped[d.factory_id]) grouped[d.factory_id] = []
        grouped[d.factory_id].push(d)
      })
      setDocsByFactory(grouped)
    }
    setLoading(false)
  }

  function openNew() {
    setForm(emptyForm)
    setEditId(null)
    setModal(true)
  }

  function openEdit(f: Factory) {
    setForm({
      name: f.name || "",
      address_line1: f.address_line1 || "",
      address_line2: f.address_line2 || "",
      city: f.city || "",
      state_province: f.state_province || "",
      postal_code: f.postal_code || "",
      country: f.country || "",
      phone: f.phone || "",
      email: f.email || "",
      contact_name: f.contact_name || "",
      default_payment_terms: f.default_payment_terms || "50% PO",
      default_shipment_method: f.default_shipment_method || "",
      notes: f.notes || "",
      is_active: f.is_active,
    })
    setEditId(f.id)
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (editId) {
      await supabase.from("factories").update(payload).eq("id", editId)
    } else {
      await supabase.from("factories").insert(payload)
    }
    setSaving(false)
    setModal(false)
    loadFactories()
  }

  async function handleDelete(f: Factory) {
    const supabase = createClient()
    await supabase.from("factories").delete().eq("id", f.id)
    setDeleteConfirm(null)
    loadFactories()
  }

  async function handleDocUpload(factory: Factory, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingFor(factory.id)
    const supabase = createClient()
    for (const file of files) {
      const path = `factories/${factory.id}/${Date.now()}-${file.name.replace(/\s/g, "_")}`
      const { error } = await supabase.storage.from("Documents").upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from("Documents").getPublicUrl(path)
        await supabase.from("factory_documents").insert({
          factory_id: factory.id,
          name: file.name,
          url: urlData.publicUrl,
          category: uploadCategory,
        })
      }
    }
    setUploadingFor(null)
    loadFactories()
  }

  async function handleDocDelete(doc: FactoryDoc) {
    const supabase = createClient()
    await supabase.from("factory_documents").delete().eq("id", doc.id)
    loadFactories()
  }

  async function loadProductsForFactory(factoryId: string) {
    if (productsLoaded[factoryId]) return
    const supabase = createClient()
    const { data } = await supabase
      .from("skus")
      .select("id, sku_code, name, unit_cost, freight_cost, duties_cost, other_landed_cost, msrp")
      .eq("factory_id", factoryId)
      .order("sku_code")
    const rows: ProductRow[] = (data || []).map((s: any) => ({
      sku_id: s.id,
      sku_code: s.sku_code,
      name: s.name,
      unit_cost: s.unit_cost || 0,
      freight_cost: s.freight_cost || 0,
      duties_cost: s.duties_cost || 0,
      other_landed_cost: s.other_landed_cost || 0,
      msrp: s.msrp || 0,
    }))
    setProductsByFactory(prev => ({ ...prev, [factoryId]: rows }))
    setProductsLoaded(prev => ({ ...prev, [factoryId]: true }))
  }

  function updateProductPricing(factoryId: string, skuId: string, key: "unit_cost" | "freight_cost" | "duties_cost" | "other_landed_cost", value: number) {
    setProductsByFactory(prev => ({
      ...prev,
      [factoryId]: (prev[factoryId] || []).map(p => p.sku_id === skuId ? { ...p, [key]: value } : p),
    }))
    setDirtyProducts(prev => {
      const next = new Set(prev[factoryId] || [])
      next.add(skuId)
      return { ...prev, [factoryId]: next }
    })
  }

  async function saveProductPricing(factoryId: string) {
    setSavingProducts(factoryId)
    const supabase = createClient()
    const dirty = dirtyProducts[factoryId] || new Set()
    const rows = productsByFactory[factoryId] || []
    for (const skuId of dirty) {
      const row = rows.find(r => r.sku_id === skuId)
      if (!row) continue
      await supabase.from("skus").update({
        unit_cost: row.unit_cost,
        freight_cost: row.freight_cost,
        duties_cost: row.duties_cost,
        other_landed_cost: row.other_landed_cost,
        updated_at: new Date().toISOString(),
      }).eq("id", skuId)
    }
    setSavingProducts(null)
    setDirtyProducts(prev => ({ ...prev, [factoryId]: new Set() }))
  }

  function toggleProductSelect(factoryId: string, skuId: string) {
    setSelectedProducts(prev => {
      const next = new Set(prev[factoryId] || [])
      if (next.has(skuId)) next.delete(skuId)
      else next.add(skuId)
      return { ...prev, [factoryId]: next }
    })
  }

  function toggleSelectAllProducts(factoryId: string) {
    const rows = productsByFactory[factoryId] || []
    const current = selectedProducts[factoryId] || new Set()
    if (current.size === rows.length) {
      setSelectedProducts(prev => ({ ...prev, [factoryId]: new Set() }))
    } else {
      setSelectedProducts(prev => ({ ...prev, [factoryId]: new Set(rows.map(r => r.sku_id)) }))
    }
  }

  function exportProductsCSV(factoryId: string, factoryName: string) {
    const rows = productsByFactory[factoryId] || []
    const selected = selectedProducts[factoryId] || new Set()
    const toExport = rows.filter(r => selected.has(r.sku_id))
    if (toExport.length === 0) return

    const headers = ["SKU Code", "Name", "Unit Cost", "Freight", "Duties", "Other", "Landed Cost", "MSRP"]
    const csvRows = toExport.map(r => {
      const landed = r.unit_cost + r.freight_cost + r.duties_cost + r.other_landed_cost
      return [r.sku_code, r.name, r.unit_cost.toFixed(2), r.freight_cost.toFixed(2), r.duties_cost.toFixed(2), r.other_landed_cost.toFixed(2), landed.toFixed(2), r.msrp.toFixed(2)]
    })
    const csv = [headers, ...csvRows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${factoryName.replace(/\s+/g, "_")}_PriceSheet_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const filtered = factories.filter(f =>
    !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.contact_name?.toLowerCase().includes(search.toLowerCase())
  )

  const inputStyle = {
    width: "100%", background: "#23282E", border: "0.5px solid rgba(255,255,255,0.12)",
    color: "#fff", padding: "9px 12px", fontSize: "13px",
    fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const,
  }
  const labelStyle = {
    display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em",
    textTransform: "uppercase" as const, color: "#9BA0A8", marginBottom: "6px",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Operations</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Factories</h1>
          <p style={{ fontSize: "12px", color: "#B5BAC2", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>{factories.length} manufacturer{factories.length !== 1 ? "s" : ""} on file — used to auto-fill new POs</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input placeholder="Search factories..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#262B32", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "200px" }} />
          <button onClick={openNew} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add Factory
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#787E87", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <FactoryIcon size={28} color="#787E87" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#787E87", margin: "0 0 16px" }}>No Factories Yet</p>
          <button onClick={openNew} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer" }}>+ Add First Factory</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(f => {
            const isExpanded = expanded === f.id
            const tab = activeTab[f.id] || "details"
            const docs = docsByFactory[f.id] || []

            return (
              <div key={f.id} style={{ background: "#2E343C", border: "0.5px solid rgba(255,255,255,0.10)", borderLeft: `3px solid ${f.is_active ? "#6A9CC8" : "#3A3F47"}` }}>
                <div onClick={() => setExpanded(isExpanded ? null : f.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: "0 0 220px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>{f.name}</p>
                    {f.contact_name && <p style={{ fontSize: "11px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>{f.contact_name}</p>}
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: "20px" }}>
                    {f.email && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Mail size={11} color="#787E87" /><span style={{ fontSize: "12px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif" }}>{f.email}</span></div>}
                    {f.phone && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Phone size={11} color="#787E87" /><span style={{ fontSize: "12px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif" }}>{f.phone}</span></div>}
                    {f.city && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><MapPin size={11} color="#787E87" /><span style={{ fontSize: "12px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif" }}>{f.city}{f.country ? `, ${f.country}` : ""}</span></div>}
                  </div>
                  {docs.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <FileText size={11} color="#5A9E5A" />
                      <span style={{ fontSize: "11px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif" }}>{docs.length}</span>
                    </div>
                  )}
                  {!f.is_active && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#787E87", background: "rgba(255,255,255,0.06)", padding: "3px 10px" }}>Inactive</span>
                  )}
                  <ChevronDown size={16} color="#787E87" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", background: "#2B3038" }}>

                    {/* Tabs */}
                    <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.06)", padding: "0 20px" }}>
                      {(["details", "products", "documents"] as const).map(t => (
                        <button key={t} onClick={() => { setActiveTab(prev => ({ ...prev, [f.id]: t })); if (t === "products") loadProductsForFactory(f.id) }}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: tab === t ? "#fff" : "#8B919A", borderBottom: tab === t ? "2px solid #6A9CC8" : "2px solid transparent", marginBottom: "-1px" }}>
                          {t === "details" ? "Details" : t === "products" ? `Products${productsLoaded[f.id] ? ` (${(productsByFactory[f.id] || []).length})` : ""}` : `Documents${docs.length > 0 ? ` (${docs.length})` : ""}`}
                        </button>
                      ))}
                    </div>

                    {tab === "details" ? (
                      <div style={{ padding: "16px 20px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
                          <div>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87", margin: "0 0 4px" }}>Address</p>
                            <p style={{ fontSize: "13px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                              {f.address_line1}{f.address_line2 ? `, ${f.address_line2}` : ""}<br />
                              {f.city}{f.state_province ? `, ${f.state_province}` : ""} {f.postal_code}<br />
                              {f.country}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87", margin: "0 0 4px" }}>Default Terms</p>
                            <p style={{ fontSize: "13px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{f.default_payment_terms || "—"}</p>
                          </div>
                          <div>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#787E87", margin: "0 0 4px" }}>Default Shipment Method</p>
                            <p style={{ fontSize: "13px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{f.default_shipment_method || "—"}</p>
                          </div>
                        </div>
                        {f.notes && <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", marginBottom: "16px", fontStyle: "italic" }}>Note: {f.notes}</p>}
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button onClick={() => openEdit(f)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B5BAC2", background: "transparent", border: "1px solid #666C75", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => setDeleteConfirm(f)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    ) : tab === "products" ? (
                      <div style={{ padding: "16px 20px" }}>
                        <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "0 0 14px" }}>
                          SKUs with this factory selected under "Made At (Factory)" on the SKU page. Edit pricing here — it writes straight back to the SKU's cost fields used everywhere else (BoM cost, Sales History, COGS).
                        </p>

                        {!productsLoaded[f.id] ? (
                          <p style={{ fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif" }}>Loading products...</p>
                        ) : (productsByFactory[f.id] || []).length === 0 ? (
                          <p style={{ fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif", fontStyle: "italic" }}>
                            No SKUs are linked to this factory yet. Set "Made At (Factory)" to {f.name} on any SKU to have it appear here.
                          </p>
                        ) : (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                              <span style={{ fontSize: "12px", color: "#6A9CC8", fontFamily: "'Barlow', sans-serif" }}>
                                {(selectedProducts[f.id] || new Set()).size} of {(productsByFactory[f.id] || []).length} selected
                              </span>
                              <button onClick={() => exportProductsCSV(f.id, f.name)} disabled={(selectedProducts[f.id] || new Set()).size === 0}
                                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: (selectedProducts[f.id] || new Set()).size === 0 ? "#666C75" : "#fff", background: (selectedProducts[f.id] || new Set()).size === 0 ? "transparent" : "#5A9E5A", border: (selectedProducts[f.id] || new Set()).size === 0 ? "1px solid #3A3F47" : "none", padding: "7px 14px", cursor: (selectedProducts[f.id] || new Set()).size === 0 ? "not-allowed" : "pointer" }}>
                                Export CSV Price Sheet
                              </button>
                              {(dirtyProducts[f.id] || new Set()).size > 0 && (
                                <button onClick={() => saveProductPricing(f.id)} disabled={savingProducts === f.id}
                                  style={{ marginLeft: "auto", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: savingProducts === f.id ? "#666C75" : "#A91E22", border: "none", padding: "7px 14px", cursor: savingProducts === f.id ? "not-allowed" : "pointer" }}>
                                  {savingProducts === f.id ? "Saving..." : `Save Pricing (${(dirtyProducts[f.id] || new Set()).size})`}
                                </button>
                              )}
                            </div>

                            <div style={{ overflowX: "auto" }}>
                              <table style={{ width: "auto", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                <colgroup>
                                  <col style={{ width: "32px" }} />
                                  <col style={{ width: "90px" }} />
                                  <col style={{ width: "220px" }} />
                                  <col style={{ width: "82px" }} />
                                  <col style={{ width: "82px" }} />
                                  <col style={{ width: "82px" }} />
                                  <col style={{ width: "82px" }} />
                                  <col style={{ width: "92px" }} />
                                  <col style={{ width: "76px" }} />
                                </colgroup>
                                <thead>
                                  <tr style={{ background: "#23282E" }}>
                                    <th style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                                      <input type="checkbox"
                                        checked={(productsByFactory[f.id] || []).length > 0 && (selectedProducts[f.id] || new Set()).size === (productsByFactory[f.id] || []).length}
                                        onChange={() => toggleSelectAllProducts(f.id)}
                                        style={{ cursor: "pointer" }} />
                                    </th>
                                    {["SKU", "Name", "Unit Cost", "Freight", "Duties", "Other", "Landed Cost", "MSRP"].map(h => (
                                      <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#787E87", padding: "8px 10px", textAlign: h === "SKU" || h === "Name" ? "left" : "right", borderBottom: "0.5px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(productsByFactory[f.id] || []).map(row => {
                                    const landed = row.unit_cost + row.freight_cost + row.duties_cost + row.other_landed_cost
                                    const isSelected = (selectedProducts[f.id] || new Set()).has(row.sku_id)
                                    const cellInputStyle = { background: "#23282E", border: "0.5px solid rgba(255,255,255,0.08)", color: "#fff", padding: "4px 6px", fontSize: "11px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, outline: "none", width: "100%", maxWidth: "68px", textAlign: "right" as const, boxSizing: "border-box" as const }
                                    return (
                                      <tr key={row.sku_id} style={{ background: isSelected ? "rgba(106,156,200,0.05)" : "transparent" }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)" }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                                      >
                                        <td style={{ padding: "6px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                                          <input type="checkbox" checked={isSelected} onChange={() => toggleProductSelect(f.id, row.sku_id)} style={{ cursor: "pointer" }} />
                                        </td>
                                        <td style={{ padding: "6px 10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.sku_code}</td>
                                        <td style={{ padding: "6px 10px", fontSize: "11px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</td>
                                        {(["unit_cost", "freight_cost", "duties_cost", "other_landed_cost"] as const).map(key => (
                                          <td key={key} style={{ padding: "3px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                                            <input type="number" style={cellInputStyle} value={row[key] || ""} placeholder="0.00" onChange={e => updateProductPricing(f.id, row.sku_id, key, parseFloat(e.target.value) || 0)} />
                                          </td>
                                        ))}
                                        <td style={{ padding: "6px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff" }}>${landed.toFixed(2)}</span>
                                        </td>
                                        <td style={{ padding: "6px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#9BA0A8" }}>${row.msrp.toFixed(2)}</span>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: "16px 20px" }}>
                        <p style={{ fontSize: "12px", color: "#8B919A", fontFamily: "'Barlow', sans-serif", margin: "0 0 14px" }}>
                          Price sheets, catalogs, and certifications sent by this factory — for internal reference, not tied to any specific order.
                        </p>

                        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
                          <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} style={{ ...inputStyle, width: "180px", cursor: "pointer" }}>
                            {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#6A9CC8", border: "none", padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" multiple onChange={e => handleDocUpload(f, e)} style={{ display: "none" }} />
                            <Upload size={12} /> {uploadingFor === f.id ? "Uploading..." : "Upload Document"}
                          </label>
                        </div>

                        {docs.length === 0 ? (
                          <p style={{ fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif", fontStyle: "italic" }}>No documents uploaded yet</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {docs.map(doc => {
                              const catStyle = DOC_CATEGORY_COLORS[doc.category] || DOC_CATEGORY_COLORS.other
                              return (
                                <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#23282E", border: "0.5px solid rgba(255,255,255,0.08)", padding: "10px 14px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <FileText size={14} color={catStyle.color} />
                                    <span style={{ fontSize: "13px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif" }}>{doc.name}</span>
                                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: catStyle.color, background: catStyle.bg, padding: "2px 7px" }}>
                                      {DOC_CATEGORIES.find(c => c.value === doc.category)?.label}
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                    <span style={{ fontSize: "11px", color: "#666C75", fontFamily: "'Barlow', sans-serif" }}>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", textDecoration: "none" }}>
                                      <ExternalLink size={12} /> Open
                                    </a>
                                    <button onClick={() => handleDocDelete(doc)} style={{ background: "none", border: "none", color: "#666C75", cursor: "pointer", display: "flex" }}><X size={14} /></button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setModal(false)}>
          <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", width: "100%", maxWidth: "640px", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#20242A", position: "sticky", top: 0, zIndex: 10 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>Operations</p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>{editId ? "Edit Factory" : "New Factory"}</h2>
              </div>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "#8B919A", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>

              <div>
                <label style={labelStyle}>Factory / Manufacturer Name *</label>
                <input style={inputStyle} placeholder="Virage Tech Industrial Co, LTD." value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Contact Name</label>
                  <input style={inputStyle} placeholder="Charles Su" value={form.contact_name} onChange={e => setForm((f: any) => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} placeholder="886-6-5832098" value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" style={inputStyle} placeholder="charles.su@vtechgolf.com.tw" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "12px" }}>Address</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input style={inputStyle} placeholder="Address Line 1" value={form.address_line1} onChange={e => setForm((f: any) => ({ ...f, address_line1: e.target.value }))} />
                  <input style={inputStyle} placeholder="Address Line 2 (optional)" value={form.address_line2} onChange={e => setForm((f: any) => ({ ...f, address_line2: e.target.value }))} />
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
                    <input style={inputStyle} placeholder="City" value={form.city} onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))} />
                    <input style={inputStyle} placeholder="State/Province" value={form.state_province} onChange={e => setForm((f: any) => ({ ...f, state_province: e.target.value }))} />
                    <input style={inputStyle} placeholder="Postal Code" value={form.postal_code} onChange={e => setForm((f: any) => ({ ...f, postal_code: e.target.value }))} />
                  </div>
                  <input style={inputStyle} placeholder="Country" value={form.country} onChange={e => setForm((f: any) => ({ ...f, country: e.target.value }))} />
                </div>
              </div>

              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B919A", marginBottom: "12px" }}>PO Defaults</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Default Payment Terms</label>
                    <input style={inputStyle} placeholder="50% PO" value={form.default_payment_terms} onChange={e => setForm((f: any) => ({ ...f, default_payment_terms: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Default Shipment Method</label>
                    <input style={inputStyle} placeholder="DHL - Ship When Ready" value={form.default_shipment_method} onChange={e => setForm((f: any) => ({ ...f, default_shipment_method: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} placeholder="Any internal notes about this factory..." value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} style={{ cursor: "pointer" }} />
                <label htmlFor="is_active" style={{ fontSize: "13px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Active (appears in PO factory dropdown)</label>
              </div>

              <button onClick={handleSave} disabled={saving || !form.name} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || !form.name ? "#666C75" : "#A91E22", border: "none", padding: "13px", cursor: saving || !form.name ? "not-allowed" : "pointer" }}>
                {saving ? "Saving..." : editId ? "Update Factory →" : "Add Factory →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "380px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 8px" }}>Delete Factory?</h2>
            <p style={{ fontSize: "13px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px" }}>Are you sure you want to delete <strong style={{ color: "#fff" }}>{deleteConfirm.name}</strong>?</p>
            <p style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>Existing POs linked to this factory will keep their data, but won't be able to re-link to it.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B5BAC2", background: "transparent", border: "1px solid #666C75", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
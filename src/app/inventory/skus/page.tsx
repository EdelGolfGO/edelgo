"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, X, Search, Pencil, Trash2, Upload, Image, ChevronLeft, ChevronRight, Star } from "lucide-react"
import { createClient } from "@/lib/supabase"
import SkuConfiguratorOptions from "@/components/inventory/SkuConfiguratorOptions"

type SKUImage = {
  id: string
  sku_id: string
  url: string
  sort_order: number
  is_primary: boolean
}

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
  sku_type: string
  lead_time_days: number
  product_id: string
  image_url: string | null
  product: { name: string; category: string }
  images?: SKUImage[]
  consumable_category?: string | null
  unit_of_measure?: string | null
  cost_per_uom?: number | null
  package_size?: number | null
  package_cost?: number | null
}

type InventoryRecord = {
  id: string
  sku_id: string
  qty_on_hand: number
  qty_reserved: number
  qty_on_order: number
  min_stock: number
  max_stock: number
  reorder_qty: number
}

type Product = {
  id: string
  name: string
  category: string
}

const CATEGORIES = ["built_club", "head_only", "part", "accessory", "apparel"]

const CATEGORY_COLORS: Record<string, string> = {
  built_club: "#A91E22",
  head_only: "#6A9CC8",
  part: "#C4A93A",
  accessory: "#7AAB6A",
  apparel: "#888",
}

const TYPE_LABELS: Record<string, string> = {
  built_product: "Built Product",
  component: "Component",
  consumable: "Consumable",
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  built_product: { bg: "rgba(169,30,34,0.15)", color: "#E87878" },
  component: { bg: "rgba(196,169,58,0.1)", color: "#C4A93A" },
  consumable: { bg: "rgba(106,156,200,0.12)", color: "#6A9CC8" },
}

const emptySkuForm = {
  sku_code: "", name: "", description: "",
  unit_cost: "", msrp: "", wholesaler_price: "", fitter_price: "",
  lead_time_days: "", is_active: true, sku_type: "built_product", is_customizable: false, generic_parent_sku_id: "", factory_id: "", shopify_sku_code: "",
  product_id: "", new_product_name: "", new_product_category: "built_club",
  use_existing_product: true, product_category: "",
  consumable_category: "adhesive", unit_of_measure: "fl_oz",
  cost_per_uom: "", package_size: "", package_cost: "",
}

const CONSUMABLE_CATEGORIES = [
  { value: "adhesive", label: "Adhesive (glue, epoxy)" },
  { value: "tape_wrap", label: "Tape / Wrap" },
  { value: "paint_finish", label: "Paint / Finish" },
  { value: "solvent", label: "Solvent (mineral spirits, etc.)" },
  { value: "packaging", label: "Packaging Material" },
  { value: "other", label: "Other Consumable" },
]

const UNITS_OF_MEASURE = [
  { value: "fl_oz", label: "fl oz" },
  { value: "ml", label: "ml" },
  { value: "linear_ft", label: "linear ft" },
  { value: "linear_in", label: "linear in" },
  { value: "g", label: "g" },
  { value: "oz", label: "oz" },
  { value: "each", label: "each" },
]

export default function SKUsPage() {
  const [skus, setSkus] = useState<SKU[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [genericParentOptions, setGenericParentOptions] = useState<{ id: string; sku_code: string; name: string }[]>([])
  const [factoryOptions, setFactoryOptions] = useState<{ id: string; name: string }[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<{ ids: string[]; codes: string[] } | null>(null)
  const [inventory, setInventory] = useState<Record<string, InventoryRecord>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "built_product" | "component" | "consumable">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active")
  const [sortBy, setSortBy] = useState<"sku_asc" | "sku_desc" | "stock_high" | "stock_low" | "price_high" | "price_low">("sku_asc")
  const [skuModal, setSkuModal] = useState(false)
  const [editSkuId, setEditSkuId] = useState<string | null>(null)
  const [skuForm, setSkuForm] = useState<any>(emptySkuForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<SKU | null>(null)
  const [lightboxSku, setLightboxSku] = useState<SKU | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [existingImages, setExistingImages] = useState<SKUImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const [skusResult, invResult, productsResult, imagesResult, genericResult, factoriesResult] = await Promise.all([
      supabase.from("skus").select("*, product:products(name, category)").order("sku_code"),
      supabase.from("inventory").select("*"),
      supabase.from("products").select("id, name, category").order("name"),
      supabase.from("sku_images").select("*").order("sort_order"),
      supabase.from("skus").select("id, sku_code, name").eq("is_customizable", true).eq("is_active", true).order("name"),
      supabase.from("factories").select("id, name").eq("is_active", true).order("name"),
    ])

    if (genericResult.data) setGenericParentOptions(genericResult.data)
    if (factoriesResult.data) setFactoryOptions(factoriesResult.data)

    if (invResult.data) {
      const invMap: Record<string, InventoryRecord> = {}
      invResult.data.forEach((inv: InventoryRecord) => { invMap[inv.sku_id] = inv })
      setInventory(invMap)
    }
    if (productsResult.data) setProducts(productsResult.data)

    if (skusResult.data) {
      const imagesBySku: Record<string, SKUImage[]> = {}
      if (imagesResult.data) {
        imagesResult.data.forEach((img: SKUImage) => {
          if (!imagesBySku[img.sku_id]) imagesBySku[img.sku_id] = []
          imagesBySku[img.sku_id].push(img)
        })
      }
      setSkus(skusResult.data.map((sku: any) => ({ ...sku, images: imagesBySku[sku.id] || [] })))
    }

    setLoading(false)
  }

  function getPrimaryImage(sku: SKU): string | null {
    const imgs = sku.images || []
    const primary = imgs.find(i => i.is_primary)
    return primary?.url || imgs[0]?.url || sku.image_url || null
  }

  async function cycleSkuType(sku: SKU) {
    setTogglingId(sku.id)
    const supabase = createClient()
    const order = ["built_product", "component", "consumable"]
    const nextType = order[(order.indexOf(sku.sku_type) + 1) % order.length]
    await supabase.from("skus").update({ sku_type: nextType }).eq("id", sku.id)
    setSkus(prev => prev.map(s => s.id === sku.id ? { ...s, sku_type: nextType } : s))
    setTogglingId(null)
  }

  function openNewSku() {
    setSkuForm(emptySkuForm)
    setEditSkuId(null)
    setPendingImages([])
    setPendingPreviews([])
    setExistingImages([])
    setSkuModal(true)
  }

  function openEditSku(sku: SKU) {
    setSkuForm({
      ...emptySkuForm,
      sku_code: sku.sku_code,
      name: sku.name,
      description: sku.description || "",
      unit_cost: sku.unit_cost?.toString() || "",
      msrp: sku.msrp?.toString() || "",
      wholesaler_price: sku.wholesaler_price?.toString() || "",
      fitter_price: sku.fitter_price?.toString() || "",
      lead_time_days: sku.lead_time_days?.toString() || "",
      is_active: sku.is_active,
      sku_type: sku.sku_type || "built_product",
      is_customizable: (sku as any).is_customizable || false,
      generic_parent_sku_id: (sku as any).generic_parent_sku_id || "",
      factory_id: (sku as any).factory_id || "",
      shopify_sku_code: (sku as any).shopify_sku_code || "",
      product_id: sku.product_id || "",
      product_category: sku.product?.category || "",
      use_existing_product: true,
      consumable_category: sku.consumable_category || "adhesive",
      unit_of_measure: sku.unit_of_measure || "fl_oz",
      cost_per_uom: sku.cost_per_uom?.toString() || "",
      package_size: sku.package_size?.toString() || "",
      package_cost: sku.package_cost?.toString() || "",
    })
    setEditSkuId(sku.id)
    setPendingImages([])
    setPendingPreviews([])
    setExistingImages(sku.images || [])
    setSkuModal(true)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPendingImages(prev => [...prev, ...files])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setPendingPreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  function removePendingImage(index: number) {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
    setPendingPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function removeExistingImage(img: SKUImage) {
    const supabase = createClient()
    await supabase.from("sku_images").delete().eq("id", img.id)
    setExistingImages(prev => prev.filter(i => i.id !== img.id))
  }

  async function setPrimaryImage(img: SKUImage) {
    const supabase = createClient()
    await supabase.from("sku_images").update({ is_primary: false }).eq("sku_id", img.sku_id)
    await supabase.from("sku_images").update({ is_primary: true }).eq("id", img.id)
    setExistingImages(prev => prev.map(i => ({ ...i, is_primary: i.id === img.id })))
  }

  async function uploadPendingImages(skuId: string): Promise<void> {
    if (!pendingImages.length) return
    setUploadingImages(true)
    const supabase = createClient()
    const currentCount = existingImages.length

    for (let i = 0; i < pendingImages.length; i++) {
      const file = pendingImages[i]
      const ext = file.name.split(".").pop()
      const path = `skus/${skuId}/${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from("product-images").getPublicUrl(path)
        await supabase.from("sku_images").insert({
          sku_id: skuId,
          url: data.publicUrl,
          sort_order: currentCount + i,
          is_primary: currentCount === 0 && i === 0,
        })
      }
    }
    setUploadingImages(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(visibleSkus: SKU[]) {
    setSelectedIds(prev => {
      const allSelected = visibleSkus.length > 0 && visibleSkus.every(s => prev.has(s.id))
      if (allSelected) {
        const next = new Set(prev)
        visibleSkus.forEach(s => next.delete(s.id))
        return next
      } else {
        const next = new Set(prev)
        visibleSkus.forEach(s => next.add(s.id))
        return next
      }
    })
  }

  async function handleBulkSetActive(isActive: boolean) {
    if (selectedIds.size === 0) return
    setBulkSaving(true)
    const supabase = createClient()
    await supabase.from("skus").update({ is_active: isActive, updated_at: new Date().toISOString() }).in("id", Array.from(selectedIds))
    setBulkSaving(false)
    setSelectedIds(new Set())
    loadAll()
  }

  // Permanent delete is only ever offered for SKUs that are already
  // inactive — this is a deliberate guardrail so an active, in-use SKU can
  // never be hard-deleted by mistake. Deactivating first is the required
  // step before a delete option even appears.
  async function handlePermanentDelete(skuIds: string[]) {
    setBulkSaving(true)
    const supabase = createClient()
    await supabase.from("skus").delete().in("id", skuIds)
    setBulkSaving(false)
    setSelectedIds(new Set())
    setPermanentDeleteConfirm(null)
    loadAll()
  }

  async function handleSaveSku() {
    setSaving(true)
    const supabase = createClient()

    let productId = skuForm.product_id
    if (!skuForm.use_existing_product && skuForm.new_product_name) {
      const { data: newProduct } = await supabase.from("products").insert({
        name: skuForm.new_product_name,
        category: skuForm.new_product_category,
        is_active: true
      }).select("id").single()
      if (newProduct) productId = newProduct.id
    }

    const payload: any = {
      sku_code: skuForm.sku_code,
      name: skuForm.name,
      description: skuForm.description || null,
      unit_cost: parseFloat(skuForm.unit_cost) || null,
      msrp: parseFloat(skuForm.msrp) || null,
      wholesaler_price: parseFloat(skuForm.wholesaler_price) || null,
      fitter_price: parseFloat(skuForm.fitter_price) || null,
      lead_time_days: parseInt(skuForm.lead_time_days) || 0,
      is_active: skuForm.is_active,
      sku_type: skuForm.sku_type || "built_product",
      is_customizable: skuForm.sku_type === "built_product" ? !!skuForm.is_customizable : false,
      generic_parent_sku_id: (!skuForm.is_customizable && skuForm.generic_parent_sku_id) ? skuForm.generic_parent_sku_id : null,
      factory_id: skuForm.factory_id || null,
      shopify_sku_code: skuForm.shopify_sku_code || null,
      product_id: productId || null,
      updated_at: new Date().toISOString(),
      consumable_category: skuForm.sku_type === "consumable" ? skuForm.consumable_category : null,
      unit_of_measure: skuForm.sku_type === "consumable" ? skuForm.unit_of_measure : null,
      cost_per_uom: skuForm.sku_type === "consumable" ? (parseFloat(skuForm.cost_per_uom) || null) : null,
      package_size: skuForm.sku_type === "consumable" ? (parseFloat(skuForm.package_size) || null) : null,
      package_cost: skuForm.sku_type === "consumable" ? (parseFloat(skuForm.package_cost) || null) : null,
    }

    let skuId = editSkuId

    if (editSkuId) {
      await supabase.from("skus").update(payload).eq("id", editSkuId)
      // Update product category for ALL SKUs under the same product
      if (skuForm.product_id && skuForm.product_category) {
        await supabase.from("products").update({ category: skuForm.product_category }).eq("id", skuForm.product_id)
      }
    } else {
      const { data: newSku } = await supabase.from("skus").insert(payload).select("id").single()
      if (newSku) {
        skuId = newSku.id
        await supabase.from("inventory").insert({
          sku_id: newSku.id, qty_on_hand: 0, qty_reserved: 0,
          qty_on_order: 0, min_stock: 5, max_stock: 50, reorder_qty: 20
        })
      }
    }

    if (skuId && pendingImages.length > 0) {
      await uploadPendingImages(skuId)
    }

    setSaving(false)
    setSkuModal(false)
    loadAll()
  }

  async function handleDeleteSku(sku: SKU) {
    const supabase = createClient()
    await supabase.from("skus").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", sku.id)
    setDeleteConfirm(null)
    loadAll()
  }

  const filtered = skus
    .filter(s => {
      if (typeFilter !== "all" && s.sku_type !== typeFilter) return false
      if (statusFilter === "active" && !s.is_active) return false
      if (statusFilter === "inactive" && s.is_active) return false
      if (search && !s.sku_code.toLowerCase().includes(search.toLowerCase()) && !s.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const stockA = inventory[a.id]?.qty_on_hand ?? 0
      const stockB = inventory[b.id]?.qty_on_hand ?? 0
      const priceA = a.msrp ?? 0
      const priceB = b.msrp ?? 0
      switch (sortBy) {
        case "sku_asc": return a.sku_code.localeCompare(b.sku_code)
        case "sku_desc": return b.sku_code.localeCompare(a.sku_code)
        case "stock_high": return stockB - stockA
        case "stock_low": return stockA - stockB
        case "price_high": return priceB - priceA
        case "price_low": return priceA - priceB
        default: return 0
      }
    })

  const statusFilteredSkus = skus.filter(s => {
    if (statusFilter === "active") return s.is_active
    if (statusFilter === "inactive") return !s.is_active
    return true
  })
  const builtCount = statusFilteredSkus.filter(s => s.sku_type === "built_product").length
  const componentCount = statusFilteredSkus.filter(s => s.sku_type === "component").length
  const consumableCount = statusFilteredSkus.filter(s => s.sku_type === "consumable").length
  const lightboxImages = lightboxSku ? (lightboxSku.images?.length ? lightboxSku.images.map(i => i.url) : lightboxSku.image_url ? [lightboxSku.image_url] : []) : []

  const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "9px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#666", marginBottom: "6px" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>SKUs</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
            {builtCount} built products · {componentCount} components · {consumableCount} consumables
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} color="#444" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px 8px 30px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 12px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", cursor: "pointer" }}>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All Statuses</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 12px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", cursor: "pointer" }}>
            <option value="sku_asc">SKU Code A–Z</option>
            <option value="sku_desc">SKU Code Z–A</option>
            <option value="stock_high">Stock: High to Low</option>
            <option value="stock_low">Stock: Low to High</option>
            <option value="price_high">MSRP: High to Low</option>
            <option value="price_low">MSRP: Low to High</option>
          </select>
          <button onClick={() => window.location.href = "/inventory/import"} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer" }}>
            Shopify Import
          </button>
          <button onClick={openNewSku} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add SKU
          </button>
        </div>
      </div>

      {/* Type filter tabs */}
      <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        {[
          { key: "all", label: `All (${statusFilteredSkus.length})` },
          { key: "built_product", label: `Built Products (${builtCount})` },
          { key: "component", label: `Components (${componentCount})` },
          { key: "consumable", label: `Consumables (${consumableCount})` },
        ].map(f => (
          <button key={f.key} onClick={() => setTypeFilter(f.key as any)}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", color: typeFilter === f.key ? "#fff" : "#555", borderBottom: typeFilter === f.key ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* SKU Table */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading SKUs...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 16px" }}>No SKUs Found</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={() => window.location.href = "/inventory/import"} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer" }}>Import from Shopify</button>
            <button onClick={openNewSku} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer" }}>+ Add SKU</button>
          </div>
        </div>
      ) : (
        <>
          {selectedIds.size > 0 && (() => {
            const selectedSkus = skus.filter(s => selectedIds.has(s.id))
            const allInactive = selectedSkus.length > 0 && selectedSkus.every(s => !s.is_active)
            return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.3)", padding: "10px 16px", marginBottom: "10px" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff", margin: 0 }}>
                {selectedIds.size} SKU{selectedIds.size !== 1 ? "s" : ""} selected
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => handleBulkSetActive(false)} disabled={bulkSaving}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "7px 14px", cursor: bulkSaving ? "not-allowed" : "pointer" }}>
                  {bulkSaving ? "Working..." : "Deactivate Selected"}
                </button>
                <button onClick={() => handleBulkSetActive(true)} disabled={bulkSaving}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A9E5A", background: "transparent", border: "1px solid rgba(90,158,90,0.4)", padding: "7px 14px", cursor: bulkSaving ? "not-allowed" : "pointer" }}>
                  Activate Selected
                </button>
                {allInactive && (
                  <button onClick={() => setPermanentDeleteConfirm({ ids: selectedSkus.map(s => s.id), codes: selectedSkus.map(s => s.sku_code) })} disabled={bulkSaving}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "#666C75", border: "1px solid rgba(255,255,255,0.2)", padding: "7px 14px", cursor: bulkSaving ? "not-allowed" : "pointer" }}>
                    Delete Permanently
                  </button>
                )}
                <button onClick={() => setSelectedIds(new Set())}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8B919A", background: "transparent", border: "1px solid #3A3F47", padding: "7px 14px", cursor: "pointer" }}>
                  Clear
                </button>
              </div>
            </div>
            )
          })()}
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1A1E22" }}>
                <th style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", width: "36px" }}>
                  <input type="checkbox"
                    checked={filtered.length > 0 && filtered.every(s => selectedIds.has(s.id))}
                    onChange={() => toggleSelectAll(filtered)}
                    style={{ cursor: "pointer" }} />
                </th>
                {["", "SKU Code", "Name", "Category", "Type", "On Hand", "Unit Cost", "MSRP", "Status", ""].map((h, i) => (
                  <th key={i} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", padding: "10px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(sku => {
                const inv = inventory[sku.id]
                const qtyOnHand = inv?.qty_on_hand ?? 0
                const isLow = inv && qtyOnHand <= inv.min_stock
                const isCritical = qtyOnHand <= 0
                const typeKey = sku.sku_type || "built_product"
                const typeStyle = TYPE_COLORS[typeKey] || TYPE_COLORS.built_product
                const primaryImage = getPrimaryImage(sku)
                const imageCount = sku.images?.length || (sku.image_url ? 1 : 0)

                return (
                  <tr key={sku.id}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", width: "36px" }}>
                      <input type="checkbox" checked={selectedIds.has(sku.id)} onChange={() => toggleSelect(sku.id)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", width: "56px" }}>
                      <div style={{ position: "relative", width: "40px" }}>
                        {primaryImage ? (
                          <div onClick={() => { setLightboxSku(sku); setLightboxIndex(0) }} style={{ width: "40px", height: "40px", cursor: "zoom-in" }}>
                            <img src={primaryImage} alt={sku.name} style={{ width: "40px", height: "40px", objectFit: "cover", display: "block" }} />
                          </div>
                        ) : (
                          <div style={{ width: "40px", height: "40px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Image size={14} color="#333" />
                          </div>
                        )}
                        {imageCount > 1 && (
                          <div style={{ position: "absolute", bottom: "-4px", right: "-10px", background: "#A91E22", borderRadius: "8px", minWidth: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: 700, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", padding: "0 3px" }}>
                            {imageCount}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>{sku.sku_code}</td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sku.name}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {sku.product?.category && (
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: CATEGORY_COLORS[sku.product.category] || "#888", background: `${CATEGORY_COLORS[sku.product.category] || "#888"}18`, padding: "2px 7px", whiteSpace: "nowrap" }}>
                          {sku.product.category.replace(/_/g, " ")}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <button onClick={() => cycleSkuType(sku)} disabled={togglingId === sku.id} title="Click to cycle: Built Product → Component → Consumable"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 8px", border: "none", cursor: togglingId === sku.id ? "wait" : "pointer", background: typeStyle.bg, color: typeStyle.color, opacity: togglingId === sku.id ? 0.5 : 1, whiteSpace: "nowrap" }}>
                        {TYPE_LABELS[typeKey] || "Built Product"}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: isCritical ? "#A91E22" : isLow ? "#C4A93A" : "#5A9E5A" }}>{qtyOnHand}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {sku.sku_type === "consumable"
                        ? (sku.cost_per_uom ? `$${sku.cost_per_uom.toFixed(4)}/${UNITS_OF_MEASURE.find(u => u.value === sku.unit_of_measure)?.label || sku.unit_of_measure}` : "—")
                        : (sku.unit_cost ? `$${sku.unit_cost.toFixed(2)}` : "—")}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {sku.sku_type === "consumable" ? "—" : (sku.msrp ? `$${sku.msrp.toFixed(2)}` : "—")}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: sku.is_active ? "#5A9E5A" : "#555", background: sku.is_active ? "rgba(90,158,90,0.1)" : "rgba(136,136,136,0.1)", padding: "2px 7px" }}>
                        {sku.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => openEditSku(sku)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: "2px" }}><Pencil size={13} /></button>
                        {sku.is_active ? (
                          <button onClick={() => setDeleteConfirm(sku)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "2px" }} title="Deactivate"><Trash2 size={13} /></button>
                        ) : (
                          <button onClick={() => setPermanentDeleteConfirm({ ids: [sku.id], codes: [sku.sku_code] })} style={{ background: "none", border: "none", color: "#A91E22", cursor: "pointer", padding: "2px" }} title="Delete permanently"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Lightbox with carousel */}
      {lightboxSku && lightboxImages.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setLightboxSku(null)}>
          <div style={{ maxWidth: "800px", width: "100%", padding: "20px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>{lightboxSku.sku_code}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>{lightboxSku.name}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {lightboxImages.length > 1 && (
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#555" }}>
                    {lightboxIndex + 1} / {lightboxImages.length}
                  </span>
                )}
                <button onClick={() => setLightboxSku(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}><X size={24} /></button>
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <img src={lightboxImages[lightboxIndex]} alt={lightboxSku.name} style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }} />
              {lightboxImages.length > 1 && (
                <>
                  <button onClick={() => setLightboxIndex(i => (i - 1 + lightboxImages.length) % lightboxImages.length)}
                    style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", padding: "8px", display: "flex" }}>
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => setLightboxIndex(i => (i + 1) % lightboxImages.length)}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", padding: "8px", display: "flex" }}>
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
            {lightboxImages.length > 1 && (
              <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "center" }}>
                {lightboxImages.map((url, i) => (
                  <div key={i} onClick={() => setLightboxIndex(i)}
                    style={{ width: "56px", height: "56px", cursor: "pointer", border: `2px solid ${i === lightboxIndex ? "#A91E22" : "transparent"}`, flexShrink: 0 }}>
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit SKU Modal */}
      {skuModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }} onClick={() => setSkuModal(false)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#161A1D", position: "sticky", top: 0, zIndex: 10 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>Inventory</p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>{editSkuId ? "Edit SKU" : "Add New SKU"}</h2>
              </div>
              <button onClick={() => setSkuModal(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Photos */}
              <div>
                <label style={labelStyle}>Product Photos</label>

                {existingImages.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {existingImages.map(img => (
                      <div key={img.id} style={{ position: "relative", width: "80px", height: "80px", flexShrink: 0 }}>
                        <img src={img.url} alt="" style={{ width: "80px", height: "80px", objectFit: "cover", display: "block" }} />
                        {img.is_primary && (
                          <div style={{ position: "absolute", top: "2px", left: "2px", background: "#A91E22", padding: "2px 4px", display: "flex", alignItems: "center" }}>
                            <Star size={8} color="#fff" fill="#fff" />
                          </div>
                        )}
                        <div style={{ position: "absolute", top: 0, right: 0, display: "flex", flexDirection: "column" }}>
                          <button onClick={() => removeExistingImage(img)}
                            style={{ background: "rgba(0,0,0,0.75)", border: "none", color: "#fff", cursor: "pointer", padding: "3px", display: "flex" }}>
                            <X size={10} />
                          </button>
                          {!img.is_primary && (
                            <button onClick={() => setPrimaryImage(img)} title="Set as primary"
                              style={{ background: "rgba(0,0,0,0.75)", border: "none", color: "#C4A93A", cursor: "pointer", padding: "3px", display: "flex" }}>
                              <Star size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pendingPreviews.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {pendingPreviews.map((preview, i) => (
                      <div key={i} style={{ position: "relative", width: "80px", height: "80px", flexShrink: 0 }}>
                        <img src={preview} alt="" style={{ width: "80px", height: "80px", objectFit: "cover", display: "block", opacity: 0.6 }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "8px", color: "#fff", fontWeight: 700, background: "rgba(0,0,0,0.5)", padding: "2px 4px" }}>NEW</span>
                        </div>
                        <button onClick={() => removePendingImage(i)}
                          style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.75)", border: "none", color: "#fff", cursor: "pointer", padding: "3px", display: "flex" }}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div onClick={() => fileInputRef.current?.click()}
                  style={{ border: "1px dashed rgba(255,255,255,0.12)", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", background: "#13161A" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(169,30,34,0.5)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                >
                  <Upload size={20} color="#444" />
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", margin: 0 }}>Click to add photos</p>
                  <p style={{ fontSize: "10px", color: "#333", fontFamily: "'Barlow', sans-serif", margin: 0 }}>JPG, PNG, WebP — select multiple at once</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: "none" }} />
                {existingImages.length > 0 && (
                  <p style={{ fontSize: "10px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "6px 0 0" }}>
                    ★ = primary photo shown in catalog. Click ☆ to set a different image as primary.
                  </p>
                )}
              </div>

              {/* SKU code + name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>SKU Code *</label>
                  <input style={inputStyle} placeholder="EAS-PUT-35-BLK" value={skuForm.sku_code} onChange={e => setSkuForm((f: any) => ({ ...f, sku_code: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>SKU Name *</label>
                  <input style={inputStyle} placeholder="EAS Putter 35" value={skuForm.name} onChange={e => setSkuForm((f: any) => ({ ...f, name: e.target.value }))} />
                </div>
              </div>

              {/* SKU Type */}
              <div>
                <label style={labelStyle}>SKU Type</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setSkuForm((f: any) => ({ ...f, sku_type: "built_product" }))}
                    style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px", cursor: "pointer", border: "none", background: skuForm.sku_type === "built_product" ? "rgba(169,30,34,0.2)" : "#13161A", color: skuForm.sku_type === "built_product" ? "#E87878" : "#555", borderLeft: skuForm.sku_type === "built_product" ? "2px solid #A91E22" : "2px solid transparent" }}>
                    Built Product
                  </button>
                  <button onClick={() => setSkuForm((f: any) => ({ ...f, sku_type: "component" }))}
                    style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px", cursor: "pointer", border: "none", background: skuForm.sku_type === "component" ? "rgba(196,169,58,0.15)" : "#13161A", color: skuForm.sku_type === "component" ? "#C4A93A" : "#555", borderLeft: skuForm.sku_type === "component" ? "2px solid #C4A93A" : "2px solid transparent" }}>
                    Component
                  </button>
                  <button onClick={() => setSkuForm((f: any) => ({ ...f, sku_type: "consumable" }))}
                    style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px", cursor: "pointer", border: "none", background: skuForm.sku_type === "consumable" ? "rgba(106,156,200,0.18)" : "#13161A", color: skuForm.sku_type === "consumable" ? "#6A9CC8" : "#555", borderLeft: skuForm.sku_type === "consumable" ? "2px solid #6A9CC8" : "2px solid transparent" }}>
                    Consumable
                  </button>
                </div>
                <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "6px 0 0" }}>
                  {skuForm.sku_type === "built_product" && "This SKU will appear in the BoM builder as a finished product."}
                  {skuForm.sku_type === "component" && "This SKU is a raw component used inside other products' BoMs."}
                  {skuForm.sku_type === "consumable" && "This SKU is a consumable (glue, tape, epoxy, etc.) used inside other products' BoMs but not individually tracked as a discrete part."}
                </p>
              </div>

              {/* Consumable-specific fields */}
              {skuForm.sku_type === "consumable" && (
                <div style={{ background: "#161A1D", border: "0.5px solid rgba(106,156,200,0.2)", borderLeft: "2px solid #6A9CC8", padding: "16px" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#6A9CC8", marginBottom: "12px" }}>Consumable Details</p>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Consumable Category</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={skuForm.consumable_category} onChange={e => setSkuForm((f: any) => ({ ...f, consumable_category: e.target.value }))}>
                      {CONSUMABLE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                    <div>
                      <label style={labelStyle}>Unit of Measure</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={skuForm.unit_of_measure} onChange={e => setSkuForm((f: any) => ({ ...f, unit_of_measure: e.target.value }))}>
                        {UNITS_OF_MEASURE.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Cost per {UNITS_OF_MEASURE.find(u => u.value === skuForm.unit_of_measure)?.label || "unit"} ($)</label>
                      <input type="number" style={inputStyle} placeholder="0.00" value={skuForm.cost_per_uom} onChange={e => setSkuForm((f: any) => ({ ...f, cost_per_uom: e.target.value }))} />
                    </div>
                  </div>

                  <p style={{ fontSize: "10px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "0 0 8px" }}>Or calculate cost-per-unit from a purchased package —</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "end" }}>
                    <div>
                      <label style={labelStyle}>Package Size ({UNITS_OF_MEASURE.find(u => u.value === skuForm.unit_of_measure)?.label || "units"})</label>
                      <input type="number" style={inputStyle} placeholder="8" value={skuForm.package_size} onChange={e => setSkuForm((f: any) => ({ ...f, package_size: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Package Cost ($)</label>
                      <input type="number" style={inputStyle} placeholder="12.00" value={skuForm.package_cost} onChange={e => setSkuForm((f: any) => ({ ...f, package_cost: e.target.value }))} />
                    </div>
                    <button
                      onClick={() => {
                        const size = parseFloat(skuForm.package_size)
                        const cost = parseFloat(skuForm.package_cost)
                        if (size > 0 && cost > 0) {
                          setSkuForm((f: any) => ({ ...f, cost_per_uom: (cost / size).toFixed(4) }))
                        }
                      }}
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", background: "rgba(106,156,200,0.12)", border: "1px solid rgba(106,156,200,0.3)", padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      Calculate →
                    </button>
                  </div>
                  {skuForm.cost_per_uom && (
                    <p style={{ fontSize: "11px", color: "#6A9CC8", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, margin: "10px 0 0" }}>
                      Current rate: ${parseFloat(skuForm.cost_per_uom).toFixed(4)} per {UNITS_OF_MEASURE.find(u => u.value === skuForm.unit_of_measure)?.label}
                    </p>
                  )}
                </div>
              )}

              {/* Product */}
              <div>
                <label style={labelStyle}>Product</label>
                {editSkuId ? (
                  // Editing existing SKU — show product name + editable category
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelStyle}>Product Group</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={skuForm.product_id} onChange={e => {
                        const p = products.find(p => p.id === e.target.value)
                        setSkuForm((f: any) => ({ ...f, product_id: e.target.value, product_category: p?.category || f.product_category }))
                      }}>
                        <option value="">Select product...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Category</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={skuForm.product_category} onChange={e => setSkuForm((f: any) => ({ ...f, product_category: e.target.value }))}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</option>)}
                      </select>
                      <p style={{ fontSize: "10px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "4px 0 0" }}>Updates all SKUs in this product group.</p>
                    </div>
                  </div>
                ) : (
                  // Adding new SKU — existing/new product toggle
                  <>
                    <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                      <button onClick={() => setSkuForm((f: any) => ({ ...f, use_existing_product: true }))} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: skuForm.use_existing_product ? "#fff" : "#555", background: skuForm.use_existing_product ? "#A91E22" : "transparent", border: skuForm.use_existing_product ? "none" : "1px solid #333", padding: "6px 12px", cursor: "pointer" }}>Existing Product</button>
                      <button onClick={() => setSkuForm((f: any) => ({ ...f, use_existing_product: false }))} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: !skuForm.use_existing_product ? "#fff" : "#555", background: !skuForm.use_existing_product ? "#A91E22" : "transparent", border: !skuForm.use_existing_product ? "none" : "1px solid #333", padding: "6px 12px", cursor: "pointer" }}>New Product</button>
                    </div>
                    {skuForm.use_existing_product ? (
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={skuForm.product_id} onChange={e => setSkuForm((f: any) => ({ ...f, product_id: e.target.value }))}>
                        <option value="">Select product...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category.replace("_", " ")})</option>)}
                      </select>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={labelStyle}>New Product Name</label>
                          <input style={inputStyle} placeholder="EAS Putter" value={skuForm.new_product_name} onChange={e => setSkuForm((f: any) => ({ ...f, new_product_name: e.target.value }))} />
                        </div>
                        <div>
                          <label style={labelStyle}>Category</label>
                          <select style={{ ...inputStyle, cursor: "pointer" }} value={skuForm.new_product_category} onChange={e => setSkuForm((f: any) => ({ ...f, new_product_category: e.target.value }))}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Pricing — hidden for consumables, which use their own unit-of-measure pricing above */}
              {skuForm.sku_type !== "consumable" && (
                <div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Pricing</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
                    {[
                      { label: "Unit Cost ($)", key: "unit_cost" },
                      { label: "MSRP ($)", key: "msrp" },
                      { label: "Wholesale ($)", key: "wholesaler_price" },
                      { label: "Fitter Price ($)", key: "fitter_price" },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={labelStyle}>{f.label}</label>
                        <input type="number" style={inputStyle} placeholder="0.00" value={skuForm[f.key]} onChange={e => setSkuForm((form: any) => ({ ...form, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Lead Time (days)</label>
                  <input type="number" style={inputStyle} placeholder="0" value={skuForm.lead_time_days} onChange={e => setSkuForm((f: any) => ({ ...f, lead_time_days: e.target.value }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "24px" }}>
                  <input type="checkbox" id="is_active" checked={skuForm.is_active} onChange={e => setSkuForm((f: any) => ({ ...f, is_active: e.target.checked }))} style={{ cursor: "pointer" }} />
                  <label htmlFor="is_active" style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Active SKU</label>
                </div>
                {skuForm.sku_type === "built_product" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "24px" }}>
                    <input type="checkbox" id="is_customizable" checked={skuForm.is_customizable || false} onChange={e => setSkuForm((f: any) => ({ ...f, is_customizable: e.target.checked }))} style={{ cursor: "pointer" }} />
                    <label htmlFor="is_customizable" style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Customizable (uses Work Orders)</label>
                  </div>
                )}
              </div>

              {skuForm.is_customizable && editSkuId && (
                <div style={{ background: "#161A1D", border: "0.5px solid rgba(169,30,34,0.25)", borderLeft: "2px solid #A91E22", padding: "16px" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Configurator Options</p>
                  <p style={{ fontSize: "11px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: "0 0 14px" }}>
                    Define what a customer or dealer can configure when ordering this product — Shaft, Grip, Ferrule, Hand, Length, etc.
                  </p>
                  <SkuConfiguratorOptions genericSkuId={editSkuId} />
                </div>
              )}

              {skuForm.is_customizable && !editSkuId && (
                <div style={{ background: "#161A1D", border: "0.5px dashed rgba(255,255,255,0.15)", padding: "14px 16px" }}>
                  <p style={{ fontSize: "12px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: 0, fontStyle: "italic" }}>
                    Save this SKU first to start defining its configurator options (Shaft, Grip, Ferrule, etc.).
                  </p>
                </div>
              )}

              {!skuForm.is_customizable && genericParentOptions.length > 0 && (
                <div style={{ background: "#161A1D", border: "0.5px solid rgba(196,169,58,0.2)", borderLeft: "2px solid #C4A93A", padding: "14px 16px" }}>
                  <label style={labelStyle}>Generic Parent Product (optional)</label>
                  <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={skuForm.generic_parent_sku_id} onChange={e => setSkuForm((f: any) => ({ ...f, generic_parent_sku_id: e.target.value }))}>
                    <option value="">No parent — standalone SKU</option>
                    {genericParentOptions.map(p => <option key={p.id} value={p.id}>{p.sku_code} — {p.name}</option>)}
                  </select>
                  <p style={{ fontSize: "11px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: "6px 0 0" }}>
                    If this is a specific head/variant (e.g. "SMS Pro Wedge — 50°F STD"), link it to its generic customizable product so orders for it route into the right Work Order build sheet.
                  </p>
                </div>
              )}

              <div style={{ background: "#161A1D", border: "0.5px solid rgba(106,156,200,0.2)", borderLeft: "2px solid #6A9CC8", padding: "14px 16px" }}>
                <label style={labelStyle}>Made At (Factory)</label>
                <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={skuForm.factory_id} onChange={e => setSkuForm((f: any) => ({ ...f, factory_id: e.target.value }))}>
                  <option value="">No factory linked</option>
                  {factoryOptions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <p style={{ fontSize: "11px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: "6px 0 0" }}>
                  Linking a factory lets this SKU appear in the Purchase Order builder when that factory is selected. Manage factories under Operations → Factories.
                </p>
              </div>

              <div style={{ background: "#161A1D", border: "0.5px solid rgba(196,169,58,0.2)", borderLeft: "2px solid #C4A93A", padding: "14px 16px" }}>
                <label style={labelStyle}>Shopify SKU Code (if different from above)</label>
                <input style={inputStyle} placeholder="e.g. the original Shopify variant SKU" value={skuForm.shopify_sku_code} onChange={e => setSkuForm((f: any) => ({ ...f, shopify_sku_code: e.target.value }))} />
                <p style={{ fontSize: "11px", color: "#787E87", fontFamily: "'Barlow', sans-serif", margin: "6px 0 0" }}>
                  Only needed if this SKU's code was renamed in EdelFit after Shopify orders were already using the old code. Incoming Shopify orders match against the main SKU Code first, then fall back to this field — so orders keep working without needing to update anything in Shopify itself.
                </p>
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} placeholder="Optional description..." value={skuForm.description} onChange={e => setSkuForm((f: any) => ({ ...f, description: e.target.value }))} />
              </div>

              <button onClick={handleSaveSku} disabled={saving || uploadingImages || !skuForm.sku_code || !skuForm.name}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || uploadingImages || !skuForm.sku_code || !skuForm.name ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: "pointer" }}>
                {uploadingImages ? "Uploading photos..." : saving ? "Saving..." : editSkuId ? "Update SKU →" : "Add SKU →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "380px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>Deactivate SKU?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px" }}>Deactivating <strong style={{ color: "#fff" }}>{deleteConfirm.sku_code}</strong> will hide it from all ordering flows and the BoM builder.</p>
            <p style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>The SKU and its history will be preserved. You can reactivate it at any time from the SKU list.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDeleteSku(deleteConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent delete confirm — only ever reachable for already-inactive SKUs */}
      {permanentDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setPermanentDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(169,30,34,0.4)", borderTop: "2px solid #A91E22", padding: "32px", width: "420px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#A91E22", margin: "0 0 8px" }}>
              Permanently Delete {permanentDeleteConfirm.ids.length > 1 ? `${permanentDeleteConfirm.ids.length} SKUs` : "SKU"}?
            </h2>
            <p style={{ fontSize: "13px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: "0 0 10px" }}>
              {permanentDeleteConfirm.codes.length <= 5 ? (
                <>This will permanently remove <strong style={{ color: "#fff" }}>{permanentDeleteConfirm.codes.join(", ")}</strong> from the database.</>
              ) : (
                <>This will permanently remove <strong style={{ color: "#fff" }}>{permanentDeleteConfirm.codes.length} SKUs</strong> from the database.</>
              )}
            </p>
            <p style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px", fontWeight: 700 }}>
              This cannot be undone. Use this only for mistakes — if the SKU has any real history (orders, BoMs, inventory transactions), deactivating instead of deleting is strongly recommended.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setPermanentDeleteConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handlePermanentDelete(permanentDeleteConfirm.ids)} disabled={bulkSaving} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: bulkSaving ? "#666C75" : "#A91E22", border: "none", padding: "10px", cursor: bulkSaving ? "not-allowed" : "pointer" }}>
                {bulkSaving ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, X, Search, Pencil, Trash2, Upload, ZoomIn, Image } from "lucide-react"
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
  product_id: string
  image_url: string | null
  product: { name: string; category: string }
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

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  built_club: { color: "#A91E22", bg: "rgba(169,30,34,0.1)" },
  head_only:  { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)" },
  component:  { color: "#C4A93A", bg: "rgba(196,169,58,0.1)" },
  accessory:  { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)" },
  apparel:    { color: "#888",    bg: "rgba(136,136,136,0.1)" },
}

const CATEGORIES = ["built_club", "head_only", "component", "accessory", "apparel"]

const emptySkuForm = {
  sku_code: "", name: "", description: "",
  unit_cost: "", msrp: "", wholesaler_price: "", fitter_price: "",
  lead_time_days: "", is_active: true,
  product_id: "", new_product_name: "", new_product_category: "component",
  use_existing_product: true,
}

export default function SKUsPage() {
  const [skus, setSkus] = useState<SKU[]>([])
  const [inventory, setInventory] = useState<Record<string, InventoryRecord>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [skuModal, setSkuModal] = useState(false)
  const [editSkuId, setEditSkuId] = useState<string | null>(null)
  const [skuForm, setSkuForm] = useState<any>(emptySkuForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<SKU | null>(null)
  const [lightboxSku, setLightboxSku] = useState<SKU | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const [skusResult, invResult, productsResult] = await Promise.all([
      supabase.from("skus").select("*, product:products(name, category)").order("sku_code"),
      supabase.from("inventory").select("*"),
      supabase.from("products").select("id, name, category").order("name"),
    ])
    if (skusResult.data) setSkus(skusResult.data as any)
    if (invResult.data) {
      const invMap: Record<string, InventoryRecord> = {}
      invResult.data.forEach((inv: InventoryRecord) => { invMap[inv.sku_id] = inv })
      setInventory(invMap)
    }
    if (productsResult.data) setProducts(productsResult.data)
    setLoading(false)
  }

  function openNewSku() {
    setSkuForm(emptySkuForm)
    setEditSkuId(null)
    setImageFile(null)
    setImagePreview(null)
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
      product_id: sku.product_id || "",
      use_existing_product: true,
    })
    setEditSkuId(sku.id)
    setImageFile(null)
    setImagePreview(sku.image_url || null)
    setSkuModal(true)
  }


  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadImage(skuId: string): Promise<string | null> {
    if (!imageFile) return null
    setUploadingImage(true)
    const supabase = createClient()
    const ext = imageFile.name.split(".").pop()
    const path = `skus/${skuId}.${ext}`
    const { error } = await supabase.storage.from("product-images").upload(path, imageFile, { upsert: true })
    if (error) { setUploadingImage(false); return null }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path)
    setUploadingImage(false)
    return data.publicUrl
  }

  async function handleSaveSku() {
    setSaving(true)
    const supabase = createClient()

    let productId = skuForm.product_id
    if (!skuForm.use_existing_product && skuForm.new_product_name) {
      const { data: newProduct } = await supabase.from("products").insert({ name: skuForm.new_product_name, category: skuForm.new_product_category, is_active: true }).select("id").single()
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
      product_id: productId || null,
      updated_at: new Date().toISOString(),
    }

    let skuId = editSkuId

    if (editSkuId) {
      await supabase.from("skus").update(payload).eq("id", editSkuId)
    } else {
      const { data: newSku } = await supabase.from("skus").insert(payload).select("id").single()
      if (newSku) {
        skuId = newSku.id
        await supabase.from("inventory").insert({ sku_id: newSku.id, qty_on_hand: 0, qty_reserved: 0, qty_on_order: 0, min_stock: 5, max_stock: 50, reorder_qty: 20 })
      }
    }

    // Upload image if new file selected
    if (imageFile && skuId) {
      const imageUrl = await uploadImage(skuId)
      if (imageUrl) {
        await supabase.from("skus").update({ image_url: imageUrl }).eq("id", skuId)
      }
    }

    setSaving(false)
    setSkuModal(false)
    loadAll()
  }


  async function handleDeleteSku(sku: SKU) {
    const supabase = createClient()
    if (sku.image_url) {
      const path = sku.image_url.split("/product-images/")[1]
      if (path) await supabase.storage.from("product-images").remove([path])
    }
    await supabase.from("inventory").delete().eq("sku_id", sku.id)
    await supabase.from("skus").delete().eq("id", sku.id)
    setDeleteConfirm(null)
    loadAll()
  }

  const categories = [...new Set(skus.map(s => s.product?.category).filter(Boolean))]
  const filtered = skus.filter(s => {
    if (categoryFilter !== "all" && s.product?.category !== categoryFilter) return false
    if (search && !s.sku_code.toLowerCase().includes(search.toLowerCase()) && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "9px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#666", marginBottom: "6px" }

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
          <button onClick={() => window.location.href = "/inventory/import"} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer" }}>
            Shopify Import
          </button>
          <button onClick={openNewSku} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add SKU
          </button>
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
      ) : filtered.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 16px" }}>No SKUs Yet</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={() => window.location.href = "/inventory/import"} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer" }}>Import from Shopify</button>
            <button onClick={openNewSku} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer" }}>+ Add SKU</button>
          </div>
        </div>
      ) : (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1A1E22" }}>
                {["", "SKU Code", "Name", "Category", "On Hand", "Min/Max", "Unit Cost", "MSRP", "Status", ""].map((h, i) => (
                  <th key={i} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", padding: "10px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(sku => {
                const cat = sku.product?.category || "component"
                const cc = CATEGORY_COLORS[cat] || CATEGORY_COLORS.component
                const inv = inventory[sku.id]
                const qtyOnHand = inv?.qty_on_hand ?? 0
                const isLow = inv && qtyOnHand <= inv.min_stock
                const isCritical = qtyOnHand <= 0

                return (
                  <tr key={sku.id}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Thumbnail */}
                    <td style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", width: "48px" }}>
                      {sku.image_url ? (
                        <div onClick={() => setLightboxSku(sku)} style={{ width: "40px", height: "40px", cursor: "zoom-in", position: "relative", flexShrink: 0 }}>
                          <img src={sku.image_url} alt={sku.name} style={{ width: "40px", height: "40px", objectFit: "cover", display: "block" }} />
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.4)" }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0)" }}
                          >
                            <ZoomIn size={16} color="#fff" />
                          </div>
                        </div>
                      ) : (
                        <div style={{ width: "40px", height: "40px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Image size={14} color="#333" />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>{sku.sku_code}</td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sku.name}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: cc.color, background: cc.bg, padding: "2px 7px" }}>
                        {cat.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: isCritical ? "#A91E22" : isLow ? "#C4A93A" : "#5A9E5A" }}>{qtyOnHand}</span>

                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "11px", color: "#555", fontFamily: "'Barlow Condensed', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {inv ? `${inv.min_stock} / ${inv.max_stock}` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#AAA", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {sku.unit_cost ? `$${sku.unit_cost.toFixed(2)}` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {sku.msrp ? `$${sku.msrp.toFixed(2)}` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: sku.is_active ? "#5A9E5A" : "#555", background: sku.is_active ? "rgba(90,158,90,0.1)" : "rgba(136,136,136,0.1)", padding: "2px 7px" }}>
                        {sku.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => openEditSku(sku)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: "2px" }}><Pencil size={13} /></button>
                        <button onClick={() => setDeleteConfirm(sku)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "2px" }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSku && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setLightboxSku(null)}>
          <div style={{ maxWidth: "800px", maxHeight: "80vh", width: "100%", padding: "20px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>{lightboxSku.sku_code}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>{lightboxSku.name}</p>
              </div>
              <button onClick={() => setLightboxSku(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}><X size={24} /></button>
            </div>
            <img src={lightboxSku.image_url!} alt={lightboxSku.name} style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", display: "block" }} />
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

              {/* Photo upload */}
              <div>
                <label style={labelStyle}>Product Photo</label>
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  {/* Preview */}
                  <div style={{ width: "100px", height: "100px", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Image size={28} color="#333" />
                    )}
                  </div>
                  {/* Upload area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{ flex: 1, border: "1px dashed rgba(255,255,255,0.12)", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", minHeight: "100px", background: "#13161A" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(169,30,34,0.5)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                  >
                    <Upload size={20} color="#444" />
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", margin: 0 }}>
                      {imageFile ? imageFile.name : "Click to upload photo"}
                    </p>
                    <p style={{ fontSize: "10px", color: "#333", fontFamily: "'Barlow', sans-serif", margin: 0 }}>JPG, PNG, WebP — max 5MB</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
                </div>
                {imagePreview && (
                  <button onClick={() => { setImageFile(null); setImagePreview(null) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "none", cursor: "pointer", marginTop: "6px", padding: 0 }}>
                    Remove photo
                  </button>
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

              {/* Product */}
              <div>
                <label style={labelStyle}>Product</label>
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
              </div>

              {/* Pricing */}
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Lead Time (days)</label>
                  <input type="number" style={inputStyle} placeholder="0" value={skuForm.lead_time_days} onChange={e => setSkuForm((f: any) => ({ ...f, lead_time_days: e.target.value }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "24px" }}>
                  <input type="checkbox" id="is_active" checked={skuForm.is_active} onChange={e => setSkuForm((f: any) => ({ ...f, is_active: e.target.checked }))} style={{ cursor: "pointer" }} />
                  <label htmlFor="is_active" style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Active SKU</label>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} placeholder="Optional description..." value={skuForm.description} onChange={e => setSkuForm((f: any) => ({ ...f, description: e.target.value }))} />
              </div>

              <button onClick={handleSaveSku} disabled={saving || uploadingImage || !skuForm.sku_code || !skuForm.name} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: saving || uploadingImage || !skuForm.sku_code || !skuForm.name ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: "pointer" }}>
                {uploadingImage ? "Uploading photo..." : saving ? "Saving..." : editSkuId ? "Update SKU →" : "Add SKU →"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#1E2226", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #A91E22", padding: "32px", width: "380px" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", color: "#fff", margin: "0 0 8px" }}>Delete SKU?</h2>
            <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 6px" }}>Delete <strong style={{ color: "#fff" }}>{deleteConfirm.sku_code}</strong>? This will also remove its inventory record and photo.</p>
            <p style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDeleteSku(deleteConfirm)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
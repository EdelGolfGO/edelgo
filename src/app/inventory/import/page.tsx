"use client"

import { useState, useCallback } from "react"
import { Upload, CheckCircle, AlertTriangle, X, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase"

type ParsedProduct = {
  handle: string
  title: string
  type: string
  status: string
  vendor: string
  sku: string
  price: number
  cost: number
  option1_name: string
  option1_value: string
  option2_name: string
  option2_value: string
  option3_name: string
  option3_value: string
  tags: string
}

type ImportResult = {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

function mapCategory(type: string): string {
  const t = type.toLowerCase()
  if (t.includes("putter") || t.includes("wedge") || t.includes("golf club") || t.includes("iron")) return "built_club"
  if (t.includes("headcover")) return "accessory"
  if (t.includes("grip")) return "component"
  if (t.includes("shaft")) return "component"
  if (t.includes("shirt") || t.includes("polo") || t.includes("headwear") || t.includes("hat") || t.includes("apparel")) return "apparel"
  if (t.includes("part") || t.includes("accessori") || t.includes("tool") || t.includes("bag") || t.includes("towel") || t.includes("divot")) return "accessory"
  return "accessory"
}

function parseCSV(text: string): ParsedProduct[] {
  const lines = text.split("\n")
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""))

  const getCol = (row: string[], name: string) => {
    const idx = headers.indexOf(name)
    if (idx === -1) return ""
    return (row[idx] || "").trim().replace(/^"|"$/g, "")
  }

  // Parse CSV respecting quoted fields
  function parseRow(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const products: ParsedProduct[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const row = parseRow(line)
    const sku = getCol(row, "Variant SKU").replace(/^'/, "").trim()
    const title = getCol(row, "Title")
    const status = getCol(row, "Status")
    const price = parseFloat(getCol(row, "Variant Price")) || 0
    const cost = parseFloat(getCol(row, "Cost per item")) || 0

    // Skip rows without SKU or title, and skip unlisted/archived
    if (!sku || !title || status === "unlisted" || status === "archived") continue
    // Skip test products
    if (title.includes("TEST") || title.includes("test") || title.includes("COPY")) continue

    products.push({
      handle: getCol(row, "Handle"),
      title,
      type: getCol(row, "Type"),
      status,
      vendor: getCol(row, "Vendor"),
      sku,
      price,
      cost,
      option1_name: getCol(row, "Option1 Name"),
      option1_value: getCol(row, "Option1 Value"),
      option2_name: getCol(row, "Option2 Name"),
      option2_value: getCol(row, "Option2 Value"),
      option3_name: getCol(row, "Option3 Name"),
      option3_value: getCol(row, "Option3 Value"),
      tags: getCol(row, "Tags"),
    })
  }

  return products
}

export default function ShopifyImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedProduct[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload")

  function handleFile(f: File) {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const products = parseCSV(text)
      setParsed(products)
      setStep("preview")
    }
    reader.readAsText(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith(".csv")) handleFile(f)
  }

  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const errors: string[] = []
    let imported = 0
    let skipped = 0

    // Group by handle to get unique products
    const productMap = new Map<string, ParsedProduct>()
    for (const p of parsed) {
      if (!productMap.has(p.handle)) productMap.set(p.handle, p)
    }

    // Import products first
    const productIdMap = new Map<string, string>()
    for (const [handle, p] of productMap) {
      const category = mapCategory(p.type)
      const { data: existingProduct } = await supabase
        .from("products")
        .select("id")
        .eq("name", p.title)
        .single()

      let productId: string
      if (existingProduct) {
        productId = existingProduct.id
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert({
            name: p.title,
            category,
            description: `Imported from Shopify. Type: ${p.type}`,
            is_active: p.status === "active",
          })
          .select("id")
          .single()

        if (error || !newProduct) {
          errors.push(`Failed to create product: ${p.title}`)
          continue
        }
        productId = newProduct.id
      }
      productIdMap.set(handle, productId)
    }

    // Import SKUs
    for (const p of parsed) {
      const productId = productIdMap.get(p.handle)
      if (!productId) { skipped++; continue }

      // Build variant name from options
      const optionParts = [
        p.option1_value && p.option1_name !== "Title" ? p.option1_value : "",
        p.option2_value ? p.option2_value : "",
        p.option3_value ? p.option3_value : "",
      ].filter(Boolean)

      const variantName = optionParts.length > 0
        ? `${p.title} — ${optionParts.join(" / ")}`
        : p.title

      // Check if SKU already exists
      const { data: existingSku } = await supabase
        .from("skus")
        .select("id")
        .eq("sku_code", p.sku)
        .single()

      if (existingSku) {
        // Update pricing
        await supabase.from("skus").update({
          msrp: p.price,
          unit_cost: p.cost || null,
          is_active: p.status === "active",
          updated_at: new Date().toISOString(),
        }).eq("id", existingSku.id)
        skipped++
        continue
      }

      const { data: newSku, error: skuError } = await supabase
        .from("skus")
        .insert({
          product_id: productId,
          sku_code: p.sku,
          name: variantName,
          msrp: p.price,
          unit_cost: p.cost || null,
          wholesaler_price: p.price * 0.6,
          fitter_price: p.price * 0.7,
          is_active: p.status === "active",
        })
        .select("id")
        .single()

      if (skuError || !newSku) {
        errors.push(`Failed to create SKU: ${p.sku} (${p.title})`)
        skipped++
        continue
      }

      // Create inventory record
      await supabase.from("inventory").upsert({
        sku_id: newSku.id,
        qty_on_hand: 0,
        qty_reserved: 0,
        qty_on_order: 0,
        min_stock: 5,
        max_stock: 50,
        reorder_qty: 20,
      }, { onConflict: "sku_id" })

      imported++
    }

    setImporting(false)
    setResult({ total: parsed.length, imported, skipped, errors })
    setStep("done")
  }

  // Group parsed by product for preview
  const groupedProducts = parsed.reduce((acc, p) => {
    if (!acc[p.handle]) acc[p.handle] = { title: p.title, type: p.type, status: p.status, skus: [] }
    acc[p.handle].skus.push(p)
    return acc
  }, {} as Record<string, { title: string; type: string; status: string; skus: ParsedProduct[] }>)

  const uniqueProducts = Object.keys(groupedProducts).length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Shopify SKU Import</h1>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
          Upload your Shopify products CSV to import all SKUs into EdelFit
        </p>
      </div>

      {/* Steps indicator */}
      <div style={{ display: "flex", gap: "0", alignItems: "center" }}>
        {[
          { key: "upload", label: "1. Upload CSV" },
          { key: "preview", label: "2. Review" },
          { key: "done", label: "3. Import" },
        ].map((s, i) => {
          const isActive = step === s.key
          const isDone = (step === "preview" && i === 0) || (step === "done" && i <= 1)
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: isActive ? "rgba(169,30,34,0.1)" : isDone ? "rgba(90,158,90,0.08)" : "transparent", border: `0.5px solid ${isActive ? "rgba(169,30,34,0.3)" : isDone ? "rgba(90,158,90,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                <div style={{ width: "20px", height: "20px", background: isActive ? "#A91E22" : isDone ? "#5A9E5A" : "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isDone ? <span style={{ color: "#fff", fontSize: "11px" }}>✓</span> : <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#fff" }}>{i + 1}</span>}
                </div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isActive ? "#fff" : isDone ? "#5A9E5A" : "#444" }}>{s.label}</span>
              </div>
              {i < 2 && <div style={{ width: "24px", height: "0.5px", background: "rgba(255,255,255,0.08)" }} />}
            </div>
          )
        })}
      </div>

      {/* STEP 1 — Upload */}
      {step === "upload" && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{ border: `1px dashed ${dragOver ? "#A91E22" : "rgba(255,255,255,0.15)"}`, background: dragOver ? "rgba(169,30,34,0.05)" : "#13161A", padding: "60px 20px", textAlign: "center", transition: "all 0.2s" }}
        >
          <Upload size={36} color={dragOver ? "#A91E22" : "#333"} style={{ margin: "0 auto 16px" }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", margin: "0 0 8px" }}>
            Drop your Shopify CSV here
          </p>
          <p style={{ fontSize: "13px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: "0 0 20px" }}>
            Export from Shopify Admin → Products → Export → All products → CSV
          </p>
          <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", padding: "10px 24px", cursor: "pointer" }}>
            <input type="file" accept=".csv" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} style={{ display: "none" }} />
            Choose File
          </label>
        </div>
      )}

      {/* STEP 2 — Preview */}
      {step === "preview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {[
              { label: "Products Found", value: uniqueProducts.toString(), color: "#fff" },
              { label: "Total SKUs", value: parsed.length.toString(), color: "#6A9CC8" },
              { label: "Active SKUs", value: parsed.filter(p => p.status === "active").length.toString(), color: "#5A9E5A" },
            ].map(s => (
              <div key={s.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "18px 20px" }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{s.label}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Info banner */}
          <div style={{ background: "rgba(106,156,200,0.08)", border: "0.5px solid rgba(106,156,200,0.2)", padding: "12px 16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <AlertTriangle size={14} color="#6A9CC8" style={{ flexShrink: 0, marginTop: "1px" }} />
            <div style={{ fontSize: "12px", color: "#6A9CC8", fontFamily: "'Barlow', sans-serif" }}>
              <strong>What will be imported:</strong> All active and draft products with SKU codes. Test products and unlisted items are excluded. Wholesale price will be set to 60% of MSRP and fitter price to 70% — you can adjust these later on the SKUs page.
              {parsed.filter(p => !p.cost).length > 0 && ` Note: ${parsed.filter(p => !p.cost).length} SKUs have no cost data in Shopify — cost fields will be blank.`}
            </div>
          </div>

          {/* Product preview table */}
          <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#666" }}>Preview — First 20 Products</span>
              <span style={{ fontSize: "11px", color: "#444", fontFamily: "'Barlow', sans-serif" }}>{uniqueProducts} total products</span>
            </div>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1A1E22", position: "sticky", top: 0 }}>
                    {["Product", "Type", "SKUs", "Price Range", "Status"].map(h => (
                      <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", padding: "8px 14px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedProducts).slice(0, 20).map(([handle, product]) => {
                    const prices = product.skus.map(s => s.price).filter(Boolean)
                    const minPrice = Math.min(...prices)
                    const maxPrice = Math.max(...prices)
                    const category = mapCategory(product.type)
                    return (
                      <tr key={handle}>
                        <td style={{ padding: "8px 14px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{product.title}</td>
                        <td style={{ padding: "8px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6A9CC8", background: "rgba(106,156,200,0.1)", padding: "2px 6px" }}>{category.replace("_", " ")}</span>
                        </td>
                        <td style={{ padding: "8px 14px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#AAA", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{product.skus.length}</td>
                        <td style={{ padding: "8px 14px", fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                          {prices.length > 0 ? (minPrice === maxPrice ? `$${minPrice.toFixed(2)}` : `$${minPrice.toFixed(2)} – $${maxPrice.toFixed(2)}`) : "—"}
                        </td>
                        <td style={{ padding: "8px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: product.status === "active" ? "#5A9E5A" : "#C4A93A", background: product.status === "active" ? "rgba(90,158,90,0.1)" : "rgba(196,169,58,0.1)", padding: "2px 6px" }}>
                            {product.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { setStep("upload"); setFile(null); setParsed([]) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>← Upload Different File</button>
            <button onClick={handleImport} disabled={importing} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: importing ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: importing ? "not-allowed" : "pointer" }}>
              {importing ? "Importing... this may take a moment" : `Import ${parsed.length} SKUs into EdelFit →`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Done */}
      {step === "done" && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: result.errors.length === 0 ? "rgba(90,158,90,0.08)" : "rgba(196,169,58,0.08)", border: `0.5px solid ${result.errors.length === 0 ? "rgba(90,158,90,0.3)" : "rgba(196,169,58,0.3)"}`, borderTop: `2px solid ${result.errors.length === 0 ? "#5A9E5A" : "#C4A93A"}`, padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <CheckCircle size={24} color={result.errors.length === 0 ? "#5A9E5A" : "#C4A93A"} />
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>
                Import {result.errors.length === 0 ? "Complete" : "Finished with Warnings"}
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              {[
                { label: "Total Processed", value: result.total.toString(), color: "#fff" },
                { label: "New SKUs Added", value: result.imported.toString(), color: "#5A9E5A" },
                { label: "Updated / Skipped", value: result.skipped.toString(), color: "#888" },
              ].map(s => (
                <div key={s.label}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", margin: "0 0 4px" }}>{s.label}</p>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.2)", padding: "16px" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A91E22", marginBottom: "8px" }}>Errors ({result.errors.length})</p>
              {result.errors.slice(0, 10).map((e, i) => (
                <p key={i} style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: "0 0 4px" }}>• {e}</p>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <a href="/inventory/skus" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px 20px", cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              View SKUs →
            </a>
            <a href="/inventory" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              View Inventory →
            </a>
            <button onClick={() => { setStep("upload"); setFile(null); setParsed([]); setResult(null) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
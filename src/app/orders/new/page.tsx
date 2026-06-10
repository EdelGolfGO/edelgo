"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Plus, X, ShoppingCart, ZoomIn, Image, ArrowLeft } from "lucide-react"

type SKU = {
  id: string
  sku_code: string
  name: string
  msrp: number
  wholesaler_price: number
  fitter_price: number
  is_active: boolean
  image_url: string | null
  product: { name: string; category: string }
}

type Dealer = {
  id: string
  name: string
  company: string
  pricing_tier?: string
}

type OrderItem = {
  id: string
  sku: SKU
  quantity: number
  unit_price: number
}

const CATEGORY_LABELS: Record<string, string> = {
  built_club: "Built Clubs",
  head_only: "Head Only",
  accessory: "Accessories",
  apparel: "Apparel",
  component: "Components",
}

const inputStyle = { width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "9px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#555", marginBottom: "5px" }

export default function NewOrderPage() {
  const router = useRouter()
  const [skus, setSkus] = useState<SKU[]>([])
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null)
  const [orderTypeSelection, setOrderTypeSelection] = useState("wholesale")
  const [manualEntry, setManualEntry] = useState(false)
  const [manualName, setManualName] = useState("")
  const [manualCompany, setManualCompany] = useState("")
  const [manualEmail, setManualEmail] = useState("")
  const [manualPO, setManualPO] = useState("")
  const [manualAddress1, setManualAddress1] = useState("")
  const [manualAddress2, setManualAddress2] = useState("")
  const [manualCity, setManualCity] = useState("")
  const [manualState, setManualState] = useState("")
  const [manualPostal, setManualPostal] = useState("")
  const [manualCountry, setManualCountry] = useState("US")
  const [manualAddressType, setManualAddressType] = useState("commercial")
  const [manualInstructions, setManualInstructions] = useState("")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [activeCategory, setActiveCategory] = useState("")
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [lightboxSku, setLightboxSku] = useState<SKU | null>(null)
  const [showAllSkus, setShowAllSkus] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const [skusResult, dealersResult] = await Promise.all([
      supabase.from("skus").select("*, product:products(name, category)").eq("is_active", true).order("sku_code"),
      supabase.from("dealers").select("id, name, company").order("name"),
    ])
    if (skusResult.data) {
      setSkus(skusResult.data as any)
      const cats = [...new Set((skusResult.data as any[]).map(s => s.product?.category).filter(Boolean))]
      if (cats.length > 0) setActiveCategory(cats[0])
    }
    if (dealersResult.data) setDealers(dealersResult.data)
    setLoading(false)
  }

  function getPrice(sku: SKU): number {
    const tier = selectedDealer?.pricing_tier || "wholesaler"
    if (tier === "fitter") return sku.fitter_price || sku.wholesaler_price || sku.msrp
    return sku.wholesaler_price || sku.msrp
  }

  function addToOrder(sku: SKU) {
    const existing = orderItems.find(i => i.sku.id === sku.id)
    if (existing) {
      setOrderItems(prev => prev.map(i => i.sku.id === sku.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setOrderItems(prev => [...prev, { id: `${sku.id}-${Date.now()}`, sku, quantity: 1, unit_price: getPrice(sku) }])
    }
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) setOrderItems(prev => prev.filter(i => i.id !== id))
    else setOrderItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i))
  }

  function getTotal() {
    return orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  }

  async function handleSubmit() {
    if (orderItems.length === 0) return
    setSubmitting(true)
    const supabase = createClient()
    const orderNumber = `EF-${Date.now().toString().slice(-6)}`
    const total = getTotal()

    const dealerName = manualEntry
      ? `${manualName}${manualCompany ? ` — ${manualCompany}` : ""}`
      : selectedDealer?.company || selectedDealer?.name || "Walk-in / Direct"

    const addressLine = manualEntry && manualAddress1
      ? `${manualAddress1}${manualAddress2 ? `, ${manualAddress2}` : ""}, ${manualCity}, ${manualState} ${manualPostal}, ${manualCountry} (${manualAddressType})`
      : ""

    const extraNotes = [
      manualEmail ? `Email: ${manualEmail}` : "",
      manualPO ? `Customer PO: ${manualPO}` : "",
      addressLine ? `Ship to: ${addressLine}` : "",
      manualInstructions ? `Special instructions: ${manualInstructions}` : "",
    ].filter(Boolean).join("\n")

    const { data: order, error } = await supabase.from("b2b_orders").insert({
      order_number: orderNumber,
      dealer_id: manualEntry ? null : selectedDealer?.id || null,
      dealer_name: dealerName,
      status: "approved",
      order_type: orderTypeSelection,
      total_amount: total,
      notes: [notes, extraNotes].filter(Boolean).join("\n"),
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    }).select("id").single()

    if (error || !order) { setSubmitting(false); return }

    await supabase.from("b2b_order_items").insert(
      orderItems.map(item => ({
        order_id: order.id,
        sku_id: item.sku.id,
        sku_code: item.sku.sku_code,
        product_name: item.sku.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        configuration: {},
      }))
    )

    setSubmitting(false)
    setSubmitted(true)
  }

  const displaySkus = showAllSkus ? skus : skus.filter((s: any) => s.is_orderable !== false)
  const categories = [...new Set(displaySkus.map(s => s.product?.category).filter(Boolean))]
  const filteredSkus = displaySkus.filter(s => {
    if (s.product?.category !== activeCategory) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.sku_code.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", background: "rgba(90,158,90,0.1)", border: "1px solid rgba(90,158,90,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>✓</div>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>Order Created</h2>
        <p style={{ fontSize: "14px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>Order has been created and auto-approved.</p>
        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <button onClick={() => router.push("/orders/all")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>View All Orders</button>
          <button onClick={() => { setSubmitted(false); setOrderItems([]); setManualName(""); setManualCompany(""); setManualEmail(""); setManualPO(""); setManualAddress1(""); setManualAddress2(""); setManualCity(""); setManualState(""); setManualPostal(""); setManualCountry("US"); setManualAddressType("commercial"); setManualInstructions(""); setSelectedDealer(null) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px 20px", cursor: "pointer" }}>New Order</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Header */}
      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <button onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#555", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px", padding: 0 }}>
          <ArrowLeft size={13} /> Back to Dashboard
        </button>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Orders</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>New Order</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555" }}>Show all SKUs</label>
            <input type="checkbox" checked={showAllSkus} onChange={e => setShowAllSkus(e.target.checked)} style={{ cursor: "pointer" }} />
          </div>
        </div>
      </div>

      {/* Dealer selector */}
      <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", margin: 0 }}>Order For</p>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#444" }}>Type:</span>
              {(["wholesale", "fitter", "retail", "international", "factory", "misc"] as const).map(t => (
                <button key={t} onClick={() => setOrderTypeSelection(t)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer", border: "none", background: orderTypeSelection === t ? "#A91E22" : "transparent", color: orderTypeSelection === t ? "#fff" : "#555", outline: orderTypeSelection === t ? "none" : "1px solid #2A2A2A" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setManualEntry(false)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: !manualEntry ? "#fff" : "#555", background: !manualEntry ? "#A91E22" : "transparent", border: !manualEntry ? "none" : "1px solid #333", padding: "5px 12px", cursor: "pointer" }}>
              Existing Dealer
            </button>
            <button onClick={() => setManualEntry(true)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: manualEntry ? "#fff" : "#555", background: manualEntry ? "#A91E22" : "transparent", border: manualEntry ? "none" : "1px solid #333", padding: "5px 12px", cursor: "pointer" }}>
              One-Time / Manual
            </button>
          </div>
        </div>

        {!manualEntry ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <select
              style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: selectedDealer ? "#fff" : "#555", padding: "10px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", cursor: "pointer" }}
              value={selectedDealer?.id || ""}
              onChange={e => {
                const dealer = dealers.find(d => d.id === e.target.value)
                setSelectedDealer(dealer || null)
              }}
            >
              <option value="">Select a dealer...</option>
              {dealers.map(d => <option key={d.id} value={d.id}>{d.company || d.name}</option>)}
            </select>
            {selectedDealer && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6A9CC8", background: "rgba(106,156,200,0.1)", padding: "4px 10px" }}>
                  {selectedDealer.pricing_tier || "Wholesaler"} pricing
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Row 1: Name, Company, Email, PO Number */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Customer Name *</label>
                <input style={inputStyle} placeholder="John Smith" value={manualName} onChange={e => setManualName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input style={inputStyle} placeholder="Golf Galaxy" value={manualCompany} onChange={e => setManualCompany(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email (optional)</label>
                <input style={inputStyle} placeholder="john@company.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>PO Number (optional)</label>
                <input style={inputStyle} placeholder="PO-12345" value={manualPO} onChange={e => setManualPO(e.target.value)} />
              </div>
            </div>
            {/* Row 2: Address */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Address Line 1</label>
                <input style={inputStyle} placeholder="123 Main St" value={manualAddress1} onChange={e => setManualAddress1(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Address Line 2 (optional)</label>
                <input style={inputStyle} placeholder="Suite 100" value={manualAddress2} onChange={e => setManualAddress2(e.target.value)} />
              </div>
            </div>
            {/* Row 3: City, State, Postal, Country, Type */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} placeholder="Denver" value={manualCity} onChange={e => setManualCity(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>State / Province</label>
                <input style={inputStyle} placeholder="CO" value={manualState} onChange={e => setManualState(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Postal Code</label>
                <input style={inputStyle} placeholder="80202" value={manualPostal} onChange={e => setManualPostal(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Country</label>
                <input style={inputStyle} placeholder="US" value={manualCountry} onChange={e => setManualCountry(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Address Type</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={manualAddressType} onChange={e => setManualAddressType(e.target.value)}>
                  <option value="commercial">Commercial</option>
                  <option value="residential">Residential</option>
                </select>
              </div>
            </div>
            {/* Special Instructions */}
            <div>
              <label style={labelStyle}>Special Instructions (optional)</label>
              <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} placeholder="Any special instructions for this order..." value={manualInstructions} onChange={e => setManualInstructions(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>

        {/* Catalog */}
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22" }}>
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }} />
          </div>
          <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", whiteSpace: "nowrap", color: activeCategory === cat ? "#fff" : "#555", borderBottom: activeCategory === cat ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
                {CATEGORY_LABELS[cat] || cat.replace("_", " ")} ({displaySkus.filter(s => s.product?.category === cat).length})
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#444", fontFamily: "'Barlow', sans-serif", fontSize: "13px" }}>Loading catalog...</div>
          ) : filteredSkus.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#444", fontFamily: "'Barlow', sans-serif", fontSize: "13px" }}>No products in this category</div>
          ) : (
            <div style={{ padding: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
              {filteredSkus.map(sku => {
                const price = getPrice(sku)
                const inOrder = orderItems.find(i => i.sku.id === sku.id)
                return (
                  <div key={sku.id} style={{ background: inOrder ? "rgba(169,30,34,0.05)" : "#1E2226", border: `0.5px solid ${inOrder ? "rgba(169,30,34,0.25)" : "rgba(255,255,255,0.06)"}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ position: "relative", height: "120px", background: "#13161A", flexShrink: 0 }}>
                      {sku.image_url ? (
                        <>
                          <img src={sku.image_url} alt={sku.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          <button onClick={() => setLightboxSku(sku)} style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <ZoomIn size={12} />
                          </button>
                        </>
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "6px" }}>
                          <Image size={24} color="#2A2A2A" />
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#2A2A2A" }}>No Photo</span>
                        </div>
                      )}
                      {inOrder && (
                        <div style={{ position: "absolute", top: "6px", left: "6px", background: "#A91E22", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", padding: "2px 6px" }}>
                          {inOrder.quantity} added
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.04em" }}>{sku.sku_code}</p>
                      <p style={{ fontSize: "11px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: 0, lineHeight: "1.3" }}>{sku.name}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "6px" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>${price.toFixed(2)}</p>
                        <button onClick={() => addToOrder(sku)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "5px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Plus size={11} /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Order sheet */}
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", position: "sticky", top: "20px" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", alignItems: "center", gap: "8px" }}>
            <ShoppingCart size={14} color="#666" />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666" }}>Order Sheet</span>
            <span style={{ marginLeft: "auto", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#444" }}>{orderItems.length} item{orderItems.length !== 1 ? "s" : ""}</span>
          </div>

          {orderItems.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", fontSize: "13px", color: "#444", fontFamily: "'Barlow', sans-serif" }}>
              No items yet.<br />Select products from the catalog.
            </div>
          ) : (
            <>
              <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                {orderItems.map(item => (
                  <div key={item.id} style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", display: "flex", gap: "10px", alignItems: "center" }}>
                    {item.sku.image_url ? (
                      <img src={item.sku.image_url} alt={item.sku.name} style={{ width: "36px", height: "36px", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: "36px", height: "36px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Image size={12} color="#333" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, color: "#A91E22", margin: 0 }}>{item.sku.sku_code}</p>
                      <p style={{ fontSize: "11px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sku.name}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                      <button onClick={() => updateQty(item.id, item.quantity - 1)} style={{ width: "20px", height: "20px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.12)", color: "#888", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff", width: "22px", textAlign: "center" }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)} style={{ width: "20px", height: "20px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.12)", color: "#888", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff", margin: 0, flexShrink: 0 }}>${(item.unit_price * item.quantity).toFixed(2)}</p>
                    <button onClick={() => setOrderItems(prev => prev.filter(i => i.id !== item.id))} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px 16px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                {(manualEntry ? manualName : selectedDealer) && (
                  <div style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.06)", padding: "8px 12px", marginBottom: "10px" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", margin: "0 0 2px" }}>Order for</p>
                    <p style={{ fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: "0 0 2px" }}>
                      {manualEntry ? `${manualName}${manualCompany ? ` — ${manualCompany}` : ""}` : selectedDealer?.company || selectedDealer?.name}
                    </p>
                    {manualEntry && manualPO && <p style={{ fontSize: "11px", color: "#6A9CC8", fontFamily: "'Barlow Condensed', sans-serif", margin: "0 0 2px", fontWeight: 700, letterSpacing: "0.04em" }}>PO: {manualPO}</p>}
                    {manualEntry && manualAddress1 && <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{manualCity}, {manualState} · {manualAddressType}</p>}
                  </div>
                )}
                <textarea placeholder="Order notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", resize: "none", minHeight: "50px", boxSizing: "border-box" as const, marginBottom: "12px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#666" }}>Order Total</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff" }}>${getTotal().toFixed(2)}</span>
                </div>
                <button onClick={handleSubmit} disabled={submitting || (manualEntry && !manualName)} style={{ width: "100%", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: submitting || (manualEntry && !manualName) ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: submitting ? "not-allowed" : "pointer" }}>
                  {submitting ? "Creating..." : "Create Order →"}
                </button>
                <p style={{ fontSize: "10px", color: "#444", textAlign: "center", marginTop: "8px", fontFamily: "'Barlow', sans-serif" }}>Admin orders are auto-approved</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSku && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }} onClick={() => setLightboxSku(null)}>
          <div style={{ maxWidth: "700px", width: "100%", padding: "20px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", margin: "0 0 4px" }}>{lightboxSku.sku_code}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>{lightboxSku.name}</p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={() => { addToOrder(lightboxSku); setLightboxSku(null) }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "9px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Plus size={13} /> Add to Order
                </button>
                <button onClick={() => setLightboxSku(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}><X size={24} /></button>
              </div>
            </div>
            <img src={lightboxSku.image_url!} alt={lightboxSku.name} style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }} />
          </div>
        </div>
      )}
    </div>
  )
}
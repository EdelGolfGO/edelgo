"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Plus, X, ShoppingCart, ZoomIn, Image } from "lucide-react"

type SKU = {
  id: string
  sku_code: string
  name: string
  msrp: number
  wholesaler_price: number
  fitter_price: number
  distributor_price: number
  is_active: boolean
  is_orderable: boolean
  image_url: string | null
  product: { name: string; category: string }
}

type OrderItem = {
  id: string
  sku: SKU
  quantity: number
  unit_price: number
  notes: string
}

const CATEGORY_LABELS: Record<string, string> = {
  built_club: "Built Clubs",
  head_only: "Head Only",
  accessory: "Accessories",
  apparel: "Apparel",
}

export default function PortalOrderPage() {
  const router = useRouter()
  const [skus, setSkus] = useState<SKU[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [activeCategory, setActiveCategory] = useState("")
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [lightboxSku, setLightboxSku] = useState<SKU | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileResult, skusResult] = await Promise.all([
      supabase.from("profiles").select("*, dealer:dealers(*)").eq("id", user.id).single(),
      supabase.from("skus")
        .select("*, product:products(name, category)")
        .eq("is_active", true)
        .eq("is_orderable", true)
        .order("sku_code"),
    ])

    if (profileResult.data) setProfile(profileResult.data)
    if (skusResult.data) {
      setSkus(skusResult.data as any)
      // Set first available category as active
      const cats = [...new Set((skusResult.data as any[]).map(s => s.product?.category).filter(Boolean))]
      if (cats.length > 0) setActiveCategory(cats[0])
    }
    setLoading(false)
  }

  function getPriceForTier(sku: SKU): number {
    const tier = profile?.pricing_tier || "wholesaler"
    if (tier === "fitter") return sku.fitter_price || sku.wholesaler_price || sku.msrp
    if (tier === "distributor") return sku.distributor_price || sku.wholesaler_price || sku.msrp
    return sku.wholesaler_price || sku.msrp
  }

  function addToOrder(sku: SKU) {
    const existing = orderItems.find(i => i.sku.id === sku.id)
    if (existing) {
      setOrderItems(prev => prev.map(i => i.sku.id === sku.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setOrderItems(prev => [...prev, {
        id: `${sku.id}-${Date.now()}`,
        sku,
        quantity: 1,
        unit_price: getPriceForTier(sku),
        notes: "",
      }])
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const orderNumber = `EF-${Date.now().toString().slice(-6)}`
    const total = getTotal()

    const { data: order, error } = await supabase.from("b2b_orders").insert({
      order_number: orderNumber,
      dealer_id: profile?.dealer_id,
      dealer_name: profile?.dealer?.company || profile?.dealer?.name || profile?.full_name,
      status: "pending",
      order_type: profile?.dealer?.dealer_type || "wholesale",
      total_amount: total,
      notes,
      submitted_at: new Date().toISOString(),
      created_by: user.id,
    }).select("id").single()

    if (error || !order) { setSubmitting(false); return }

    const { error: itemsError } = await supabase.from("b2b_order_items").insert(
      orderItems.map(item => ({
        order_id: order.id,
        sku_id: item.sku.id,
        sku_code: item.sku.sku_code,
        product_name: item.sku.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        configuration: {},
      }))
    )
    if (itemsError) console.error("Items insert error:", itemsError)
    await supabase.from("portal_notifications").insert({
      type: "order_placed",
      title: `New Order from ${profile?.dealer?.company || profile?.full_name}`,
      message: `Order ${orderNumber} for $${total.toLocaleString()} — ${orderItems.length} line item${orderItems.length !== 1 ? "s" : ""}`,
      reference_id: order.id,
      reference_type: "b2b_order",
    })

    setSubmitting(false)
    setSubmitted(true)
    setOrderItems([])
  }

  const categories = [...new Set(skus.map(s => s.product?.category).filter(Boolean))]
  const filteredSkus = skus.filter(s => {
    if (s.product?.category !== activeCategory) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.sku_code.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", background: "rgba(90,158,90,0.1)", border: "1px solid rgba(90,158,90,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>✓</div>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: 0 }}>Order Submitted</h2>
        <p style={{ fontSize: "14px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0, maxWidth: "400px" }}>Your order has been submitted and is pending review by the Edel Golf team.</p>
        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <button onClick={() => router.push("/portal/orders")} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "10px 20px", cursor: "pointer" }}>View My Orders</button>
          <button onClick={() => setSubmitted(false)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px 20px", cursor: "pointer" }}>Place Another Order</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Header */}
      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Dealer Portal</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Place an Order</h1>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>
          Pricing shown is your {profile?.pricing_tier || "wholesale"} rate
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>

        {/* Left — catalog */}
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>

          {/* Search */}
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22" }}>
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 12px", fontSize: "13px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }} />
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", border: "none", background: "transparent", whiteSpace: "nowrap", color: activeCategory === cat ? "#fff" : "#555", borderBottom: activeCategory === cat ? "2px solid #A91E22" : "2px solid transparent", marginBottom: "-1px" }}>
                {CATEGORY_LABELS[cat] || cat.replace("_", " ")} ({skus.filter(s => s.product?.category === cat).length})
              </button>
            ))}
          </div>

          {/* SKU grid */}
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#444", fontFamily: "'Barlow', sans-serif", fontSize: "13px" }}>Loading catalog...</div>
          ) : filteredSkus.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#444", fontFamily: "'Barlow', sans-serif", fontSize: "13px" }}>No products in this category</div>
          ) : (
            <div style={{ padding: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
              {filteredSkus.map(sku => {
                const price = getPriceForTier(sku)
                const inOrder = orderItems.find(i => i.sku.id === sku.id)
                return (
                  <div key={sku.id} style={{ background: inOrder ? "rgba(169,30,34,0.05)" : "#1E2226", border: `0.5px solid ${inOrder ? "rgba(169,30,34,0.25)" : "rgba(255,255,255,0.06)"}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                    {/* Product image */}
                    <div style={{ position: "relative", height: "140px", background: "#13161A", flexShrink: 0 }}>
                      {sku.image_url ? (
                        <>
                          <img src={sku.image_url} alt={sku.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          <button
                            onClick={() => setLightboxSku(sku)}
                            style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", padding: "5px", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <ZoomIn size={14} />
                          </button>
                        </>
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px" }}>
                          <Image size={28} color="#2A2A2A" />
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#2A2A2A" }}>No Photo</span>
                        </div>
                      )}
                      {inOrder && (
                        <div style={{ position: "absolute", top: "8px", left: "8px", background: "#A91E22", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", padding: "3px 7px" }}>
                          {inOrder.quantity} in order
                        </div>
                      )}
                    </div>

                    {/* Product info */}
                    <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.04em" }}>{sku.sku_code}</p>
                      <p style={{ fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: 0, lineHeight: "1.3" }}>{sku.name}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                        <div>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff", margin: 0 }}>${price.toFixed(2)}</p>
                          {sku.msrp && sku.msrp !== price && <p style={{ fontSize: "10px", color: "#444", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0" }}>MSRP ${sku.msrp.toFixed(2)}</p>}
                        </div>
                        <button onClick={() => addToOrder(sku)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Plus size={12} /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right — order sheet */}
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
              <div style={{ maxHeight: "420px", overflowY: "auto" }}>
                {orderItems.map(item => (
                  <div key={item.id} style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", display: "flex", gap: "10px", alignItems: "center" }}>
                    {/* Thumbnail */}
                    {item.sku.image_url ? (
                      <img src={item.sku.image_url} alt={item.sku.name} style={{ width: "36px", height: "36px", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: "36px", height: "36px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Image size={12} color="#333" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.04em" }}>{item.sku.sku_code}</p>
                      <p style={{ fontSize: "11px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sku.name}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                      <button onClick={() => updateQty(item.id, item.quantity - 1)} style={{ width: "22px", height: "22px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.12)", color: "#888", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff", width: "24px", textAlign: "center" }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)} style={{ width: "22px", height: "22px", background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.12)", color: "#888", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#fff", margin: 0 }}>${(item.unit_price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button onClick={() => setOrderItems(prev => prev.filter(i => i.id !== item.id))} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: "0", flexShrink: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ padding: "14px 16px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                <textarea placeholder="Order notes (optional)..." value={notes} onChange={e => setNotes(e.target.value)} style={{ width: "100%", background: "#13161A", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", resize: "none", minHeight: "56px", boxSizing: "border-box" as const, marginBottom: "12px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#666" }}>Order Total</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff" }}>${getTotal().toFixed(2)}</span>
                </div>
                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: submitting ? "#333" : "#A91E22", border: "none", padding: "13px", cursor: submitting ? "not-allowed" : "pointer" }}>
                  {submitting ? "Submitting..." : "Submit Order →"}
                </button>
                <p style={{ fontSize: "10px", color: "#444", textAlign: "center", marginTop: "8px", fontFamily: "'Barlow', sans-serif" }}>Orders require approval before processing</p>
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
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>{lightboxSku.name}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: "#5A9E5A", margin: 0 }}>${getPriceForTier(lightboxSku).toFixed(2)}</p>
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
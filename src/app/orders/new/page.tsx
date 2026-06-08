"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const CATALOG = {
  "Built Clubs": [
    {
      id: "putter-eas",
      name: "EAS Putter",
      price: 425,
      image: "🏌️",
      options: {
        shaft: ["Steel 35\"", "Steel 34\"", "Steel 33\""],
        grip: ["Black Pistol", "White Pistol", "Jumbo Pistol", "Mid-Size"],
        ferrule: ["Black", "White", "None"],
      },
    },
    {
      id: "putter-array",
      name: "Array Putter",
      price: 395,
      image: "🏌️",
      options: {
        shaft: ["Steel 35\"", "Steel 34\"", "Steel 33\""],
        grip: ["Black Pistol", "White Pistol", "Jumbo Pistol", "Mid-Size"],
        ferrule: ["Black", "White", "None"],
      },
    },
    {
      id: "wedge-sms",
      name: "SMS Wedge",
      price: 185,
      image: "⛳",
      options: {
        loft: ["50°", "52°", "54°", "56°", "58°", "60°"],
        shaft: ["Steel Stiff", "Steel Regular", "Steel X-Stiff"],
        grip: ["Standard Black", "Standard White", "Mid-Size"],
        ferrule: ["Black", "White", "None"],
      },
    },
    {
      id: "wedge-smspro",
      name: "SMS Pro Wedge",
      price: 210,
      image: "⛳",
      options: {
        loft: ["50°", "52°", "54°", "56°", "58°", "60°"],
        shaft: ["Steel Stiff", "Steel Regular", "Steel X-Stiff"],
        grip: ["Standard Black", "Standard White", "Mid-Size"],
        ferrule: ["Black", "White", "None"],
      },
    },
  ],
  "Head Only": [
    { id: "head-eas", name: "EAS Putter Head", price: 280, image: "🔩", options: {} },
    { id: "head-array", name: "Array Putter Head", price: 260, image: "🔩", options: {} },
    { id: "head-sms", name: "SMS Wedge Head", price: 120, image: "🔩", options: { loft: ["50°", "52°", "54°", "56°", "58°", "60°"] } },
  ],
  "Components": [
    { id: "comp-shaft-putter", name: "Putter Shaft — Steel", price: 28, image: "📏", options: { length: ["33\"", "34\"", "35\""] } },
    { id: "comp-shaft-wedge", name: "Wedge Shaft — Steel", price: 22, image: "📏", options: { flex: ["Regular", "Stiff", "X-Stiff"] } },
    { id: "comp-grip-pistol", name: "Pistol Grip", price: 12, image: "🖐️", options: { color: ["Black", "White"] } },
    { id: "comp-grip-standard", name: "Standard Grip", price: 8, image: "🖐️", options: { size: ["Standard", "Mid-Size", "Jumbo"] } },
    { id: "comp-ferrule", name: "Ferrule", price: 2, image: "⚙️", options: { color: ["Black", "White"] } },
  ],
  "Accessories": [
    { id: "acc-headcover", name: "Putter Headcover", price: 45, image: "🧢", options: { color: ["Black", "White", "Red"] } },
    { id: "acc-tool", name: "Loft/Lie Tool", price: 85, image: "🔧", options: {} },
    { id: "acc-wrench", name: "Torque Wrench", price: 35, image: "🔧", options: {} },
  ],
  "Apparel & Gear": [
    { id: "app-hat", name: "Edel Structured Hat", price: 32, image: "🧢", options: { color: ["Black", "White", "Navy"] } },
    { id: "app-polo", name: "Edel Performance Polo", price: 65, image: "👕", options: { size: ["S", "M", "L", "XL", "XXL"], color: ["Black", "White"] } },
    { id: "app-bag", name: "Edel Staff Bag", price: 285, image: "🎒", options: { color: ["Black", "Red/Black"] } },
  ],
}

type Tab = keyof typeof CATALOG
type OrderItem = {
  id: string
  productId: string
  name: string
  price: number
  options: Record<string, string>
  quantity: number
}

export default function NewOrderPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("Built Clubs")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, Record<string, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [draftModal, setDraftModal] = useState(false)

  function getOptions(productId: string) {
    return selectedOptions[productId] || {}
  }

  function setOption(productId: string, key: string, value: string) {
    setSelectedOptions(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [key]: value }
    }))
  }

  function addToOrder(product: any) {
    const opts = getOptions(product.id)
    const optionKeys = Object.keys(product.options)
    const missingOptions = optionKeys.filter(k => !opts[k])
    if (missingOptions.length > 0) {
      setErrors([`Please select: ${missingOptions.join(", ")} for ${product.name}`])
      return
    }
    setErrors([])
    const itemId = `${product.id}-${Date.now()}`
    setOrderItems(prev => [...prev, {
      id: itemId,
      productId: product.id,
      name: product.name,
      price: product.price,
      options: { ...opts },
      quantity: 1,
    }])
  }

  function updateQuantity(itemId: string, qty: number) {
    setOrderItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: Math.max(0, qty) } : item
    ))
  }

  function removeItem(itemId: string) {
    setOrderItems(prev => prev.filter(item => item.id !== itemId))
  }

  function getTotal() {
    return orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  function handleSaveDraft() {
    const drafts = JSON.parse(localStorage.getItem("edelgo_drafts") || "[]")
    const draft = {
      id: `draft-${Date.now()}`,
      savedAt: new Date().toISOString(),
      items: orderItems,
    }
    drafts.push(draft)
    localStorage.setItem("edelgo_drafts", JSON.stringify(drafts))
    setDraftModal(false)
    router.push("/orders/drafts")
  }

  function handleDiscard() {
    setDraftModal(false)
    setOrderItems([])
    router.push("/dashboard")
  }

  async function handleSubmit() {
    const itemsWithNoQty = orderItems.filter(i => i.quantity === 0)
    if (orderItems.length === 0) {
      setErrors(["Please add at least one item to the order."])
      return
    }
    if (itemsWithNoQty.length > 0) {
      setErrors([`Please set quantity for: ${itemsWithNoQty.map(i => i.name).join(", ")}`])
      return
    }
    setErrors([])
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1000))
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "60vh", gap: "16px",
      }}>
        <div style={{
          width: "56px", height: "56px", background: "rgba(90,158,90,0.1)",
          border: "1.5px solid #5A9E5A", display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: "24px",
        }}>✓</div>
        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px",
          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          color: "#fff", margin: 0,
        }}>Order Submitted</h2>
        <p style={{ fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
          Your order has been submitted for review. You'll receive a confirmation shortly.
        </p>
        <button
          onClick={() => { setSubmitted(false); setOrderItems([]) }}
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px",
            fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "#fff", background: "#A91E22", border: "none",
            padding: "10px 24px", cursor: "pointer", marginTop: "8px",
          }}>
          Place Another Order
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)",
      }}>
        <div>
          <button
            onClick={() => orderItems.length > 0 ? setDraftModal(true) : router.push("/dashboard")}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
              fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#888", background: "transparent", border: "none",
              cursor: "pointer", padding: 0, marginBottom: "8px",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
            ← Back to Dashboard
          </button>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
            fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase",
            color: "#A91E22", marginBottom: "4px",
          }}>New Order</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Build Your Order</h1>
          <p style={{
            fontSize: "12px", color: "#888", marginTop: "5px",
            fontFamily: "'Barlow', sans-serif", textTransform: "none",
            letterSpacing: "normal", fontWeight: 400,
          }}>Select products from the catalog, configure options, then review your order sheet</p>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{
          background: "rgba(169,30,34,0.1)", border: "0.5px solid rgba(169,30,34,0.3)",
          padding: "12px 16px", fontSize: "13px", color: "#A91E22",
          fontFamily: "'Barlow', sans-serif",
        }}>
          {errors[0]}
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "16px", alignItems: "start" }}>

        {/* LEFT — Catalog */}
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>

          {/* Tabs */}
          <div style={{
            display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.10)",
            background: "#1A1E22", overflowX: "auto",
          }}>
            {(Object.keys(CATALOG) as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "12px 16px", cursor: "pointer", border: "none",
                  background: "transparent", whiteSpace: "nowrap",
                  color: activeTab === tab ? "#fff" : "#666",
                  borderBottom: activeTab === tab ? "2px solid #A91E22" : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >{tab}</button>
            ))}
          </div>

          {/* Products */}
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {CATALOG[activeTab].map(product => (
              <div key={product.id} style={{
                background: "#1E2226",
                border: "0.5px solid rgba(255,255,255,0.08)",
                padding: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div>
                    <p style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "15px", fontWeight: 700,
                      color: "#fff", margin: 0, letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}>{product.name}</p>
                    <p style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "14px", fontWeight: 600,
                      color: "#A91E22", margin: "3px 0 0",
                    }}>${product.price.toFixed(2)}</p>
                  </div>
                  <span style={{ fontSize: "24px" }}>{product.image}</span>
                </div>

                {/* Options */}
                {Object.keys(product.options).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                    {Object.entries(product.options).map(([key, values]) => (
                      <div key={key}>
                        <label style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: "9px", fontWeight: 700,
                          letterSpacing: "0.14em", textTransform: "uppercase",
                          color: "#777", display: "block", marginBottom: "4px",
                        }}>{key}</label>
                        <select
                          value={getOptions(product.id)[key] || ""}
                          onChange={e => setOption(product.id, key, e.target.value)}
                          style={{
                            background: "#13161A",
                            border: "0.5px solid rgba(255,255,255,0.12)",
                            color: getOptions(product.id)[key] ? "#fff" : "#666",
                            padding: "5px 8px",
                            fontSize: "12px",
                            fontFamily: "'Barlow', sans-serif",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="">Select...</option>
                          {(values as string[]).map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => addToOrder(product)}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "11px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "#fff", background: "#A91E22",
                    border: "none", padding: "7px 16px",
                    cursor: "pointer",
                  }}>
                  + Add to Order
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Order sheet */}
        <div style={{
          background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)",
          position: "sticky", top: "20px",
        }}>
          <div style={{
            padding: "14px 18px",
            borderBottom: "0.5px solid rgba(255,255,255,0.10)",
            background: "#1A1E22",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
              fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888",
            }}>Order Sheet</span>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
              fontWeight: 700, color: "#666",
            }}>{orderItems.length} item{orderItems.length !== 1 ? "s" : ""}</span>
          </div>

          {orderItems.length === 0 ? (
            <div style={{
              padding: "40px 20px", textAlign: "center",
              fontSize: "13px", color: "#444",
              fontFamily: "'Barlow', sans-serif",
            }}>
              No items added yet.<br />Select products from the catalog.
            </div>
          ) : (
            <>
              <div style={{ maxHeight: "450px", overflowY: "auto" }}>
                {orderItems.map(item => (
                  <div key={item.id} style={{
                    padding: "14px 18px",
                    borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: "13px", fontWeight: 700,
                          color: "#fff", margin: 0, textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}>{item.name}</p>
                        {Object.entries(item.options).map(([k, v]) => (
                          <span key={k} style={{
                            fontSize: "10px", color: "#666",
                            fontFamily: "'Barlow', sans-serif",
                            marginRight: "8px",
                          }}>{k}: {v}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        style={{
                          background: "none", border: "none",
                          color: "#444", cursor: "pointer",
                          fontSize: "16px", padding: "0 0 0 8px",
                          lineHeight: 1,
                        }}>×</button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          style={{
                            width: "28px", height: "28px",
                            background: "#1A1E22",
                            border: "0.5px solid rgba(255,255,255,0.12)",
                            color: "#888", cursor: "pointer", fontSize: "16px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>−</button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                          style={{
                            width: "44px", height: "28px",
                            background: "#1A1E22",
                            border: "0.5px solid rgba(255,255,255,0.12)",
                            borderLeft: "none", borderRight: "none",
                            color: item.quantity === 0 ? "#A91E22" : "#fff",
                            textAlign: "center", fontSize: "13px",
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 700, outline: "none",
                          }}
                        />
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          style={{
                            width: "28px", height: "28px",
                            background: "#1A1E22",
                            border: "0.5px solid rgba(255,255,255,0.12)",
                            color: "#888", cursor: "pointer", fontSize: "16px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>+</button>
                      </div>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "14px", fontWeight: 700,
                        color: item.quantity === 0 ? "#333" : "#fff",
                      }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total + submit */}
              <div style={{ padding: "16px 18px", borderTop: "0.5px solid rgba(255,255,255,0.10)" }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: "14px",
                }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "11px", fontWeight: 700,
                    letterSpacing: "0.14em", textTransform: "uppercase", color: "#888",
                  }}>Order Total</span>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "20px", fontWeight: 700, color: "#fff",
                  }}>${getTotal().toFixed(2)}</span>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "13px", fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "#fff",
                    background: submitting ? "#5A0F11" : "#A91E22",
                    border: "none", padding: "13px",
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}>
                  {submitting ? "Submitting..." : "Submit Order →"}
                </button>
                <p style={{
                  fontSize: "10px", color: "#444", textAlign: "center",
                  marginTop: "8px", fontFamily: "'Barlow', sans-serif",
                  fontWeight: 400, textTransform: "none", letterSpacing: "normal",
                }}>
                  Orders require admin approval before processing
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Draft modal */}
      {draftModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200,
        }}
          onClick={() => setDraftModal(false)}
        >
          <div
            style={{
              background: "#1E2226",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderTop: "2px solid #A91E22",
              padding: "32px",
              width: "380px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "20px", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              color: "#fff", margin: "0 0 8px",
            }}>Save Draft?</h2>
            <p style={{
              fontSize: "13px", color: "#888",
              fontFamily: "'Barlow', sans-serif",
              margin: "0 0 24px", fontWeight: 400,
              textTransform: "none", letterSpacing: "normal",
            }}>
              You have {orderItems.length} item{orderItems.length !== 1 ? "s" : ""} in your order. Save a draft or discard?
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleDiscard}
                style={{
                  flex: 1,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "12px", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "#888", background: "transparent",
                  border: "1px solid #333", padding: "10px",
                  cursor: "pointer",
                }}>Discard</button>
              <button
                onClick={handleSaveDraft}
                style={{
                  flex: 1,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "12px", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "#fff", background: "#A91E22",
                  border: "none", padding: "10px",
                  cursor: "pointer",
                }}>Save Draft</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type OrderItem = {
  id: string
  productId: string
  name: string
  price: number
  options: Record<string, string>
  quantity: number
}

type Draft = {
  id: string
  savedAt: string
  items: OrderItem[]
}

export default function DraftsPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [deleteModal, setDeleteModal] = useState<string | null>(null)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("edelgo_drafts") || "[]")
    setDrafts(stored)
  }, [])

  function deleteDraft(id: string) {
    const updated = drafts.filter(d => d.id !== id)
    setDrafts(updated)
    localStorage.setItem("edelgo_drafts", JSON.stringify(updated))
    setDeleteModal(null)
  }

  function getDraftTotal(items: OrderItem[]) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)",
      }}>
        <div>
          <button
            onClick={() => router.push("/dashboard")}
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
          }}>Orders</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Order Drafts</h1>
          <p style={{
            fontSize: "12px", color: "#888", marginTop: "5px",
            fontFamily: "'Barlow', sans-serif", textTransform: "none",
            letterSpacing: "normal", fontWeight: 400,
          }}>Saved drafts — resume or discard at any time</p>
        </div>
        <button
          onClick={() => router.push("/orders/new")}
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff",
            background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer",
          }}>+ New Order</button>
      </div>

      {/* Drafts list */}
      {drafts.length === 0 ? (
        <div style={{
          background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)",
          padding: "60px 20px", textAlign: "center",
        }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px",
            fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
            color: "#444", margin: "0 0 8px",
          }}>No Drafts Saved</p>
          <p style={{
            fontSize: "13px", color: "#333",
            fontFamily: "'Barlow', sans-serif", margin: "0 0 20px",
          }}>Start a new order and save it as a draft to see it here.</p>
          <button
            onClick={() => router.push("/orders/new")}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff",
              background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer",
            }}>Start an Order</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {drafts.map(draft => (
            <div key={draft.id} style={{
              background: "#22262B",
              border: "0.5px solid rgba(255,255,255,0.10)",
              padding: "20px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "14px", fontWeight: 700,
                    color: "#fff", textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    Draft — {draft.items.length} item{draft.items.length !== 1 ? "s" : ""}
                  </span>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "10px", fontWeight: 600,
                    color: "#A91E22", background: "rgba(169,30,34,0.1)",
                    padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>Draft</span>
                </div>
                <div style={{ display: "flex", gap: "24px" }}>
                  <span style={{ fontSize: "12px", color: "#666", fontFamily: "'Barlow', sans-serif" }}>
                    Saved {formatDate(draft.savedAt)}
                  </span>
                  <span style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif" }}>
                    Est. total: ${getDraftTotal(draft.items).toFixed(2)}
                  </span>
                </div>
                <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {draft.items.slice(0, 4).map(item => (
                    <span key={item.id} style={{
                      fontSize: "11px", color: "#666",
                      background: "#1A1E22",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      padding: "3px 8px",
                      fontFamily: "'Barlow', sans-serif",
                    }}>{item.name}</span>
                  ))}
                  {draft.items.length > 4 && (
                    <span style={{
                      fontSize: "11px", color: "#444",
                      fontFamily: "'Barlow', sans-serif",
                      padding: "3px 0",
                    }}>+{draft.items.length - 4} more</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginLeft: "24px" }}>
                <button
                  onClick={() => setDeleteModal(draft.id)}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                    fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "#555", background: "transparent",
                    border: "1px solid #333", padding: "7px 14px", cursor: "pointer",
                  }}>Discard</button>
                <button
                  onClick={() => router.push("/orders/new")}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                    fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "#fff", background: "#A91E22",
                    border: "none", padding: "7px 14px", cursor: "pointer",
                  }}>Resume →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200,
        }}
          onClick={() => setDeleteModal(null)}
        >
          <div
            style={{
              background: "#1E2226",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderTop: "2px solid #A91E22",
              padding: "32px", width: "360px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "20px", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              color: "#fff", margin: "0 0 8px",
            }}>Discard Draft?</h2>
            <p style={{
              fontSize: "13px", color: "#888",
              fontFamily: "'Barlow', sans-serif",
              margin: "0 0 24px", fontWeight: 400,
              textTransform: "none", letterSpacing: "normal",
            }}>
              This draft will be permanently deleted and cannot be recovered.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setDeleteModal(null)}
                style={{
                  flex: 1, fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "#888", background: "transparent",
                  border: "1px solid #333", padding: "10px", cursor: "pointer",
                }}>Cancel</button>
              <button
                onClick={() => deleteDraft(deleteModal)}
                style={{
                  flex: 1, fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "#fff", background: "#A91E22",
                  border: "none", padding: "10px", cursor: "pointer",
                }}>Discard Draft</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
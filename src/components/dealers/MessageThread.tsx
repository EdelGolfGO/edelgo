"use client"

import { useState, useEffect, useRef } from "react"
import { Send } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Message = {
  id: string
  dealer_id: string
  order_id: string | null
  sender_role: "dealer" | "admin"
  sender_profile_id: string | null
  message: string
  is_read: boolean
  created_at: string
}

type MessageThreadProps = {
  dealerId: string
  orderId?: string | null // null/omitted = general inbox thread, not tied to an order
  currentUserRole: "dealer" | "admin"
  dealerName?: string // shown in admin view to label whose thread this is
  compact?: boolean // smaller height for embedding inside an order's detail panel
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export default function MessageThread({ dealerId, orderId, currentUserRole, dealerName, compact }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadMessages() }, [dealerId, orderId])

  async function loadMessages() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from("dealer_messages").select("*").eq("dealer_id", dealerId).order("created_at", { ascending: true })
    query = orderId ? query.eq("order_id", orderId) : query.is("order_id", null)
    const { data } = await query
    if (data) setMessages(data)
    setLoading(false)

    // Mark messages from the other party as read once viewed
    const unreadFromOther = (data || []).filter(m => !m.is_read && m.sender_role !== currentUserRole)
    if (unreadFromOther.length > 0) {
      await supabase.from("dealer_messages").update({ is_read: true }).in("id", unreadFromOther.map(m => m.id))
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function handleSend() {
    if (!draft.trim()) return
    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from("dealer_messages").insert({
      dealer_id: dealerId,
      order_id: orderId || null,
      sender_role: currentUserRole,
      sender_profile_id: user?.id || null,
      message: draft.trim(),
    })

    if (!error) {
      // If a dealer sent this, notify admin via the existing portal_notifications
      // pipeline so it surfaces on the Alerts page alongside signups/orders.
      if (currentUserRole === "dealer") {
        await supabase.from("portal_notifications").insert({
          type: "dealer_message",
          title: `New Message${dealerName ? ` from ${dealerName}` : ""}`,
          message: draft.trim().slice(0, 140),
          reference_id: orderId || dealerId,
          reference_type: orderId ? "b2b_order" : "dealer",
          dealer_id: dealerId,
        })
      }
      setDraft("")
      loadMessages()
    }
    setSending(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#23282E", border: "0.5px solid rgba(255,255,255,0.10)" }}>
      <div ref={scrollRef} style={{ height: compact ? "200px" : "360px", overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {loading ? (
          <p style={{ fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif", textAlign: "center", margin: "auto" }}>Loading messages...</p>
        ) : messages.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif", textAlign: "center", margin: "auto", fontStyle: "italic" }}>
            No messages yet. {orderId ? "Ask a question about this order." : "Start a conversation."}
          </p>
        ) : messages.map(msg => {
          const isMine = msg.sender_role === currentUserRole
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "75%", background: isMine ? "#A91E22" : "#2E343C", border: isMine ? "none" : "0.5px solid rgba(255,255,255,0.08)", padding: "8px 12px" }}>
                <p style={{ fontSize: "13px", color: "#fff", fontFamily: "'Barlow', sans-serif", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.message}</p>
                <p style={{ fontSize: "10px", color: isMine ? "rgba(255,255,255,0.6)" : "#787E87", fontFamily: "'Barlow', sans-serif", margin: "4px 0 0", textAlign: "right" }}>
                  {msg.sender_role === "admin" ? "Edel Golf" : "You"} · {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", gap: "8px", padding: "10px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Type a message..."
          style={{ flex: 1, background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", resize: "none", minHeight: "20px", maxHeight: "80px", boxSizing: "border-box" as const }}
          rows={1}
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()}
          style={{ background: !draft.trim() ? "#3A3F47" : "#A91E22", border: "none", color: "#fff", cursor: !draft.trim() ? "not-allowed" : "pointer", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
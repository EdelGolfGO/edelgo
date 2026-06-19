"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ChevronDown, FileText } from "lucide-react"

export default function PortalInvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("distributor_invoices")
      .select("*")
      .eq("invoice_type", "distributor")
      .order("created_at", { ascending: false })
    if (data) setInvoices(data)
    setLoading(false)
  }

  const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
    pending:          { color: "#C4A93A", bg: "rgba(196,169,58,0.1)",  label: "Payment Due" },
    deposit_received: { color: "#6A9CC8", bg: "rgba(106,156,200,0.1)", label: "Deposit Received" },
    shipped:          { color: "#7AAB6A", bg: "rgba(122,171,106,0.1)", label: "Shipped" },
    final_pending:    { color: "#A91E22", bg: "rgba(169,30,34,0.1)",   label: "Final Payment Due" },
    paid:             { color: "#5A9E5A", bg: "rgba(90,158,90,0.1)",   label: "Paid in Full" },
  }

  function formatDate(d: string) {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  function addDays(d: string, days: number) {
    const date = new Date(d)
    date.setDate(date.getDate() + days)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const totalOutstanding = invoices.filter(i => i.status !== "paid").reduce((sum, i) => {
    let owed = 0
    if (!i.deposit_paid_date) owed += i.total_amount * 0.5
    if (!i.final_payment_paid_date && i.ship_date) owed += i.total_amount * 0.5
    return sum + owed
  }, 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Dealer Portal</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>My Invoices</h1>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", fontWeight: 400 }}>{invoices.length} invoices</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {[
          { label: "Total Invoices", value: invoices.length.toString(), color: "#fff" },
          { label: "Outstanding Balance", value: `$${Math.round(totalOutstanding).toLocaleString()}`, color: totalOutstanding > 0 ? "#C4A93A" : "#5A9E5A" },
          { label: "Paid in Full", value: invoices.filter(i => i.status === "paid").length.toString(), color: "#5A9E5A" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{stat.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: stat.color, lineHeight: 1, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "60px 20px", textAlign: "center" }}>
          <FileText size={32} color="#333" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", margin: "0 0 8px" }}>No invoices yet</p>
          <p style={{ fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif", margin: 0 }}>Invoices will appear here once your orders are processed.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {invoices.map(invoice => {
            const isExpanded = expanded === invoice.id
            const statusInfo = STATUS_COLORS[invoice.status] || STATUS_COLORS.pending

            return (
              <div key={invoice.id} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
                <div onClick={() => setExpanded(isExpanded ? null : invoice.id)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", margin: 0, letterSpacing: "0.05em" }}>{invoice.invoice_number}</p>
                    <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: "2px 0 0" }}>Issued {formatDate(invoice.invoice_date)}</p>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px" }}>{statusInfo.label}</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff" }}>${invoice.total_amount?.toLocaleString()}</span>
                  <ChevronDown size={16} color="#444" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }} />
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "16px 20px", background: "#1E2226" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#555", marginBottom: "12px" }}>Payment Schedule</p>
                    <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                      {[
                        { label: "50% Deposit", amount: invoice.total_amount * 0.5, due: addDays(invoice.invoice_date, 14), paid: !!invoice.deposit_paid_date, paidDate: invoice.deposit_paid_date },
                        { label: "50% Final", amount: invoice.total_amount * 0.5, due: invoice.ship_date ? addDays(invoice.ship_date, 45) : "Due 45 days after ship", paid: !!invoice.final_payment_paid_date, paidDate: invoice.final_payment_paid_date },
                      ].map(p => (
                        <div key={p.label} style={{ background: "#22262B", border: `0.5px solid ${p.paid ? "rgba(90,158,90,0.3)" : "rgba(196,169,58,0.2)"}`, padding: "12px 16px", flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: p.paid ? "#5A9E5A" : "#C4A93A" }}>{p.label}</span>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: p.paid ? "#5A9E5A" : "#C4A93A", background: p.paid ? "rgba(90,158,90,0.1)" : "rgba(196,169,58,0.1)", padding: "2px 6px" }}>{p.paid ? "Paid" : "Pending"}</span>
                          </div>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, color: "#fff", margin: "4px 0" }}>${p.amount.toLocaleString()}</p>
                          <p style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{p.paid ? `Paid ${formatDate(p.paidDate)}` : `Due ${p.due}`}</p>
                        </div>
                      ))}
                    </div>
                    {invoice.notes && <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", fontStyle: "italic" }}>Note: {invoice.notes}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
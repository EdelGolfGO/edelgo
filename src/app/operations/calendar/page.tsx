"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase"

type CalendarEvent = {
  id: string
  date: string
  type: "deposit_due_from" | "final_due_from" | "deposit_due_to" | "final_due_to" | "ship_date" | "po_placed"
  label: string
  amount?: number
  reference: string
  status: "upcoming" | "due_soon" | "overdue" | "completed"
  href: string
}

const EVENT_CONFIG = {
  deposit_due_from: { color: "#5A9E5A", bg: "rgba(90,158,90,0.12)",   label: "Deposit Due From", icon: "↓" },
  final_due_from:   { color: "#5A9E5A", bg: "rgba(90,158,90,0.12)",   label: "Final Pmt Due From", icon: "↓" },
  deposit_due_to:   { color: "#A91E22", bg: "rgba(169,30,34,0.12)",   label: "Deposit Due To", icon: "↑" },
  final_due_to:     { color: "#A91E22", bg: "rgba(169,30,34,0.12)",   label: "Final Pmt Due To", icon: "↑" },
  ship_date:        { color: "#6A9CC8", bg: "rgba(106,156,200,0.12)", label: "Ship Date", icon: "✈" },
  po_placed:        { color: "#C4A93A", bg: "rgba(196,169,58,0.12)",  label: "PO Placed", icon: "📋" },
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function daysUntil(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + "T00:00:00")
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getEventStatus(dateStr: string, isPaid: boolean): CalendarEvent["status"] {
  if (isPaid) return "completed"
  const d = daysUntil(dateStr)
  if (d < 0) return "overdue"
  if (d <= 7) return "due_soon"
  return "upcoming"
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  })
}

function formatMoney(amount?: number) {
  if (!amount) return ""
  return `$${amount.toLocaleString()}`
}

export default function CalendarPage() {
  const router = useRouter()
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setLoading(true)
    const supabase = createClient()

    const [posResult, invoicesResult] = await Promise.all([
      supabase.from("purchase_orders").select("*"),
      supabase.from("distributor_invoices").select("*"),
    ])

    const newEvents: CalendarEvent[] = []

    // Process POs
    for (const po of posResult.data || []) {
      if (po.status === "cancelled") continue

      // PO placed event
      newEvents.push({
        id: `po-placed-${po.id}`,
        date: po.order_date,
        type: "po_placed",
        label: po.po_number,
        amount: po.total_amount,
        reference: po.po_number,
        status: "completed",
        href: "/operations/pos",
      })

      // Deposit due to factory (at PO placement — same as order date)
      newEvents.push({
        id: `po-dep-${po.id}`,
        date: po.order_date,
        type: "deposit_due_to",
        label: `${po.po_number} — Deposit to Factory`,
        amount: po.total_amount * 0.5,
        reference: po.po_number,
        status: getEventStatus(po.order_date, !!po.deposit_paid_date),
        href: "/operations/pos",
      })

      // Final payment due to factory (14 days after ship)
      if (po.actual_ship_date) {
        const finalDue = addDays(po.actual_ship_date, 14)
        newEvents.push({
          id: `po-final-${po.id}`,
          date: finalDue,
          type: "final_due_to",
          label: `${po.po_number} — Final to Factory`,
          amount: po.total_amount * 0.5,
          reference: po.po_number,
          status: getEventStatus(finalDue, !!po.final_payment_paid_date),
          href: "/operations/pos",
        })
      }

      // Expected ship date
      if (po.expected_ship_date && po.status !== "received") {
        newEvents.push({
          id: `po-ship-${po.id}`,
          date: po.actual_ship_date || po.expected_ship_date,
          type: "ship_date",
          label: `${po.po_number} — Ships`,
          reference: po.po_number,
          status: po.actual_ship_date ? "completed" : getEventStatus(po.expected_ship_date, false),
          href: "/operations/pos",
        })
      }
    }

    // Process invoices
    for (const inv of invoicesResult.data || []) {
      const isFactory = inv.invoice_type === "factory"
      const depositDue = addDays(inv.invoice_date, 14)

      if (isFactory) {
        // Factory invoice — we pay
        newEvents.push({
          id: `inv-dep-${inv.id}`,
          date: depositDue,
          type: "deposit_due_to",
          label: `${inv.invoice_number} — Deposit to ${inv.dealer_name}`,
          amount: inv.total_amount * 0.5,
          reference: inv.invoice_number,
          status: getEventStatus(depositDue, !!inv.deposit_paid_date),
          href: "/operations/invoices",
        })

        if (inv.ship_date) {
          const finalDue = addDays(inv.ship_date, 14)
          newEvents.push({
            id: `inv-final-${inv.id}`,
            date: finalDue,
            type: "final_due_to",
            label: `${inv.invoice_number} — Final to Factory`,
            amount: inv.total_amount * 0.5,
            reference: inv.invoice_number,
            status: getEventStatus(finalDue, !!inv.final_payment_paid_date),
            href: "/operations/invoices",
          })
        }
      } else {
        // Distributor invoice — we receive
        newEvents.push({
          id: `inv-dep-${inv.id}`,
          date: depositDue,
          type: "deposit_due_from",
          label: `${inv.invoice_number} — Deposit from ${inv.dealer_name}`,
          amount: inv.total_amount * 0.5,
          reference: inv.invoice_number,
          status: getEventStatus(depositDue, !!inv.deposit_paid_date),
          href: "/operations/invoices",
        })

        if (inv.ship_date) {
          // Ship event
          newEvents.push({
            id: `inv-ship-${inv.id}`,
            date: inv.ship_date,
            type: "ship_date",
            label: `${inv.invoice_number} — Shipped to ${inv.dealer_name}`,
            reference: inv.invoice_number,
            status: "completed",
            href: "/operations/invoices",
          })

          // Final payment due from distributor
          const finalDue = addDays(inv.ship_date, 45)
          newEvents.push({
            id: `inv-final-${inv.id}`,
            date: finalDue,
            type: "final_due_from",
            label: `${inv.invoice_number} — Final from ${inv.dealer_name}`,
            amount: inv.total_amount * 0.5,
            reference: inv.invoice_number,
            status: getEventStatus(finalDue, !!inv.final_payment_paid_date),
            href: "/operations/invoices",
          })
        }
      }
    }

    setEvents(newEvents)
    setLoading(false)
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
    setSelectedDay(null)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
    setSelectedDay(null)
  }

  function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
  function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay() }

  function getEventsForDay(day: number) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return events.filter(e => e.date === dateStr)
  }

  function getEventsForMonth() {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
    return events.filter(e => e.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date))
  }

  const upcomingAll = events
    .filter(e => {
      const d = daysUntil(e.date)
      return d >= 0 && d <= 30 && e.status !== "completed"
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const overdueAll = events
    .filter(e => e.status === "overdue")
    .sort((a, b) => a.date.localeCompare(b.date))

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []
  const monthEvents = getEventsForMonth()

  const btnStyle = (active: boolean) => ({
    fontFamily: "'Barlow Condensed', sans-serif" as const,
    fontSize: "11px", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase" as const,
    color: active ? "#fff" : "#555",
    background: active ? "#A91E22" : "transparent",
    border: active ? "none" : "1px solid #333",
    padding: "7px 16px", cursor: "pointer",
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Operations</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Calendar</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
            All payment deadlines and ship dates from your POs and invoices
            {loading ? " — loading..." : ` — ${events.length} events`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={btnStyle(view === "calendar")} onClick={() => setView("calendar")}>📅 Calendar</button>
          <button style={btnStyle(view === "list")} onClick={() => setView("list")}>📋 List</button>
        </div>
      </div>

      {/* Overdue banner */}
      {overdueAll.length > 0 && (
        <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.3)", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A91E22" }}>
            ⚠ {overdueAll.length} Overdue Payment{overdueAll.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: "12px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>
            {overdueAll.map(e => e.reference).join(", ")}
          </span>
          <button onClick={() => router.push("/operations/alerts")} style={{ marginLeft: "auto", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A91E22", background: "transparent", border: "1px solid rgba(169,30,34,0.3)", padding: "4px 10px", cursor: "pointer" }}>
            View Alerts →
          </button>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {[
          { color: "#5A9E5A", label: "↓ Money In (from distributors)" },
          { color: "#A91E22", label: "↑ Money Out (to factory)" },
          { color: "#6A9CC8", label: "✈ Ship Dates" },
          { color: "#C4A93A", label: "📋 PO Milestones" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "10px", height: "10px", background: item.color }} />
            <span style={{ fontSize: "11px", color: "#666", fontFamily: "'Barlow', sans-serif" }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "16px", alignItems: "start" }}>

        {/* Calendar / List */}
        <div>
          {view === "calendar" ? (
            <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
              {/* Month nav */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22" }}>
                <button onClick={prevMonth} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "4px" }}><ChevronLeft size={18} /></button>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", margin: 0 }}>{MONTHS[currentMonth]} {currentYear}</h2>
                <button onClick={nextMonth} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "4px" }}><ChevronRight size={18} /></button>
              </div>

              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <div key={d} style={{ padding: "8px 0", textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#333", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{d}</div>
                ))}
              </div>

              {/* Days */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {Array.from({ length: getFirstDay(currentYear, currentMonth) }).map((_, i) => (
                  <div key={`e${i}`} style={{ minHeight: "80px", borderRight: "0.5px solid rgba(255,255,255,0.04)", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }} />
                ))}
                {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, i) => {
                  const day = i + 1
                  const dayEvents = getEventsForDay(day)
                  const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
                  const isSelected = selectedDay === day
                  const hasOverdue = dayEvents.some(e => e.status === "overdue")

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      style={{
                        minHeight: "80px", padding: "6px",
                        borderRight: "0.5px solid rgba(255,255,255,0.04)",
                        borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                        cursor: dayEvents.length > 0 ? "pointer" : "default",
                        background: isSelected ? "rgba(169,30,34,0.08)" : "transparent",
                      }}
                      onMouseEnter={e => { if (!isSelected && dayEvents.length > 0) e.currentTarget.style.background = "rgba(255,255,255,0.02)" }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                    >
                      <div style={{ width: "24px", height: "24px", background: isToday ? "#A91E22" : hasOverdue && !isToday ? "rgba(169,30,34,0.2)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: isToday ? 700 : 400, color: isToday ? "#fff" : hasOverdue ? "#A91E22" : "#666" }}>{day}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {dayEvents.slice(0, 2).map(event => {
                          const config = EVENT_CONFIG[event.type]
                          return (
                            <div key={event.id} style={{ background: event.status === "overdue" ? "rgba(169,30,34,0.2)" : config.bg, padding: "2px 4px", fontSize: "9px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: event.status === "overdue" ? "#A91E22" : config.color, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {config.icon} {event.reference}
                              {event.amount ? ` ${formatMoney(event.amount)}` : ""}
                            </div>
                          )
                        })}
                        {dayEvents.length > 2 && <div style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow', sans-serif", paddingLeft: "4px" }}>+{dayEvents.length - 2} more</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            // List view
            <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
              <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666" }}>
                  {MONTHS[currentMonth]} {currentYear} — {monthEvents.length} Events
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={prevMonth} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><ChevronLeft size={16} /></button>
                  <button onClick={nextMonth} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}><ChevronRight size={16} /></button>
                </div>
              </div>
              {monthEvents.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif" }}>
                  {loading ? "Loading events..." : "No events this month"}
                </div>
              ) : (
                monthEvents.map(event => {
                  const config = EVENT_CONFIG[event.type]
                  const d = new Date(event.date + "T12:00:00")
                  return (
                    <div key={event.id} onClick={() => router.push(event.href)} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ flex: "0 0 80px", textAlign: "center" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1 }}>{d.getDate()}</p>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#444", margin: "2px 0 0" }}>{MONTHS[d.getMonth()].slice(0, 3)}</p>
                      </div>
                      <div style={{ width: "3px", alignSelf: "stretch", background: event.status === "overdue" ? "#A91E22" : config.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#fff", margin: "0 0 2px" }}>{config.label}</p>
                        <p style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{event.label}</p>
                      </div>
                      {event.amount && (
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: event.status === "overdue" ? "#A91E22" : config.color }}>
                          {formatMoney(event.amount)}
                        </span>
                      )}
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: event.status === "completed" ? "#5A9E5A" : event.status === "overdue" ? "#A91E22" : event.status === "due_soon" ? "#C4A93A" : "#666", background: event.status === "completed" ? "rgba(90,158,90,0.1)" : event.status === "overdue" ? "rgba(169,30,34,0.1)" : event.status === "due_soon" ? "rgba(196,169,58,0.1)" : "rgba(255,255,255,0.05)", padding: "3px 8px" }}>
                        {event.status === "due_soon" ? "Due Soon" : event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Selected day */}
          {selectedDay && selectedEvents.length > 0 && (
            <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#888" }}>
                  {MONTHS[currentMonth]} {selectedDay}
                </span>
              </div>
              {selectedEvents.map(event => {
                const config = EVENT_CONFIG[event.type]
                return (
                  <div key={event.id} onClick={() => router.push(event.href)} style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${event.status === "overdue" ? "#A91E22" : config.color}`, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: event.status === "overdue" ? "#A91E22" : config.color, margin: "0 0 2px" }}>{config.label}</p>
                    <p style={{ fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: "0 0 4px" }}>{event.label}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif" }}>{event.reference}</span>
                      {event.amount && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, color: event.status === "overdue" ? "#A91E22" : config.color }}>{formatMoney(event.amount)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Overdue */}
          {overdueAll.length > 0 && (
            <div style={{ background: "#22262B", border: "0.5px solid rgba(169,30,34,0.25)", borderTop: "2px solid #A91E22" }}>
              <div style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", background: "#1A1E22" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A91E22" }}>⚠ Overdue ({overdueAll.length})</span>
              </div>
              {overdueAll.slice(0, 5).map(event => {
                const daysLate = Math.abs(daysUntil(event.date))
                return (
                  <div key={event.id} onClick={() => router.push(event.href)} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(169,30,34,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ flex: "0 0 36px", height: "36px", background: "rgba(169,30,34,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", lineHeight: 1 }}>{daysLate}d</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "8px", color: "#A91E22", letterSpacing: "0.08em", textTransform: "uppercase" }}>late</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#A91E22", margin: "0 0 1px" }}>{EVENT_CONFIG[event.type].label}</p>
                      <p style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>{event.reference}</p>
                    </div>
                    {event.amount && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#A91E22" }}>{formatMoney(event.amount)}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Upcoming 30 days */}
          <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
            <div style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1A1E22" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#888" }}>
                Next 30 Days {upcomingAll.length > 0 ? `(${upcomingAll.length})` : ""}
              </span>
            </div>
            {loading ? (
              <div style={{ padding: "20px 14px", fontSize: "12px", color: "#333", fontFamily: "'Barlow', sans-serif" }}>Loading...</div>
            ) : upcomingAll.length === 0 ? (
              <div style={{ padding: "20px 14px", fontSize: "12px", color: "#333", fontFamily: "'Barlow', sans-serif" }}>Nothing due in the next 30 days</div>
            ) : (
              upcomingAll.map(event => {
                const config = EVENT_CONFIG[event.type]
                const d = new Date(event.date + "T12:00:00")
                const daysLeft = daysUntil(event.date)
                return (
                  <div key={event.id} onClick={() => router.push(event.href)} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ flex: "0 0 36px", height: "36px", background: config.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: config.color, lineHeight: 1 }}>{d.getDate()}</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "8px", fontWeight: 600, color: config.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{MONTHS[d.getMonth()].slice(0, 3)}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: config.color, margin: "0 0 1px" }}>
                        {config.icon} {config.label}
                      </p>
                      <p style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {event.reference}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {event.amount && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: config.color, margin: "0 0 2px" }}>{formatMoney(event.amount)}</p>}
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, color: daysLeft <= 7 ? "#A91E22" : daysLeft <= 14 ? "#C4A93A" : "#555", margin: 0 }}>
                        {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
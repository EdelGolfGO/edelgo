"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

type CalendarEvent = {
  id: string
  date: string
  type: "deposit_due_from" | "final_due_from" | "deposit_due_to" | "final_due_to" | "ship_date" | "po_placed"
  label: string
  amount?: number
  reference: string
  status: "upcoming" | "due_soon" | "overdue" | "completed"
}

const EVENT_CONFIG = {
  deposit_due_from: { color: "#5A9E5A", bg: "rgba(90,158,90,0.12)", label: "Deposit Due From", icon: "↓" },
  final_due_from:   { color: "#5A9E5A", bg: "rgba(90,158,90,0.12)", label: "Final Pmt Due From", icon: "↓" },
  deposit_due_to:   { color: "#A91E22", bg: "rgba(169,30,34,0.12)", label: "Deposit Due To", icon: "↑" },
  final_due_to:     { color: "#A91E22", bg: "rgba(169,30,34,0.12)", label: "Final Pmt Due To", icon: "↑" },
  ship_date:        { color: "#6A9CC8", bg: "rgba(106,156,200,0.12)", label: "Ship Date", icon: "✈" },
  po_placed:        { color: "#C4A93A", bg: "rgba(196,169,58,0.12)", label: "PO Placed", icon: "📋" },
}

const SAMPLE_EVENTS: CalendarEvent[] = [
  { id: "e1",  date: "2026-06-10", type: "deposit_due_from", label: "Golf Galaxy – Denver", amount: 6375, reference: "INV-2026-088", status: "completed" },
  { id: "e2",  date: "2026-06-18", type: "deposit_due_from", label: "PGA Tour Superstore", amount: 14200, reference: "INV-2026-085", status: "completed" },
  { id: "e3",  date: "2026-06-20", type: "deposit_due_to",   label: "Edel China Factory", amount: 24250, reference: "PO-2026-041", status: "completed" },
  { id: "e4",  date: "2026-07-04", type: "deposit_due_from", label: "Fairway & Greene", amount: 3100, reference: "INV-2026-091", status: "due_soon" },
  { id: "e5",  date: "2026-07-08", type: "ship_date",        label: "PO-2026-041 Ships", reference: "PO-2026-041", status: "upcoming" },
  { id: "e6",  date: "2026-07-08", type: "ship_date",        label: "INV-2026-088 Ships", reference: "INV-2026-088", status: "upcoming" },
  { id: "e7",  date: "2026-07-14", type: "ship_date",        label: "INV-2026-085 Ships", reference: "INV-2026-085", status: "upcoming" },
  { id: "e8",  date: "2026-07-22", type: "final_due_to",     label: "Edel China Factory", amount: 24250, reference: "PO-2026-041", status: "upcoming" },
  { id: "e9",  date: "2026-08-01", type: "final_due_from",   label: "Golf Galaxy – Denver", amount: 6375, reference: "INV-2026-088", status: "upcoming" },
  { id: "e10", date: "2026-08-22", type: "final_due_from",   label: "PGA Tour Superstore", amount: 14200, reference: "INV-2026-085", status: "upcoming" },
  { id: "e11", date: "2026-06-16", type: "final_due_to",     label: "Edel China Factory", amount: 16000, reference: "PO-2026-038", status: "due_soon" },
  { id: "e12", date: "2026-07-17", type: "final_due_from",   label: "The Caddy Shack", amount: 2400, reference: "INV-2026-071", status: "upcoming" },
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatMoney(amount?: number) {
  if (!amount) return ""
  return `$${amount.toLocaleString()}`
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"]

export default function CalendarPage() {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [view, setView] = useState<"calendar" | "list">("calendar")

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

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

  function getEventsForDay(day: number) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return SAMPLE_EVENTS.filter(e => e.date === dateStr)
  }

  function getEventsForMonth() {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
    return SAMPLE_EVENTS
      .filter(e => e.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []
  const monthEvents = getEventsForMonth()

  const upcomingAll = SAMPLE_EVENTS
    .filter(e => {
      const d = new Date(e.date)
      const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 30
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)",
      }}>
        <div>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
            fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase",
            color: "#A91E22", marginBottom: "4px",
          }}>Operations</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Calendar</h1>
          <p style={{
            fontSize: "12px", color: "#888", marginTop: "5px",
            fontFamily: "'Barlow', sans-serif", textTransform: "none",
            letterSpacing: "normal", fontWeight: 400,
          }}>All payment deadlines, ship dates, and PO milestones in one view</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["calendar", "list"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: view === v ? "#fff" : "#555",
                background: view === v ? "#A91E22" : "transparent",
                border: view === v ? "none" : "1px solid #333",
                padding: "7px 16px", cursor: "pointer",
              }}
            >{v === "calendar" ? "📅 Calendar" : "📋 List"}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {[
          { color: "#5A9E5A", label: "Money In (from distributors)" },
          { color: "#A91E22", label: "Money Out (to factory)" },
          { color: "#6A9CC8", label: "Ship Dates" },
          { color: "#C4A93A", label: "PO Milestones" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "10px", height: "10px", background: item.color }} />
            <span style={{ fontSize: "11px", color: "#666", fontFamily: "'Barlow', sans-serif" }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "16px", alignItems: "start" }}>

        {/* Calendar / List view */}
        <div>
          {view === "calendar" ? (
            <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>

              {/* Month nav */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)",
                background: "#1A1E22",
              }}>
                <button onClick={prevMonth} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "4px" }}>
                  <ChevronLeft size={18} />
                </button>
                <h2 style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "18px",
                  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "#fff", margin: 0,
                }}>{MONTHS[currentMonth]} {currentYear}</h2>
                <button onClick={nextMonth} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "4px" }}>
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <div key={d} style={{
                    padding: "8px 0", textAlign: "center",
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                    fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
                    color: "#333", borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                  }}>{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} style={{
                    minHeight: "80px",
                    borderRight: "0.5px solid rgba(255,255,255,0.04)",
                    borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                  }} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const events = getEventsForDay(day)
                  const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
                  const isSelected = selectedDay === day

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      style={{
                        minHeight: "80px",
                        padding: "6px",
                        borderRight: "0.5px solid rgba(255,255,255,0.04)",
                        borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                        cursor: events.length > 0 ? "pointer" : "default",
                        background: isSelected ? "rgba(169,30,34,0.08)" : "transparent",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)" }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
                    >
                      <div style={{
                        width: "24px", height: "24px",
                        background: isToday ? "#A91E22" : "transparent",
                        borderRadius: isToday ? "0" : "0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginBottom: "4px",
                      }}>
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: "13px", fontWeight: isToday ? 700 : 400,
                          color: isToday ? "#fff" : "#666",
                        }}>{day}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {events.slice(0, 2).map(event => {
                          const config = EVENT_CONFIG[event.type]
                          return (
                            <div key={event.id} style={{
                              background: config.bg,
                              padding: "2px 4px",
                              fontSize: "9px",
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontWeight: 700,
                              color: config.color,
                              letterSpacing: "0.04em",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {config.icon} {event.label.split(" – ")[0].split(" ")[0]}
                              {event.amount ? ` ${formatMoney(event.amount)}` : ""}
                            </div>
                          )
                        })}
                        {events.length > 2 && (
                          <div style={{ fontSize: "9px", color: "#444", fontFamily: "'Barlow', sans-serif", paddingLeft: "4px" }}>
                            +{events.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            // List view
            <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
              <div style={{
                padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)",
                background: "#1A1E22",
              }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                  fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666",
                }}>{MONTHS[currentMonth]} {currentYear} — {monthEvents.length} Events</span>
              </div>
              {monthEvents.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif" }}>
                  No events this month
                </div>
              ) : (
                monthEvents.map(event => {
                  const config = EVENT_CONFIG[event.type]
                  const d = new Date(event.date)
                  return (
                    <div key={event.id} style={{
                      display: "flex", alignItems: "center", gap: "16px",
                      padding: "14px 20px",
                      borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                    }}>
                      <div style={{ flex: "0 0 80px", textAlign: "center" }}>
                        <p style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px",
                          fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1,
                        }}>{d.getDate()}</p>
                        <p style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                          fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
                          color: "#444", margin: "2px 0 0",
                        }}>{MONTHS[d.getMonth()].slice(0, 3)}</p>
                      </div>
                      <div style={{
                        width: "3px", alignSelf: "stretch",
                        background: config.color, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px",
                          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                          color: "#fff", margin: "0 0 2px",
                        }}>{config.label}</p>
                        <p style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                          {event.label} · {event.reference}
                        </p>
                      </div>
                      {event.amount && (
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px",
                          fontWeight: 700, color: config.color,
                        }}>{formatMoney(event.amount)}</span>
                      )}
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                        fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: event.status === "completed" ? "#5A9E5A" :
                               event.status === "overdue" ? "#A91E22" :
                               event.status === "due_soon" ? "#C4A93A" : "#666",
                        background: event.status === "completed" ? "rgba(90,158,90,0.1)" :
                                    event.status === "overdue" ? "rgba(169,30,34,0.1)" :
                                    event.status === "due_soon" ? "rgba(196,169,58,0.1)" : "rgba(255,255,255,0.05)",
                        padding: "3px 8px",
                      }}>
                        {event.status === "due_soon" ? "Due Soon" :
                         event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Right panel — selected day or upcoming */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Selected day events */}
          {selectedDay && selectedEvents.length > 0 && (
            <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
              <div style={{
                padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)",
                background: "#1A1E22",
              }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                  fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#888",
                }}>{MONTHS[currentMonth]} {selectedDay}</span>
              </div>
              {selectedEvents.map(event => {
                const config = EVENT_CONFIG[event.type]
                return (
                  <div key={event.id} style={{
                    padding: "12px 16px",
                    borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                    borderLeft: `3px solid ${config.color}`,
                  }}>
                    <p style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px",
                      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                      color: config.color, margin: "0 0 2px",
                    }}>{config.label}</p>
                    <p style={{ fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", margin: "0 0 4px" }}>
                      {event.label}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "#555", fontFamily: "'Barlow', sans-serif" }}>{event.reference}</span>
                      {event.amount && (
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px",
                          fontWeight: 700, color: config.color,
                        }}>{formatMoney(event.amount)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Upcoming 30 days */}
          <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
            <div style={{
              padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)",
              background: "#1A1E22",
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#888",
              }}>Next 30 Days</span>
            </div>
            {upcomingAll.length === 0 ? (
              <div style={{ padding: "20px 16px", fontSize: "12px", color: "#333", fontFamily: "'Barlow', sans-serif" }}>
                Nothing due in the next 30 days
              </div>
            ) : (
              upcomingAll.map(event => {
                const config = EVENT_CONFIG[event.type]
                const d = new Date(event.date)
                const daysLeft = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={event.id} style={{
                    display: "flex", alignItems: "flex-start", gap: "10px",
                    padding: "10px 16px",
                    borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                  }}>
                    <div style={{
                      flex: "0 0 36px", height: "36px",
                      background: config.bg,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "14px", fontWeight: 700, color: config.color, lineHeight: 1,
                      }}>{d.getDate()}</span>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "8px", fontWeight: 600, color: config.color,
                        letterSpacing: "0.1em", textTransform: "uppercase",
                      }}>{MONTHS[d.getMonth()].slice(0, 3)}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px",
                        fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                        color: config.color, margin: "0 0 1px",
                      }}>{config.icon} {config.label}</p>
                      <p style={{ fontSize: "11px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                        {event.label.length > 20 ? event.label.slice(0, 20) + "…" : event.label}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {event.amount && (
                        <p style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px",
                          fontWeight: 700, color: config.color, margin: "0 0 2px",
                        }}>{formatMoney(event.amount)}</p>
                      )}
                      <p style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
                        fontWeight: 600, color: daysLeft <= 7 ? "#A91E22" : daysLeft <= 14 ? "#C4A93A" : "#555",
                        margin: 0,
                      }}>{daysLeft}d</p>
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
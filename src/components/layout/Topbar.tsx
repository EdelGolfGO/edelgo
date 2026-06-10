"use client"

import { Bell, User, Settings, LogOut, ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export default function Topbar() {
  const supabase = createClient()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [signOutModal, setSignOutModal] = useState(false)
  const [profile, setProfile] = useState<{ full_name: string; email: string; title: string } | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadProfile()
    loadUnreadCount()
    // Refresh count every 60 seconds
    const interval = setInterval(loadUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    setProfile({
      full_name: data?.full_name || user.email || "Admin",
      email: user.email || "",
      title: "Administrator",
    })
  }

  async function loadUnreadCount() {
    const supabase = createClient()

    // Count unread portal notifications — exclude dealer signups (those go in Approvals tab)
    const { count: notifCount } = await supabase
      .from("portal_notifications")
      .select("id", { count: "exact" })
      .eq("is_read", false)
      .neq("type", "new_dealer_signup")

    // Count overdue payments
    const { data: pos } = await supabase
      .from("purchase_orders")
      .select("order_date, deposit_paid_date, actual_ship_date, final_payment_paid_date, status")
      .neq("status", "cancelled")

    const { data: invoices } = await supabase
      .from("distributor_invoices")
      .select("invoice_date, deposit_paid_date, ship_date, final_payment_paid_date")

    let overdueCount = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const po of pos || []) {
      const depositDue = new Date(po.order_date)
      if (!po.deposit_paid_date && depositDue < today) overdueCount++
      if (po.actual_ship_date && !po.final_payment_paid_date) {
        const finalDue = new Date(po.actual_ship_date)
        finalDue.setDate(finalDue.getDate() + 14)
        if (finalDue < today) overdueCount++
      }
    }

    for (const inv of invoices || []) {
      const depositDue = new Date(inv.invoice_date)
      depositDue.setDate(depositDue.getDate() + 14)
      if (!inv.deposit_paid_date && depositDue < today) overdueCount++
      if (inv.ship_date && !inv.final_payment_paid_date) {
        const finalDue = new Date(inv.ship_date)
        finalDue.setDate(finalDue.getDate() + 45)
        if (finalDue < today) overdueCount++
      }
    }

    setUnreadCount((notifCount || 0) + overdueCount)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "EF"

  return (
    <>
      <header style={{
        background: "#0D0F10",
        borderBottom: "2px solid #A91E22",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: "80px",
        width: "100%",
        flexShrink: 0,
        position: "relative",
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={() => router.push("/dashboard")}>
          <img src="/edelfit-logo.png" alt="EdelFit" style={{ height: "55px", width: "auto", filter: "invert(1)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444", fontFamily: "'Barlow Condensed', sans-serif" }}>Spring 2026</span>

          {/* Bell icon with count */}
          <div
            onClick={() => router.push("/operations/alerts")}
            style={{ position: "relative", cursor: "pointer", padding: "4px" }}
            title="View Alerts"
          >
            <Bell size={18} color={unreadCount > 0 ? "#C4A93A" : "#444"} />
            {unreadCount > 0 && (
              <div style={{
                position: "absolute", top: "0px", right: "0px",
                minWidth: "16px", height: "16px",
                background: "#A91E22",
                borderRadius: "8px",
                border: "1.5px solid #0D0F10",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px",
              }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              </div>
            )}
          </div>

          {/* Account button */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                cursor: "pointer", padding: "4px 8px",
                border: dropdownOpen ? "1.5px solid #A91E22" : "1.5px solid #333",
                background: dropdownOpen ? "rgba(169,30,34,0.08)" : "#1A1A1A",
              }}>
              <div style={{ width: "24px", height: "24px", background: "#A91E22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}>
                {initials}
              </div>
              {profile?.full_name && (
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#888", letterSpacing: "0.06em" }}>
                  {profile.full_name.split(" ")[0]}
                </span>
              )}
              <ChevronDown size={12} color="#666" style={{ transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
            </div>

            {dropdownOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#161A1D", border: "0.5px solid rgba(255,255,255,0.08)", borderTop: "2px solid #A91E22", minWidth: "220px", zIndex: 100 }}>
                <div style={{ padding: "14px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "0.04em" }}>{profile?.full_name || "Admin"}</p>
                  <p style={{ fontSize: "11px", color: "#555", margin: "2px 0 0", fontFamily: "'Barlow', sans-serif" }}>{profile?.email}</p>
                  <p style={{ fontSize: "10px", color: "#333", margin: "2px 0 0", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>{profile?.title || "Administrator"}</p>
                </div>

                {[
                  { icon: User, label: "My Profile", action: () => { router.push("/profile"); setDropdownOpen(false) } },
                  { icon: Settings, label: "Settings", action: () => { router.push("/settings"); setDropdownOpen(false) } },
                ].map((item) => (
                  <div key={item.label} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 16px", cursor: "pointer", fontSize: "13px", color: "#888", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <item.icon size={14} />
                    {item.label}
                  </div>
                ))}

                <div onClick={() => { setDropdownOpen(false); setSignOutModal(true) }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 16px", cursor: "pointer", fontSize: "13px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(169,30,34,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <LogOut size={14} />
                  Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {signOutModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setSignOutModal(false)}>
          <div style={{ background: "#161A1D", border: "0.5px solid rgba(255,255,255,0.08)", borderTop: "2px solid #A91E22", padding: "32px", width: "360px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <img src="/edelfit-logo.png" alt="EdelFit" style={{ height: "24px", width: "auto", filter: "invert(1)" }} />
            </div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 8px" }}>Sign Out?</h2>
            <p style={{ fontSize: "13px", color: "#666", fontFamily: "'Barlow', sans-serif", margin: "0 0 24px" }}>You will be returned to the login screen.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setSignOutModal(false)} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", background: "transparent", border: "1px solid #333", padding: "10px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSignOut} style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "10px", cursor: "pointer" }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
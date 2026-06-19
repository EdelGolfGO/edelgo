"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { LogOut, ChevronDown, ShoppingCart, Clock, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase"

export default function PortalTopbar() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [signOutModal, setSignOutModal] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const navItems = [
    { label: "Place Order", href: "/portal/order", icon: ShoppingCart },
    { label: "My Orders", href: "/portal/orders", icon: Clock },
    { label: "Invoices", href: "/portal/invoices", icon: FileText },
  ]

  return (
    <>
      <header style={{
        background: "#0D0F10",
        borderBottom: "2px solid #A91E22",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        height: "56px",
        width: "100%",
        flexShrink: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <img
            src="/edelfit-logo.png"
            alt="EdelFit"
            style={{ height: "30px", width: "auto", filter: "invert(1)", cursor: "pointer" }}
            onClick={() => router.push("/portal")}
          />

          {/* Nav */}
          <nav style={{ display: "flex", gap: "4px" }}>
            {navItems.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/")
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "12px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: active ? "#fff" : "#555",
                    background: active ? "rgba(169,30,34,0.1)" : "transparent",
                    border: "none",
                    borderBottom: active ? "2px solid #A91E22" : "2px solid transparent",
                    padding: "0 12px",
                    height: "56px",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Account */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              cursor: "pointer", padding: "6px 12px",
              border: dropdownOpen ? "1.5px solid #A91E22" : "1.5px solid #333",
              background: dropdownOpen ? "rgba(169,30,34,0.08)" : "#1A1A1A",
            }}
          >
            <div style={{ width: "24px", height: "24px", background: "#A91E22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif" }}>EF</div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888" }}>My Account</span>
            <ChevronDown size={12} color="#555" style={{ transform: dropdownOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }} />
          </div>

          {dropdownOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#161A1D", border: "0.5px solid rgba(255,255,255,0.08)", borderTop: "2px solid #A91E22", minWidth: "180px", zIndex: 100 }}>
              <div
                onClick={() => { setDropdownOpen(false); setSignOutModal(true) }}
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", cursor: "pointer", fontSize: "13px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(169,30,34,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <LogOut size={14} />
                Sign Out
              </div>
            </div>
          )}
        </div>
      </header>

      {signOutModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setSignOutModal(false)}>
          <div style={{ background: "#161A1D", border: "0.5px solid rgba(255,255,255,0.08)", borderTop: "2px solid #A91E22", padding: "32px", width: "360px" }} onClick={e => e.stopPropagation()}>
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
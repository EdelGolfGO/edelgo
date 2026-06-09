"use client"

import { Bell, User, Settings, LogOut, ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function Topbar() {
  const supabase = createClient()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [signOutModal, setSignOutModal] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <>
      <header style={{
        background: "#0D0F10",
        borderBottom: "2px solid #A91E22",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: "52px",
        width: "100%",
        flexShrink: 0,
        position: "relative",
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={() => router.push("/dashboard")}>
          <img
            src="/edelfit-logo.png"
            alt="EdelFit"
            style={{ height: "36px", width: "auto", filter: "invert(1) brightness(2)" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{
            fontSize: "10px", fontWeight: 500, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#444",
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>Spring 2026</span>

          <div style={{ position: "relative", cursor: "pointer" }}>
            <Bell size={18} color="#444" />
            <div style={{
              position: "absolute", top: "-2px", right: "-2px",
              width: "7px", height: "7px", background: "#A91E22",
              borderRadius: "50%", border: "1.5px solid #0D0F10",
            }} />
          </div>

          {/* Account button */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                cursor: "pointer", padding: "4px 8px",
                border: dropdownOpen ? "1.5px solid #A91E22" : "1.5px solid #333",
                background: dropdownOpen ? "rgba(169,30,34,0.08)" : "#1A1A1A",
              }}>
              <div style={{
                width: "22px", height: "22px",
                background: "#A91E22",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", fontWeight: 700, color: "#fff",
                fontFamily: "'Barlow Condensed', sans-serif",
              }}>EF</div>
              <ChevronDown size={12} color="#666" style={{
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s",
              }} />
            </div>

            {dropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "#161A1D",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderTop: "2px solid #A91E22",
                minWidth: "200px",
                zIndex: 100,
              }}>
                <div style={{
                  padding: "14px 16px",
                  borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                }}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "13px", fontWeight: 700,
                    color: "#fff", margin: 0, letterSpacing: "0.04em",
                  }}>EdelFit Admin</p>
                  <p style={{
                    fontSize: "11px", color: "#444",
                    margin: "2px 0 0", fontFamily: "'Barlow', sans-serif",
                  }}>Administrator</p>
                </div>

                {[
                  { icon: User, label: "My Profile", action: () => {} },
                  { icon: Settings, label: "Settings", action: () => { router.push("/settings"); setDropdownOpen(false) } },
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={item.action}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "11px 16px", cursor: "pointer",
                      fontSize: "13px", color: "#888",
                      fontFamily: "'Barlow', sans-serif",
                      borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <item.icon size={14} />
                    {item.label}
                  </div>
                ))}

                <div
                  onClick={() => { setDropdownOpen(false); setSignOutModal(true) }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "11px 16px", cursor: "pointer",
                    fontSize: "13px", color: "#A91E22",
                    fontFamily: "'Barlow', sans-serif",
                  }}
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

      {/* Sign out modal */}
      {signOutModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200,
        }}
          onClick={() => setSignOutModal(false)}
        >
          <div
            style={{
              background: "#161A1D",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderTop: "2px solid #A91E22",
              padding: "32px",
              width: "360px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <img src="/edelfit-logo.png" alt="EdelFit" style={{ height: "24px", width: "auto", filter: "invert(1)" }} />
            </div>
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "20px", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              color: "#fff", margin: "0 0 8px",
            }}>Sign Out?</h2>
            <p style={{
              fontSize: "13px", color: "#666",
              fontFamily: "'Barlow', sans-serif",
              margin: "0 0 24px", fontWeight: 400,
              textTransform: "none", letterSpacing: "normal",
            }}>
              You will be returned to the login screen.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setSignOutModal(false)}
                style={{
                  flex: 1,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "12px", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "#666", background: "transparent",
                  border: "1px solid #333", padding: "10px",
                  cursor: "pointer",
                }}>Cancel</button>
              <button
                onClick={handleSignOut}
                style={{
                  flex: 1,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "12px", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "#fff", background: "#A91E22",
                  border: "none", padding: "10px",
                  cursor: "pointer",
                }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
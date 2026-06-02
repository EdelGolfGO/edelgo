import { Bell } from "lucide-react"

export default function Topbar() {
  return (
    <header style={{
      background: "#0D0F10",
      borderBottom: "2px solid var(--edel-red)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      height: "52px",
      gridColumn: "1 / -1",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: "22px",
        fontWeight: 800,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "#fff",
      }}>
        <div style={{
          width: "28px",
          height: "28px",
          background: "var(--edel-red)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 800,
          color: "#fff",
        }}>
          EG
        </div>
        EDEL
        <div style={{
          width: "1px",
          height: "18px",
          background: "rgba(255,255,255,0.15)",
        }} />
        <span style={{
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.22em",
          color: "var(--edel-red)",
        }}>
          Dealer Portal
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <span style={{
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--edel-text-dim)",
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          Spring 2026
        </span>
        <div style={{ position: "relative", cursor: "pointer" }}>
          <Bell size={18} color="#444" />
          <div style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            width: "7px",
            height: "7px",
            background: "var(--edel-red)",
            borderRadius: "50%",
            border: "1.5px solid #0D0F10",
          }} />
        </div>
        <div style={{
          width: "30px",
          height: "30px",
          background: "#1A1A1A",
          border: "1.5px solid var(--edel-red)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 700,
          color: "#fff",
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: "0.06em",
        }}>
          JW
        </div>
      </div>
    </header>
  )
}
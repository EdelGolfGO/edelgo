"use client"

import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()

  const stats = [
    { label: "Open Orders", value: "14", delta: "↑ +3 this week", up: true },
    { label: "Units Pending Build", value: "47", delta: "— No change", up: null },
    { label: "MTD Revenue", value: "$84k", delta: "↑ +12% vs last mo", up: true },
    { label: "Low Stock SKUs", value: "6", delta: "⚠ 2 critical", up: false },
  ]

  const orders = [
    { num: "#EG-2841", dealer: "Golf Galaxy – Denver", items: "3 putters", value: "$1,290", status: "Pending", color: "#A91E22" },
    { num: "#EG-2840", dealer: "Fairway & Greene", items: "8 wedges", value: "$3,440", status: "Processing", color: "#6A9CC8" },
    { num: "#EG-2839", dealer: "The Caddy Shack", items: "1 putter", value: "$420", status: "Fulfilled", color: "#5A9E5A" },
    { num: "#EG-2838", dealer: "PGA Tour Superstore", items: "12 wedges", value: "$5,160", status: "Needs Review", color: "#D44444" },
    { num: "#EG-2837", dealer: "Pinehurst Pro Shop", items: "4 putters", value: "$1,720", status: "Fulfilled", color: "#5A9E5A" },
  ]

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
          }}>Dealer Dashboard</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Good Morning, Josh</h1>
          <p style={{
            fontSize: "12px", color: "#888", marginTop: "5px",
            fontWeight: 400, fontFamily: "'Barlow', sans-serif",
            textTransform: "none", letterSpacing: "normal",
          }}>
            Tuesday, June 3 · 14 open orders · 3 require action
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase", color: "#888",
            background: "transparent", border: "1px solid #333", padding: "7px 14px", cursor: "pointer",
          }}>Export</button>
          <button
            onClick={() => router.push("/orders/new")}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff",
              background: "#A91E22", border: "none", padding: "8px 18px", cursor: "pointer",
            }}>+ New Order</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{
            background: "#22262B",
            border: "0.5px solid rgba(255,255,255,0.10)",
            borderTop: `2px solid ${stat.up === false ? "#A91E22" : "#2A2A2A"}`,
            padding: "18px 20px",
          }}>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600,
              letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px",
            }}>{stat.label}</p>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "36px",
              fontWeight: 700, color: "#fff", lineHeight: "1", margin: 0,
            }}>{stat.value}</p>
            <p style={{
              fontSize: "11px", marginTop: "7px", fontFamily: "'Barlow', sans-serif",
              color: stat.up === true ? "#5A9E5A" : stat.up === false ? "#A91E22" : "#555",
            }}>{stat.delta}</p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.10)",
          background: "#1A1E22",
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700,
            letterSpacing: "0.16em", textTransform: "uppercase", color: "#888",
          }}>Recent Orders</span>
          <span
            onClick={() => router.push("/orders")}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase", color: "#A91E22", cursor: "pointer",
            }}>View All →</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Order", "Dealer", "Items", "Value", "Status"].map((h) => (
                <th key={h} style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700,
                  letterSpacing: "0.16em", textTransform: "uppercase", color: "#666",
                  padding: "10px 20px", textAlign: "left",
                  borderBottom: "0.5px solid rgba(255,255,255,0.08)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((row) => (
              <tr
                key={row.num}
                style={{ cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "13px 20px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 600, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.05)", letterSpacing: "0.05em" }}>{row.num}</td>
                <td style={{ padding: "13px 20px", fontSize: "13px", color: "#DDD", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>{row.dealer}</td>
                <td style={{ padding: "13px 20px", fontSize: "13px", color: "#BBB", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>{row.items}</td>
                <td style={{ padding: "13px 20px", fontSize: "13px", color: "#BBB", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>{row.value}</td>
                <td style={{ padding: "13px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", color: row.color,
                    background: `${row.color}22`, padding: "4px 10px",
                  }}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
export default function DashboardPage() {
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
        paddingBottom: "16px", borderBottom: "0.5px solid var(--edel-border)",
      }}>
        <div>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px",
            fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase",
            color: "var(--edel-red)", marginBottom: "4px",
          }}>Dealer Dashboard</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Good Morning, Josh</h1>
          <p style={{ fontSize: "12px", color: "var(--edel-text-dim)", marginTop: "5px", fontWeight: 400, fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal" }}>
            Tuesday, June 3 · 14 open orders · 3 require action
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase", color: "#555",
            background: "transparent", border: "1px solid #222", padding: "7px 14px", cursor: "pointer",
          }}>Export</button>
          <button style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff",
            background: "var(--edel-red)", border: "none", padding: "8px 18px", cursor: "pointer",
          }}>+ New Order</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{
            background: "var(--edel-bg-4)", border: "0.5px solid var(--edel-border)",
            borderTop: `2px solid ${stat.up === false ? "var(--edel-red)" : "#1E1E1E"}`,
            padding: "16px 18px",
          }}>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600,
              letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--edel-text-dim)", marginBottom: "8px",
            }}>{stat.label}</p>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: "36px",
              fontWeight: 700, color: "#fff", lineHeight: "1", margin: 0,
            }}>{stat.value}</p>
            <p style={{
              fontSize: "11px", marginTop: "7px", fontFamily: "'Barlow', sans-serif",
              color: stat.up === true ? "#5A9E5A" : stat.up === false ? "var(--edel-red)" : "#333",
            }}>{stat.delta}</p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div style={{ background: "var(--edel-bg-4)", border: "0.5px solid var(--edel-border)" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", borderBottom: "0.5px solid var(--edel-border)", background: "#0F1113",
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700,
            letterSpacing: "0.16em", textTransform: "uppercase", color: "#444",
          }}>Recent Orders</span>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--edel-red)", cursor: "pointer",
          }}>View All →</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Order", "Dealer", "Items", "Value", "Status"].map((h) => (
                <th key={h} style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700,
                  letterSpacing: "0.16em", textTransform: "uppercase", color: "#252525",
                  padding: "8px 18px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((row) => (
              <tr key={row.num} style={{ cursor: "pointer" }}>
                <td style={{ padding: "11px 18px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--edel-red)", borderBottom: "0.5px solid rgba(255,255,255,0.03)", letterSpacing: "0.05em" }}>{row.num}</td>
                <td style={{ padding: "11px 18px", fontSize: "12px", color: "#666", borderBottom: "0.5px solid rgba(255,255,255,0.03)" }}>{row.dealer}</td>
                <td style={{ padding: "11px 18px", fontSize: "12px", color: "#666", borderBottom: "0.5px solid rgba(255,255,255,0.03)" }}>{row.items}</td>
                <td style={{ padding: "11px 18px", fontSize: "12px", color: "#666", borderBottom: "0.5px solid rgba(255,255,255,0.03)" }}>{row.value}</td>
                <td style={{ padding: "11px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.03)" }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", color: row.color,
                    background: `${row.color}22`, padding: "3px 8px",
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
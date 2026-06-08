export default function PendingOrdersPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Orders</p>
        <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Pending Review</h1>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>Orders pending approval — coming soon</p>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { DollarSign, Download } from "lucide-react"

type CogsEntry = {
  sku_id: string
  sku_code: string
  name: string
  msrp: number
  wholesaler_price: number
  factory_cost: number
  freight_cost: number
  duties_cost: number
  other_cost: number
  landed_cost: number
  units_sold: number
}

export default function CogsPage() {
  const [entries, setEntries] = useState<CogsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [quarter, setQuarter] = useState(`Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from("skus").select("id, sku_code, name, msrp, wholesaler_price, unit_cost").eq("is_active", true).order("sku_code")
    if (data) {
      setEntries(data.map(s => ({
        sku_id: s.id,
        sku_code: s.sku_code,
        name: s.name,
        msrp: s.msrp || 0,
        wholesaler_price: s.wholesaler_price || 0,
        factory_cost: s.unit_cost || 0,
        freight_cost: 0,
        duties_cost: 0,
        other_cost: 0,
        landed_cost: s.unit_cost || 0,
        units_sold: 0,
      })))
    }
    setLoading(false)
  }

  function updateEntry(sku_id: string, key: string, value: number) {
    setEntries(prev => prev.map(e => {
      if (e.sku_id !== sku_id) return e
      const updated = { ...e, [key]: value }
      updated.landed_cost = updated.factory_cost + updated.freight_cost + updated.duties_cost + updated.other_cost
      return updated
    }))
  }

  function getTotalCogs() {
    return entries.reduce((sum, e) => sum + e.landed_cost * e.units_sold, 0)
  }

  function getTotalRevenue() {
    return entries.reduce((sum, e) => sum + e.wholesaler_price * e.units_sold, 0)
  }

  function getTotalGrossProfit() {
    return getTotalRevenue() - getTotalCogs()
  }

  function exportCSV() {
    const headers = ["SKU Code", "Name", "MSRP", "Wholesale Price", "Factory Cost", "Freight", "Duties", "Other", "Landed Cost", "Units Sold", "Total COGS", "Total Revenue", "Gross Profit"]
    const rows = entries.map(e => [
      e.sku_code, e.name, e.msrp, e.wholesaler_price,
      e.factory_cost, e.freight_cost, e.duties_cost, e.other_cost,
      e.landed_cost, e.units_sold,
      (e.landed_cost * e.units_sold).toFixed(2),
      (e.wholesaler_price * e.units_sold).toFixed(2),
      ((e.wholesaler_price - e.landed_cost) * e.units_sold).toFixed(2),
    ])
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `EdelFit_COGS_${quarter.replace(" ", "_")}.csv`
    a.click()
  }

  const inputStyle = { background: "#13161A", border: "0.5px solid rgba(255,255,255,0.08)", color: "#fff", padding: "5px 8px", fontSize: "12px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, outline: "none", width: "90px", textAlign: "right" as const }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Finance</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>COGS Calculator</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>
            Calculate cost of goods sold for financial reporting
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div>
            <input style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "140px" }} value={quarter} onChange={e => setQuarter(e.target.value)} placeholder="Q1 2026" />
          </div>
          <button onClick={exportCSV} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { label: "Total COGS", value: `$${Math.round(getTotalCogs()).toLocaleString()}`, color: "#A91E22" },
          { label: "Total Revenue", value: `$${Math.round(getTotalRevenue()).toLocaleString()}`, color: "#5A9E5A" },
          { label: "Gross Profit", value: `$${Math.round(getTotalGrossProfit()).toLocaleString()}`, color: getTotalGrossProfit() > 0 ? "#5A9E5A" : "#A91E22" },
          { label: "Gross Margin", value: getTotalRevenue() > 0 ? `${(getTotalGrossProfit() / getTotalRevenue() * 100).toFixed(1)}%` : "—", color: "#6A9CC8" },
        ].map(s => (
          <div key={s.label} style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", borderTop: "2px solid #2A2A2A", padding: "18px 20px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{s.label}</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 700, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", textTransform: "uppercase" }}>Loading...</div>
      ) : (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
            <thead>
              <tr style={{ background: "#1A1E22" }}>
                {["SKU", "Name", "MSRP", "Wholesale", "Factory Cost", "Freight", "Duties", "Other", "Landed Cost", "Units Sold", "Total COGS", "Gross Profit"].map(h => (
                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", padding: "10px 10px", textAlign: h === "SKU" || h === "Name" ? "left" : "right", borderBottom: "0.5px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const totalCogs = entry.landed_cost * entry.units_sold
                const totalRev = entry.wholesaler_price * entry.units_sold
                const gp = totalRev - totalCogs
                return (
                  <tr key={entry.sku_id}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "8px 10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{entry.sku_code}</td>
                    <td style={{ padding: "8px 10px", fontSize: "11px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#666" }}>${entry.msrp.toFixed(2)}</span>
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#666" }}>${entry.wholesaler_price.toFixed(2)}</span>
                    </td>
                    {["factory_cost", "freight_cost", "duties_cost", "other_cost"].map(key => (
                      <td key={key} style={{ padding: "4px 6px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                        <input type="number" style={inputStyle} value={(entry as any)[key] || ""} placeholder="0.00" onChange={e => updateEntry(entry.sku_id, key, parseFloat(e.target.value) || 0)} />
                      </td>
                    ))}
                    <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff" }}>${entry.landed_cost.toFixed(2)}</span>
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                      <input type="number" style={inputStyle} value={entry.units_sold || ""} placeholder="0" onChange={e => updateEntry(entry.sku_id, "units_sold", parseInt(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22" }}>${totalCogs.toFixed(2)}</span>
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", textAlign: "right" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: gp >= 0 ? "#5A9E5A" : "#A91E22" }}>${gp.toFixed(2)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1A1E22" }}>
                <td colSpan={10} style={{ padding: "10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", textAlign: "right" }}>Totals</td>
                <td style={{ padding: "10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#A91E22", textAlign: "right" }}>${getTotalCogs().toFixed(2)}</td>
                <td style={{ padding: "10px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "14px", fontWeight: 700, color: "#5A9E5A", textAlign: "right" }}>${getTotalGrossProfit().toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
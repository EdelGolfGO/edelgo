"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { RefreshCw, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react"

type Cin7Stock = {
  SKU: string
  Name: string
  OnHand: number
  Allocated: number
  OnOrder: number
  Available: number
  Location: string
}

type MatchResult = {
  cin7: Cin7Stock
  edelfit_id: string | null
  edelfit_sku_code: string | null
  status: "matched" | "not_in_edelfit" | "not_in_cin7"
}

export default function Cin7ImportPage() {
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<MatchResult[]>([])
  const [importDone, setImportDone] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<"all" | "matched" | "not_in_edelfit" | "not_in_cin7">("all")
  const [search, setSearch] = useState("")

  async function fetchAndCompare() {
    setLoading(true)
    setError("")
    setResults([])
    setImportDone(false)

    try {
      // Fetch from Cin7 via our API route
      const cin7Res = await fetch("/api/cin7/stock")
      if (!cin7Res.ok) throw new Error("Failed to fetch from Cin7")
      const cin7Data: Cin7Stock[] = await cin7Res.json()

      // Fetch EdelFit SKUs
      const supabase = createClient()
      const { data: edelfitSkus } = await supabase
        .from("skus")
        .select("id, sku_code")

      const edelfitMap: Record<string, { id: string; sku_code: string }> = {}
      edelfitSkus?.forEach(s => { edelfitMap[s.sku_code] = s })

      const cin7SkuSet = new Set(cin7Data.map(c => c.SKU))

      // Match results
      const matched: MatchResult[] = cin7Data.map(c => ({
        cin7: c,
        edelfit_id: edelfitMap[c.SKU]?.id || null,
        edelfit_sku_code: edelfitMap[c.SKU]?.sku_code || null,
        status: edelfitMap[c.SKU] ? "matched" : "not_in_edelfit",
      }))

      // Add EdelFit SKUs not in Cin7
      edelfitSkus?.forEach(s => {
        if (!cin7SkuSet.has(s.sku_code)) {
          matched.push({
            cin7: { SKU: s.sku_code, Name: "", OnHand: 0, Allocated: 0, OnOrder: 0, Available: 0, Location: "" },
            edelfit_id: s.id,
            edelfit_sku_code: s.sku_code,
            status: "not_in_cin7",
          })
        }
      })

      setResults(matched)
    } catch (e: any) {
      setError(e.message || "Failed to fetch data")
    }
    setLoading(false)
  }

  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const toImport = results.filter(r => r.status === "matched" && r.edelfit_id)
    let count = 0

    for (const result of toImport) {
      const inv = result.cin7
      // Check if inventory record exists
      const { data: existing } = await supabase
        .from("inventory")
        .select("id")
        .eq("sku_id", result.edelfit_id!)
        .single()

      if (existing) {
        await supabase.from("inventory").update({
          qty_on_hand: Math.round(inv.OnHand),
          qty_reserved: Math.round(inv.Allocated),
          qty_on_order: Math.round(inv.OnOrder),
          updated_at: new Date().toISOString(),
        }).eq("sku_id", result.edelfit_id!)
      } else {
        await supabase.from("inventory").insert({
          sku_id: result.edelfit_id!,
          qty_on_hand: Math.round(inv.OnHand),
          qty_reserved: Math.round(inv.Allocated),
          qty_on_order: Math.round(inv.OnOrder),
          min_stock: 0,
          max_stock: 999,
          reorder_qty: 0,
        })
      }
      count++
    }

    setImportCount(count)
    setImportDone(true)
    setImporting(false)
  }

  function exportCSV() {
    const headers = ["Status", "SKU", "Name", "Cin7 On Hand", "Cin7 Allocated", "Cin7 On Order", "In EdelFit"]
    const rows = results.map(r => [
      r.status,
      r.cin7.SKU,
      r.cin7.Name,
      r.cin7.OnHand,
      r.cin7.Allocated,
      r.cin7.OnOrder,
      r.edelfit_id ? "Yes" : "No",
    ])
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `EdelFit_Cin7_Comparison_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const matched = results.filter(r => r.status === "matched").length
  const notInEdelfit = results.filter(r => r.status === "not_in_edelfit").length
  const notInCin7 = results.filter(r => r.status === "not_in_cin7").length

  const filtered = results.filter(r => {
    if (filter !== "all" && r.status !== filter) return false
    if (search && !r.cin7.SKU.toLowerCase().includes(search.toLowerCase()) && !r.cin7.Name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#555" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A91E22", marginBottom: "4px" }}>Inventory</p>
          <h1 style={{ fontSize: "32px", color: "#fff", margin: 0 }}>Cin7 Import</h1>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "5px", fontFamily: "'Barlow', sans-serif" }}>
            Compare and sync stock levels from Cin7 Core into EdelFit
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {results.length > 0 && (
            <button onClick={exportCSV} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", background: "transparent", border: "1px solid #333", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <Download size={13} /> Export CSV
            </button>
          )}
          <button onClick={fetchAndCompare} disabled={loading} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: loading ? "#333" : "#A91E22", border: "none", padding: "8px 18px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Fetching from Cin7..." : "Fetch & Compare"}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: "rgba(106,156,200,0.08)", border: "0.5px solid rgba(106,156,200,0.2)", padding: "14px 18px" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6A9CC8", margin: "0 0 4px" }}>How this works</p>
        <p style={{ fontSize: "12px", color: "#888", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
          Click "Fetch & Compare" to pull all stock from Cin7 and match it against EdelFit SKUs by SKU code. Review the results, then click "Import Stock Levels" to update EdelFit's inventory with Cin7's on-hand quantities.
        </p>
      </div>

      {error && (
        <div style={{ background: "rgba(169,30,34,0.08)", border: "0.5px solid rgba(169,30,34,0.25)", padding: "14px 18px", fontSize: "13px", color: "#A91E22", fontFamily: "'Barlow', sans-serif" }}>
          {error}
        </div>
      )}

      {importDone && (
        <div style={{ background: "rgba(90,158,90,0.08)", border: "0.5px solid rgba(90,158,90,0.25)", padding: "14px 18px", fontSize: "13px", color: "#5A9E5A", fontFamily: "'Barlow', sans-serif" }}>
          ✓ Successfully imported stock levels for {importCount} SKUs from Cin7.
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
            {[
              { label: "Total in Cin7", value: results.filter(r => r.status !== "not_in_cin7").length, color: "#fff", top: "#2A2A2A", f: "all" },
              { label: "Matched", value: matched, color: "#5A9E5A", top: "#5A9E5A", f: "matched" },
              { label: "Not in EdelFit", value: notInEdelfit, color: "#C4A93A", top: notInEdelfit > 0 ? "#C4A93A" : "#2A2A2A", f: "not_in_edelfit" },
              { label: "Not in Cin7", value: notInCin7, color: "#6A9CC8", top: notInCin7 > 0 ? "#6A9CC8" : "#2A2A2A", f: "not_in_cin7" },
            ].map(s => (
              <div key={s.label} onClick={() => setFilter(filter === s.f as any ? "all" : s.f as any)} style={{ background: "#22262B", border: `0.5px solid ${filter === s.f ? s.top : "rgba(255,255,255,0.10)"}`, borderTop: `2px solid ${s.top}`, padding: "18px 20px", cursor: "pointer" }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>{s.label}</p>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 700, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Import button */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "16px 20px" }}>
            <div>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 2px" }}>
                Ready to import {matched} matched SKUs
              </p>
              <p style={{ fontSize: "12px", color: "#555", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                This will update qty_on_hand, qty_reserved, and qty_on_order in EdelFit for all matched SKUs.
              </p>
            </div>
            <button onClick={handleImport} disabled={importing || matched === 0} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: importing || matched === 0 ? "#333" : "#5A9E5A", border: "none", padding: "10px 24px", cursor: importing ? "not-allowed" : "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle size={14} /> {importing ? `Importing...` : `Import ${matched} SKUs →`}
            </button>
          </div>

          {/* Search + filter */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input placeholder="Search SKUs..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "#1A1E22", border: "0.5px solid rgba(255,255,255,0.10)", color: "#fff", padding: "8px 14px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", width: "220px" }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", color: "#444" }}>{filtered.length} SKUs shown</span>
          </div>

          {/* Results table */}
          <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1A1E22" }}>
                  {["Status", "SKU Code", "Name", "On Hand", "Allocated", "On Order", "In EdelFit"].map(h => (
                    <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#555", padding: "10px 12px", textAlign: "left", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const statusColor = r.status === "matched" ? "#5A9E5A" : r.status === "not_in_edelfit" ? "#C4A93A" : "#6A9CC8"
                  const statusLabel = r.status === "matched" ? "Matched" : r.status === "not_in_edelfit" ? "Not in EdelFit" : "Not in Cin7"
                  const statusBg = r.status === "matched" ? "rgba(90,158,90,0.1)" : r.status === "not_in_edelfit" ? "rgba(196,169,58,0.1)" : "rgba(106,156,200,0.1)"

                  return (
                    <tr key={i}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "9px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor, background: statusBg, padding: "2px 7px" }}>{statusLabel}</span>
                      </td>
                      <td style={{ padding: "9px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", fontWeight: 700, color: "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{r.cin7.SKU}</td>
                      <td style={{ padding: "9px 12px", fontSize: "12px", color: "#CCC", fontFamily: "'Barlow', sans-serif", borderBottom: "0.5px solid rgba(255,255,255,0.04)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cin7.Name || "—"}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: r.cin7.OnHand > 0 ? "#5A9E5A" : "#A91E22", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{r.cin7.OnHand ?? "—"}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", color: "#555", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{r.cin7.Allocated ?? "—"}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "12px", color: "#6A9CC8", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>{r.cin7.OnOrder ?? "—"}</td>
                      <td style={{ padding: "9px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                        {r.edelfit_id
                          ? <CheckCircle size={14} color="#5A9E5A" />
                          : <XCircle size={14} color="#555" />
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {results.length === 0 && !loading && (
        <div style={{ background: "#22262B", border: "0.5px solid rgba(255,255,255,0.10)", padding: "80px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#333", margin: "0 0 8px" }}>No Data Yet</p>
          <p style={{ fontSize: "13px", color: "#333", fontFamily: "'Barlow', sans-serif", margin: 0 }}>Click "Fetch & Compare" to pull stock data from Cin7</p>
        </div>
      )}
    </div>
  )
}
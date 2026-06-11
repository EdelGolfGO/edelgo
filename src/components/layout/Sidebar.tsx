"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import {
  LayoutDashboard, ClipboardList, Plus, Clock,
  Boxes, List, Package, Building2, Users, BarChart2, Settings, FileText,
  Briefcase, FileCheck, Calendar, Bell, TrendingDown, GitBranch, Upload,
  UserCheck,
} from "lucide-react"

export default function Sidebar() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0)

  useEffect(() => { loadCounts() }, [])

  async function loadCounts() {
    const supabase = createClient()
    const [pendingResult, notifResult, pendingOrdersResult] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact" }).eq("role", "dealer").eq("is_approved", false),
      supabase.from("portal_notifications").select("id", { count: "exact" }).eq("is_read", false),
      supabase.from("b2b_orders").select("id", { count: "exact" }).eq("status", "pending"),
    ])
    setPendingCount(pendingResult.count || 0)
    setNotifCount(notifResult.count || 0)
    setPendingOrdersCount(pendingOrdersResult.count || 0)
  }

  const nav = [
    { section: "Overview", items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ]},
    { section: "Orders", items: [
      { label: "All Orders", href: "/orders/all", icon: ClipboardList, badge: pendingOrdersCount },
      { label: "New Order", href: "/orders/new", icon: Plus },
      { label: "Pending Review", href: "/orders/pending", icon: Clock },
      { label: "Drafts", href: "/orders/drafts", icon: FileText },
    ]},
    { section: "Operations", items: [
      { label: "PO Tracker", href: "/operations/pos", icon: Briefcase },
      { label: "Invoices", href: "/operations/invoices", icon: FileCheck },
      { label: "Calendar", href: "/operations/calendar", icon: Calendar },
      { label: "Alerts", href: "/operations/alerts", icon: Bell, badge: notifCount },
    ]},
    { section: "Inventory", items: [
      { label: "Stock Levels", href: "/inventory/stock", icon: Package },
      { label: "Forecast / Reorder", href: "/inventory/forecast", icon: TrendingDown },
      { label: "Bill of Materials", href: "/inventory/boms", icon: GitBranch },
      { label: "SKUs", href: "/inventory/skus", icon: List },
      { label: "Products", href: "/inventory/products", icon: Boxes },
      { label: "Shopify Import", href: "/inventory/import", icon: Upload },
      { label: "Pricing Tiers", href: "/inventory/pricing", icon: BarChart2 },
      { label: "COGS Calculator", href: "/inventory/cogs", icon: BarChart2 },
    ]},
    { section: "Accounts", items: [
      { label: "Dealers", href: "/dealers", icon: Building2 },
      { label: "Contacts", href: "/dealers/contacts", icon: Users },
      { label: "Approvals", href: "/approvals", icon: UserCheck, badge: pendingCount },
    ]},
    { section: "Settings", items: [
      { label: "My Profile", href: "/profile", icon: Users },
      { label: "Analytics", href: "/settings/analytics", icon: BarChart2 },
      { label: "Settings", href: "/settings", icon: Settings },
    ]},
  ]

  return (
    <aside style={{
      background: "#161A1D",
      borderRight: "0.5px solid rgba(255,255,255,0.06)",
      width: "210px",
      minHeight: "100%",
      flexShrink: 0,
      paddingTop: "12px",
      overflowY: "auto",
    }}>
      {nav.map((group) => (
        <div key={group.section}>
          <p style={{
            padding: "14px 16px 5px",
            fontSize: "9px", fontWeight: 700,
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: "#2A2A2A",
            fontFamily: "'Barlow Condensed', sans-serif",
            margin: 0,
          }}>{group.section}</p>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: "9px",
                padding: "8px 14px", margin: "0 6px",
                fontSize: "13px",
                fontWeight: active ? 500 : 400,
                color: active ? "#fff" : "#555",
                background: active ? "rgba(169,30,34,0.08)" : "transparent",
                borderLeft: active ? "2px solid #A91E22" : "2px solid transparent",
                textDecoration: "none",
              }}>
                <Icon size={15} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span style={{
                    background: "#A91E22", color: "#fff",
                    fontSize: "9px", fontWeight: 700,
                    padding: "2px 6px",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    borderRadius: "2px",
                  }}>{item.badge}</span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </aside>
  )
}
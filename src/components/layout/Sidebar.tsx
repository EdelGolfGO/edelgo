"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, ClipboardList, Plus, Clock,
  Boxes, List, Package, Building2, Users, BarChart2, Settings, FileText,
  Briefcase, FileCheck, Calendar, Bell,
} from "lucide-react"

const nav = [
  { section: "Overview", items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ]},
  { section: "Orders", items: [
    { label: "All Orders", href: "/orders", icon: ClipboardList, badge: 14 },
    { label: "New Order", href: "/orders/new", icon: Plus },
    { label: "Pending Review", href: "/orders/pending", icon: Clock, badge: 3 },
    { label: "Drafts", href: "/orders/drafts", icon: FileText },
  ]},
  { section: "Operations", items: [
    { label: "PO Tracker", href: "/operations/pos", icon: Briefcase },
    { label: "Invoices", href: "/operations/invoices", icon: FileCheck },
    { label: "Calendar", href: "/operations/calendar", icon: Calendar },
    { label: "Alerts", href: "/operations/alerts", icon: Bell },
  ]},
  { section: "Catalog", items: [
    { label: "Products", href: "/inventory/products", icon: Boxes },
    { label: "SKUs & BoMs", href: "/skus", icon: List },
    { label: "Inventory", href: "/inventory", icon: Package },
  ]},
  { section: "Accounts", items: [
    { label: "Dealers", href: "/dealers", icon: Building2 },
    { label: "Contacts", href: "/dealers/contacts", icon: Users },
  ]},
  { section: "Reports", items: [
    { label: "Analytics", href: "/settings/analytics", icon: BarChart2 },
    { label: "Settings", href: "/settings", icon: Settings },
  ]},
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside style={{
      background: "#161A1D",
      borderRight: "0.5px solid rgba(255,255,255,0.06)",
      width: "210px",
      minHeight: "100%",
      flexShrink: 0,
      paddingTop: "12px",
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
            const active = pathname === item.href
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
                {item.badge && (
                  <span style={{
                    background: "#A91E22", color: "#fff",
                    fontSize: "9px", fontWeight: 700,
                    padding: "2px 6px",
                    fontFamily: "'Barlow Condensed', sans-serif",
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
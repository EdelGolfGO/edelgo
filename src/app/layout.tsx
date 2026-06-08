import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"

export const metadata: Metadata = {
  title: "EdelFit | Dealer Portal",
  description: "Edel Golf B2B Ordering Platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#080A0B", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  )
}
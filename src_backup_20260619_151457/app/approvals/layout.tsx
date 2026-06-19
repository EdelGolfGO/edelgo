import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"

export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ flexShrink: 0 }}><Topbar /></div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar />
        <main style={{ flex: 1, background: "#1A1E22", padding: "28px", overflowY: "auto", minHeight: "calc(100vh - 52px)" }}>
          {children}
        </main>
      </div>
    </div>
  )
}
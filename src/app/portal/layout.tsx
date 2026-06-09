import PortalTopbar from "@/components/portal/PortalTopbar"

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#1A1E22" }}>
      <PortalTopbar />
      <main style={{ flex: 1, padding: "32px", maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
        {children}
      </main>
    </div>
  )
}
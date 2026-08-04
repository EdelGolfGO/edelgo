import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
}

async function buildPOPdf(po: any, factory: any, items: any[]) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)

  const margin = 40
  const pageWidth = 612
  let y = 792 - 50

  function text(str: string, x: number, yPos: number, opts: { size?: number; bold?: boolean; italic?: boolean; color?: any } = {}) {
    page.drawText(str || "", {
      x, y: yPos,
      size: opts.size || 9,
      font: opts.bold ? fontBold : (opts.italic ? fontItalic : font),
      color: opts.color || rgb(0, 0, 0),
    })
  }

  function line(x1: number, y1: number, x2: number, y2: number, thickness = 0.75) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0, 0, 0) })
  }

  // ---- Header ----
  text("PURCHASE ORDER", margin, y, { size: 26 })
  text("Edel", pageWidth - margin - 40, y - 2, { italic: true, size: 14 })
  text("Edel Golf US LLC", pageWidth - margin - 150, y - 20, { bold: true, size: 11 })
  y -= 50

  // ---- Three column info block ----
  const col1X = margin
  const col2X = margin + 230
  const col3X = margin + 410
  let colY = y

  text("Purchase Order To:", col1X, colY, { bold: true, size: 9 })
  text(factory?.name || po.factory_name || "—", col1X, colY - 12, { size: 9 })
  let supplierY = colY - 24
  const addressLines = [factory?.address_line1, factory?.address_line2, [factory?.city, factory?.state_province].filter(Boolean).join(", "), [factory?.postal_code, factory?.country].filter(Boolean).join(" ")].filter(Boolean)
  for (const l of addressLines) {
    text(l, col1X, supplierY, { size: 9 })
    supplierY -= 12
  }
  if (factory?.phone) { text(factory.phone, col1X, supplierY - 6, { size: 9 }); supplierY -= 6 }
  if (factory?.email) { text(factory.email, col1X, supplierY - 20, { size: 9 }); supplierY -= 14 }

  text("Ship To:", col1X, supplierY - 38, { bold: true, size: 9 })
  text("Edel Golf US LLC", col1X, supplierY - 50, { size: 9 })
  text("123 Holmes Dr. Ste. 5", col1X, supplierY - 62, { size: 9 })
  text("Liberty Hill TX 78642", col1X, supplierY - 74, { size: 9 })

  text("Purchase Order No.", col2X, colY, { bold: true, size: 9 })
  text(po.po_number || "—", col2X, colY - 12, { size: 9 })
  text("Date", col2X, colY - 32, { bold: true, size: 9 })
  text(formatDate(po.order_date), col2X, colY - 44, { size: 9 })
  text("Required By", col2X, colY - 64, { bold: true, size: 9 })
  text(formatDate(po.required_by_date), col2X, colY - 76, { size: 9 })
  text("Terms", col2X, colY - 96, { bold: true, size: 9 })
  text(po.payment_terms || "50% PO", col2X, colY - 108, { size: 9 })
  text("Shipment Method", col2X, colY - 128, { bold: true, size: 9 })
  text((po.shipment_method || "—").slice(0, 35), col2X, colY - 140, { size: 9 })

  text("Address", col3X, colY, { bold: true, size: 9 })
  text("5280 Ward Rd", col3X, colY - 12, { size: 9 })
  text("Arvada CO 80002", col3X, colY - 24, { size: 9 })
  text("Phone", col3X, colY - 44, { bold: true, size: 9 })
  text("(303) 578-6306", col3X, colY - 56, { size: 9 })
  text("Email", col3X, colY - 76, { bold: true, size: 9 })
  text("rockyh@edelgolf.com", col3X, colY - 88, { size: 9 })
  text("Web", col3X, colY - 108, { bold: true, size: 9 })
  text("edelgolf.com", col3X, colY - 120, { size: 9 })

  y = supplierY - 90

  // ---- Line items table ----
  const tableTop = y
  const colXs = { num: margin, code: margin + 20, desc: margin + 95, supplier: margin + 260, unit: margin + 350, qty: margin + 390, price: margin + 440, discount: margin + 480, amount: margin + 520 }

  text("#", colXs.num, tableTop, { bold: true, size: 8 })
  text("Code", colXs.code, tableTop, { bold: true, size: 8 })
  text("Product Description", colXs.desc, tableTop, { bold: true, size: 8 })
  text("Supplier Code", colXs.supplier, tableTop, { bold: true, size: 8 })
  text("Unit", colXs.unit, tableTop, { bold: true, size: 8 })
  text("Quantity", colXs.qty, tableTop, { bold: true, size: 8 })
  text("Price", colXs.price, tableTop, { bold: true, size: 8 })
  text("Disc.", colXs.discount, tableTop, { bold: true, size: 8 })
  text("Amount", colXs.amount, tableTop, { bold: true, size: 8 })
  line(margin, tableTop - 4, pageWidth - margin, tableTop - 4, 1)

  let rowY = tableTop - 18
  let totalBeforeTax = 0
  let pageRef = page

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const discount = item.discount_percent || 0
    const amount = item.quantity * item.unit_cost * (1 - discount / 100)
    totalBeforeTax += amount

    if (rowY < 80) {
      // Start a new page if we run out of room
      const newPage = doc.addPage([612, 792])
      pageRef = newPage
      rowY = 792 - 60
    }

    text(String(i + 1), colXs.num, rowY, { size: 8 })
    text(item.sku_code || "", colXs.code, rowY, { size: 8 })
    text((item.product_name || "").slice(0, 38), colXs.desc, rowY, { size: 8 })
    text((item.supplier_code || "").slice(0, 22), colXs.supplier, rowY, { size: 7 })
    text("Item", colXs.unit, rowY, { size: 8 })
    text(item.quantity.toFixed(2), colXs.qty, rowY, { size: 8 })
    text(item.unit_cost.toFixed(2), colXs.price, rowY, { size: 8 })
    text(discount.toFixed(2) + "%", colXs.discount, rowY, { size: 8 })
    text(amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), colXs.amount, rowY, { size: 8 })
    rowY -= 16
  }

  line(margin, rowY + 4, pageWidth - margin, rowY + 4, 0.5)
  y = rowY - 24

  // ---- Totals ----
  const additionalCost = 0
  const tax = 0
  text("Order Lines", margin, y, { bold: true, size: 9 })
  text("Additional Cost", margin + 175, y, { bold: true, size: 9 })
  text("Total Order", margin + 350, y, { bold: true, size: 9 })
  line(margin, y - 4, margin + 150, y - 4, 0.5)
  line(margin + 175, y - 4, margin + 325, y - 4, 0.5)
  line(margin + 350, y - 4, margin + 500, y - 4, 0.5)

  y -= 18
  text(`Before Tax    ${totalBeforeTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin, y, { size: 9 })
  text(`Before Tax    ${additionalCost.toFixed(2)}`, margin + 175, y, { size: 9 })
  text(`Before Tax    ${(totalBeforeTax + additionalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + 350, y, { size: 9 })

  y -= 14
  text(`Tax    ${tax.toFixed(2)}`, margin, y, { size: 9 })
  text(`Tax    0.00`, margin + 175, y, { size: 9 })
  text(`Tax    ${tax.toFixed(2)}`, margin + 350, y, { size: 9 })

  y -= 16
  text(`Total    ${(totalBeforeTax + tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin, y, { bold: true, size: 9 })
  text(`Total    ${additionalCost.toFixed(2)}`, margin + 175, y, { bold: true, size: 9 })
  text(`Total    ${(totalBeforeTax + additionalCost + tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + 350, y, { bold: true, size: 9 })

  if (po.notes) {
    y -= 30
    text("NOTES:", margin, y, { bold: true, size: 9 })
    text(po.notes.slice(0, 100), margin, y - 14, { size: 9 })
  }

  return doc.save()
}

// POST /api/po/generate-pdf
// Body: { po_id: string }
// Generates the PO PDF, uploads it to Supabase Storage, appends it to the
// PO's document_urls list, and returns the public URL.
export async function POST(req: NextRequest) {
  try {
    const { po_id } = await req.json()
    if (!po_id) return NextResponse.json({ error: "Missing po_id" }, { status: 400 })

    const { data: po, error: poError } = await supabaseAdmin
      .from("purchase_orders")
      .select("*")
      .eq("id", po_id)
      .single()

    if (poError || !po) return NextResponse.json({ error: "PO not found" }, { status: 404 })

    let factory = null
    if (po.factory_id) {
      const { data } = await supabaseAdmin.from("factories").select("*").eq("id", po.factory_id).single()
      factory = data
    }

    const { data: items } = await supabaseAdmin
      .from("purchase_order_items")
      .select("*")
      .eq("po_id", po_id)
      .order("created_at")

    const pdfBytes = await buildPOPdf(po, factory, items || [])

    const fileName = `po/${po.po_number || po_id}-${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from("Documents")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: "Failed to upload PDF", details: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from("Documents").getPublicUrl(fileName)
    const pdfUrl = urlData.publicUrl

    // Append to the PO's existing document_urls list (don't clobber other docs)
    let existingDocs: { name: string; url: string }[] = []
    try { existingDocs = po.document_urls ? JSON.parse(po.document_urls) : [] } catch {}
    const updatedDocs = [...existingDocs, { name: `${po.po_number || "PO"}.pdf`, url: pdfUrl }]

    await supabaseAdmin.from("purchase_orders").update({
      pdf_url: pdfUrl,
      document_urls: JSON.stringify(updatedDocs),
      updated_at: new Date().toISOString(),
    }).eq("id", po_id)

    return NextResponse.json({ success: true, pdf_url: pdfUrl })
  } catch (error: any) {
    console.error("PO PDF generation error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
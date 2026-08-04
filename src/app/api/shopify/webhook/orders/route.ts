import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Maps a Shopify line-item property name to the kind of component it represents.
// Property names come from whatever your customization app (the one generating
// _pplr_customization_id) labels them — adjust these keys if yours differ.
const PROPERTY_TO_COMPONENT_TYPE: Record<string, string> = {
  "Shaft": "shaft",
  "Grip": "grip",
  "Edel x BB&F Ferrule": "ferrule",
  "Ferrule": "ferrule",
}

// Properties that are build specs, not component selections — these get stored
// as notes on the work order rather than matched against component SKUs.
const SPEC_PROPERTIES = new Set(["Hand", "Lie Angle", "Length"])

function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false
  const generatedHash = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(rawBody, "utf8")
    .digest("base64")
  try {
    return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader))
  } catch {
    return false
  }
}

// Finds a component SKU whose name best matches a property value string like
// "KBS Tour V - Wedge 125g". Matching is fuzzy (case-insensitive substring)
// since these are freeform display strings, not SKU codes.
async function findComponentByName(nameFragment: string): Promise<{ id: string; sku_code: string } | null> {
  const { data } = await supabaseAdmin
    .from("skus")
    .select("id, sku_code, name")
    .eq("is_active", true)
    .in("sku_type", ["component", "consumable"])
    .ilike("name", `%${nameFragment}%`)
    .limit(1)

  return data && data.length > 0 ? data[0] : null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256")

  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
  }

  const order = JSON.parse(rawBody)
  const lineItems = order.line_items || []
  const orderRef = order.name || order.order_number?.toString() || null
  const customerName = order.customer
    ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
    : null

  const results: any[] = []
  // Tracks non-customizable items on this same order, so they can be attached
  // to whichever Work Order(s) get created below as a shipping-coordination
  // reference (see work_order_companion_items).
  const stockLineItems: { sku_code: string; sku_name: string; quantity: number }[] = []
  const createdWorkOrderIds: string[] = []

  for (const item of lineItems) {
    const skuCode = (item.sku || "").trim()
    if (!skuCode) {
      results.push({ line_item: item.title, skipped: true, reason: "No SKU code on line item" })
      continue
    }

    // Look up the ordered SKU along with whether it has a generic parent —
    // i.e. whether this is a specific head/variant that should be filed under
    // a broader customizable product (e.g. "2000090" -> "SMS Pro Wedge").
    // Try the current sku_code first; if EdelFit's SKU codes have since been
    // renamed/standardized but Shopify still has the old code on file, fall
    // back to shopify_sku_code so orders keep matching without needing any
    // changes on the Shopify side.
    const skuSelect = "id, sku_code, name, is_customizable, generic_parent_sku_id, generic_parent:skus!generic_parent_sku_id(id, sku_code, name, is_customizable)"

    let { data: sku } = await supabaseAdmin.from("skus").select(skuSelect).eq("sku_code", skuCode).single()
    let matchedVia: "sku_code" | "shopify_sku_code" | null = sku ? "sku_code" : null

    if (!sku) {
      const fallback = await supabaseAdmin.from("skus").select(skuSelect).eq("shopify_sku_code", skuCode).single()
      if (fallback.data) {
        sku = fallback.data
        matchedVia = "shopify_sku_code"
      }
    }

    if (!sku) {
      results.push({ line_item: item.title, sku_code: skuCode, skipped: true, reason: "SKU not found in EdelFit (checked sku_code and shopify_sku_code)" })
      continue
    }

    const genericParent = (sku as any).generic_parent
    // The "build target" is either this SKU's generic parent (if linked) or,
    // failing that, the SKU itself if it's directly customizable. Anything
    // else is a stock item — pull and ship, no Work Order.
    const buildTarget = genericParent?.is_customizable ? genericParent : (sku.is_customizable ? sku : null)

    if (!buildTarget) {
      results.push({ line_item: item.title, sku_code: skuCode, skipped: true, reason: "Not customizable — pull and ship" })
      stockLineItems.push({ sku_code: sku.sku_code, sku_name: sku.name, quantity: item.quantity || 1 })
      continue
    }

    // Customizable product — build a Work Order from the line item's properties.
    const properties: { name: string; value: string }[] = item.properties || []
    const specNotes: string[] = []
    const componentMatches: { component_sku_id: string; sku_code: string; quantity: number }[] = []

    // If the ordered SKU itself is a specific head linked to a generic parent
    // (rather than the generic product being ordered directly), the ordered
    // SKU IS the head component — add it to the build sheet automatically,
    // exactly like a chosen shaft or grip.
    if (genericParent?.is_customizable && sku.id !== buildTarget.id) {
      componentMatches.push({ component_sku_id: sku.id, sku_code: sku.sku_code, quantity: 1 })
    }

    for (const prop of properties) {
      if (!prop.value || prop.name.startsWith("_")) continue // skip internal/customizer metadata fields

      if (SPEC_PROPERTIES.has(prop.name)) {
        specNotes.push(`${prop.name}: ${prop.value}`)
        continue
      }

      if (PROPERTY_TO_COMPONENT_TYPE[prop.name]) {
        const match = await findComponentByName(prop.value)
        if (match) {
          componentMatches.push({ component_sku_id: match.id, sku_code: match.sku_code, quantity: 1 })
        } else {
          specNotes.push(`${prop.name}: ${prop.value} (no matching component SKU found — needs manual review)`)
        }
      }
    }

    const { data: newWO, error: woError } = await supabaseAdmin
      .from("work_orders")
      .insert({
        sales_order_reference: orderRef,
        sku_id: buildTarget.id,
        customer_name: customerName,
        status: "pending",
        source: "shopify",
        notes: specNotes.length > 0 ? specNotes.join(" · ") : null,
      })
      .select()
      .single()

    if (woError || !newWO) {
      results.push({ line_item: item.title, sku_code: skuCode, error: "Failed to create work order", details: woError?.message })
      continue
    }

    createdWorkOrderIds.push(newWO.id)

    if (componentMatches.length > 0) {
      await supabaseAdmin.from("work_order_items").insert(
        componentMatches.map(m => ({
          work_order_id: newWO.id,
          component_sku_id: m.component_sku_id,
          quantity: m.quantity,
        }))
      )
    }

    results.push({
      line_item: item.title,
      sku_code: skuCode,
      matched_via: matchedVia,
      built_under: buildTarget.sku_code !== skuCode ? `${buildTarget.sku_code} (generic parent)` : undefined,
      work_order_id: newWO.id,
      components_matched: componentMatches.length,
    })
  }

  // If this order had both customizable and stock items, attach the stock
  // items to every Work Order created from this order as a read-only
  // shipping-coordination reference — so whoever ships it knows everything
  // that needs to go out together.
  if (stockLineItems.length > 0 && createdWorkOrderIds.length > 0) {
    const companionRows = createdWorkOrderIds.flatMap(woId =>
      stockLineItems.map(item => ({
        work_order_id: woId,
        sku_code: item.sku_code,
        sku_name: item.sku_name,
        quantity: item.quantity,
      }))
    )
    await supabaseAdmin.from("work_order_companion_items").insert(companionRows)
  }

  return NextResponse.json({ success: true, order: orderRef, results })
}
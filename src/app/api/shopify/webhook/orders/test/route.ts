import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// TEST-ONLY ROUTE — no signature verification. Used to manually verify the
// component-matching logic against real order line item JSON before trusting
// the live webhook with real Shopify traffic. Safe to delete once confident,
// or keep but never wire this URL into Shopify's webhook settings.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PROPERTY_TO_COMPONENT_TYPE: Record<string, string> = {
  "Shaft": "shaft",
  "Grip": "grip",
  "Edel x BB&F Ferrule": "ferrule",
  "Ferrule": "ferrule",
}

const SPEC_PROPERTIES = new Set(["Hand", "Lie Angle", "Length"])

async function findComponentByName(nameFragment: string): Promise<{ id: string; sku_code: string; name: string } | null> {
  const { data } = await supabaseAdmin
    .from("skus")
    .select("id, sku_code, name")
    .eq("is_active", true)
    .in("sku_type", ["component", "consumable"])
    .ilike("name", `%${nameFragment}%`)
    .limit(1)

  return data && data.length > 0 ? data[0] : null
}

// POST /api/shopify/webhook/orders/test
// Body: paste a real order's line_items array directly, e.g.
// { "line_items": [ { "sku": "2000090", "title": "...", "properties": [...] } ] }
// Does NOT write to work_orders — this is dry-run/preview only, shows what WOULD happen.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const lineItems = body.line_items || []

  const results: any[] = []

  for (const item of lineItems) {
    const skuCode = (item.sku || "").trim()
    if (!skuCode) {
      results.push({ line_item: item.title, skipped: true, reason: "No SKU code on line item" })
      continue
    }

    const { data: sku } = await supabaseAdmin
      .from("skus")
      .select("id, sku_code, name, is_customizable")
      .eq("sku_code", skuCode)
      .single()

    if (!sku) {
      results.push({ line_item: item.title, sku_code: skuCode, skipped: true, reason: "SKU not found in EdelFit" })
      continue
    }

    if (!sku.is_customizable) {
      results.push({ line_item: item.title, sku_code: skuCode, skipped: true, reason: "Not customizable — pull and ship" })
      continue
    }

    const properties: { name: string; value: string }[] = item.properties || []
    const specNotes: string[] = []
    const componentMatches: any[] = []
    const unmatched: any[] = []

    for (const prop of properties) {
      if (!prop.value || prop.name.startsWith("_")) continue

      if (SPEC_PROPERTIES.has(prop.name)) {
        specNotes.push(`${prop.name}: ${prop.value}`)
        continue
      }

      if (PROPERTY_TO_COMPONENT_TYPE[prop.name]) {
        const match = await findComponentByName(prop.value)
        if (match) {
          componentMatches.push({ property: prop.name, value_from_shopify: prop.value, matched_sku: match.sku_code, matched_name: match.name })
        } else {
          unmatched.push({ property: prop.name, value_from_shopify: prop.value, reason: "No component SKU found containing this text" })
        }
      }
    }

    results.push({
      line_item: item.title,
      sku_code: skuCode,
      would_create_work_order: true,
      spec_notes: specNotes,
      matched_components: componentMatches,
      unmatched_properties: unmatched,
    })
  }

  return NextResponse.json({ dry_run: true, note: "Nothing was written to the database. This is a preview only.", results })
}
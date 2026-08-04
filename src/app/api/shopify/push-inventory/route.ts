import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ShopifyLocation = { id: number; name: string }

// Fetches all location IDs from Shopify (cached in shopify_integration after first call)
async function getShopifyLocations(shop: string, accessToken: string): Promise<ShopifyLocation[]> {
  const res = await fetch(`https://${shop}/admin/api/2026-04/locations.json`, {
    headers: { "X-Shopify-Access-Token": accessToken },
  })
  if (!res.ok) throw new Error(`Failed to fetch locations: ${await res.text()}`)
  const data = await res.json()
  return data.locations
}

// Looks up the inventory_item_id for a given variant — required by Shopify's
// inventoryLevels/set endpoint, which works on inventory_item_id, not variant_id directly.
async function getInventoryItemId(shop: string, accessToken: string, variantId: string): Promise<string | null> {
  const res = await fetch(`https://${shop}/admin/api/2026-04/variants/${variantId}.json`, {
    headers: { "X-Shopify-Access-Token": accessToken },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.variant?.inventory_item_id?.toString() || null
}

// Ensures inventory tracking is enabled on this inventory item. Many of Edel's
// existing Shopify variants were never set up with tracking, since Shopify wasn't
// previously the source of truth for stock — EdelFit is. This flips tracking on
// the first time we push a number for a given SKU, making the rollout self-healing.
async function ensureInventoryTracking(shop: string, accessToken: string, inventoryItemId: string) {
  const res = await fetch(`https://${shop}/admin/api/2026-04/inventory_items/${inventoryItemId}.json`, {
    method: "PUT",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inventory_item: {
        id: inventoryItemId,
        tracked: true,
      },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to enable inventory tracking: ${errText}`)
  }
}

async function setInventoryLevel(shop: string, accessToken: string, inventoryItemId: string, locationId: number, available: number) {
  const res = await fetch(`https://${shop}/admin/api/2026-04/inventory_levels/set.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to set inventory for location ${locationId}: ${errText}`)
  }
  return res.json()
}

// POST /api/shopify/push-inventory
// Body: { sku_id: string } — pushes the current qty_available for this SKU to Shopify,
// across all locations, if it has a linked shopify_variant_id.
export async function POST(req: NextRequest) {
  try {
    const { sku_id } = await req.json()
    if (!sku_id) {
      return NextResponse.json({ error: "Missing sku_id" }, { status: 400 })
    }

    // 1. Look up the SKU's Shopify variant link + current available qty
    const { data: sku, error: skuError } = await supabaseAdmin
      .from("skus")
      .select("id, sku_code, shopify_variant_id, inventory:inventory(qty_available)")
      .eq("id", sku_id)
      .single()

    if (skuError || !sku) {
      return NextResponse.json({ error: "SKU not found" }, { status: 404 })
    }

    if (!sku.shopify_variant_id) {
      return NextResponse.json({ message: "SKU has no linked Shopify variant — nothing to push", skipped: true })
    }

    const qtyAvailable = (sku.inventory as any)?.[0]?.qty_available ?? 0

    // 2. Get the stored Shopify access token + shop domain
    const { data: integration, error: intError } = await supabaseAdmin
      .from("shopify_integration")
      .select("shop_domain, access_token")
      .limit(1)
      .single()

    if (intError || !integration) {
      return NextResponse.json({ error: "Shopify integration not connected. Complete the OAuth install first." }, { status: 412 })
    }

    const { shop_domain: shop, access_token: accessToken } = integration

    // 3. Get the inventory_item_id for this variant
    const inventoryItemId = await getInventoryItemId(shop, accessToken, sku.shopify_variant_id)
    if (!inventoryItemId) {
      return NextResponse.json({ error: "Could not resolve inventory_item_id for this variant" }, { status: 502 })
    }

    // 3b. Make sure tracking is turned on for this item — many existing Shopify
    // variants have tracking disabled since EdelFit, not Shopify, has always been
    // the real source of truth. This enables it automatically on first push.
    await ensureInventoryTracking(shop, accessToken, inventoryItemId)

    // 4. Get all locations (both should carry the same stock per Gavin's setup)
    const locations = await getShopifyLocations(shop, accessToken)

    // 5. Push the same available qty to every location
    const results = []
    for (const loc of locations) {
      const result = await setInventoryLevel(shop, accessToken, inventoryItemId, loc.id, qtyAvailable)
      results.push({ location: loc.name, location_id: loc.id, success: true })
    }

    return NextResponse.json({
      success: true,
      sku_code: sku.sku_code,
      qty_pushed: qtyAvailable,
      locations: results,
    })
  } catch (error: any) {
    console.error("Shopify inventory push error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
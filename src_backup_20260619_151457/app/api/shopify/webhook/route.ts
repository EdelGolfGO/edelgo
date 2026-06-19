import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// This endpoint receives webhooks from Shopify when products are created or updated
// Set up in Shopify Admin → Settings → Notifications → Webhooks
// Event: Product creation + Product update
// URL: https://edelgo.vercel.app/api/shopify/webhook

function mapCategory(type: string): string {
  const t = (type || "").toLowerCase()
  if (t.includes("putter") || t.includes("wedge") || t.includes("golf club") || t.includes("iron")) return "built_club"
  if (t.includes("headcover")) return "accessory"
  if (t.includes("grip")) return "component"
  if (t.includes("shaft")) return "component"
  if (t.includes("shirt") || t.includes("polo") || t.includes("headwear") || t.includes("hat")) return "apparel"
  if (t.includes("part") || t.includes("accessori") || t.includes("tool") || t.includes("bag")) return "accessory"
  return "accessory"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Create Supabase admin client (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const shopifyProduct = body
    const topic = request.headers.get("x-shopify-topic") || ""

    // Only process product create/update
    if (!topic.includes("products/")) {
      return NextResponse.json({ message: "Ignored" }, { status: 200 })
    }

    // Skip draft/archived products
    if (shopifyProduct.status === "archived") {
      return NextResponse.json({ message: "Archived product ignored" }, { status: 200 })
    }

    const productTitle = shopifyProduct.title
    const productType = shopifyProduct.product_type || ""
    const category = mapCategory(productType)

    // Upsert product
    let productId: string | null = null
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id")
      .eq("name", productTitle)
      .single()

    if (existingProduct) {
      productId = existingProduct.id
      await supabase.from("products").update({
        is_active: shopifyProduct.status === "active",
        updated_at: new Date().toISOString(),
      }).eq("id", productId)
    } else {
      const { data: newProduct } = await supabase
        .from("products")
        .insert({
          name: productTitle,
          category,
          description: `Auto-synced from Shopify. Type: ${productType}`,
          shopify_product_id: shopifyProduct.id?.toString(),
          is_active: shopifyProduct.status === "active",
        })
        .select("id")
        .single()
      if (newProduct) productId = newProduct.id
    }

    if (!productId) {
      return NextResponse.json({ error: "Failed to upsert product" }, { status: 500 })
    }

    // Upsert variants as SKUs
    const variants = shopifyProduct.variants || []
    let skusUpserted = 0

    for (const variant of variants) {
      const skuCode = (variant.sku || "").replace(/^'/, "").trim()
      if (!skuCode) continue

      // Build variant name
      const options = [variant.option1, variant.option2, variant.option3].filter(Boolean)
      const variantName = options.length > 0 && options[0] !== "Default Title"
        ? `${productTitle} — ${options.join(" / ")}`
        : productTitle

      const { data: existingSku } = await supabase
        .from("skus")
        .select("id")
        .eq("sku_code", skuCode)
        .single()

      if (existingSku) {
        await supabase.from("skus").update({
          name: variantName,
          msrp: parseFloat(variant.price) || null,
          is_active: shopifyProduct.status === "active",
          shopify_variant_id: variant.id?.toString(),
          updated_at: new Date().toISOString(),
        }).eq("id", existingSku.id)
      } else {
        const price = parseFloat(variant.price) || 0
        const { data: newSku } = await supabase
          .from("skus")
          .insert({
            product_id: productId,
            sku_code: skuCode,
            name: variantName,
            msrp: price,
            wholesaler_price: price * 0.6,
            fitter_price: price * 0.7,
            is_active: shopifyProduct.status === "active",
            shopify_variant_id: variant.id?.toString(),
          })
          .select("id")
          .single()

        if (newSku) {
          // Create inventory record
          await supabase.from("inventory").insert({
            sku_id: newSku.id,
            qty_on_hand: 0,
            qty_reserved: 0,
            qty_on_order: 0,
            min_stock: 5,
            max_stock: 50,
            reorder_qty: 20,
          })
          skusUpserted++
        }
      }
    }

    console.log(`Shopify webhook processed: ${productTitle} — ${skusUpserted} new SKUs`)

    return NextResponse.json({
      success: true,
      product: productTitle,
      skus_upserted: skusUpserted,
    })
  } catch (error: any) {
    console.error("Shopify webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
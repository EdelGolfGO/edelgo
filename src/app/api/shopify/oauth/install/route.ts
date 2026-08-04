import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

// GET /api/shopify/oauth/install?shop=edelgolf.myshopify.com
// Redirects the browser to Shopify's OAuth authorization screen.
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop")

  if (!shop || !shop.endsWith(".myshopify.com")) {
    return NextResponse.json(
      { error: "Missing or invalid 'shop' parameter. Expected something like edelgolf.myshopify.com" },
      { status: 400 }
    )
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/shopify/oauth/callback`
  const scopes = "read_products,read_orders,read_locations,write_inventory"

  // Random state value to prevent CSRF; we verify this on callback.
  const state = crypto.randomBytes(16).toString("hex")

  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`)
  authorizeUrl.searchParams.set("client_id", clientId!)
  authorizeUrl.searchParams.set("scope", scopes)
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("state", state)

  const response = NextResponse.redirect(authorizeUrl.toString())

  // Store state in a short-lived cookie so the callback can verify it.
  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  })

  return response
}
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

// Server-side Supabase client using the service role key, since this route
// runs with no logged-in user session (Shopify is calling us directly).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/shopify/oauth/callback?code=...&shop=...&state=...&hmac=...
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const code = params.get("code")
  const shop = params.get("shop")
  const state = params.get("state")
  const hmac = params.get("hmac")

  if (!code || !shop || !state || !hmac) {
    return NextResponse.json({ error: "Missing required OAuth parameters" }, { status: 400 })
  }

  // 1. Verify state matches what we set in the install step (CSRF protection)
  const storedState = req.cookies.get("shopify_oauth_state")?.value
  if (!storedState || storedState !== state) {
    return NextResponse.json({ error: "Invalid state parameter — possible CSRF attempt" }, { status: 403 })
  }

  // 2. Verify the HMAC signature to confirm this request genuinely came from Shopify
  const map = { ...Object.fromEntries(params) }
  delete (map as any).hmac
  delete (map as any).signature
  const message = Object.keys(map).sort().map(key => `${key}=${map[key]}`).join("&")

  const generatedHmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_CLIENT_SECRET!)
    .update(message)
    .digest("hex")

  const hmacValid = crypto.timingSafeEqual(
    Buffer.from(generatedHmac, "utf-8"),
    Buffer.from(hmac, "utf-8")
  )

  if (!hmacValid) {
    return NextResponse.json({ error: "HMAC validation failed — request did not come from Shopify" }, { status: 403 })
  }

  // 3. Exchange the authorization code for a permanent access token
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  })

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text()
    return NextResponse.json({ error: "Failed to exchange code for token", details: errText }, { status: 502 })
  }

  const tokenData = await tokenResponse.json()
  const accessToken = tokenData.access_token
  const grantedScope = tokenData.scope

  // 4. Store the access token in Supabase, keyed by shop domain
  const { error: dbError } = await supabaseAdmin
    .from("shopify_integration")
    .upsert(
      {
        shop_domain: shop,
        access_token: accessToken,
        scope: grantedScope,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_domain" }
    )

  if (dbError) {
    return NextResponse.json({ error: "Failed to save access token", details: dbError.message }, { status: 500 })
  }

  // 5. Clean up the state cookie and redirect back into the app
  const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?shopify_connected=true`)
  response.cookies.delete("shopify_oauth_state")
  return response
}
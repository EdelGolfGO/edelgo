import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const ADMIN_EMAILS = [
  'gjones@edelgolf.com',
  'nedel@edelgolf.com',
  'abard@edelgolf.com',
  'acalzada@edelgolf.com',
  'accounting@edelgolf.com',
  'alex@pinsandaces.com',
  'edeldev@edelgolf.com',
]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Allow API routes and auth pages through
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth")) {
    return supabaseResponse
  }

  // Not logged in — redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Check if email is in admin whitelist — auto-promote if needed
  const isAdminEmail = ADMIN_EMAILS.includes(user.email || "")

  if (isAdminEmail) {
    // Ensure profile is set to admin
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      role: "admin",
      is_approved: true,
      full_name: user.email,
    }, { onConflict: "id" })

    // Admin trying to access portal — redirect to dashboard
    if (pathname.startsWith("/portal")) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

    // Admin is good to go anywhere else
    return supabaseResponse
  }

  // Non-admin — get their profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved, dealer_id")
    .eq("id", user.id)
    .single()

  const isApproved = profile?.is_approved || false

  // Not approved yet — show pending page
  if (!isApproved && !pathname.startsWith("/portal/pending")) {
    const url = request.nextUrl.clone()
    url.pathname = "/portal/pending"
    return NextResponse.redirect(url)
  }

  // Approved dealer trying to access admin pages — redirect to portal
  if (!pathname.startsWith("/portal") && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone()
    url.pathname = "/portal"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
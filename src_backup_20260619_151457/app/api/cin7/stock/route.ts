import { NextResponse } from "next/server"

const ACCOUNT_ID = process.env.CIN7_ACCOUNT_ID
const APP_KEY = process.env.CIN7_APP_KEY
const BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2"

export async function GET() {
  if (!ACCOUNT_ID || !APP_KEY) {
    return NextResponse.json({ error: "Cin7 credentials not configured" }, { status: 500 })
  }

  const headers = {
    "api-auth-accountid": ACCOUNT_ID,
    "api-auth-applicationkey": APP_KEY,
  }

  try {
    let allStock: any[] = []
    let page = 1
    const limit = 500

    while (true) {
      const res = await fetch(`${BASE_URL}/ref/productavailability?limit=${limit}&page=${page}`, { headers })
      if (!res.ok) break
      const text = await res.text()
      if (!text || text.trim() === "") break

      let data
      try { data = JSON.parse(text) } catch { break }

      if (!data || !Array.isArray(data) || data.length === 0) break

      allStock = [...allStock, ...data]
      if (data.length < limit) break
      page++
    }

    return NextResponse.json(allStock)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Database = {
  purchase_orders: {
    id: string
    po_number: string
    factory_name: string
    order_date: string
    expected_ship_date: string
    actual_ship_date?: string
    status: string
    total_amount: number
    deposit_paid_date?: string
    final_payment_paid_date?: string
    notes?: string
    created_at: string
  }
  distributor_invoices: {
    id: string
    invoice_number: string
    dealer_name: string
    invoice_date: string
    total_amount: number
    deposit_paid_date?: string
    ship_date?: string
    final_payment_paid_date?: string
    status: string
    notes?: string
    created_at: string
  }
}
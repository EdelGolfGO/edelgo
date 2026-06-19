export type UserRole = "admin" | "dealer" | "korea" | "factory"

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  company: string
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  account_id: string
  account_name: string
  status: OrderStatus
  items: OrderItem[]
  total_value: number
  created_at: string
  updated_at: string
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "approved"
  | "in_production"
  | "shipped"
  | "fulfilled"
  | "needs_review"

export interface OrderItem {
  id: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
}

export interface Dealer {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  status: "active" | "inactive"
  payment_terms: string
  created_at: string
}
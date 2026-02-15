import type { SpecialDay } from "./customer-types"

export interface QuotingContact {
  name: string
  email: string
}

export interface Vendor {
  id: string
  company_name: string
  terms: string
  contact_name: string | null
  office_phone: string | null
  cell_phone: string | null
  email: string | null
  quoting_contacts: QuotingContact[]
  cc_all_quoting: boolean
  pickup_cost: number
  website: string | null
  notes: string | null
  custom_fields: Record<string, string>
  created_at: string
  updated_at: string
}

export interface VendorFacility {
  id: string
  vendor_id: string
  label: string | null
  company_name: string | null
  street: string
  city: string | null
  state: string | null
  postal_code: string | null
  pickup_contact: string | null
  pickup_phone: string | null
  is_24_hours: boolean
  pickup_window_from: string | null
  pickup_window_to: string | null
  special_days: SpecialDay[]
  notes: string | null
  created_at: string
  updated_at: string
}

export const EMPTY_FACILITY: Omit<VendorFacility, "id" | "vendor_id" | "created_at" | "updated_at"> = {
  label: null,
  company_name: null,
  street: "",
  city: null,
  state: null,
  postal_code: null,
  pickup_contact: null,
  pickup_phone: null,
  is_24_hours: false,
  pickup_window_from: "08:00",
  pickup_window_to: "17:00",
  special_days: [],
  notes: null,
}

export interface VendorBid {
  id: string
  quote_id: string | null
  item_label: string
  item_description: string | null
  item_category: string
  status: "open" | "closed" | "awarded"
  winning_vendor_id: string | null
  winning_price: number | null
  created_at: string
  updated_at: string
}

export interface VendorBidPrice {
  id: string
  bid_id: string
  vendor_id: string
  price: number | null
  notes: string | null
  status: "pending" | "received" | "declined"
  responded_at: string | null
  vendors?: { company_name: string }
  created_at: string
  updated_at: string
}

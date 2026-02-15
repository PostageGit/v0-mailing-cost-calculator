export interface Customer {
  id: string
  company_name: string
  contact_name: string | null
  office_phone: string | null
  cell_phone: string | null
  email: string | null
  billing_contact_name: string | null
  billing_contact_email: string | null
  billing_contact_phone: string | null
  billing_same_as_primary: boolean
  website: string | null
  street: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  notes: string | null
  custom_fields: Record<string, string>
  created_at: string
  updated_at: string
}

export interface CustomerContact {
  id: string
  customer_id: string
  name: string
  department: string | null
  email: string | null
  cell_phone: string | null
  office_phone: string | null
  title: string | null
  notes: string | null
  custom_fields: Record<string, string>
  created_at: string
  updated_at: string
}

export interface CustomFieldDef {
  name: string
  target: "customer" | "contact"
}

export type DepartmentColors = Record<string, string>

export const EMPTY_CUSTOMER: Omit<Customer, "id" | "created_at" | "updated_at"> = {
  company_name: "",
  contact_name: null,
  office_phone: null,
  cell_phone: null,
  email: null,
  billing_contact_name: null,
  billing_contact_email: null,
  billing_contact_phone: null,
  billing_same_as_primary: true,
  website: null,
  street: null,
  city: null,
  state: null,
  postal_code: null,
  country: "US",
  notes: null,
  custom_fields: {},
}

export const EMPTY_CONTACT: Omit<CustomerContact, "id" | "customer_id" | "created_at" | "updated_at"> = {
  name: "",
  department: null,
  email: null,
  cell_phone: null,
  office_phone: null,
  title: null,
  notes: null,
  custom_fields: {},
}

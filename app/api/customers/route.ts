import { createClient, supabaseReady } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  if (!supabaseReady()) return NextResponse.json([])
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")

  // If no search term, return all customers ordered alphabetically
  if (!search) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("company_name", { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Search across customer fields AND contacts table
  // 1) Search customers directly (company_name, contact_name, email, phone, city)
  const { data: directMatches, error: e1 } = await supabase
    .from("customers")
    .select("*")
    .or(
      `company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%,office_phone.ilike.%${search}%,city.ilike.%${search}%`
    )
    .order("company_name", { ascending: true })
    .limit(50)

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // 2) Search contacts table and find their parent customers
  const { data: contactMatches } = await supabase
    .from("contacts")
    .select("customer_id, name, email, office_phone")
    .or(
      `name.ilike.%${search}%,email.ilike.%${search}%,office_phone.ilike.%${search}%`
    )
    .limit(30)

  let contactCustomerIds: string[] = []
  const matchedContactsByCustomer: Record<string, { name: string; email?: string; phone?: string }> = {}
  if (contactMatches && contactMatches.length > 0) {
    contactCustomerIds = [...new Set(contactMatches.map((c) => c.customer_id))]
    for (const c of contactMatches) {
      if (!matchedContactsByCustomer[c.customer_id]) {
        matchedContactsByCustomer[c.customer_id] = { name: c.name, email: c.email || undefined, phone: c.office_phone || undefined }
      }
    }
  }

  // 3) Fetch customer records for contact matches (excluding already found)
  const directIds = new Set((directMatches || []).map((c) => c.id))
  const missingIds = contactCustomerIds.filter((id) => !directIds.has(id))

  let contactCustomers: typeof directMatches = []
  if (missingIds.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .in("id", missingIds)
      .order("company_name", { ascending: true })
    contactCustomers = data || []
  }

  // 4) Merge results, annotate with match reason
  const results = [
    ...(directMatches || []).map((c) => ({
      ...c,
      _matchedContact: matchedContactsByCustomer[c.id] || null,
      _matchReason: getMatchReason(c, search),
    })),
    ...(contactCustomers || []).map((c) => ({
      ...c,
      _matchedContact: matchedContactsByCustomer[c.id] || null,
      _matchReason: "contact" as const,
    })),
  ]

  return NextResponse.json(results)
}

function getMatchReason(customer: Record<string, unknown>, search: string): string {
  const s = search.toLowerCase()
  if ((customer.company_name as string)?.toLowerCase().includes(s)) return "company"
  if ((customer.contact_name as string)?.toLowerCase().includes(s)) return "name"
  if ((customer.email as string)?.toLowerCase().includes(s)) return "email"
  if ((customer.office_phone as string)?.toLowerCase().includes(s)) return "phone"
  if ((customer.city as string)?.toLowerCase().includes(s)) return "city"
  return "other"
}

export async function POST(req: Request) {
  if (!supabaseReady()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  const supabase = await createClient()
  const body = await req.json()

  // Support bulk import: array of customers
  if (Array.isArray(body)) {
    const { data, error } = await supabase
      .from("customers")
      .insert(body)
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: data?.length || 0 })
  }

  const { data, error } = await supabase
    .from("customers")
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

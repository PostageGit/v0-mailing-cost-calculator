import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function supabaseReady() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(req: Request) {
  if (!supabaseReady()) return NextResponse.json([])
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")

  let query = supabase
    .from("customers")
    .select("*")
    .order("company_name", { ascending: true })

  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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

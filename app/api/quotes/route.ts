import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all quotes
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("updated_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST create a new quote
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      project_name: body.project_name || "Untitled Quote",
      status: body.status || "draft",
      items: body.items || [],
      total: body.total || 0,
      notes: body.notes || null,
      customer_id: body.customer_id || null,
      reference_number: body.reference_number || "",
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

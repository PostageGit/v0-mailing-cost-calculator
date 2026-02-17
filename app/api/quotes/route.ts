import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET quotes, with filters: is_job, archived, search
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const isJob = searchParams.get("is_job")
  const archived = searchParams.get("archived")
  const search = searchParams.get("search")

  let query = supabase
    .from("quotes")
    .select("*")
    .order("updated_at", { ascending: false })

  if (isJob === "true") {
    query = query.eq("is_job", true)
  } else if (isJob === "false") {
    query = query.eq("is_job", false)
  }

  if (archived === "true") {
    query = query.eq("archived", true)
  } else if (archived === "false") {
    query = query.eq("archived", false)
  } else {
    // Default: hide archived
    query = query.eq("archived", false)
  }

  if (search) {
    query = query.or(
      `project_name.ilike.%${search}%,contact_name.ilike.%${search}%,reference_number.ilike.%${search}%,notes.ilike.%${search}%,status.ilike.%${search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST create a new quote
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  // Get the first board column as default
  let defaultColumnId: string | null = null
  if (!body.column_id) {
    const { data: cols } = await supabase
      .from("board_columns")
      .select("id")
      .order("sort_order", { ascending: true })
      .limit(1)
    defaultColumnId = cols?.[0]?.id || null
  }

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      project_name: body.project_name || "Untitled Quote",
      status: body.status || "draft",
      column_id: body.column_id || defaultColumnId,
      items: body.items || [],
      total: body.total || 0,
      quantity: body.quantity || 0,
      mailing_pieces: body.mailing_pieces || [],
      notes: body.notes || null,
      customer_id: body.customer_id || null,
      contact_name: body.contact_name || "",
      reference_number: body.reference_number || "",
      mailing_date: body.mailing_date || "",
      mailing_class: body.mailing_class || "",
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

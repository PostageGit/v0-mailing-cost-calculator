import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET single quote
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  return NextResponse.json(data)
}

// PATCH update a quote (status, items, name, notes, total)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  // Only allow updating specific fields
  const updates: Record<string, unknown> = {}
  if (body.project_name !== undefined) updates.project_name = body.project_name
  if (body.status !== undefined) updates.status = body.status
  if (body.items !== undefined) updates.items = body.items
  if (body.total !== undefined) updates.total = body.total
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.customer_id !== undefined) updates.customer_id = body.customer_id
  if (body.contact_name !== undefined) updates.contact_name = body.contact_name
  if (body.reference_number !== undefined) updates.reference_number = body.reference_number
  if (body.column_id !== undefined) updates.column_id = body.column_id
  if (body.mailing_date !== undefined) updates.mailing_date = body.mailing_date
  if (body.lights !== undefined) updates.lights = body.lights
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order
  if (body.is_job !== undefined) updates.is_job = body.is_job
  if (body.converted_at !== undefined) updates.converted_at = body.converted_at
  if (body.archived !== undefined) updates.archived = body.archived
  if (body.archived_at !== undefined) updates.archived_at = body.archived_at

  const { data, error } = await supabase
    .from("quotes")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE a quote
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from("quotes").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

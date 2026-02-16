import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// PATCH update a column (name, color, position)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.title = body.name
  if (body.color !== undefined) updates.color = body.color
  if (body.position !== undefined) updates.sort_order = body.position

  const { data, error } = await supabase
    .from("board_columns")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE a column -- moves all quotes in it to the first column
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Find the first column to move orphaned quotes to
  const { data: cols } = await supabase
    .from("board_columns")
    .select("id")
    .order("sort_order", { ascending: true })
    .limit(2)

  const fallback = cols?.find((c) => c.id !== id)

  if (fallback) {
    await supabase
      .from("quotes")
      .update({ column_id: fallback.id })
      .eq("column_id", id)
  }

  const { error } = await supabase.from("board_columns").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

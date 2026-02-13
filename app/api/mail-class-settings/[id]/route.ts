import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.class_name !== undefined) updates.class_name = body.class_name
  if (body.addressing !== undefined) updates.addressing = body.addressing
  if (body.computer_work !== undefined) updates.computer_work = body.computer_work
  if (body.cass !== undefined) updates.cass = body.cass
  if (body.inserting !== undefined) updates.inserting = body.inserting
  if (body.stamping !== undefined) updates.stamping = body.stamping
  if (body.printing !== undefined) updates.printing = body.printing
  if (body.notes !== undefined) updates.notes = body.notes

  const { data, error } = await supabase
    .from("mail_class_settings")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from("mail_class_settings")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

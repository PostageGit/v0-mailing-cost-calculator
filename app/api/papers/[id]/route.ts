import { NextResponse } from "next/server"
import { createSafeClient } from "@/lib/supabase-server"

const DB_ERR = NextResponse.json({ error: "Database not configured" }, { status: 500 })

// GET single paper
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR

  const { data, error } = await supabase
    .from("papers")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH update paper
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) updates.name = body.name
  if (body.category !== undefined) updates.category = body.category
  if (body.is_cardstock !== undefined) updates.is_cardstock = body.is_cardstock
  if (body.thickness !== undefined) updates.thickness = body.thickness
  if (body.weight_gsm !== undefined) updates.weight_gsm = body.weight_gsm
  if (body.prices !== undefined) updates.prices = body.prices
  if (body.available_sizes !== undefined) updates.available_sizes = body.available_sizes
  // Granular per-calculator usage flags
  if (body.use_in_postcard !== undefined) updates.use_in_postcard = body.use_in_postcard
  if (body.use_in_letter !== undefined) updates.use_in_letter = body.use_in_letter
  if (body.use_in_flat !== undefined) updates.use_in_flat = body.use_in_flat
  if (body.use_in_envelope !== undefined) updates.use_in_envelope = body.use_in_envelope
  if (body.use_in_booklet_cover !== undefined) updates.use_in_booklet_cover = body.use_in_booklet_cover
  if (body.use_in_booklet_inside !== undefined) updates.use_in_booklet_inside = body.use_in_booklet_inside
  if (body.use_in_perfect_bind_cover !== undefined) updates.use_in_perfect_bind_cover = body.use_in_perfect_bind_cover
  if (body.use_in_perfect_bind_inside !== undefined) updates.use_in_perfect_bind_inside = body.use_in_perfect_bind_inside
  if (body.use_in_saddle_stitch_cover !== undefined) updates.use_in_saddle_stitch_cover = body.use_in_saddle_stitch_cover
  if (body.use_in_saddle_stitch_inside !== undefined) updates.use_in_saddle_stitch_inside = body.use_in_saddle_stitch_inside
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order
  if (body.active !== undefined) updates.active = body.active

  const { data, error } = await supabase
    .from("papers")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE paper (permanent delete)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR

  const { error } = await supabase.from("papers").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

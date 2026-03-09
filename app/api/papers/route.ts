import { NextResponse } from "next/server"
import { createSafeClient } from "@/lib/supabase-server"

const DB_ERR = NextResponse.json({ error: "Database not configured" }, { status: 500 })

// GET all papers (with optional filters)
export async function GET(request: Request) {
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get("active") !== "false"
  const useFor = searchParams.get("use_for") // 'printing', 'booklet_cover', 'booklet_inside', 'flat'
  const category = searchParams.get("category") // 'text', 'cover', 'specialty'

  let query = supabase.from("papers").select("*").order("sort_order", { ascending: true })

  if (activeOnly) {
    query = query.eq("active", true)
  }

  // Granular per-calculator filters
  if (useFor === "postcard") query = query.eq("use_in_postcard", true)
  if (useFor === "letter") query = query.eq("use_in_letter", true)
  if (useFor === "flat") query = query.eq("use_in_flat", true)
  if (useFor === "envelope") query = query.eq("use_in_envelope", true)
  if (useFor === "booklet_cover") query = query.eq("use_in_booklet_cover", true)
  if (useFor === "booklet_inside") query = query.eq("use_in_booklet_inside", true)
  if (useFor === "perfect_bind_cover") query = query.eq("use_in_perfect_bind_cover", true)
  if (useFor === "perfect_bind_inside") query = query.eq("use_in_perfect_bind_inside", true)
  if (useFor === "saddle_stitch_cover") query = query.eq("use_in_saddle_stitch_cover", true)
  if (useFor === "saddle_stitch_inside") query = query.eq("use_in_saddle_stitch_inside", true)

  if (category) query = query.eq("category", category)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST create new paper
export async function POST(request: Request) {
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR

  const body = await request.json()
  
  const { data, error } = await supabase
    .from("papers")
    .insert({
      name: body.name,
      category: body.category || "text",
      is_cardstock: body.is_cardstock || false,
      thickness: body.thickness || 0.003,
      weight_gsm: body.weight_gsm,
      prices: body.prices || {},
      available_sizes: body.available_sizes || ["8.5x11", "11x17", "12x18", "13x19"],
      // Granular per-calculator usage flags
      use_in_postcard: body.use_in_postcard ?? true,
      use_in_letter: body.use_in_letter ?? true,
      use_in_flat: body.use_in_flat ?? true,
      use_in_envelope: body.use_in_envelope ?? true,
      use_in_booklet_cover: body.use_in_booklet_cover ?? false,
      use_in_booklet_inside: body.use_in_booklet_inside ?? false,
      use_in_perfect_bind_cover: body.use_in_perfect_bind_cover ?? false,
      use_in_perfect_bind_inside: body.use_in_perfect_bind_inside ?? false,
      use_in_saddle_stitch_cover: body.use_in_saddle_stitch_cover ?? false,
      use_in_saddle_stitch_inside: body.use_in_saddle_stitch_inside ?? false,
      notes: body.notes,
      sort_order: body.sort_order || 0,
      active: body.active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

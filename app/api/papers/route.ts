import { NextResponse } from "next/server"
import { createSafeClient } from "@/lib/supabase-server"

const DB_ERR = NextResponse.json({ error: "Database not configured" }, { status: 500 })

// GET all papers (with optional filters)
export async function GET(request: Request) {
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get("active") !== "false"
  const useFor = searchParams.get("use_for") // 'flat_printing', 'book_cover', 'book_inside'
  const category = searchParams.get("category") // 'text', 'cover', 'specialty'

  let query = supabase.from("papers").select("*").order("sort_order", { ascending: true })

  if (activeOnly) {
    query = query.eq("active", true)
  }

  // Printing context filters
  if (useFor === "flat_printing") query = query.eq("use_in_flat_printing", true)
  if (useFor === "book_cover") query = query.eq("use_in_book_cover", true)
  if (useFor === "book_inside") query = query.eq("use_in_book_inside", true)

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
      // Printing context usage flags
      use_in_flat_printing: body.use_in_flat_printing ?? true,
      use_in_book_cover: body.use_in_book_cover ?? false,
      use_in_book_inside: body.use_in_book_inside ?? false,
      notes: body.notes,
      sort_order: body.sort_order || 0,
      active: body.active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

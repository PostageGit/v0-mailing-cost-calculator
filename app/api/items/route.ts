import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all items (optionally filter by ?category= or ?labor_class_id=)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const laborClassId = searchParams.get("labor_class_id")

  let query = supabase.from("items").select("*").order("category").order("name")
  if (category) query = query.eq("category", category)
  if (laborClassId) query = query.eq("labor_class_id", laborClassId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST create a new item
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("items")
    .insert({
      name: body.name || "New Item",
      description: body.description || "",
      sku: body.sku || "",
      unit_cost: body.unit_cost ?? 0,
      unit_label: body.unit_label || "each",
      category: body.category || "General",
      labor_class_id: body.labor_class_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

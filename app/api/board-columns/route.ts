import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all board columns, ordered by position
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("board_columns")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST create a new column
export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  // Get max position
  const { data: cols } = await supabase
    .from("board_columns")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)

  const nextPos = (cols?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from("board_columns")
    .insert({
      title: body.name || "New Column",
      color: body.color || "#94a3b8",
      sort_order: nextPos,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

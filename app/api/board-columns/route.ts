import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET board columns, optionally filtered by board_type
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const boardType = searchParams.get("type") // "quote" | "job"

  let query = supabase
    .from("board_columns")
    .select("*")
    .order("sort_order", { ascending: true })

  if (boardType) {
    query = query.eq("board_type", boardType)
  }

  const { data, error } = await query

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
      board_type: body.board_type || "quote",
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

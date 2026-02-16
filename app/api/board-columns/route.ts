import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all board columns, ordered by position
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("board_columns")
    .select("*")
    .order("position", { ascending: true })

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
    .select("position")
    .order("position", { ascending: false })
    .limit(1)

  const nextPos = (cols?.[0]?.position ?? 0) + 1

  const { data, error } = await supabase
    .from("board_columns")
    .insert({
      name: body.name || "New Column",
      color: body.color || "#94a3b8",
      position: nextPos,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

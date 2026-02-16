import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST batch-reorder columns: body = { order: [id1, id2, ...] }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { order } = await request.json()

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: "order must be an array of column IDs" }, { status: 400 })
  }

  // Update positions in parallel
  const updates = order.map((id: string, idx: number) =>
    supabase.from("board_columns").update({ sort_order: idx }).eq("id", id)
  )
  await Promise.all(updates)

  return NextResponse.json({ success: true })
}

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Return as { key: value } map
  const map: Record<string, unknown> = {}
  for (const row of data || []) {
    map[row.key] = row.value
  }
  return NextResponse.json(map)
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const body = await req.json() as Record<string, unknown>
  // Upsert each key-value pair
  for (const [key, value] of Object.entries(body)) {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value }, { onConflict: "key" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

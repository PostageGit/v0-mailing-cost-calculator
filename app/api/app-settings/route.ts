import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const map: Record<string, unknown> = {}
    for (const row of data || []) {
      map[row.key] = row.value
    }
    return NextResponse.json(map)
  } catch {
    // If Supabase is not yet configured, return empty settings
    return NextResponse.json({})
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const body = await req.json() as Record<string, unknown>
    for (const [key, value] of Object.entries(body)) {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value }, { onConflict: "key" })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

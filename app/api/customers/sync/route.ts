import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/* POST /api/customers/sync -- mark/unmark customers as QBO synced */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { ids, synced } = body as { ids: string[]; synced: boolean }

  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids required" }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from("customers")
    .update({
      qbo_synced: synced,
      qbo_synced_at: synced ? new Date().toISOString() : null,
    })
    .in("id", ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: ids.length })
}

/* GET /api/customers/sync -- get sync stats */
export async function GET() {
  const supabase = await createClient()

  const { count: total } = await supabase.from("customers").select("*", { count: "exact", head: true })
  const { count: synced } = await supabase.from("customers").select("*", { count: "exact", head: true }).eq("qbo_synced", true)
  const { count: unsynced } = await supabase.from("customers").select("*", { count: "exact", head: true }).eq("qbo_synced", false)

  return NextResponse.json({ total: total || 0, synced: synced || 0, unsynced: unsynced || 0 })
}

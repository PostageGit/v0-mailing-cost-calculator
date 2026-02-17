import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/activity-log
 * Query params: entity_type, entity_id, event, limit (default 50), since (ISO date)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const entityType = sp.get("entity_type")
  const entityId = sp.get("entity_id")
  const event = sp.get("event")
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200)
  const since = sp.get("since")

  const supabase = await createClient()
  let query = supabase
    .from("quote_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (entityType) query = query.eq("entity_type", entityType)
  if (entityId) query = query.eq("entity_id", entityId)
  if (event) query = query.eq("event", event)
  if (since) query = query.gte("created_at", since)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * POST /api/activity-log
 * Body: { quote_id?, entity_type, entity_id?, event, detail, user_name? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await createClient()

  const { error } = await supabase.from("quote_activity_log").insert({
    quote_id: body.quote_id || body.entity_id || null,
    entity_type: body.entity_type || "system",
    entity_id: body.entity_id || body.quote_id || null,
    event: body.event || "unknown",
    detail: body.detail || "",
    user_name: body.user_name || "",
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

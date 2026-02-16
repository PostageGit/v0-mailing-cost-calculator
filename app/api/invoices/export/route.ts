import { NextResponse } from "next/server"
import { createClient, supabaseReady } from "@/lib/supabase/server"

/**
 * POST /api/invoices/export
 * Body: { ids: string[], markExported?: boolean }
 * Returns the invoice records for CSV generation on the client.
 * Optionally marks them as exported.
 */
export async function POST(req: Request) {
  if (!supabaseReady()) return NextResponse.json({ error: "DB not configured" }, { status: 500 })
  const supabase = await createClient()
  const { ids, markExported } = await req.json()

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No invoice IDs provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .in("id", ids)
    .order("invoice_number", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark as exported if requested
  if (markExported && data && data.length > 0) {
    const now = new Date().toISOString()
    await supabase
      .from("invoices")
      .update({ qb_exported: true, qb_exported_at: now })
      .in("id", ids)
  }

  return NextResponse.json(data)
}

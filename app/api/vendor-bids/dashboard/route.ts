import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/vendor-bids/dashboard
 * Returns all vendor bids with price counts + parent quote info in a single query.
 */
export async function GET() {
  const supabase = await createClient()

  // Fetch bids with nested price counts and parent quote info
  const { data: bids, error: bidsErr } = await supabase
    .from("vendor_bids")
    .select(`
      *,
      vendor_bid_prices ( id, vendor_id, price, status, vendors(company_name) ),
      quotes ( id, project_name, contact_name, customer_id, quote_number, job_number, is_job, archived, mailing_date, items )
    `)
    .order("created_at", { ascending: false })

  if (bidsErr) return NextResponse.json({ error: bidsErr.message }, { status: 500 })
  return NextResponse.json(bids ?? [])
}

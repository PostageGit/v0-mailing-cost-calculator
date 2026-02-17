import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { logActivityServer } from "@/lib/audit-server"

// GET /api/purchase-orders?job_id=xxx  OR  GET /api/purchase-orders (all)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const jobId = req.nextUrl.searchParams.get("job_id")

  let query = supabase.from("purchase_orders").select("*, quotes(project_name, company_name)")
    .order("created_at", { ascending: false })

  if (jobId) query = query.eq("job_id", jobId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/purchase-orders
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  // Validate at least one of po_number or ohp_job_number
  if (!body.po_number?.trim() && !body.ohp_job_number?.trim()) {
    return NextResponse.json({ error: "At least one of PO Number or OHP Job Number is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      job_id: body.job_id,
      po_number: body.po_number?.trim() || "",
      ohp_job_number: body.ohp_job_number?.trim() || "",
      ohp_location: body.ohp_location || "",
      urgency: body.urgency || "standard",
      needed_date: body.needed_date || null,
      needed_time: body.needed_time || "",
      status: "draft",
      cost: body.cost || 0,
      notes: body.notes || "",
      ohp_email: body.ohp_email || "",
      created_by: body.created_by || "",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logActivityServer({
    entity_type: "purchase_order",
    entity_id: data.id,
    event: "po_created",
    detail: `PO ${data.po_number || data.ohp_job_number} created for job`,
    user_name: body.created_by || "",
  })

  return NextResponse.json(data)
}

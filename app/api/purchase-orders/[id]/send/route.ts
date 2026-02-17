import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { logActivityServer } from "@/lib/audit-server"

// POST /api/purchase-orders/[id]/send  -- marks PO as sent (email integration later)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()
  const email = body.email || ""

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ status: "sent", sent_at: now, ohp_email: email, updated_at: now })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logActivityServer({
    entity_type: "purchase_order",
    entity_id: id,
    event: "po_sent",
    detail: `PO ${data.po_number || data.ohp_job_number} sent${email ? ` to ${email}` : ""}`,
    user_name: body._user_name || "",
  })

  return NextResponse.json(data)
}

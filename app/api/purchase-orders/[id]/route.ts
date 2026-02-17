import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { logActivityServer } from "@/lib/audit-server"

// PATCH /api/purchase-orders/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  // Validate at least one number if they're being updated
  if (body.po_number !== undefined && body.ohp_job_number !== undefined) {
    if (!body.po_number?.trim() && !body.ohp_job_number?.trim()) {
      return NextResponse.json({ error: "At least one of PO Number or OHP Job Number is required" }, { status: 400 })
    }
  }

  // Status transitions add timestamps
  const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }
  delete updates._user_name

  if (body.status === "sent" && !body.sent_at) updates.sent_at = new Date().toISOString()
  if (body.status === "confirmed" && !body.confirmed_at) updates.confirmed_at = new Date().toISOString()
  if (body.status === "in_production" && !body.in_production_at) updates.in_production_at = new Date().toISOString()
  if (body.status === "received" && !body.received_at) updates.received_at = new Date().toISOString()

  const { data, error } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const poLabel = data.po_number || data.ohp_job_number || id.slice(0, 8)
  if (body.status) {
    logActivityServer({
      entity_type: "purchase_order",
      entity_id: id,
      event: `po_${body.status}`,
      detail: `PO ${poLabel} -> ${body.status.replace("_", " ")}`,
      user_name: body._user_name || "",
    })
  }

  return NextResponse.json(data)
}

// DELETE /api/purchase-orders/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: po } = await supabase.from("purchase_orders").select("po_number, ohp_job_number").eq("id", id).single()
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logActivityServer({
    entity_type: "purchase_order",
    entity_id: id,
    event: "po_deleted",
    detail: `PO ${po?.po_number || po?.ohp_job_number || id.slice(0, 8)} deleted`,
  })

  return NextResponse.json({ ok: true })
}

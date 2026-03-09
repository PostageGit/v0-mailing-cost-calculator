import { createSafeClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const DB_ERR = NextResponse.json({ error: "Database connection unavailable" }, { status: 503 })

// GET single quote
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  return NextResponse.json(data)
}

// PATCH update a quote (status, items, name, notes, total)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR
  const body = await request.json()

  // Only allow updating specific fields
  const updates: Record<string, unknown> = {}
  if (body.project_name !== undefined) updates.project_name = body.project_name
  if (body.status !== undefined) updates.status = body.status
  if (body.items !== undefined) updates.items = body.items
  if (body.total !== undefined) updates.total = body.total
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.customer_id !== undefined) updates.customer_id = body.customer_id
  if (body.contact_name !== undefined) updates.contact_name = body.contact_name
  if (body.reference_number !== undefined) updates.reference_number = body.reference_number
  if (body.column_id !== undefined) updates.column_id = body.column_id
  if (body.mailing_date !== undefined) updates.mailing_date = body.mailing_date
  if (body.lights !== undefined) updates.lights = body.lights
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order
  if (body.is_job !== undefined) updates.is_job = body.is_job
  if (body.converted_at !== undefined) updates.converted_at = body.converted_at
  if (body.archived !== undefined) updates.archived = body.archived
  if (body.archived_at !== undefined) updates.archived_at = body.archived_at
  if (body.voided !== undefined) updates.voided = body.voided
  if (body.voided_at !== undefined) updates.voided_at = body.voided_at
  if (body.voided_reason !== undefined) updates.voided_reason = body.voided_reason
  if (body.job_meta !== undefined) {
    // Merge with existing job_meta instead of replacing
    const { data: existing } = await supabase.from("quotes").select("job_meta").eq("id", id).single()
    updates.job_meta = { ...(existing?.job_meta || {}), ...body.job_meta }
  }
  if (body.quantity !== undefined) updates.quantity = body.quantity

  // Auto-assign job_number when activating a quote into a job
  if (body.is_job === true) {
    const { data: existing } = await supabase
      .from("quotes")
      .select("job_number")
      .eq("id", id)
      .single()
    if (!existing?.job_number) {
      // Get the next job number (max + 1, floor at 5001)
      const { data: maxRow } = await supabase
        .from("quotes")
        .select("job_number")
        .not("job_number", "is", null)
        .order("job_number", { ascending: false })
        .limit(1)
        .maybeSingle()
      updates.job_number = Math.max((maxRow?.job_number || 0) + 1, 5001)
    }
  }

  const { data, error } = await supabase
    .from("quotes")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE a quote - now voids instead of deleting (preserves audit trail)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR
  
  // Get optional reason from request body
  let reason: string | null = null
  try {
    const body = await request.json()
    reason = body.reason || null
  } catch {
    // No body provided, that's okay
  }
  
  // Void the quote instead of deleting (soft delete with audit trail)
  const { data, error } = await supabase
    .from("quotes")
    .update({ 
      voided: true, 
      voided_at: new Date().toISOString(),
      voided_reason: reason
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, voided: true, data })
}

import { createSafeClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const DB_ERR = NextResponse.json({ error: "Database connection unavailable" }, { status: 503 })

// GET all revisions for a quote
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR
  
  const { data, error } = await supabase
    .from("quotes")
    .select("job_meta, items, total, project_name, notes, quantity, updated_at")
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  
  const revisions = data.job_meta?.revisions || []
  
  // Add current version as the latest "revision"
  const currentRevision = {
    revision_number: (data.job_meta?.current_revision || revisions.length + 1),
    project_name: data.project_name,
    items: data.items,
    total: data.total,
    notes: data.notes,
    quantity: data.quantity,
    mailing_state: data.job_meta?.mailing_state,
    created_at: data.updated_at,
    is_current: true,
  }
  
  return NextResponse.json({
    current: currentRevision,
    revisions: [...revisions].reverse(), // Most recent first
    total_revisions: revisions.length + 1,
  })
}

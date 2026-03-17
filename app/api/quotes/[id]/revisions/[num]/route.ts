import { createSafeClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const DB_ERR = NextResponse.json({ error: "Database connection unavailable" }, { status: 503 })

// PATCH /api/quotes/[id]/revisions/[num] — update a stored revision (e.g. set its name)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; num: string }> }
) {
  const { id, num } = await params
  const revNum = parseInt(num, 10)
  if (isNaN(revNum)) return NextResponse.json({ error: "Invalid revision number" }, { status: 400 })

  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR

  const body = await request.json() as { name?: string }

  const { data, error } = await supabase
    .from("quotes")
    .select("job_meta")
    .eq("id", id)
    .single()

  if (error || !data) return NextResponse.json({ error: "Quote not found" }, { status: 404 })

  const meta = data.job_meta || {}
  const revisions: Record<string, unknown>[] = meta.revisions || []

  const idx = revisions.findIndex((r) => r.revision_number === revNum)
  if (idx === -1) return NextResponse.json({ error: "Revision not found" }, { status: 404 })

  revisions[idx] = { ...revisions[idx], ...(body.name !== undefined ? { name: body.name } : {}) }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ job_meta: { ...meta, revisions } })
    .eq("id", id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, revision: revisions[idx] })
}

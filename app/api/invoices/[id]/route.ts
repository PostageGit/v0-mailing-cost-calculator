import { NextResponse } from "next/server"
import { createClient, supabaseReady } from "@/lib/supabase/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseReady()) return NextResponse.json({ error: "DB not configured" }, { status: 500 })
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseReady()) return NextResponse.json({ error: "DB not configured" }, { status: 500 })
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  // Only allow updating specific fields
  const allowed: Record<string, unknown> = {}
  const fields = [
    "status", "invoice_date", "due_date", "terms", "items",
    "subtotal", "tax_rate", "tax_amount", "total", "notes", "memo",
    "reference_number", "project_name", "qb_exported", "qb_exported_at",
    "customer_name", "contact_name",
  ]
  for (const f of fields) {
    if (f in body) allowed[f] = body[f]
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(allowed)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseReady()) return NextResponse.json({ error: "DB not configured" }, { status: 500 })
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from("invoices").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

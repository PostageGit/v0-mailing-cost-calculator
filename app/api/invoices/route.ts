import { NextResponse } from "next/server"
import { createClient, supabaseReady } from "@/lib/supabase/server"

export async function GET(req: Request) {
  if (!supabaseReady()) return NextResponse.json([])
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false })

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  if (!supabaseReady()) return NextResponse.json({ error: "DB not configured" }, { status: 500 })
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      quote_id: body.quote_id || null,
      customer_id: body.customer_id || null,
      customer_name: body.customer_name || "Unknown",
      contact_name: body.contact_name || null,
      status: body.status || "draft",
      invoice_date: body.invoice_date || new Date().toISOString().slice(0, 10),
      due_date: body.due_date || null,
      terms: body.terms || "Due on receipt",
      items: body.items || [],
      subtotal: body.subtotal || 0,
      tax_rate: body.tax_rate || 0,
      tax_amount: body.tax_amount || 0,
      total: body.total || 0,
      notes: body.notes || null,
      memo: body.memo || null,
      reference_number: body.reference_number || null,
      project_name: body.project_name || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If created from a quote, link back
  if (body.quote_id && data) {
    await supabase
      .from("quotes")
      .update({ invoice_id: data.id, finalized_at: new Date().toISOString() })
      .eq("id", body.quote_id)
  }

  return NextResponse.json(data)
}

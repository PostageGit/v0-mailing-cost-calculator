import { NextResponse } from "next/server"
import { createSafeClient } from "@/lib/supabase/server"

const DB_ERR = NextResponse.json({ error: "Database connection unavailable" }, { status: 503 })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR
  
  const { data, error } = await supabase
    .from("quotes")
    .select(`
      id,
      quote_number,
      job_number,
      project_name,
      customer_id,
      mailing_date,
      quantity,
      mailing_class,
      notes,
      job_meta,
      invoice_id,
      created_at,
      updated_at,
      customer:customers(id, company_name),
      invoice:invoices(id, invoice_number)
    `)
    .eq("id", id)
    .eq("is_job", true)
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR
  const body = await request.json()
  
  // Extract allowed fields to update
  const allowedFields = [
    "project_name",
    "customer_id",
    "mailing_date",
    "quantity",
    "mailing_class",
    "notes",
    "job_meta",
  ]
  
  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }
  
  // Always update updated_at
  updateData.updated_at = new Date().toISOString()
  
  const { data, error } = await supabase
    .from("quotes")
    .update(updateData)
    .eq("id", id)
    .eq("is_job", true)
    .select(`
      id,
      quote_number,
      job_number,
      project_name,
      customer_id,
      mailing_date,
      quantity,
      mailing_class,
      notes,
      job_meta,
      invoice_id,
      created_at,
      updated_at,
      customer:customers(id, company_name),
      invoice:invoices(id, invoice_number)
    `)
    .single()
  
  if (error) {
    console.error("Error updating production job:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}

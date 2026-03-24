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
    .select("*")
    .eq("id", id)
    .eq("is_job", true)
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  
  // Fetch customer if exists
  let customer = null
  if (data.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("id", data.customer_id)
      .single()
    customer = cust
  }
  
  return NextResponse.json({ ...data, customer })
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
    .select("*")
    .single()
  
  if (error) {
    console.error("Error updating production job:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Fetch customer if exists
  let customer = null
  if (data.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("id", data.customer_id)
      .single()
    customer = cust
  }
  
  return NextResponse.json({ ...data, customer })
}

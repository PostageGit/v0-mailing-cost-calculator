import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  
  // Fetch all jobs (is_job = true) that are not archived
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
    .eq("is_job", true)
    .eq("archived", false)
    .order("mailing_date", { ascending: true, nullsFirst: false })
  
  if (error) {
    console.error("[v0] Error fetching production jobs:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  console.log("[v0] Production jobs fetched:", data?.length || 0, "jobs")
  
  return NextResponse.json(data || [])
}

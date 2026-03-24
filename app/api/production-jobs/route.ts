import { NextResponse } from "next/server"
import { createSafeClient } from "@/lib/supabase/server"

const DB_ERR = NextResponse.json({ error: "Database connection unavailable" }, { status: 503 })

export async function GET() {
  const supabase = await createSafeClient()
  if (!supabase) return DB_ERR
  
  // Fetch all jobs (is_job = true) that are not archived
  const { data: jobs, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("is_job", true)
    .eq("archived", false)
    .order("mailing_date", { ascending: true, nullsFirst: false })
  
  if (error) {
    console.error("[v0] Error fetching production jobs:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Fetch customers for all jobs
  const customerIds = [...new Set((jobs || []).map(j => j.customer_id).filter(Boolean))]
  const { data: customers } = customerIds.length > 0 
    ? await supabase.from("customers").select("id, company_name").in("id", customerIds)
    : { data: [] }
  
  const customerMap = new Map((customers || []).map(c => [c.id, c]))
  
  // Attach customer data to jobs
  const data = (jobs || []).map(j => ({
    ...j,
    customer: j.customer_id ? customerMap.get(j.customer_id) : null
  }))
  
  console.log("[v0] Production jobs fetched:", data.length, "jobs")
  
  return NextResponse.json(data)
}

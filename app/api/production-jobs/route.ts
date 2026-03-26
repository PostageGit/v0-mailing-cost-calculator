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
  
  // Fetch purchase orders for all jobs
  const jobIds = (jobs || []).map(j => j.id)
  const { data: purchaseOrders } = jobIds.length > 0
    ? await supabase
        .from("purchase_orders")
        .select("id, job_id, po_number, ohp_job_number, ohp_location, status, needed_date, sent_at, received_at, in_production_at, confirmed_at")
        .in("job_id", jobIds)
    : { data: [] }
  
  // Group purchase orders by job_id
  const poMap = new Map<string, typeof purchaseOrders>()
  for (const po of purchaseOrders || []) {
    if (!poMap.has(po.job_id)) poMap.set(po.job_id, [])
    poMap.get(po.job_id)!.push(po)
  }
  
  // Attach customer and purchase order data to jobs
  const data = (jobs || []).map(j => ({
    ...j,
    customer: j.customer_id ? customerMap.get(j.customer_id) : null,
    purchase_orders: poMap.get(j.id) || []
  }))
  
  return NextResponse.json(data)
}

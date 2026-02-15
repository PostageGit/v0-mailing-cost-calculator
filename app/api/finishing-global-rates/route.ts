import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("finishing_global_rates")
    .select("*")
    .limit(1)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const body = await req.json()

  // Get the single row
  const { data: existing } = await supabase
    .from("finishing_global_rates")
    .select("id")
    .limit(1)
    .single()
  if (!existing) return NextResponse.json({ error: "No global rates row found" }, { status: 404 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.setup_labor_rate !== undefined) updates.setup_labor_rate = body.setup_labor_rate
  if (body.running_labor_rate !== undefined) updates.running_labor_rate = body.running_labor_rate
  if (body.broker_discount !== undefined) updates.broker_discount = body.broker_discount

  const { data, error } = await supabase
    .from("finishing_global_rates")
    .update(updates)
    .eq("id", existing.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

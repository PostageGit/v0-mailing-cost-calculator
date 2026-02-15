import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("finishing_calculators")
    .select("*")
    .order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from("finishing_calculators")
    .insert({
      name: body.name || "New Finishing",
      apply_per: body.apply_per || "cut_item",
      material_cost: body.material_cost ?? 0,
      labor_cost: body.labor_cost ?? 0,
      setup_minutes: body.setup_minutes ?? 0,
      setup_buffer_minutes: body.setup_buffer_minutes ?? 0,
      speed_per_hour: body.speed_per_hour ?? 0,
      running_buffer_minutes: body.running_buffer_minutes ?? 0,
      markup: body.markup ?? 1.0,
      enabled_calculators: body.enabled_calculators || [],
      is_active: body.is_active ?? true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

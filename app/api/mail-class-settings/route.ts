import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("mail_class_settings")
    .select("*")
    .order("class_name", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from("mail_class_settings")
    .insert({
      class_name: body.class_name,
      addressing: body.addressing ?? 0,
      computer_work: body.computer_work ?? 0,
      cass: body.cass ?? 0,
      inserting: body.inserting ?? 0,
      stamping: body.stamping ?? 0,
      printing: body.printing ?? 0,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

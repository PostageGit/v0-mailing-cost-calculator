import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const fetcher = async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("item_templates")
    .select("*")
    .order("group_name")
    .order("sort_order")
    .order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET() {
  return fetcher()
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from("item_templates")
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

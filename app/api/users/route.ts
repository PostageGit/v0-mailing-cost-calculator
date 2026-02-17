import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const sb = createClient()
  const { data, error } = await sb
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const sb = createClient()
  const { data, error } = await sb
    .from("app_users")
    .insert({
      name: body.name || "New User",
      email: body.email || "",
      role: body.role || "user",
      active: body.active ?? true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

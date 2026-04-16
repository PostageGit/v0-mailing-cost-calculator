import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("app_config")
      .select("key, value, description")

    if (error) throw error

    // Convert array to object for easier access
    const config: Record<string, any> = {}
    for (const row of data || []) {
      config[row.key] = row.value
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error("Error fetching app config:", error)
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const updates = await request.json()

    // Update each key
    for (const [key, value] of Object.entries(updates)) {
      const { error } = await supabase
        .from("app_config")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating app config:", error)
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 })
  }
}

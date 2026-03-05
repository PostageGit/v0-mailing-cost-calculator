import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { refNumber, attachments } = await request.json()

    if (!refNumber || !attachments || !Array.isArray(attachments)) {
      return NextResponse.json({ error: "Missing refNumber or attachments" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get existing attachments
    const { data: existing } = await supabase
      .from("chat_quotes")
      .select("attachments")
      .eq("ref_number", refNumber)
      .single()

    const existingFiles = existing?.attachments || []
    const merged = [...existingFiles, ...attachments]

    const { error } = await supabase
      .from("chat_quotes")
      .update({ attachments: merged })
      .eq("ref_number", refNumber)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, total: merged.length })
  } catch (error) {
    console.error("Attach error:", error)
    return NextResponse.json({ error: "Failed to attach files" }, { status: 500 })
  }
}

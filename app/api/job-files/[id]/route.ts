import { del } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// DELETE a file
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Get the file record first to get blob_url
  const { data: file, error: fetchErr } = await supabase
    .from("job_files")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchErr || !file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  // Delete from Vercel Blob
  try {
    await del(file.blob_url)
  } catch {
    // Blob may already be gone, continue with DB cleanup
  }

  // Delete from DB
  const { error } = await supabase.from("job_files").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

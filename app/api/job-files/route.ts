import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET files for a quote/job
export async function GET(request: NextRequest) {
  const quoteId = request.nextUrl.searchParams.get("quote_id")
  if (!quoteId) return NextResponse.json({ error: "quote_id required" }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("job_files")
    .select("*")
    .eq("quote_id", quoteId)
    .order("uploaded_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST upload a file
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get("file") as File
  const quoteId = formData.get("quote_id") as string

  if (!file || !quoteId) {
    return NextResponse.json({ error: "file and quote_id required" }, { status: 400 })
  }

  // Upload to Vercel Blob with a folder path
  const blob = await put(`jobs/${quoteId}/${file.name}`, file, {
    access: "public",
  })

  // Save reference to DB
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("job_files")
    .insert({
      quote_id: quoteId,
      blob_url: blob.url,
      filename: file.name,
      size: file.size,
      mime_type: file.type || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

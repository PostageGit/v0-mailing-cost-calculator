import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

// POST: upload a list file for a supplier item
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get("file") as File
  const supplierId = formData.get("supplierId") as string
  const itemId = formData.get("itemId") as string

  if (!file || !supplierId || !itemId) {
    return NextResponse.json(
      { error: "file, supplierId, and itemId are required" },
      { status: 400 }
    )
  }

  const blob = await put(`suppliers/${supplierId}/${itemId}/${file.name}`, file, {
    access: "public",
  })

  return NextResponse.json({
    url: blob.url,
    fileName: file.name,
    size: file.size,
  })
}

import { generateQuotePdf } from "@/lib/quote-pdf"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const url = await generateQuotePdf(body)
    return Response.json({ url })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[quote-pdf] Error:", msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import {
  sendEmail,
  buildInvoiceEmail,
  buildQuoteEmail,
  type InvoiceEmailData,
  type QuoteEmailData,
} from "@/lib/email"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type, to, data, pdfBase64, pdfFilename } = body as {
      type: "invoice" | "quote"
      to: string | string[]
      data: InvoiceEmailData | QuoteEmailData
      pdfBase64?: string
      pdfFilename?: string
    }

    if (!to || !type || !data) {
      return NextResponse.json({ error: "Missing to, type, or data" }, { status: 400 })
    }

    // Build the email content based on type
    let subject: string
    let html: string

    if (type === "invoice") {
      const result = buildInvoiceEmail(data as InvoiceEmailData)
      subject = result.subject
      html = result.html
    } else {
      const result = buildQuoteEmail(data as QuoteEmailData)
      subject = result.subject
      html = result.html
    }

    // Build attachments array
    const attachments = pdfBase64 && pdfFilename
      ? [{ filename: pdfFilename, content: pdfBase64 }]
      : undefined

    const result = await sendEmail({ to, subject, html, attachments })

    return NextResponse.json({ success: true, id: result?.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send email"
    console.error("[email/send]", msg)
    // If RESEND_API_KEY is missing, give a helpful message
    if (msg.includes("RESEND_API_KEY")) {
      return NextResponse.json(
        { error: "Email not configured. Add your RESEND_API_KEY in project settings." },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

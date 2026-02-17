import { Resend } from "resend"
import { COMPANY } from "./company"

/* ── Resend singleton ─────────────────────────────────────── */
let _resend: Resend | null = null
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error("RESEND_API_KEY is not set")
    _resend = new Resend(key)
  }
  return _resend
}

/* ── Types ────────────────────────────────────────────────── */
export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  attachments?: { filename: string; content: Buffer | string }[]
}

export interface InvoiceEmailData {
  invoiceNumber: number
  customerName: string
  contactName?: string
  total: number
  dueDate?: string
  terms: string
  items: { label: string; description: string; amount: number }[]
  pdfBuffer?: Buffer | string
}

export interface QuoteEmailData {
  quoteNumber: number | null
  projectName: string
  customerName: string
  contactName?: string
  total: number
  items: { label: string; description: string; amount: number }[]
  pdfBuffer?: Buffer | string
}

/* ── Core sender ──────────────────────────────────────────── */
export async function sendEmail(payload: EmailPayload) {
  const resend = getResend()
  const fromDomain = process.env.RESEND_FROM_DOMAIN
  const fromEmail = fromDomain
    ? `${COMPANY.name} <no-reply@${fromDomain}>`
    : `${COMPANY.name} <onboarding@resend.dev>`

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
    html: payload.html,
    replyTo: payload.replyTo || COMPANY.email,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: typeof a.content === "string" ? Buffer.from(a.content, "base64") : a.content,
    })),
  })

  if (error) throw new Error(error.message)
  return data
}

/* ── HTML Templates ───────────────────────────────────────── */

const wrapper = (body: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; color: #18181b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #18181b; padding: 28px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
    .header p { margin: 4px 0 0; color: #a1a1aa; font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; margin: 0 0 16px; }
    .message { font-size: 14px; color: #52525b; line-height: 1.6; margin: 0 0 24px; }
    .amount-box { background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px; }
    .amount-label { font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px; }
    .amount-value { font-size: 32px; font-weight: 700; color: #18181b; margin: 0; }
    table.items { width: 100%; border-collapse: collapse; margin: 0 0 24px; }
    table.items th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; border-bottom: 1px solid #e4e4e7; padding: 8px 0; }
    table.items td { font-size: 13px; padding: 10px 0; border-bottom: 1px solid #f4f4f5; }
    table.items td.amount { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
    table.items td.desc { color: #71717a; font-size: 12px; }
    .total-row td { border-bottom: none; font-weight: 700; font-size: 15px; padding-top: 12px; }
    .cta { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .footer { padding: 24px 32px; background: #fafafa; border-top: 1px solid #e4e4e7; }
    .footer p { margin: 0; font-size: 12px; color: #a1a1aa; line-height: 1.5; }
    .divider { height: 1px; background: #e4e4e7; margin: 24px 0; }
    .details-grid { display: flex; gap: 24px; margin: 0 0 24px; }
    .detail-item { flex: 1; }
    .detail-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin: 0 0 2px; }
    .detail-value { font-size: 14px; font-weight: 500; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
    <div class="footer">
      <p><strong>${COMPANY.name}</strong></p>
      <p>${COMPANY.address}<br>${COMPANY.city}, ${COMPANY.state} ${COMPANY.zip}</p>
      <p>${COMPANY.phone} &middot; ${COMPANY.email}</p>
    </div>
  </div>
</body>
</html>`

function formatMoney(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function itemsTable(items: { label: string; description: string; amount: number }[], total: number) {
  const rows = items.map((it) => `
    <tr>
      <td>
        ${it.label}
        ${it.description ? `<div class="desc">${it.description}</div>` : ""}
      </td>
      <td class="amount">${formatMoney(it.amount)}</td>
    </tr>`).join("")

  return `
    <table class="items">
      <thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td>Total</td>
          <td class="amount">${formatMoney(total)}</td>
        </tr>
      </tbody>
    </table>`
}

/* ── Invoice Email ────────────────────────────────────────── */
export function buildInvoiceEmail(d: InvoiceEmailData): { subject: string; html: string } {
  const subject = `Invoice #INV-${d.invoiceNumber} from ${COMPANY.name} - ${formatMoney(d.total)}`
  const greeting = d.contactName ? `Hi ${d.contactName.split(" ")[0]},` : `Hi,`

  const html = wrapper(`
    <div class="header">
      <h1>Invoice #INV-${d.invoiceNumber}</h1>
      <p>${COMPANY.name}</p>
    </div>
    <div class="body">
      <p class="greeting">${greeting}</p>
      <p class="message">Please find your invoice below. ${d.dueDate ? `Payment is due by <strong>${d.dueDate}</strong>.` : `Terms: <strong>${d.terms}</strong>.`}</p>

      <div class="amount-box">
        <p class="amount-label">Amount Due</p>
        <p class="amount-value">${formatMoney(d.total)}</p>
      </div>

      <table style="width:100%;margin:0 0 24px;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;">
            <p class="detail-label">Bill To</p>
            <p class="detail-value">${d.customerName}</p>
          </td>
          <td style="width:25%;">
            <p class="detail-label">Invoice Date</p>
            <p class="detail-value">${new Date().toLocaleDateString("en-US")}</p>
          </td>
          <td style="width:25%;">
            <p class="detail-label">Terms</p>
            <p class="detail-value">${d.terms}</p>
          </td>
        </tr>
      </table>

      <div class="divider"></div>
      ${itemsTable(d.items, d.total)}

      <p class="message">If you have any questions, just reply to this email.</p>
    </div>
  `)

  return { subject, html }
}

/* ── Quote/Estimate Email ─────────────────────────────────── */
export function buildQuoteEmail(d: QuoteEmailData): { subject: string; html: string } {
  const num = d.quoteNumber ? `#Q-${d.quoteNumber}` : ""
  const subject = `Quote ${num} from ${COMPANY.name} - ${d.projectName}`
  const greeting = d.contactName ? `Hi ${d.contactName.split(" ")[0]},` : `Hi,`

  const html = wrapper(`
    <div class="header">
      <h1>Quote ${num}</h1>
      <p>${d.projectName} &middot; ${COMPANY.name}</p>
    </div>
    <div class="body">
      <p class="greeting">${greeting}</p>
      <p class="message">Thank you for the opportunity. Here is our quote for <strong>${d.projectName}</strong>.</p>

      <div class="amount-box">
        <p class="amount-label">Quoted Total</p>
        <p class="amount-value">${formatMoney(d.total)}</p>
      </div>

      <table style="width:100%;margin:0 0 24px;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;">
            <p class="detail-label">Prepared For</p>
            <p class="detail-value">${d.customerName}</p>
          </td>
          <td style="width:50%;">
            <p class="detail-label">Date</p>
            <p class="detail-value">${new Date().toLocaleDateString("en-US")}</p>
          </td>
        </tr>
      </table>

      <div class="divider"></div>
      ${itemsTable(d.items, d.total)}

      <p class="message">This quote is valid for 30 days. To proceed, just reply to this email or give us a call.</p>
    </div>
  `)

  return { subject, html }
}

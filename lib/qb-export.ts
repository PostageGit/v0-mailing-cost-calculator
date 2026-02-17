/**
 * QuickBooks CSV Export Utility
 *
 * Generates CSV files matching **Transaction Pro Importer** field mapping
 * for QuickBooks Online invoices and estimates.
 *
 * Reference: https://importer.transactionpro.com/Importer/Docs/Import/Invoice.aspx
 *
 * Transaction Pro Invoice fields used:
 *   RefNumber, Customer, TxnDate, DueDate, SalesTerm,
 *   BillAddrLine1, BillAddrLine2, BillAddrCity, BillAddrState, BillAddrPostalCode,
 *   PrivateNote, Msg,
 *   LineItem, LineDesc, LineQty, LineUnitPrice, LineAmount
 *
 * Transaction Pro Estimate fields used:
 *   RefNumber, Customer, TxnDate, ExpirationDate,
 *   BillAddrLine1, BillAddrLine2, BillAddrCity, BillAddrState, BillAddrPostalCode,
 *   PrivateNote, Msg,
 *   LineItem, LineDesc, LineQty, LineUnitPrice, LineAmount
 */

export interface QBLineItem {
  /** Product/Service name in QB (e.g. "Printing", "Postage") */
  serviceName?: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface QBAddress {
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
}

export interface QBInvoiceData {
  invoiceNumber: number | string
  customerName: string
  invoiceDate: string   // YYYY-MM-DD
  dueDate?: string
  terms?: string
  billingAddress?: QBAddress
  items: QBLineItem[]
  memo?: string         // internal (PrivateNote)
  message?: string      // customer-facing (Msg on invoice)
}

export interface QBEstimateData {
  estimateNumber: number | string
  customerName: string
  estimateDate: string
  expirationDate?: string
  billingAddress?: QBAddress
  items: QBLineItem[]
  memo?: string
  message?: string
}

/* ────────────────────────────── helpers ────────────────────────────── */

function csvEscape(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return ""
  const str = String(val)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function csvRow(values: (string | number | undefined | null)[]): string {
  return values.map(csvEscape).join(",")
}

/** MM/DD/YYYY -- Transaction Pro's preferred date format */
function formatTPDate(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`
}

/** Map our quote category to a QB Product/Service name */
const CATEGORY_SERVICE_MAP: Record<string, string> = {
  envelope: "Envelopes",
  postage: "Postage",
  labor: "Labor",
  printing: "Printing",
  binding: "Binding",
  item: "Materials",
  ohp: "Outside Services",
  other: "Other",
}

/* ═══════════════════════════════════════════════════════
   Transaction Pro Invoice CSV
   ═══════════════════════════════════════════════════════ */

export function generateInvoiceCSV(invoices: QBInvoiceData[]): string {
  const headers = [
    "RefNumber",        // Invoice #
    "Customer",         // Customer name (must match QB)
    "TxnDate",          // Invoice Date
    "DueDate",          // Due Date
    "SalesTerm",        // Terms
    "BillAddrLine1",    // Billing address
    "BillAddrLine2",
    "BillAddrCity",
    "BillAddrState",
    "BillAddrPostalCode",
    "PrivateNote",      // Internal memo
    "Msg",              // Message displayed on invoice
    "LineItem",         // Product/Service
    "LineDesc",         // Line description
    "LineQty",          // Quantity
    "LineUnitPrice",    // Rate
    "LineAmount",       // Amount
  ]

  const rows: string[] = [csvRow(headers)]

  for (const inv of invoices) {
    const date = formatTPDate(inv.invoiceDate)
    const due = inv.dueDate ? formatTPDate(inv.dueDate) : ""
    const terms = inv.terms || "Due on receipt"
    const addr = inv.billingAddress || {}

    if (inv.items.length === 0) {
      rows.push(csvRow([
        inv.invoiceNumber, inv.customerName, date, due, terms,
        addr.line1, addr.line2, addr.city, addr.state, addr.zip,
        inv.memo, inv.message,
        "", "", "", "", "",
      ]))
    } else {
      inv.items.forEach((item, idx) => {
        rows.push(csvRow([
          inv.invoiceNumber,
          inv.customerName,
          // Header fields only on first row per Transaction Pro spec
          idx === 0 ? date : "",
          idx === 0 ? due : "",
          idx === 0 ? terms : "",
          idx === 0 ? (addr.line1 || "") : "",
          idx === 0 ? (addr.line2 || "") : "",
          idx === 0 ? (addr.city || "") : "",
          idx === 0 ? (addr.state || "") : "",
          idx === 0 ? (addr.zip || "") : "",
          idx === 0 ? (inv.memo || "") : "",
          idx === 0 ? (inv.message || "") : "",
          item.serviceName || "",
          item.description,
          item.quantity,
          item.rate,
          item.amount,
        ]))
      })
    }
  }

  return rows.join("\r\n")  // Windows line endings for Transaction Pro
}

/* ═══════════════════════════════════════════════════════
   Transaction Pro Estimate CSV
   ═══════════════════════════════════════════════════════ */

export function generateEstimateCSV(estimates: QBEstimateData[]): string {
  const headers = [
    "RefNumber",
    "Customer",
    "TxnDate",
    "ExpirationDate",
    "BillAddrLine1",
    "BillAddrLine2",
    "BillAddrCity",
    "BillAddrState",
    "BillAddrPostalCode",
    "PrivateNote",
    "Msg",
    "LineItem",
    "LineDesc",
    "LineQty",
    "LineUnitPrice",
    "LineAmount",
  ]

  const rows: string[] = [csvRow(headers)]

  for (const est of estimates) {
    const date = formatTPDate(est.estimateDate)
    const exp = est.expirationDate ? formatTPDate(est.expirationDate) : ""
    const addr = est.billingAddress || {}

    if (est.items.length === 0) {
      rows.push(csvRow([
        est.estimateNumber, est.customerName, date, exp,
        addr.line1, addr.line2, addr.city, addr.state, addr.zip,
        est.memo, est.message,
        "", "", "", "", "",
      ]))
    } else {
      est.items.forEach((item, idx) => {
        rows.push(csvRow([
          est.estimateNumber,
          est.customerName,
          idx === 0 ? date : "",
          idx === 0 ? exp : "",
          idx === 0 ? (addr.line1 || "") : "",
          idx === 0 ? (addr.line2 || "") : "",
          idx === 0 ? (addr.city || "") : "",
          idx === 0 ? (addr.state || "") : "",
          idx === 0 ? (addr.zip || "") : "",
          idx === 0 ? (est.memo || "") : "",
          idx === 0 ? (est.message || "") : "",
          item.serviceName || "",
          item.description,
          item.quantity,
          item.rate,
          item.amount,
        ]))
      })
    }
  }

  return rows.join("\r\n")
}

/* ═══════════════════════════════════════════════════════
   Converters
   ═══════════════════════════════════════════════════════ */

/**
 * Convert our QuoteLineItem[] to Transaction Pro-compatible line items.
 * Maps each category to a QB Product/Service name.
 */
export function quoteItemsToQBLines(
  items: { category: string; label: string; description: string; amount: number }[],
): QBLineItem[] {
  return items.map((item) => ({
    serviceName: CATEGORY_SERVICE_MAP[item.category] || "Other",
    description: [item.label, item.description].filter(Boolean).join(" - "),
    quantity: 1,
    rate: item.amount,
    amount: item.amount,
  }))
}

/**
 * Trigger a CSV download in the browser
 */
export function downloadCSV(csv: string, filename: string) {
  // BOM for Excel/Transaction Pro UTF-8 compatibility
  const bom = "\uFEFF"
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

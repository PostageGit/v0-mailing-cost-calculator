/**
 * QuickBooks Online CSV Export Utility
 *
 * Generates CSV files matching QB Online's import format for:
 * - Estimates (Quotes)
 * - Invoices
 *
 * QB Invoice CSV columns:
 * InvoiceNo, Customer, InvoiceDate, DueDate, Terms, ItemDescription,
 * ItemQuantity, ItemRate, ItemAmount, Memo
 *
 * QB Estimate CSV columns:
 * EstimateNo, Customer, EstimateDate, ExpirationDate, ItemDescription,
 * ItemQuantity, ItemRate, ItemAmount, Memo
 */

export interface QBLineItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface QBInvoiceData {
  invoiceNumber: number | string
  customerName: string
  invoiceDate: string // YYYY-MM-DD
  dueDate?: string
  terms?: string
  items: QBLineItem[]
  memo?: string
}

export interface QBEstimateData {
  estimateNumber: number | string
  customerName: string
  estimateDate: string
  expirationDate?: string
  items: QBLineItem[]
  memo?: string
}

// Escape CSV value: wrap in quotes if it contains commas, quotes, or newlines
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

/**
 * Generate QB Online Invoice CSV for one or more invoices.
 * Multi-line items share the same InvoiceNo row group.
 */
export function generateInvoiceCSV(invoices: QBInvoiceData[]): string {
  const headers = [
    "InvoiceNo", "Customer", "InvoiceDate", "DueDate", "Terms",
    "ItemDescription", "ItemQuantity", "ItemRate", "ItemAmount", "Memo",
  ]

  const rows: string[] = [csvRow(headers)]

  for (const inv of invoices) {
    const date = formatQBDate(inv.invoiceDate)
    const due = inv.dueDate ? formatQBDate(inv.dueDate) : ""
    const terms = inv.terms || "Due on receipt"

    if (inv.items.length === 0) {
      // Invoice with no line items (just header)
      rows.push(csvRow([
        inv.invoiceNumber, inv.customerName, date, due, terms,
        "", "", "", "", inv.memo || "",
      ]))
    } else {
      inv.items.forEach((item, idx) => {
        rows.push(csvRow([
          // Only first row gets the header fields; subsequent rows repeat customer for QB
          inv.invoiceNumber,
          inv.customerName,
          idx === 0 ? date : "",
          idx === 0 ? due : "",
          idx === 0 ? terms : "",
          item.description,
          item.quantity,
          item.rate,
          item.amount,
          idx === 0 ? (inv.memo || "") : "",
        ]))
      })
    }
  }

  return rows.join("\n")
}

/**
 * Generate QB Online Estimate CSV for one or more estimates.
 */
export function generateEstimateCSV(estimates: QBEstimateData[]): string {
  const headers = [
    "EstimateNo", "Customer", "EstimateDate", "ExpirationDate",
    "ItemDescription", "ItemQuantity", "ItemRate", "ItemAmount", "Memo",
  ]

  const rows: string[] = [csvRow(headers)]

  for (const est of estimates) {
    const date = formatQBDate(est.estimateDate)
    const exp = est.expirationDate ? formatQBDate(est.expirationDate) : ""

    if (est.items.length === 0) {
      rows.push(csvRow([
        est.estimateNumber, est.customerName, date, exp,
        "", "", "", "", est.memo || "",
      ]))
    } else {
      est.items.forEach((item, idx) => {
        rows.push(csvRow([
          est.estimateNumber,
          est.customerName,
          idx === 0 ? date : "",
          idx === 0 ? exp : "",
          item.description,
          item.quantity,
          item.rate,
          item.amount,
          idx === 0 ? (est.memo || "") : "",
        ]))
      })
    }
  }

  return rows.join("\n")
}

/**
 * Convert our QuoteLineItem[] to QB-compatible line items.
 * Groups by category label for cleaner QB display.
 */
export function quoteItemsToQBLines(
  items: { category: string; label: string; description: string; amount: number }[],
  quantity?: number,
): QBLineItem[] {
  return items.map((item) => ({
    description: [item.label, item.description].filter(Boolean).join(" - "),
    quantity: 1,
    rate: item.amount,
    amount: item.amount,
  }))
}

/**
 * Format date to MM/DD/YYYY for QB import
 */
function formatQBDate(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const y = d.getFullYear()
  return `${m}/${day}/${y}`
}

/**
 * Trigger a CSV download in the browser
 */
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
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

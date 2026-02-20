import { getCategoryLabel, type QuoteCategory } from "./quote-types"
import { formatCurrency } from "./pricing"
import { COMPANY } from "./company"

interface TextItem {
  category: QuoteCategory
  label: string
  description: string
  amount: number
  metadata?: Record<string, unknown>
}

/** Build a compact finishing spec line from metadata */
function buildFinishingLine(m: Record<string, unknown>): string {
  const parts: string[] = []
  if (m.pieceDimensions) parts.push(String(m.pieceDimensions) + '"')
  if (m.foldType && m.foldType !== "none") parts.push("Fold: " + String(m.foldType).replace("x2h","Half(H)").replace("x2w","Half(W)").replace("x3h","Tri(H)").replace("x3w","Tri(W)"))
  if (m.paperName) parts.push(String(m.paperName))
  if (m.sides) parts.push(String(m.sides))
  if (m.hasBleed) parts.push("Bleed")
  if (m.pageCount) parts.push(m.pageCount + "pg")
  if (m.envelopeSize) parts.push("Env: " + String(m.envelopeSize))
  if (m.envelopeKind) parts.push(String(m.envelopeKind))
  if (m.production && m.production !== "inhouse") {
    const prodLabels: Record<string, string> = { ohp: "OHP", both: "In+OHP", customer: "Customer Provided" }
    parts.push(prodLabels[String(m.production)] || String(m.production))
  }
  if (m.mailingClass) parts.push(String(m.mailingClass))
  if (m.mailShape) parts.push(String(m.mailShape).charAt(0).toUpperCase() + String(m.mailShape).slice(1))
  if (m.tierName) parts.push(String(m.tierName))
  if (m.entryPoint) parts.push(String(m.entryPoint))
  return parts.join(", ")
}

export interface QuoteTextOptions {
  items: TextItem[]
  projectName?: string
  customerName?: string
  referenceNumber?: string
  quantity?: number
  notes?: string
}

/**
 * Builds clean plain-text quote output for email / clipboard.
 *
 * Order:
 *  1. Company header (name, address, phone, email)
 *  2. Date/time copied
 *  3. Job info (name, customer, ref #, quantity)
 *  4. Line items by category with finishing specs
 *  5. Total
 */
export function buildQuoteText(opts: QuoteTextOptions): string {
  const { items, projectName, customerName, referenceNumber, quantity, notes } = opts
  const lines: string[] = []
  const divider = "------------------------------"
  const miniDivider = "----"

  // ── 1. Company header ──
  lines.push(COMPANY.name)
  lines.push(COMPANY.fullAddress)
  lines.push(`${COMPANY.phone} | ${COMPANY.email}`)
  lines.push(divider)

  // ── 2. Date / time ──
  const now = new Date()
  lines.push(`Date: ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`)
  lines.push("")

  // ── 3. Job info ──
  if (projectName) lines.push(`Job: ${projectName}`)
  if (customerName) lines.push(`Customer: ${customerName}`)
  if (referenceNumber) lines.push(`PO / Ref #: ${referenceNumber}`)
  if (quantity) lines.push(`Quantity: ${quantity.toLocaleString()}`)
  if (projectName || customerName || referenceNumber || quantity) {
    lines.push(divider)
  }

  // ── 4. Line items ──
  const PRINT_CATS: QuoteCategory[] = ["flat", "booklet", "spiral", "perfect", "pad"]
  const OTHER_CATS: QuoteCategory[] = ["envelope", "postage", "listwork", "item", "ohp"]

  // --- PRINTING super-group ---
  const printItems = items.filter((i) => PRINT_CATS.includes(i.category))
  if (printItems.length > 0) {
    const grouped: Record<string, TextItem[]> = {}
    for (const item of printItems) {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    }

    const catKeys = Object.keys(grouped) as QuoteCategory[]
    catKeys.forEach((cat, catIdx) => {
      const catItems = grouped[cat]
      catItems.forEach((item, itemIdx) => {
        if (catIdx > 0 || itemIdx > 0) lines.push(miniDivider)
        lines.push("PRINTING")
        lines.push(getCategoryLabel(cat))
        if (item.description) lines.push(item.description)
        if (item.metadata) {
          const finishing = buildFinishingLine(item.metadata)
          if (finishing) lines.push(`  Specs: ${finishing}`)
        }
        lines.push(formatCurrency(item.amount))
      })
    })
    lines.push("")
    lines.push(divider)
  }

  // --- Other categories ---
  for (const cat of OTHER_CATS) {
    const catItems = items.filter((i) => i.category === cat)
    if (catItems.length === 0) continue

    const label = getCategoryLabel(cat)
    catItems.forEach((item, idx) => {
      if (idx > 0) lines.push(miniDivider)
      lines.push(label)
      if (item.description) lines.push(item.description)
      if (item.metadata) {
        const finishing = buildFinishingLine(item.metadata)
        if (finishing) lines.push(`  Specs: ${finishing}`)
      }
      lines.push(formatCurrency(item.amount))
    })
    lines.push("")
    lines.push(divider)
  }

  // ── 5. Total ──
  const total = items.reduce((s, i) => s + i.amount, 0)
  lines.push(`TOTAL: ${formatCurrency(total)}`)

  if (notes) {
    lines.push("")
    lines.push(notes)
  }

  lines.push("")
  return lines.join("\n")
}

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

/**
 * Build a customer-facing spec line from metadata.
 * Excludes internal info: production method (In+OHP, OHP), tier names (3-Digit),
 * entry points (ORIGIN, DNDC), and other operational details.
 */
function buildCustomerSpecs(m: Record<string, unknown>): string {
  const parts: string[] = []
  if (m.pieceDimensions) parts.push(String(m.pieceDimensions) + '"')
  if (m.paperName) parts.push(String(m.paperName))
  if (m.sides) parts.push(String(m.sides))
  if (m.pageCount) parts.push(m.pageCount + "pg")
  if (m.hasBleed) parts.push("Bleed")
  // Fold type from planner
  if (m.foldType && m.foldType !== "none") {
    const fLabel = String(m.foldType)
      .replace("x3long", "Tri-Fold (Long)")
      .replace("x2h", "Half Fold")
      .replace("x2w", "Half Fold")
      .replace("x3h", "Tri-Fold")
      .replace("x3w", "Tri-Fold")
    parts.push(fLabel)
  }
  // Score / Fold finishing
  if (m.scoreFoldEnabled) {
    const opLabels: Record<string, string> = { fold: "Fold", score_and_fold: "Score & Fold", score_only: "Score Only" }
    const foldLabels: Record<string, string> = { half: "Half Fold", tri: "Tri-Fold", z: "Z-Fold", gate: "Gate Fold", roll: "Roll Fold", accordion: "Accordion Fold", double_gate: "Double Gate Fold", double_parallel: "Double Parallel Fold" }
    const op = opLabels[String(m.scoreFoldFinishType)] || String(m.scoreFoldFinishType)
    const ft = foldLabels[String(m.scoreFoldFoldType)] || String(m.scoreFoldFoldType)
    parts.push(`${op}: ${ft}`)
  }
  // Lamination
  if (m.laminationEnabled) {
    const lamSides = m.laminationSides === "both" ? "both sides" : "one side"
    parts.push(`Lamination: ${String(m.laminationType || "Gloss")} (${lamSides})`)
  }
  // Envelope (customer-facing) -- show size and color/BW
  if (m.envelopeSize) parts.push("Envelope: " + String(m.envelopeSize))
  if (m.envelopeKind) {
    const kind = String(m.envelopeKind).toLowerCase()
    if (kind === "paper") {
      // Instead of just "paper", show if color or BW based on inkType
      const inkType = m.inkType ? String(m.inkType).toLowerCase() : ""
      if (inkType.includes("color") || inkType.includes("full")) parts.push("Color")
      else if (inkType.includes("bw") || inkType.includes("black")) parts.push("Black & White")
      else parts.push("Paper")
    } else {
      parts.push(String(m.envelopeKind))
    }
  }
  // Postage: only show class and shape, NOT tier/entry (internal)
  if (m.mailingClass) parts.push(String(m.mailingClass))
  if (m.mailShape) parts.push(String(m.mailShape).charAt(0).toUpperCase() + String(m.mailShape).slice(1))
  // Intentionally excluded: production, tierName, entryPoint
  return parts.join(", ")
}

/** Customer-facing category label for email. "item" and "listwork" become "Mail Work". */
function emailCategoryLabel(cat: QuoteCategory): string {
  if (cat === "item" || cat === "listwork") return "Mail Work"
  return getCategoryLabel(cat)
}

export interface QuoteTextOptions {
  items: TextItem[]
  projectName?: string
  customerName?: string
  referenceNumber?: string
  quoteNumber?: number | string
  quantity?: number
  notes?: string
}

/**
 * Builds clean plain-text quote for email / clipboard.
 *
 * Customer-friendly:
 *  - Internal details stripped (production method, tier, entry point)
 *  - "Items & Supplies" + "List Work" grouped under single "MAIL WORK" header
 *  - Spec lines prefixed with ">"
 *  - Minimal separators, no repeated headers
 */
export function buildQuoteText(opts: QuoteTextOptions): string {
  const { items, projectName, customerName, referenceNumber, quoteNumber, quantity, notes } = opts
  const lines: string[] = []
  const divider = "------------------------------"

  // ── 1. Quote number + Company header ──
  if (quoteNumber) lines.push(`Quote# Q-${quoteNumber}`)
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
  const MAIL_WORK_CATS: QuoteCategory[] = ["item", "listwork"]
  const STANDALONE_CATS: QuoteCategory[] = ["envelope", "postage", "ohp"]

  // --- PRINTING ---
  // One "PRINTING" header, then each item with specs on one ">" line
  // Description (e.g. "80lb Text Gloss, 4/4") is NOT shown separately
  // because the ">" spec line already contains paper, sides, etc.
  const printItems = items.filter((i) => PRINT_CATS.includes(i.category))
  if (printItems.length > 0) {
    lines.push("PRINTING")
    printItems.forEach((item) => {
      const catSub = getCategoryLabel(item.category)
      // Show sub-category label for non-flat types (booklet, spiral, etc.)
      if (item.category !== "flat") lines.push(catSub)
      // Only show description if there are NO metadata specs (fallback)
      if (item.metadata) {
        const specs = buildCustomerSpecs(item.metadata)
        if (specs) lines.push(`>  ${specs}`)
      } else if (item.description) {
        lines.push(item.description)
      }
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }

  // --- ENVELOPES ---
  const envItems = items.filter((i) => i.category === "envelope")
  if (envItems.length > 0) {
    lines.push("ENVELOPES")
    envItems.forEach((item) => {
      if (item.description) lines.push(item.description)
      if (item.metadata) {
        const specs = buildCustomerSpecs(item.metadata)
        if (specs) lines.push(`>  ${specs}`)
      }
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }

  // --- POSTAGE ---
  // Description already contains class, qty, rate. Strip internal tier (3-Digit, 5-Digit, etc.)
  // and entry point. Don't add a duplicate ">" spec line since description covers it.
  const postageItems = items.filter((i) => i.category === "postage")
  if (postageItems.length > 0) {
    lines.push("POSTAGE / USPS")
    postageItems.forEach((item) => {
      if (item.description) {
        // Strip internal tier names and entry points from description
        let desc = item.description
          .replace(/\s*(AADC|Mixed AADC|3-Digit|5-Digit|Basic|SCF|NDC|DDU)\s*/gi, " ")
          .replace(/\s*(ORIGIN|DNDC|DSCF|DADC)\s*/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim()
        lines.push(desc)
      }
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }

  // --- MAIL WORK (consolidated: "item" + "listwork" under one header) ---
  const mailWorkItems = items.filter((i) => MAIL_WORK_CATS.includes(i.category))
  if (mailWorkItems.length > 0) {
    lines.push("MAIL WORK")
    mailWorkItems.forEach((item) => {
      if (item.description) lines.push(item.description)
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }

  // --- OHP ---
  const ohpItems = items.filter((i) => i.category === "ohp")
  if (ohpItems.length > 0) {
    lines.push("OUT OF HOUSE")
    ohpItems.forEach((item) => {
      if (item.description) lines.push(item.description)
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }

  // ── 5. Total ──
  const total = items.reduce((s, i) => s + i.amount, 0)
  lines.push("")
  lines.push(`TOTAL: ${formatCurrency(total)}`)

  if (notes) {
    lines.push("")
    lines.push(notes)
  }

  lines.push("")
  return lines.join("\n")
}

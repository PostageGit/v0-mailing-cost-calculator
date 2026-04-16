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
 *
 * Industry-standard print description order:
 *   Size, Pages (books), Paper stock, Color (sides), Bleed, Fold, Lamination
 *
 * For envelopes: "Paper Envelope" / "Plastic Envelope", size, printing method
 *
 * Intentionally excluded: production method, tier names, entry points, broker flags.
 */
/**
 * Build customer-facing spec string from metadata.
 * @param separator - defaults to "\n" for multi-line (copy/email). Pass ", " for inline (PDF rows).
 */
export function buildCustomerSpecs(m: Record<string, unknown>, category?: QuoteCategory, separator: string = "\n"): string {
  const parts: string[] = []

  // ── ENVELOPE specs ──
  if (category === "envelope") {
    const kind = m.envelopeKind ? String(m.envelopeKind).toLowerCase() : "paper"
    parts.push(kind === "plastic" ? "Plastic Envelope" : "Paper Envelope")
    if (m.pieceDimensions) parts.push(String(m.pieceDimensions) + '"')
    else if (m.envelopeSize) parts.push(String(m.envelopeSize))
    if (m.printType) {
      const pt = String(m.printType).toLowerCase()
      const ink = m.inkType ? String(m.inkType) : ""
      if (pt.includes("color") || pt.includes("full")) {
        parts.push(ink ? `${ink} Color` : "Color")
      } else if (pt.includes("bw") || pt.includes("black")) {
        parts.push(ink ? `${ink} B&W` : "B&W")
      } else {
        parts.push(ink ? `${ink} ${String(m.printType)}` : String(m.printType))
      }
    }
    return parts.join(separator)
  }

  // ── PRINTING specs (flat, booklet, spiral, perfect, pad, ohp) ──
  // 1. Size + Bleed (always on same line)
  if (m.pieceDimensions) {
    const dimStr = String(m.pieceDimensions) + '"'
    parts.push(m.hasBleed ? `${dimStr} + Bleed` : `${dimStr} - No Bleed`)
  }

  // 2. Pages (for books)
  if (m.pageCount) parts.push(m.pageCount + " Pages")

  // 3. Paper stock + sides (when cover exists, sides go on inside pages line)
  if (m.paperName && m.coverPaper) {
    const sidesStr = m.sides ? ` ${String(m.sides)}` : ""
    parts.push(`Inside pages: ${String(m.paperName)}${sidesStr}`)
  } else if (m.paperName) {
    parts.push(String(m.paperName))
  }

  // 3b. Cover paper (booklet/perfect)
  if (m.coverPaper) parts.push(`Cover: ${String(m.coverPaper)}${m.coverSides ? `, ${String(m.coverSides)}` : ""}`)
  
  // 3c. Binding type (booklet/perfect/spiral)
  if (m.bindingType && m.bindingType !== "none") {
    const bindingLabels: Record<string, string> = { 
      staple: "Saddle Stitch", 
      perfect: "Perfect Bound", 
      spiral: "Spiral Bound",
      coil: "Coil Bound",
      wire: "Wire-O Bound"
    }
    parts.push(bindingLabels[String(m.bindingType)] || String(m.bindingType))
  }

  // 4. Color / sides -- only as separate line when NO cover (flat prints etc.)
  if (m.sides && !m.coverPaper) parts.push(String(m.sides))

  // 5. Fold (from planner fold type)
  if (m.foldType && m.foldType !== "none") {
    const fLabel = String(m.foldType)
      .replace("x3long", "Tri-Fold")
      .replace("x2h", "Half Fold")
      .replace("x2w", "Half Fold")
      .replace("x3h", "Tri-Fold")
      .replace("x3w", "Tri-Fold")
    parts.push(fLabel)
  }

  // 6. Score / Fold finishing
  if (m.scoreFoldEnabled) {
    const opLabels: Record<string, string> = { fold: "Fold", score_and_fold: "Score & Fold", score_only: "Score Only" }
    const foldLabels: Record<string, string> = { half: "in Half", tri: "Tri-Fold", z: "Z-Fold", gate: "Gate Fold", roll: "Roll Fold", accordion: "Accordion Fold", double_gate: "Double Gate Fold", double_parallel: "Double Parallel Fold" }
    const op = opLabels[String(m.scoreFoldFinishType)] || String(m.scoreFoldFinishType)
    const ft = foldLabels[String(m.scoreFoldFoldType)] || String(m.scoreFoldFoldType)
    parts.push(`${op} ${ft}`)
  }

  // 7. Lamination
  if (m.laminationEnabled) {
    const lamSides = m.laminationSides === "both" ? "both sides" : "one side"
    parts.push(`${String(m.laminationType || "Gloss")} Lamination (${lamSides})`)
  }

  return parts.join(separator)
}

/** Strip internal tier names and entry points from postage description */
export function cleanPostageDescription(desc: string): string {
  return desc
    .replace(/\s*(AADC|Mixed AADC|Mixed|3-Digit|5-Digit|Basic|SCF|NDC|DDU)\s*/gi, " ")
    .replace(/\s*(ORIGIN|DNDC|DSCF|DADC)\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
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
        const specs = buildCustomerSpecs(item.metadata, item.category, ", ")
        if (specs) lines.push(`>  ${specs}`)
      } else if (item.description) {
        lines.push(item.description)
      }
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }

  // --- ENVELOPES ---
  // Description (e.g. "Laser BW, Broker") may contain internal info.
  // We only show the clean ">" spec line (Paper/Plastic Envelope, size, sides).
  const envItems = items.filter((i) => i.category === "envelope")
  if (envItems.length > 0) {
    lines.push("ENVELOPES")
    envItems.forEach((item) => {
      if (item.metadata) {
        const specs = buildCustomerSpecs(item.metadata, "envelope", ", ")
        if (specs) lines.push(`>  ${specs}`)
      } else if (item.description) {
        // Fallback: strip internal words from description
        const desc = item.description
          .replace(/,?\s*Broker/gi, "")
          .replace(/,?\s*Regular/gi, "")
          .trim()
        if (desc) lines.push(desc)
      }
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }

  // --- POSTAGE ---
  // Description already contains class, qty, rate. Strip internal tier (3-Digit, 5-Digit, etc.)
  // and entry point. Don't add a duplicate ">" spec line since description covers it.
  const postageItems = items.filter((i) => i.category === "postage")
  const hasEstimatedPostage = postageItems.some((i) => i.metadata?.isEstimated)
  if (postageItems.length > 0) {
    lines.push(hasEstimatedPostage ? "POSTAGE / USPS (ESTIMATED)" : "POSTAGE / USPS")
    postageItems.forEach((item) => {
      const m = (item.metadata ?? {}) as Record<string, unknown>
      // Customer sees: Mail class + qty x ~$rate
      const mailClass = m.mailingClass ? String(m.mailingClass) : ""
      const avgPP = m.avgPerPiece ? `~${formatCurrency(Number(m.avgPerPiece))}/pc` : ""
      const custLine = [mailClass, avgPP].filter(Boolean).join(", ")
      if (custLine) lines.push(custLine)
      else if (item.description) lines.push(cleanPostageDescription(item.description))
      lines.push(formatCurrency(item.amount))
    })
    if (hasEstimatedPostage) {
      lines.push("")
      lines.push("* Postage rates shown are estimates. Final rates are determined when the mailing list is processed and the mail piece is verified by USPS standards.")
    }
    lines.push(divider)
  }

  // --- MAIL WORK (consolidated: "item" + "listwork" under one header) ---
  // Split list rentals from other mail work for better presentation
  const mailWorkItems = items.filter((i) => MAIL_WORK_CATS.includes(i.category))
  const listRentalItems = mailWorkItems.filter((i) => i.label.toLowerCase().includes("list rental"))
  const otherMailWork = mailWorkItems.filter((i) => !i.label.toLowerCase().includes("list rental"))
  
  // Show list rentals first with proper formatting
  if (listRentalItems.length > 0) {
    lines.push("LIST RENTALS")
    listRentalItems.forEach((item) => {
      // Label has "List Rental - Monsey" format, description has "13,800 names @ $50/M"
      const listName = item.label.replace(/^List Rental\s*[-–]\s*/i, "").trim()
      // Build a nice customer line: "Monsey - 13,800 names @ $50/M"
      const custLine = item.description ? `${listName} - ${item.description}` : listName
      lines.push(custLine)
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }
  
  if (otherMailWork.length > 0) {
    lines.push("MAIL WORK")
    otherMailWork.forEach((item) => {
      if (item.label) lines.push(item.label)
      if (item.description) lines.push(item.description)
      lines.push(formatCurrency(item.amount))
    })
    lines.push(divider)
  }

  // --- OHP (shown as PRINTING to customer) ---
  const ohpItems = items.filter((i) => i.category === "ohp")
  if (ohpItems.length > 0) {
    // Only add header if no printing section was already printed
    if (printItems.length === 0) lines.push("PRINTING")
    ohpItems.forEach((item) => {
      const m = (item.metadata ?? {}) as Record<string, unknown>
      const specs = buildCustomerSpecs(m, "flat", ", ") // treat OHP metadata as flat printing specs
      if (item.label) lines.push(item.label)
      if (specs) lines.push(`>  ${specs}`)
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

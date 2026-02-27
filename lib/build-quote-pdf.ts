import { jsPDF } from "jspdf"
import { getCategoryLabel, type QuoteCategory } from "./quote-types"
import { formatCurrency } from "./pricing"
import { COMPANY } from "./company"
import { buildCustomerSpecs, cleanPostageDescription, type QuoteTextOptions } from "./build-quote-text"

/* ── Palette ── */
const BLACK = "#1a1a1a"
const DARK_GRAY = "#333333"
const MID_GRAY = "#666666"
const LIGHT_GRAY = "#999999"
const SECTION_BG = "#f5f5f5"
const HEADER_LINE = "#222222"
const DIVIDER = "#dddddd"
const WHITE = "#ffffff"

/* ── Layout constants (mm) ── */
const PAGE_W = 215.9 // Letter width
const PAGE_H = 279.4 // Letter height
const ML = 20        // Left margin
const MR = 20        // Right margin
const MT = 18        // Top margin
const CONTENT_W = PAGE_W - ML - MR
const AMOUNT_X = PAGE_W - MR // Right-aligned amounts

/* ── Category grouping (same as text builder) ── */
const PRINT_CATS: QuoteCategory[] = ["flat", "booklet", "spiral", "perfect", "pad"]
const MAIL_WORK_CATS: QuoteCategory[] = ["item", "listwork"]

/* ── Helpers ── */
function rightText(doc: jsPDF, text: string, x: number, y: number) {
  doc.text(text, x, y, { align: "right" })
}

/**
 * Build and return a jsPDF document for a quote.
 * Call `.save(filename)` on the result to trigger download.
 */
export function buildQuotePDF(opts: QuoteTextOptions): jsPDF {
  const { items, projectName, customerName, referenceNumber, quoteNumber, quantity, notes } = opts
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" })
  let y = MT

  // ──────────────────────────────────────────────
  // 1. COMPANY HEADER
  // ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.setTextColor(BLACK)
  doc.text(COMPANY.name.toUpperCase(), ML, y)

  // Quote # on the right
  if (quoteNumber) {
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    rightText(doc, `Quote# Q-${quoteNumber}`, AMOUNT_X, y)
  }

  y += 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(MID_GRAY)
  doc.text(COMPANY.fullAddress, ML, y)

  // Date on the right
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  rightText(doc, dateStr, AMOUNT_X, y)

  y += 4
  doc.text(`${COMPANY.phone}  |  ${COMPANY.email}`, ML, y)

  y += 4
  doc.setDrawColor(HEADER_LINE)
  doc.setLineWidth(0.6)
  doc.line(ML, y, PAGE_W - MR, y)
  y += 6

  // ──────────────────────────────────────────────
  // 2. JOB INFO BAR
  // ──────────────────────────────────────────────
  if (projectName || customerName || referenceNumber || quantity) {
    doc.setFillColor(SECTION_BG)
    doc.roundedRect(ML, y - 1, CONTENT_W, 16, 2, 2, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(BLACK)

    let infoY = y + 5
    const col1 = ML + 4
    const col2 = ML + CONTENT_W / 2

    if (projectName) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(LIGHT_GRAY)
      doc.text("JOB NAME", col1, infoY - 1)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(DARK_GRAY)
      doc.text(projectName, col1, infoY + 4)
    }

    if (customerName) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(LIGHT_GRAY)
      doc.text("CUSTOMER", col2, infoY - 1)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(DARK_GRAY)
      doc.text(customerName, col2, infoY + 4)
    }

    // Quantity + PO on second mini-row if present
    const hasSecondRow = quantity || referenceNumber
    if (hasSecondRow) {
      infoY += 0 // Stay in same row, right side
    }
    if (quantity) {
      const qtyX = customerName ? col2 + 80 : col2
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(LIGHT_GRAY)
      doc.text("QUANTITY", qtyX, infoY - 1)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(DARK_GRAY)
      doc.text(quantity.toLocaleString(), qtyX, infoY + 4)
    }

    y += 20
  }

  // ──────────────────────────────────────────────
  // 3. TABLE HEADER
  // ──────────────────────────────────────────────
  y += 2
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(LIGHT_GRAY)
  doc.text("DESCRIPTION", ML, y)
  rightText(doc, "AMOUNT", AMOUNT_X, y)

  y += 2
  doc.setDrawColor(DIVIDER)
  doc.setLineWidth(0.3)
  doc.line(ML, y, PAGE_W - MR, y)
  y += 5

  // ──────────────────────────────────────────────
  // 4. LINE ITEMS
  // ──────────────────────────────────────────────

  /** Check if we need a page break; if so, add one and return the new Y */
  function checkPage(need: number): void {
    if (y + need > PAGE_H - 30) {
      doc.addPage()
      y = MT
    }
  }

  /** Draw a category section header (shaded bar) */
  function sectionHeader(title: string) {
    checkPage(14)
    doc.setFillColor(SECTION_BG)
    doc.roundedRect(ML, y - 3, CONTENT_W, 7, 1.5, 1.5, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(DARK_GRAY)
    doc.text(title, ML + 3, y + 1)
    y += 8
  }

  /** Draw a line item: description (+ optional spec line) with right-aligned amount */
  function lineItem(desc: string, specs: string | null, amount: number) {
    checkPage(specs ? 12 : 8)

    // Description
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(BLACK)
    doc.text(desc, ML + 4, y)

    // Amount right-aligned on same line
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BLACK)
    rightText(doc, formatCurrency(amount), AMOUNT_X, y)

    y += 4.5

    // Spec line below (lighter, smaller)
    if (specs) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(MID_GRAY)
      // Wrap long spec lines
      const maxW = CONTENT_W - 50
      const wrapped = doc.splitTextToSize(specs, maxW)
      doc.text(wrapped, ML + 6, y)
      y += wrapped.length * 3.5
    }

    y += 2
  }

  // --- PRINTING ---
  const printItems = items.filter((i) => PRINT_CATS.includes(i.category))
  if (printItems.length > 0) {
    sectionHeader("PRINTING")
    printItems.forEach((item) => {
      const catSub = getCategoryLabel(item.category)
      const label = item.category !== "flat" ? catSub : (item.description || catSub)
      let specs: string | null = null
      if (item.metadata) {
        specs = buildCustomerSpecs(item.metadata, item.category, ", ")
      }
      // For flat printing, description is redundant with specs -- use label only if no sub-cat
      const desc = item.category !== "flat" ? catSub : (item.label || "Flat Printing")
      lineItem(desc, specs, item.amount)
    })
  }

  // --- ENVELOPES ---
  const envItems = items.filter((i) => i.category === "envelope")
  if (envItems.length > 0) {
    sectionHeader("ENVELOPES")
    envItems.forEach((item) => {
      let specs: string | null = null
      if (item.metadata) {
        specs = buildCustomerSpecs(item.metadata, "envelope", ", ")
      }
      const desc = item.label || "Envelope"
      lineItem(desc, specs, item.amount)
    })
  }

  // --- POSTAGE ---
  const postageItems = items.filter((i) => i.category === "postage")
  const hasEstimatedPostage = postageItems.some((i) => i.metadata?.isEstimated)
  if (postageItems.length > 0) {
    sectionHeader(hasEstimatedPostage ? "POSTAGE / USPS (ESTIMATED)" : "POSTAGE / USPS")
    postageItems.forEach((item) => {
      const m = (item.metadata ?? {}) as Record<string, unknown>
      // Customer sees: Mail class + qty x ~$rate (no sort tiers, no buffer, no entry point)
      const mailClass = m.mailingClass ? String(m.mailingClass) : ""
      const avgPP = m.avgPerPiece ? `~${formatCurrency(Number(m.avgPerPiece))}/pc` : ""
      let desc = [mailClass, avgPP].filter(Boolean).join(", ")
      if (!desc) desc = item.description ? cleanPostageDescription(item.description) : item.label || "Postage"
      lineItem(desc, null, item.amount)
    })
    // Postage disclaimer for estimated rates
    if (hasEstimatedPostage) {
      checkPage(10)
      doc.setFont("helvetica", "italic")
      doc.setFontSize(7)
      doc.setTextColor(LIGHT_GRAY)
      const disclaimer = "* Postage rates shown are estimates. Final rates are determined when the mailing list is processed and the mail piece is verified by USPS standards."
      const wrapped = doc.splitTextToSize(disclaimer, CONTENT_W)
      doc.text(wrapped, ML + 2, y)
      y += wrapped.length * 3 + 2
    }
  }

  // --- MAIL WORK ---
  const mailWorkItems = items.filter((i) => MAIL_WORK_CATS.includes(i.category))
  if (mailWorkItems.length > 0) {
    sectionHeader("MAIL WORK")
    mailWorkItems.forEach((item) => {
      lineItem(item.description || item.label || "Service", null, item.amount)
    })
  }

  // --- OHP (shown as PRINTING to customer) ---
  const ohpItems = items.filter((i) => i.category === "ohp")
  if (ohpItems.length > 0) {
    // If there's already a printing section, don't add another header
    if (printItems.length === 0) sectionHeader("PRINTING")
    ohpItems.forEach((item) => {
      const m = (item.metadata ?? {}) as Record<string, unknown>
      const specs = buildCustomerSpecs(m, "flat", ", ") // treat OHP metadata as flat printing specs
      const desc = item.label || "Printing"
      lineItem(desc, specs || null, item.amount)
    })
  }

  // ──────────────────────────────────────────────
  // 5. TOTAL
  // ──────────────────────────────────────────────
  const total = items.reduce((s, i) => s + i.amount, 0)

  checkPage(16)
  y += 2
  doc.setDrawColor(HEADER_LINE)
  doc.setLineWidth(0.4)
  doc.line(ML, y, PAGE_W - MR, y)
  y += 7

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(BLACK)
  rightText(doc, `TOTAL:  ${formatCurrency(total)}`, AMOUNT_X, y)
  y += 8

  // ──────────────────────────────────────────────
  // 6. NOTES
  // ──────────────────────────────────────────────
  if (notes) {
    checkPage(14)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(MID_GRAY)
    doc.text("Notes:", ML, y)
    y += 4
    const wrapped = doc.splitTextToSize(notes, CONTENT_W - 10)
    doc.text(wrapped, ML + 2, y)
    y += wrapped.length * 3.5 + 4
  }

  // ──────────────────────────────────────────────
  // 7. FOOTER
  // ──────────────────────────────────────────────
  const footerY = PAGE_H - 14
  doc.setDrawColor(DIVIDER)
  doc.setLineWidth(0.2)
  doc.line(ML, footerY - 3, PAGE_W - MR, footerY - 3)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(LIGHT_GRAY)
  doc.text("Thank you for your business.", ML, footerY)
  rightText(doc, `${COMPANY.name}  |  ${COMPANY.phone}  |  ${COMPANY.email}`, AMOUNT_X, footerY)

  return doc
}

/**
 * Generate a filename for the PDF.
 */
export function quotePdfFilename(opts: QuoteTextOptions): string {
  if (opts.quoteNumber) return `Quote-Q-${opts.quoteNumber}.pdf`
  if (opts.projectName) return `Quote-${opts.projectName.replace(/\s+/g, "-")}.pdf`
  return "Quote.pdf"
}

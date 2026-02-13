import { getCategoryLabel, type QuoteCategory } from "./quote-types"
import { formatCurrency } from "./pricing"

interface TextItem {
  category: QuoteCategory
  label: string
  description: string
  amount: number
}

/**
 * Builds clean plain-text quote output for email / clipboard.
 *
 * Format matches the design spec:
 *   Quote Summary
 *   ------------------------------
 *   PRINTING
 *   Flat Printing
 *   1,000 - 4x6 Flat Prints, 10pt Gloss, 4/0,
 *   $101.63
 *   ----
 *   PRINTING
 *   Fold & Staple
 *   1,000 - 48pg Booklet, 8.5x11 ...
 *   $4,672.00
 *
 *   ------------------------------
 *   Postage / USPS
 *   Postage - Standard (1,000 pc) / Postcard, $0.46/pc
 *   $460.00
 *
 *   ------------------------------
 *   List Work & Mailing Labor
 *   1,000 pc Postcard - Standard, Addressing, Computer Work
 *   $350.00
 *   ------------------------------
 *   TOTAL: $5,583.63
 */
export function buildQuoteText(
  items: TextItem[],
  projectName?: string,
  notes?: string
): string {
  const lines: string[] = []
  const divider = "------------------------------"
  const miniDivider = "----"

  // Header
  lines.push(projectName ? `Quote Summary - ${projectName}` : "Quote Summary")
  lines.push(divider)

  const PRINT_CATS: QuoteCategory[] = ["flat", "booklet"]
  const OTHER_CATS: QuoteCategory[] = ["postage", "listwork"]

  // --- PRINTING super-group ---
  const printItems = items.filter((i) => PRINT_CATS.includes(i.category))
  if (printItems.length > 0) {
    // Group by category within printing
    const grouped: Record<string, TextItem[]> = {}
    for (const item of printItems) {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    }

    const catKeys = Object.keys(grouped) as QuoteCategory[]
    catKeys.forEach((cat, catIdx) => {
      const catItems = grouped[cat]
      catItems.forEach((item, itemIdx) => {
        // Add mini-divider between items (not before the first)
        if (catIdx > 0 || itemIdx > 0) {
          lines.push(miniDivider)
        }
        lines.push("PRINTING")
        lines.push(getCategoryLabel(cat))
        if (item.description) {
          lines.push(item.description)
        }
        lines.push(formatCurrency(item.amount))
      })
    })

    lines.push("")
    lines.push(divider)
  }

  // --- Other categories (Postage, Labor) ---
  for (const cat of OTHER_CATS) {
    const catItems = items.filter((i) => i.category === cat)
    if (catItems.length === 0) continue

    const label = getCategoryLabel(cat)
    catItems.forEach((item, idx) => {
      if (idx > 0) {
        lines.push(miniDivider)
      }
      lines.push(label)
      if (item.description) {
        lines.push(item.description)
      }
      lines.push(formatCurrency(item.amount))
    })

    lines.push("")
    lines.push(divider)
  }

  // --- Total ---
  const total = items.reduce((s, i) => s + i.amount, 0)
  lines.push(`TOTAL: ${formatCurrency(total)}`)

  if (notes) {
    lines.push("")
    lines.push(notes)
  }

  lines.push("")
  return lines.join("\n")
}

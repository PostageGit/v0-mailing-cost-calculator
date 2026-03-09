// Test script to calculate the booklet quote
import { calculateBooklet } from "../lib/booklet-pricing"
import type { BookletInputs } from "../lib/booklet-types"

const inputs: BookletInputs = {
  bookQty: 5000,
  pagesPerBook: 92, // inside pages (96 total - 4 cover)
  pageWidth: 6,
  pageHeight: 9,
  separateCover: true,
  // Cover: 14pt Gloss 4/0 with bleed
  coverPaper: "14pt Gloss",
  coverSides: "4/0",
  coverBleed: true,
  coverSheetSize: "cheapest",
  // Inside: 60lb Offset D/S with bleed
  insidePaper: "60lb Offset",
  insideSides: "D/S",
  insideBleed: true,
  insideSheetSize: "cheapest",
  // Options
  laminationType: "none",
  customLevel: "auto",
  isBroker: true,
  printingMarkupPct: 0,
}

const result = calculateBooklet(inputs)

console.log("=== BOOKLET QUOTE CALCULATION ===")
console.log("")
console.log("SPECS:")
console.log(`  Quantity: ${inputs.bookQty}`)
console.log(`  Size: ${inputs.pageWidth}" x ${inputs.pageHeight}"`)
console.log(`  Total Pages: 96 (92 inside + 4 cover)`)
console.log(`  Inside: ${inputs.insidePaper} ${inputs.insideSides} w/bleed`)
console.log(`  Cover: ${inputs.coverPaper} ${inputs.coverSides} w/bleed`)
console.log(`  Binding: Saddle Stitch`)
console.log(`  Broker: ${inputs.isBroker ? "Yes" : "No"}`)
console.log("")

if (!result.isValid) {
  console.log("ERROR:", result.error)
} else {
  console.log("INSIDE PAGES:")
  console.log(`  Sheet Size: ${result.insideResult.sheetSize}`)
  console.log(`  Sheets Needed: ${result.insideResult.sheets.toLocaleString()}`)
  console.log(`  Max Up: ${result.insideResult.maxUps}`)
  console.log(`  Level: ${result.insideResult.level}`)
  console.log(`  Cost: $${result.insideResult.cost.toFixed(2)}`)
  console.log("")
  
  console.log("COVER:")
  console.log(`  Sheet Size: ${result.coverResult.sheetSize}`)
  console.log(`  Sheets Needed: ${result.coverResult.sheets.toLocaleString()}`)
  console.log(`  Max Up: ${result.coverResult.maxUps}`)
  console.log(`  Level: ${result.coverResult.level}`)
  console.log(`  Cost: $${result.coverResult.cost.toFixed(2)}`)
  console.log("")
  
  console.log("BINDING:")
  console.log(`  Per Book: $${result.bindingPricePerBook.toFixed(4)}`)
  console.log(`  Total: $${result.totalBindingPrice.toFixed(2)}`)
  console.log("")
  
  if (result.brokerMinimumApplied) {
    console.log(`BROKER MINIMUM: ${result.brokerMinimumApplied}`)
    console.log("")
  }
  
  console.log("TOTALS:")
  console.log(`  Printing: $${result.totalPrintingCost.toFixed(2)}`)
  console.log(`  Binding: $${result.totalBindingPrice.toFixed(2)}`)
  console.log(`  Lamination: $${result.totalLaminationCost.toFixed(2)}`)
  console.log(`  Broker Discount: -$${result.brokerDiscountAmount.toFixed(2)}`)
  console.log("")
  console.log(`  GRAND TOTAL: $${result.grandTotal.toFixed(2)}`)
  console.log(`  PER BOOKLET: $${result.pricePerBook.toFixed(4)}`)
}

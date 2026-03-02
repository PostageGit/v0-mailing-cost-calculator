import { calculateBooklet } from "../lib/booklet-pricing"

function fmt(n: number) {
  return "$" + n.toFixed(2)
}

// Test 1: Exact specs from screenshot -- 100 booklets, 40 inside pages, 8x10
// Cover: 12pt Matte 4/0, bleed, matte lamination
// Inside: 20lb Offset S/S (BW both sides), bleed
// NOT broker
console.log("=== TEST 1: Screenshot specs (100 booklets, 8x10, 40 inside pages) ===")

// The chat tool does: pagesPerBook=44 (40 inside + 4 cover), adjustedPages = ceil(44/4)*4 = 44
// insidePages = separateCover ? 44-4 : 44 = 40
// ALSO: chat auto-corrects S/S -> D/S, 4/0 -> 4/4 for booklets

const result1 = calculateBooklet({
  bookQty: 100,
  pagesPerBook: 40, // inside pages (cover is separate)
  pageWidth: 8,
  pageHeight: 10,
  separateCover: true,
  coverPaper: "12pt Matte",
  coverSides: "4/4",  // auto-corrected from 4/0 -> 4/4 by chat tool
  coverBleed: true,
  coverSheetSize: "cheapest",
  insidePaper: "20lb Offset",
  insideSides: "D/S",  // auto-corrected from S/S -> D/S by chat tool
  insideBleed: true,
  insideSheetSize: "cheapest",
  laminationType: "Matte",
  customLevel: "auto",
  isBroker: false,
  printingMarkupPct: 0,
})

if (!result1.isValid) {
  console.log("ERROR:", result1.error)
} else {
  console.log("Total:", fmt(result1.grandTotal))
  console.log("Per booklet:", fmt(result1.pricePerBook))
  console.log("Printing:", fmt(result1.totalPrintingCost))
  console.log("Binding:", fmt(result1.totalBindingPrice))
  console.log("Lamination:", fmt(result1.totalLaminationCost))
  console.log("Inside level:", result1.insideResult?.level, "(auto:", result1.insideResult?.autoLevel, ")")
  console.log("Inside sheets:", result1.insideResult?.sheets)
  console.log("Cover level:", result1.coverResult?.level, "(auto:", result1.coverResult?.autoLevel, ")")
  console.log("Cover sheets:", result1.coverResult?.sheets)
}

// Test 2: Same but with the WRONG sides the AI might send (4/0 and S/S)
console.log("\n=== TEST 2: Same specs but with WRONG sides (4/0 cover, S/S inside) ===")
const result2 = calculateBooklet({
  bookQty: 100,
  pagesPerBook: 40,
  pageWidth: 8,
  pageHeight: 10,
  separateCover: true,
  coverPaper: "12pt Matte",
  coverSides: "4/0",  // WRONG - single sided
  coverBleed: true,
  coverSheetSize: "cheapest",
  insidePaper: "20lb Offset",
  insideSides: "S/S",  // WRONG - single sided
  insideBleed: true,
  insideSheetSize: "cheapest",
  laminationType: "Matte",
  customLevel: "auto",
  isBroker: false,
  printingMarkupPct: 0,
})

if (!result2.isValid) {
  console.log("ERROR:", result2.error)
} else {
  console.log("Total:", fmt(result2.grandTotal))
  console.log("Per booklet:", fmt(result2.pricePerBook))
  console.log("DIFFERENCE from correct sides:", fmt(result2.grandTotal - result1.grandTotal!))
}

// Test 3: Broker pricing to check if it gives a much lower price
console.log("\n=== TEST 3: Same specs but with BROKER = true ===")
const result3 = calculateBooklet({
  bookQty: 100,
  pagesPerBook: 40,
  pageWidth: 8,
  pageHeight: 10,
  separateCover: true,
  coverPaper: "12pt Matte",
  coverSides: "4/4",
  coverBleed: true,
  coverSheetSize: "cheapest",
  insidePaper: "20lb Offset",
  insideSides: "D/S",
  insideBleed: true,
  insideSheetSize: "cheapest",
  laminationType: "Matte",
  customLevel: "auto",
  isBroker: true,
  printingMarkupPct: 0,
})

if (!result3.isValid) {
  console.log("ERROR:", result3.error)
} else {
  console.log("Total:", fmt(result3.grandTotal))
  console.log("Per booklet:", fmt(result3.pricePerBook))
  console.log("Level (broker always 10):", result3.insideResult?.level)
  console.log("DIFFERENCE from non-broker:", fmt(result3.grandTotal - result1.grandTotal!))
}

// Test 4: UI calculator has 4/0 cover and S/S inside (from screenshot) -- NOT auto-corrected
// The UI calculator accepts these codes. So the correct comparison is 4/0 + S/S.
console.log("\n=== TEST 4: Exact UI screenshot (4/0 cover, S/S inside, no auto-correct) ===")
const result4 = calculateBooklet({
  bookQty: 100,
  pagesPerBook: 40,
  pageWidth: 8,
  pageHeight: 10,
  separateCover: true,
  coverPaper: "12pt Matte",
  coverSides: "4/0",
  coverBleed: true,
  coverSheetSize: "cheapest",
  insidePaper: "20lb Offset",
  insideSides: "S/S",
  insideBleed: true,
  insideSheetSize: "cheapest",
  laminationType: "Matte",
  customLevel: "auto",
  isBroker: false,
  printingMarkupPct: 0,
})

if (!result4.isValid) {
  console.log("ERROR:", result4.error)
} else {
  console.log("Total:", fmt(result4.grandTotal), "(should be $343.00)")
  console.log("Per booklet:", fmt(result4.pricePerBook))
  console.log("Printing:", fmt(result4.totalPrintingCost))
  console.log("Binding:", fmt(result4.totalBindingPrice))
  console.log("Lamination:", fmt(result4.totalLaminationCost))
  console.log("Inside level:", result4.insideResult?.level, "(auto:", result4.insideResult?.autoLevel, ")")
  console.log("Cover level:", result4.coverResult?.level, "(auto:", result4.coverResult?.autoLevel, ")")
}

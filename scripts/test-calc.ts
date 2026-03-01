import { calculatePerfect } from "../lib/perfect-pricing"
import { calculateBooklet } from "../lib/booklet-pricing"
import { calculateSpiral } from "../lib/spiral-pricing"
import { calculateAllSheetOptions, buildFullResult } from "../lib/printing-pricing"

// Test 1: Perfect Bound - 500 copies, 8.5x11, 100 inside BW, color cover
console.log("=== PERFECT BOUND ===")
const p = calculatePerfect({
  bookQty: 500, pagesPerBook: 100, pageWidth: 8.5, pageHeight: 11,
  inside: { paperName: "80lb Text Gloss", sides: "1/1", hasBleed: false, sheetSize: "cheapest" },
  cover: { paperName: "80 Gloss", sides: "4/4", hasBleed: true, sheetSize: "cheapest" },
  laminationType: "none", customLevel: "auto", isBroker: false,
})
if ("error" in p) { console.log("ERROR:", p.error) }
else { console.log("Total:", p.grandTotal, "PerBook:", p.pricePerBook, "InsideSheet:", p.insideResult?.sheetSize, "CoverSheet:", p.coverResult?.sheetSize) }

// Test 2: Booklet - 500 copies, 8.5x11, 16 inside pages, separate cover
console.log("\n=== SADDLE-STITCH ===")
const b = calculateBooklet({
  bookQty: 500, pagesPerBook: 16, pageWidth: 8.5, pageHeight: 11,
  separateCover: true, coverPaper: "80 Gloss", coverSides: "4/4", coverBleed: true, coverSheetSize: "cheapest",
  insidePaper: "80lb Text Gloss", insideSides: "4/4", insideBleed: false, insideSheetSize: "cheapest",
  laminationType: "none", customLevel: "auto", isBroker: false, printingMarkupPct: 10,
})
if (!b.isValid) { console.log("ERROR:", b.error) }
else { console.log("Total:", b.grandTotal, "PerBook:", b.pricePerBook, "InsideSheet:", b.insideResult?.sheetSize, "CoverSheet:", b.coverResult?.sheetSize) }

// Test 3: Spiral - 500 copies, 8.5x11, 100 inside BW, covers
console.log("\n=== SPIRAL ===")
const s = calculateSpiral({
  bookQty: 500, pagesPerBook: 100, pageWidth: 8.5, pageHeight: 11,
  inside: { paperName: "80lb Text Gloss", sides: "1/1", hasBleed: false, sheetSize: "cheapest" },
  useFrontCover: true, front: { paperName: "80 Gloss", sides: "4/4", hasBleed: false, sheetSize: "cheapest" },
  useBackCover: true, back: { paperName: "80 Gloss", sides: "4/4", hasBleed: false, sheetSize: "cheapest" },
  clearPlastic: false, blackVinyl: false, customLevel: "auto", isBroker: false,
})
if ("error" in s) { console.log("ERROR:", s.error) }
else { console.log("Total:", s.grandTotal, "PerBook:", s.pricePerBook, "Printing:", s.totalPrintingCost, "Binding:", s.totalBindingPrice) }

// Test 4: Flat - 1000 flyers 8.5x11
console.log("\n=== FLAT PRINT ===")
const inputs = {
  qty: 1000, width: 8.5, height: 11, paperName: "80lb Text Gloss", sidesValue: "4/4" as const,
  hasBleed: false, addOnCharge: 0, addOnDescription: "", printingMarkupPct: 10, isBroker: false,
  lamination: { enabled: false, type: "Gloss" as const, sides: "S/S" as const }, scoreFoldOperation: "" as const, scoreFoldType: "" as const,
}
const options = calculateAllSheetOptions(inputs)
if (!options.length) { console.log("ERROR: No options") }
else {
  const best = options[0]
  const result = buildFullResult(inputs, best.result)
  console.log("Total:", result.grandTotal, "PerUnit:", result.grandTotal/1000, "Sheet:", best.size, "Ups:", best.result.ups)
}

// Test all three binding calculators with real parameters
import { calculatePerfect } from "../lib/perfect-pricing.js"
import { calculateBooklet } from "../lib/booklet-pricing.js"
import { calculateSpiral } from "../lib/spiral-pricing.js"

console.log("=== TEST 1: Perfect Bound ===")
console.log("500 copies, 8.5x11, 100 inside pages BW, color cover")
try {
  const perfectResult = calculatePerfect({
    bookQty: 500,
    pagesPerBook: 100,
    pageWidth: 8.5,
    pageHeight: 11,
    inside: {
      paperName: "80lb Text Gloss",
      sides: "1/1",
      hasBleed: false,
      sheetSize: "cheapest",
    },
    cover: {
      paperName: "80 Gloss",
      sides: "4/4",
      hasBleed: true,
      sheetSize: "cheapest",
    },
    laminationType: "none",
    customLevel: "auto",
    isBroker: false,
  })
  if ("error" in perfectResult) {
    console.log("ERROR:", perfectResult.error)
  } else {
    console.log("Grand Total:", perfectResult.grandTotal)
    console.log("Per Book:", perfectResult.pricePerBook)
    console.log("Inside sheets:", perfectResult.insideResult?.sheets)
    console.log("Inside sheet size:", perfectResult.insideResult?.sheetSize)
    console.log("Inside ups:", perfectResult.insideResult?.ups)
    console.log("Cover sheet size:", perfectResult.coverResult?.sheetSize)
  }
} catch (e) {
  console.log("EXCEPTION:", e.message)
}

console.log("\n=== TEST 2: Saddle-Stitch Booklet ===")
console.log("500 copies, 8.5x11, 16 inside pages (20 total), color, separate 80 Gloss cover")
try {
  const bookletResult = calculateBooklet({
    bookQty: 500,
    pagesPerBook: 16,
    pageWidth: 8.5,
    pageHeight: 11,
    separateCover: true,
    coverPaper: "80 Gloss",
    coverSides: "4/4",
    coverBleed: true,
    coverSheetSize: "cheapest",
    insidePaper: "80lb Text Gloss",
    insideSides: "4/4",
    insideBleed: false,
    insideSheetSize: "cheapest",
    laminationType: "none",
    customLevel: "auto",
    isBroker: false,
    printingMarkupPct: 10,
  })
  if (!bookletResult.isValid) {
    console.log("ERROR:", bookletResult.error)
  } else {
    console.log("Grand Total:", bookletResult.grandTotal)
    console.log("Per Book:", bookletResult.pricePerBook)
    console.log("Inside:", JSON.stringify({
      sheets: bookletResult.insideResult.sheets,
      sheetSize: bookletResult.insideResult.sheetSize,
      ups: bookletResult.insideResult.maxUps,
    }))
    console.log("Cover:", JSON.stringify({
      sheets: bookletResult.coverResult.sheets,
      sheetSize: bookletResult.coverResult.sheetSize,
      ups: bookletResult.coverResult.maxUps,
    }))
  }
} catch (e) {
  console.log("EXCEPTION:", e.message)
}

console.log("\n=== TEST 3: Spiral Bound ===")
console.log("500 copies, 8.5x11, 100 inside pages BW, front/back 80 Gloss cover")
try {
  const spiralResult = calculateSpiral({
    bookQty: 500,
    pagesPerBook: 100,
    pageWidth: 8.5,
    pageHeight: 11,
    inside: {
      paperName: "80lb Text Gloss",
      sides: "1/1",
      hasBleed: false,
      sheetSize: "cheapest",
    },
    useFrontCover: true,
    front: {
      paperName: "80 Gloss",
      sides: "4/4",
      hasBleed: false,
      sheetSize: "cheapest",
    },
    useBackCover: true,
    back: {
      paperName: "80 Gloss",
      sides: "4/4",
      hasBleed: false,
      sheetSize: "cheapest",
    },
    clearPlastic: false,
    blackVinyl: false,
    customLevel: "auto",
    isBroker: false,
  })
  if ("error" in spiralResult) {
    console.log("ERROR:", spiralResult.error)
  } else {
    console.log("Grand Total:", spiralResult.grandTotal)
    console.log("Per Book:", spiralResult.pricePerBook)
    console.log("Printing cost:", spiralResult.totalPrintingCost)
    console.log("Binding cost:", spiralResult.totalBindingPrice)
  }
} catch (e) {
  console.log("EXCEPTION:", e.message)
}

console.log("\n=== TEST 4: Flat Print ===")
console.log("1000 flyers, 8.5x11, 80lb Text Gloss, color both sides")
import { calculateAllSheetOptions, buildFullResult } from "../lib/printing-pricing.js"
try {
  const inputs = {
    qty: 1000,
    width: 8.5,
    height: 11,
    paperName: "80lb Text Gloss",
    sidesValue: "4/4",
    hasBleed: false,
    addOnCharge: 0,
    addOnDescription: "",
    printingMarkupPct: 10,
    isBroker: false,
    lamination: { enabled: false, type: "Gloss", sides: "S/S" },
    scoreFoldOperation: "",
    scoreFoldType: "",
  }
  const options = calculateAllSheetOptions(inputs)
  if (!options.length) {
    console.log("ERROR: No sheet options found")
  } else {
    const best = options[0]
    const result = buildFullResult(inputs, best.result)
    console.log("Grand Total:", result.grandTotal)
    console.log("Per Unit:", result.grandTotal / 1000)
    console.log("Sheet size:", best.size)
    console.log("Ups:", best.result.ups)
  }
} catch (e) {
  console.log("EXCEPTION:", e.message)
}

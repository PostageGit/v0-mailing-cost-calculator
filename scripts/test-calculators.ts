// Test: 500 copies, 8.5x11, 100 pages inside BW, color cover, perfect bound
import { calculatePerfect } from "../lib/perfect-pricing.js"
import { calculateBooklet } from "../lib/booklet-pricing.js"
import { calculateSpiral } from "../lib/spiral-pricing.js"

console.log("=== TEST: Perfect Bound ===")
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
    console.log("Cover sheet size:", perfectResult.coverResult?.sheetSize)
  }
} catch (e: any) {
  console.log("EXCEPTION:", e.message)
}

console.log("\n=== TEST: Saddle-Stitch Booklet ===")
console.log("500 copies, 8.5x11, 20 total pages, color, separate cover")
try {
  const bookletResult = calculateBooklet({
    bookQty: 500,
    pagesPerBook: 16, // 20 total minus 4 cover pages
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
    console.log("Inside result:", {
      sheets: bookletResult.insideResult.sheets,
      sheetSize: bookletResult.insideResult.sheetSize,
      ups: bookletResult.insideResult.maxUps,
    })
    console.log("Cover result:", {
      sheets: bookletResult.coverResult.sheets,
      sheetSize: bookletResult.coverResult.sheetSize,
      ups: bookletResult.coverResult.maxUps,
    })
  }
} catch (e: any) {
  console.log("EXCEPTION:", e.message)
}

console.log("\n=== TEST: Spiral Bound ===")
console.log("500 copies, 8.5x11, 100 inside pages BW, front/back cover")
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
  }
} catch (e: any) {
  console.log("EXCEPTION:", e.message)
}

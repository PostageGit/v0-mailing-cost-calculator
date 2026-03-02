import { calculateBooklet } from "@/lib/booklet-pricing"

export async function GET() {
  // Test 1: Exact specs from screenshot - 100 booklets, 40 inside pages, 8x10
  // 12pt Matte cover 4/0, bleed, 20lb Offset inside S/S, bleed, matte lamination, no broker
  const test1 = calculateBooklet({
    bookQty: 100,
    pagesPerBook: 40, // inside pages only
    pageWidth: 8,
    pageHeight: 10,
    separateCover: true,
    coverPaper: "12pt Matte",
    coverSides: "4/4", // auto-corrected from 4/0 (books always both sides)
    coverBleed: true,
    coverSheetSize: "cheapest",
    insidePaper: "20lb Offset",
    insideSides: "D/S", // auto-corrected from S/S (books always both sides)
    insideBleed: true,
    insideSheetSize: "cheapest",
    laminationType: "Matte",
    customLevel: "auto",
    isBroker: false,
    printingMarkupPct: 0,
  })

  // Test 2: Same but with the WRONG sides codes the AI might send (4/0 and S/S)
  const test2 = calculateBooklet({
    bookQty: 100,
    pagesPerBook: 40,
    pageWidth: 8,
    pageHeight: 10,
    separateCover: true,
    coverPaper: "12pt Matte",
    coverSides: "4/0", // WRONG - single sided
    coverBleed: true,
    coverSheetSize: "cheapest",
    insidePaper: "20lb Offset",
    insideSides: "S/S", // WRONG - single sided
    insideBleed: true,
    insideSheetSize: "cheapest",
    laminationType: "Matte",
    customLevel: "auto",
    isBroker: false,
    printingMarkupPct: 0,
  })

  // Test 3: Broker pricing (to check if AI accidentally uses broker)
  const test3 = calculateBooklet({
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

  // Test 4: No bleed inside (to see price difference)
  const test4 = calculateBooklet({
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
    insideBleed: false,
    insideSheetSize: "cheapest",
    laminationType: "Matte",
    customLevel: "auto",
    isBroker: false,
    printingMarkupPct: 0,
  })

  const fmt = (r: typeof test1) => ({
    valid: r.isValid,
    total: r.grandTotal,
    perBook: r.pricePerBook,
    error: r.error,
    insideLevel: r.insideResult?.level,
    insideAutoLevel: r.insideResult?.autoLevel,
    insideSheets: r.insideResult?.sheets,
    insideSheetSize: r.insideResult?.sheetSize,
    insideUps: r.insideResult?.ups,
    coverLevel: r.coverResult?.level,
    coverAutoLevel: r.coverResult?.autoLevel,
    coverSheets: r.coverResult?.sheets,
    coverSheetSize: r.coverResult?.sheetSize,
    coverUps: r.coverResult?.ups,
    printing: r.totalPrintingCost,
    binding: r.totalBindingPrice,
    lamination: r.totalLaminationCost,
  })

  return Response.json({
    "TEST 1 - Correct specs (4/4, D/S, bleed, no broker) - SHOULD MATCH $423": fmt(test1),
    "TEST 2 - Wrong sides (4/0, S/S) - shows price difference from wrong codes": fmt(test2),
    "TEST 3 - Broker pricing - shows if AI accidentally uses broker": fmt(test3),
    "TEST 4 - No inside bleed - shows bleed price impact": fmt(test4),
  }, { status: 200 })
}

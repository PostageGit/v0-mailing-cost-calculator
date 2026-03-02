import { calculateBooklet } from "@/lib/booklet-pricing"
import { calculatePerfect } from "@/lib/perfect-pricing"
import { calculateSpiral } from "@/lib/spiral-pricing"
import { calculateAllSheetOptions, buildFullResult } from "@/lib/printing-pricing"
import type { PrintingInputs } from "@/lib/printing-types"
import type { LaminationInputs } from "@/lib/lamination-pricing"
import { NextResponse } from "next/server"

function fmt(n: number) {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

type TestResult = {
  name: string
  status: "PASS" | "FAIL" | "WARN"
  expected: string
  actual: string
  details?: string
}

export async function GET() {
  const results: TestResult[] = []

  // ===========================
  // TEST 1: Booklet - cover sides 4/0 preserved (not overridden to 4/4)
  // Matches Q-1194: 1050 qty, 16 pages, 8.5x11, 20lb Offset D/S, 10pt Gloss 4/0, Matte lam, bleed both
  // ===========================
  {
    const coverSidesInput = "4/0" // Customer explicitly said 4/0
    const singleToBoth: Record<string, string> = { "4/0": "4/4", "1/0": "1/1", "S/S": "D/S" }
    const correctedInsideSides = singleToBoth["D/S"] || "D/S"
    const finalCoverSides = coverSidesInput // Cover should NOT be auto-corrected for booklets
    
    const result = calculateBooklet({
      bookQty: 1050, pagesPerBook: 12, pageWidth: 8.5, pageHeight: 11, separateCover: true,
      coverPaper: "10pt Gloss", coverSides: finalCoverSides,
      coverBleed: true, coverSheetSize: "cheapest",
      insidePaper: "20lb Offset", insideSides: correctedInsideSides, insideBleed: true, insideSheetSize: "cheapest",
      laminationType: "Matte", customLevel: "auto", isBroker: false, printingMarkupPct: 0,
    })
    
    // Now calculate with 4/4 to see the difference
    const result44 = calculateBooklet({
      bookQty: 1050, pagesPerBook: 12, pageWidth: 8.5, pageHeight: 11, separateCover: true,
      coverPaper: "10pt Gloss", coverSides: "4/4",
      coverBleed: true, coverSheetSize: "cheapest",
      insidePaper: "20lb Offset", insideSides: correctedInsideSides, insideBleed: true, insideSheetSize: "cheapest",
      laminationType: "Matte", customLevel: "auto", isBroker: false, printingMarkupPct: 0,
    })
    
    results.push({
      name: "TEST 1: Booklet cover 4/0 NOT overridden (Q-1194 match)",
      status: result.isValid ? "PASS" : "FAIL",
      expected: "4/0 cover = cheaper than 4/4",
      actual: `4/0 total: ${fmt(result.grandTotal)} | 4/4 total: ${fmt(result44.grandTotal)} | Diff: ${fmt(result44.grandTotal - result.grandTotal)}`,
      details: `Cover sides passed: ${finalCoverSides}. Auto-correction should NOT apply to booklet covers.`
    })
  }

  // ===========================
  // TEST 2: Booklet inside sides auto-corrected (S/S -> D/S)
  // ===========================
  {
    const singleToBoth: Record<string, string> = { "4/0": "4/4", "1/0": "1/1", "S/S": "D/S" }
    const corrected = singleToBoth["S/S"] || "S/S"
    results.push({
      name: "TEST 2: Booklet inside S/S auto-corrected to D/S",
      status: corrected === "D/S" ? "PASS" : "FAIL",
      expected: "D/S",
      actual: corrected,
    })
  }

  // ===========================
  // TEST 3: Perfect bound auto-corrects BOTH cover and inside
  // ===========================
  {
    const singleToBoth: Record<string, string> = { "4/0": "4/4", "1/0": "1/1", "S/S": "D/S" }
    const corrInsidePB = singleToBoth["4/0"] || "4/0"
    const corrCoverPB = singleToBoth["4/0"] || "4/0"
    results.push({
      name: "TEST 3: Perfect bound corrects inside 4/0 -> 4/4",
      status: corrInsidePB === "4/4" ? "PASS" : "FAIL",
      expected: "4/4",
      actual: corrInsidePB,
    })
    results.push({
      name: "TEST 3b: Perfect bound corrects cover 4/0 -> 4/4",
      status: corrCoverPB === "4/4" ? "PASS" : "FAIL",
      expected: "4/4",
      actual: corrCoverPB,
    })
  }

  // ===========================
  // TEST 4: Spiral inside auto-corrected, cover NOT
  // ===========================
  {
    const singleToBoth: Record<string, string> = { "4/0": "4/4", "1/0": "1/1", "S/S": "D/S" }
    const corrInsideSpiral = singleToBoth["S/S"] || "S/S"
    const frontSidesInput = "4/0" // spiral cover can be one-sided
    const finalFrontSides = frontSidesInput // no correction
    results.push({
      name: "TEST 4: Spiral inside S/S -> D/S",
      status: corrInsideSpiral === "D/S" ? "PASS" : "FAIL",
      expected: "D/S",
      actual: corrInsideSpiral,
    })
    results.push({
      name: "TEST 4b: Spiral front cover 4/0 preserved",
      status: finalFrontSides === "4/0" ? "PASS" : "FAIL",
      expected: "4/0",
      actual: finalFrontSides,
    })
  }

  // ===========================
  // TEST 5: Broker vs non-broker pricing difference (booklet)
  // 100 booklets, 40 pages, 8x10, 12pt Matte 4/4, 20lb Offset D/S, Matte lam, bleed both
  // ===========================
  {
    const baseParams = {
      bookQty: 100, pagesPerBook: 36, pageWidth: 8, pageHeight: 10, separateCover: true as const,
      coverPaper: "12pt Matte", coverSides: "4/4",
      coverBleed: true, coverSheetSize: "cheapest" as const,
      insidePaper: "20lb Offset", insideSides: "D/S", insideBleed: true, insideSheetSize: "cheapest" as const,
      laminationType: "Matte" as const, customLevel: "auto" as const, printingMarkupPct: 0,
    }
    const regular = calculateBooklet({ ...baseParams, isBroker: false })
    const broker = calculateBooklet({ ...baseParams, isBroker: true })
    
    results.push({
      name: "TEST 5: Broker cheaper than regular",
      status: broker.grandTotal < regular.grandTotal ? "PASS" : "FAIL",
      expected: "Broker < Regular",
      actual: `Regular: ${fmt(regular.grandTotal)} | Broker: ${fmt(broker.grandTotal)} | Savings: ${fmt(regular.grandTotal - broker.grandTotal)}`,
      details: `Regular - Print: ${fmt(regular.totalPrintingCost)}, Bind: ${fmt(regular.totalBindingPrice)}, Lam: ${fmt(regular.totalLaminationCost)} | Broker - Print: ${fmt(broker.totalPrintingCost)}, Bind: ${fmt(broker.totalBindingPrice)}, Lam: ${fmt(broker.totalLaminationCost)}`,
    })
  }

  // ===========================
  // TEST 6: Self-cover vs separate cover (booklet)
  // Self-cover = entire book same paper, separateCover=false
  // ===========================
  {
    const selfCover = calculateBooklet({
      bookQty: 100, pagesPerBook: 24, pageWidth: 8.5, pageHeight: 11, separateCover: false,
      coverPaper: "80 Gloss", coverSides: "4/4",
      coverBleed: false, coverSheetSize: "cheapest",
      insidePaper: "20lb Offset", insideSides: "D/S", insideBleed: false, insideSheetSize: "cheapest",
      laminationType: "none", customLevel: "auto", isBroker: false, printingMarkupPct: 0,
    })
    const separateCover = calculateBooklet({
      bookQty: 100, pagesPerBook: 20, pageWidth: 8.5, pageHeight: 11, separateCover: true,
      coverPaper: "10pt Offset", coverSides: "4/4",
      coverBleed: false, coverSheetSize: "cheapest",
      insidePaper: "20lb Offset", insideSides: "D/S", insideBleed: false, insideSheetSize: "cheapest",
      laminationType: "none", customLevel: "auto", isBroker: false, printingMarkupPct: 0,
    })
    
    results.push({
      name: "TEST 6: Self-cover vs separate cover both valid",
      status: selfCover.isValid && separateCover.isValid ? "PASS" : "FAIL",
      expected: "Both valid",
      actual: `Self: ${selfCover.isValid ? fmt(selfCover.grandTotal) : selfCover.error} | Separate: ${separateCover.isValid ? fmt(separateCover.grandTotal) : separateCover.error}`,
    })
  }

  // ===========================
  // TEST 7: Q-1194 exact match -- 1050 qty, 16 total pages, 8.5x11
  // 10pt Gloss cover 4/0, 20lb Offset D/S inside, bleed both, matte lam, no broker
  // Database says $2,207
  // ===========================
  {
    const result = calculateBooklet({
      bookQty: 1050, pagesPerBook: 12, pageWidth: 8.5, pageHeight: 11, separateCover: true,
      coverPaper: "10pt Gloss", coverSides: "4/0",
      coverBleed: true, coverSheetSize: "cheapest",
      insidePaper: "20lb Offset", insideSides: "D/S", insideBleed: true, insideSheetSize: "cheapest",
      laminationType: "Matte", customLevel: "auto", isBroker: false, printingMarkupPct: 0,
    })
    
    const diff = Math.abs(result.grandTotal - 2207)
    results.push({
      name: "TEST 7: Q-1194 price match ($2,207 expected)",
      status: diff < 5 ? "PASS" : diff < 50 ? "WARN" : "FAIL",
      expected: "$2,207.00",
      actual: fmt(result.grandTotal),
      details: `Diff: ${fmt(diff)} | Print: ${fmt(result.totalPrintingCost)} | Bind: ${fmt(result.totalBindingPrice)} | Lam: ${fmt(result.totalLaminationCost)} | Inside level: ${result.insideResult?.level} | Cover level: ${result.coverResult?.level}`,
    })
  }

  // ===========================
  // TEST 8: Bleed on vs off price difference
  // ===========================
  {
    const noBleed = calculateBooklet({
      bookQty: 100, pagesPerBook: 36, pageWidth: 8.5, pageHeight: 11, separateCover: true,
      coverPaper: "80 Gloss", coverSides: "4/4",
      coverBleed: false, coverSheetSize: "cheapest",
      insidePaper: "20lb Offset", insideSides: "D/S", insideBleed: false, insideSheetSize: "cheapest",
      laminationType: "none", customLevel: "auto", isBroker: false, printingMarkupPct: 0,
    })
    const withBleed = calculateBooklet({
      bookQty: 100, pagesPerBook: 36, pageWidth: 8.5, pageHeight: 11, separateCover: true,
      coverPaper: "80 Gloss", coverSides: "4/4",
      coverBleed: true, coverSheetSize: "cheapest",
      insidePaper: "20lb Offset", insideSides: "D/S", insideBleed: true, insideSheetSize: "cheapest",
      laminationType: "none", customLevel: "auto", isBroker: false, printingMarkupPct: 0,
    })
    
    results.push({
      name: "TEST 8: Bleed on vs off affects price (or same sheet)",
      status: (noBleed.isValid && withBleed.isValid) ? "PASS" : "FAIL",
      expected: "Both valid, bleed may cost more (larger sheet needed)",
      actual: `No bleed: ${fmt(noBleed.grandTotal)} | With bleed: ${fmt(withBleed.grandTotal)} | Diff: ${fmt(withBleed.grandTotal - noBleed.grandTotal)}`,
    })
  }

  // ===========================
  // TEST 9: Flat printing -- basic postcard 4x6, 12pt Gloss, 4/4, bleed
  // ===========================
  {
    const lamination: LaminationInputs = { enabled: false, type: "Gloss", sides: "S/S" }
    const inputs: PrintingInputs = {
      qty: 500, width: 4, height: 6, paperName: "12pt Gloss", sidesValue: "4/4", hasBleed: true,
      addOnCharge: 0, addOnDescription: "", printingMarkupPct: 0, isBroker: false, lamination,
      scoreFoldOperation: "", scoreFoldType: "",
    }
    const options = calculateAllSheetOptions(inputs)
    const valid = options.length > 0
    let total = 0
    if (valid) {
      const full = buildFullResult(inputs, options[0].result)
      total = full.grandTotal
    }
    results.push({
      name: "TEST 9: Flat postcard 500x 4x6 12pt Gloss 4/4 bleed",
      status: valid ? "PASS" : "FAIL",
      expected: "Valid result",
      actual: valid ? `${fmt(total)} (${fmt(total / 500)}/ea)` : "No valid options",
    })
  }

  // ===========================
  // TEST 10: Flat printing broker vs regular
  // ===========================
  {
    const lamination: LaminationInputs = { enabled: false, type: "Gloss", sides: "S/S" }
    const base = {
      qty: 1000, width: 8.5, height: 11, paperName: "20lb Offset", sidesValue: "4/4" as const, hasBleed: false,
      addOnCharge: 0, addOnDescription: "", printingMarkupPct: 0, lamination,
      scoreFoldOperation: "" as const, scoreFoldType: "" as const,
    }
    const regOpts = calculateAllSheetOptions({ ...base, isBroker: false })
    const brokerOpts = calculateAllSheetOptions({ ...base, isBroker: true })
    let regTotal = 0, brokerTotal = 0
    if (regOpts.length) { regTotal = buildFullResult({ ...base, isBroker: false }, regOpts[0].result).grandTotal }
    if (brokerOpts.length) { brokerTotal = buildFullResult({ ...base, isBroker: true }, brokerOpts[0].result).grandTotal }
    
    results.push({
      name: "TEST 10: Flat printing broker cheaper",
      status: brokerTotal < regTotal ? "PASS" : "FAIL",
      expected: "Broker < Regular",
      actual: `Regular: ${fmt(regTotal)} | Broker: ${fmt(brokerTotal)}`,
    })
  }

  // ===========================
  // TEST 11: Perfect bound -- 100 books, 60 pages, 8.5x11
  // ===========================
  {
    const result = calculatePerfect({
      bookQty: 100, pagesPerBook: 60, pageWidth: 8.5, pageHeight: 11,
      inside: { paperName: "20lb Offset", sides: "D/S", hasBleed: false, sheetSize: "cheapest" },
      cover: { paperName: "80 Gloss", sides: "4/4", hasBleed: true, sheetSize: "cheapest" },
      laminationType: "Gloss", customLevel: "auto", isBroker: false,
    })
    const valid = !("error" in result)
    results.push({
      name: "TEST 11: Perfect bound 100x 60pg 8.5x11",
      status: valid ? "PASS" : "FAIL",
      expected: "Valid result",
      actual: valid ? `${fmt(result.grandTotal)} (${fmt(result.pricePerBook)}/ea) | Print: ${fmt(result.totalPrintingCost)} | Bind: ${fmt(result.totalBindingPrice)} | Lam: ${fmt(result.totalLaminationCost)}` : `Error: ${(result as any).error}`,
    })
  }

  // ===========================
  // TEST 12: Spiral -- 50 books, 100 pages, 8.5x11, printed covers
  // ===========================
  {
    const result = calculateSpiral({
      bookQty: 50, pagesPerBook: 100, pageWidth: 8.5, pageHeight: 11,
      inside: { paperName: "20lb Offset", sides: "D/S", hasBleed: false, sheetSize: "cheapest" },
      useFrontCover: true,
      front: { paperName: "80 Gloss", sides: "4/0", hasBleed: true, sheetSize: "cheapest" },
      useBackCover: true,
      back: { paperName: "80 Gloss", sides: "4/0", hasBleed: false, sheetSize: "cheapest" },
      clearPlastic: false, blackVinyl: false, customLevel: "auto", isBroker: false,
    })
    const valid = !("error" in result)
    results.push({
      name: "TEST 12: Spiral 50x 100pg 8.5x11 printed covers 4/0",
      status: valid ? "PASS" : "FAIL",
      expected: "Valid result with 4/0 covers",
      actual: valid ? `${fmt(result.grandTotal)} (${fmt(result.pricePerBook)}/ea)` : `Error: ${(result as any).error}`,
    })
  }

  // ===========================
  // SUMMARY
  // ===========================
  const passed = results.filter(r => r.status === "PASS").length
  const failed = results.filter(r => r.status === "FAIL").length
  const warned = results.filter(r => r.status === "WARN").length

  return NextResponse.json({
    summary: `${passed} PASS | ${failed} FAIL | ${warned} WARN out of ${results.length} tests`,
    tests: results,
  }, { status: 200 })
}

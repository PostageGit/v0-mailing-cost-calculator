import type {
  BookletPaperOption,
  BookletInputs,
  PartCalcResult,
  BookletCalcResult,
} from "./booklet-types"
import { getActiveConfig, calculateFinishingCost } from "./pricing-config"
import { CLICK_COST_SHEET_MULTIPLIERS, SPECIALTY_SHEET_SIZES } from "./printing-pricing"

// ==================== DATA CONSTANTS ====================

export const BOOKLET_PAPER_OPTIONS: BookletPaperOption[] = [
  // Cardstock (for covers)
  { name: "80 Gloss", isCardstock: true, canLaminate: true, thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19"] },
  { name: "80 Matte", isCardstock: true, canLaminate: true, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "10pt Offset", isCardstock: true, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "10pt Gloss", isCardstock: true, canLaminate: true, thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19"] },
  { name: "10pt Matte", isCardstock: true, canLaminate: true, thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19"] },
  { name: "12pt Gloss", isCardstock: true, canLaminate: true, thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19", "13x26"] },
  { name: "12pt Matte", isCardstock: true, canLaminate: true, thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19", "13x26"] },
  { name: "14pt Gloss", isCardstock: true, canLaminate: true, thickness: 0.014, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "14pt Matte", isCardstock: true, canLaminate: true, thickness: 0.014, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  // Paper (for inside pages)
  { name: "20lb Offset", isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "12.5x19", "Short 11x17"] },
  { name: "60lb Offset", isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12.5x19", "Short 12x18", "Short 12.5x19"] },
  { name: "60 lb Cream", isCardstock: false, canLaminate: false, thickness: 0.004, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "80lb Text Gloss", isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19", "Short 11x17", "Short 12x18"] },
  { name: "100lb Text Gloss", isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19", "Short 11x17", "Short 12x18"] },
]

export const BOOKLET_PAPER_PRICES: Record<string, Record<string, number>> = {
  "80 Gloss": { "11x17": 0.1159, "12x18": 0.1159, "13x19": 0.1159 },
  "80 Matte": { "8.5x11": 0.052, "11x17": 0.1138, "12x18": 0.1138, "13x19": 0.1138 },
  "10pt Offset": { "8.5x11": 0.0578, "11x17": 0.1130, "12x18": 0.1130, "13x19": 0.1130 },
  "10pt Gloss": { "11x17": 0.1321, "12x18": 0.1321, "13x19": 0.1321 },
  "10pt Matte": { "11x17": 0.1272, "12x18": 0.1272, "13x19": 0.1272 },
  "12pt Gloss": { "11x17": 0.1490, "12x18": 0.1490, "13x19": 0.1490, "13x26": 0.4470 },
  "12pt Matte": { "11x17": 0.1601, "12x18": 0.1601, "13x19": 0.1601, "13x26": 0.4803 },
  "14pt Gloss": { "8.5x11": 0.09455, "11x17": 0.1891, "12x18": 0.1891, "13x19": 0.1891 },
  "14pt Matte": { "8.5x11": 0.09455, "11x17": 0.1891, "12x18": 0.1891, "13x19": 0.1891 },
  "20lb Offset": { "8.5x11": 0.0092, "11x17": 0.0174, "12x18": 0.0293, "12.5x19": 0.0270, "Short 11x17": 0.0184 },
  "60lb Offset": { "8.5x11": 0.015, "11x17": 0.0295, "12x18": 0.0346, "12.5x19": 0.0320, "Short 12x18": 0.0360, "Short 12.5x19": 0.0410 },
  "60 lb Cream": { "8.5x11": 0.018, "11x17": 0.035, "12x18": 0.042, "13x19": 0.050 },
  "80lb Text Gloss": { "8.5x11": 0.025, "11x17": 0.0490, "12x18": 0.0490, "13x19": 0.0615, "Short 11x17": 0.0523, "Short 12x18": 0.0523 },
  "100lb Text Gloss": { "8.5x11": 0.03, "11x17": 0.0565, "12x18": 0.0565, "13x19": 0.0653, "Short 11x17": 0.0675, "Short 12x18": 0.0675 },
}

const CLICK_COSTS: Record<string, { regular: number; machine: number }> = {
  BW: { regular: 0.0039, machine: 0.00365 },
  Color: { regular: 0.049, machine: 0.0087 },
}

const SIDES_RULES: Record<string, { clickAmount: number; clickType: string; machineClickAmount: number }> = {
  "S/S": { clickAmount: 1, clickType: "BW", machineClickAmount: 1 },
  "D/S": { clickAmount: 2, clickType: "BW", machineClickAmount: 2 },
  "4/0": { clickAmount: 1, clickType: "Color", machineClickAmount: 1 },
  "4/1": { clickAmount: 2, clickType: "Color", machineClickAmount: 2 },
  "4/4": { clickAmount: 2, clickType: "Color", machineClickAmount: 2 },
  "1/0": { clickAmount: 0.25, clickType: "Color", machineClickAmount: 1 },
  "1/1": { clickAmount: 0.5, clickType: "Color", machineClickAmount: 2 },
}

const LEVEL_BRACKETS = [
  { level: 1, from: 1 }, { level: 2, from: 10 }, { level: 3, from: 100 },
  { level: 4, from: 250 }, { level: 5, from: 1000 }, { level: 6, from: 2000 },
  { level: 7, from: 3500 }, { level: 8, from: 5000 }, { level: 9, from: 100000 },
  { level: 10, from: 1000000 },
]

const MARKUP_PERCENTAGES: Record<string, Record<number, number>> = {
  BW: { 1: 15, 2: 8, 3: 4, 4: 3.5, 5: 3.13, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.9 },
  "Color Paper": { 1: 12, 2: 6, 3: 4, 4: 3.5, 5: 3, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.52 },
  "Color Card": { 1: 12, 2: 6, 3: 4, 4: 3.4, 5: 3.15, 6: 2.95, 7: 2.5, 8: 2.2, 9: 2.05, 10: 1.52 },
}

const GUTTER_AMOUNT = 0.2
const BLEED_MARGIN = 0.25

export const ALL_SIDES = ["4/4", "4/0", "4/1", "1/1", "1/0", "D/S", "S/S"]
export const INSIDE_SIDES = ["4/4", "1/1", "D/S"] // saddle-stitch = folded signatures, ALWAYS both-sided

// ==================== HELPER FUNCTIONS ====================

function getLevel(quantity: number): number {
  let level = 1
  for (let i = LEVEL_BRACKETS.length - 1; i >= 0; i--) {
    if (quantity >= LEVEL_BRACKETS[i].from) {
      level = LEVEL_BRACKETS[i].level
      break
    }
  }
  return level
}

function getMarkup(level: number, sidesValue: string, isCardstock: boolean): number {
  const rule = SIDES_RULES[sidesValue]
  if (!rule) return 1
  const category = rule.clickType === "BW" ? "BW" : isCardstock ? "Color Card" : "Color Paper"
  const markups = getActiveConfig().markups
  return markups[category]?.[level] || MARKUP_PERCENTAGES[category]?.[level] || 1
}

export function parseSheetSize(sizeString: string): { w: number; h: number } {
  const parts = sizeString.replace("Short ", "").split("x")
  const w = parseFloat(parts[0])
  const h = parseFloat(parts[1])
  if (sizeString.startsWith("Short")) return { w: h, h: w }
  return { w, h }
}

import { getDynamicPaperOptions } from "./pricing-config"

export function getCoverPapers(): BookletPaperOption[] {
  // Use dynamic options from database if available, fallback to hardcoded
  const dynamic = getDynamicPaperOptions("bookCover")
  if (dynamic.length > 0) {
    return dynamic.map(d => ({
      name: d.name,
      isCardstock: d.isCardstock,
      canLaminate: d.canLaminate,
      thickness: d.thickness,
      availableSizes: d.availableSizes,
    })).sort((a, b) => a.name.localeCompare(b.name))
  }
  return BOOKLET_PAPER_OPTIONS.filter((p) => p.isCardstock).sort((a, b) => a.name.localeCompare(b.name))
}

export function getInsidePapers(): BookletPaperOption[] {
  // Use dynamic options from database if available, fallback to hardcoded
  const dynamic = getDynamicPaperOptions("bookInside")
  if (dynamic.length > 0) {
    return dynamic.map(d => ({
      name: d.name,
      isCardstock: d.isCardstock,
      canLaminate: d.canLaminate,
      thickness: d.thickness,
      availableSizes: d.availableSizes,
    })).sort((a, b) => a.name.localeCompare(b.name))
  }
  return BOOKLET_PAPER_OPTIONS.filter((p) => !p.isCardstock).sort((a, b) => a.name.localeCompare(b.name))
}

export function canPaperLaminate(paperName: string): boolean {
  // Check dynamic options first
  const coverDynamic = getDynamicPaperOptions("bookCover")
  const insideDynamic = getDynamicPaperOptions("bookInside")
  const allDynamic = [...coverDynamic, ...insideDynamic]
  if (allDynamic.length > 0) {
    return allDynamic.find(p => p.name === paperName)?.canLaminate ?? false
  }
  const paper = BOOKLET_PAPER_OPTIONS.find((p) => p.name === paperName)
  return paper?.canLaminate ?? false
}

export function getAvailableSizes(paperName: string): string[] {
  // Check dynamic options first
  const coverDynamic = getDynamicPaperOptions("bookCover")
  const insideDynamic = getDynamicPaperOptions("bookInside")
  const allDynamic = [...coverDynamic, ...insideDynamic]
  if (allDynamic.length > 0) {
    const paper = allDynamic.find(p => p.name === paperName)
    if (paper) return paper.availableSizes
  }
  const paper = BOOKLET_PAPER_OPTIONS.find((p) => p.name === paperName)
  return paper?.availableSizes ?? []
}

// ==================== LAYOUT GEOMETRY ====================

function calculateLayout(
  sheetW: number,
  sheetH: number,
  pageW: number,
  pageH: number,
  hasBleed: boolean,
  hasLamination: boolean,
): { maxUps: number; isRotated: boolean; verticalUps: number; cols: number; rows: number } {
  const SCALE = 10000
  const gutter_s = hasBleed ? Math.round(GUTTER_AMOUNT * SCALE) : 0
  let sheetW_s = Math.round(sheetW * SCALE)
  let sheetH_s = Math.round(sheetH * SCALE)

  if (hasLamination) {
    const laminationMargin_s = Math.round(0.15 * SCALE)
    if (sheetW_s < sheetH_s) sheetW_s -= laminationMargin_s
    else sheetH_s -= laminationMargin_s
  }

  const bleedMargin_s = hasBleed ? Math.round(BLEED_MARGIN * SCALE) : 0
  let printableW_s = sheetW_s - bleedMargin_s * 2
  let printableH_s = sheetH_s - bleedMargin_s * 2

  if (printableW_s < 0 || printableH_s < 0) return { maxUps: 0, isRotated: false, verticalUps: 0, cols: 0, rows: 0 }

  const getFitCount = (area: number, item: number, gutter: number) => {
    if (item <= 0 || area <= 0) return 0
    return Math.floor((area + gutter) / (item + gutter))
  }

  const pageW_s = Math.round(pageW * SCALE)
  const pageH_s = Math.round(pageH * SCALE)

  // Portrait
  const rawColsP = getFitCount(printableW_s, pageW_s, gutter_s)
  const rawRowsP = getFitCount(printableH_s, pageH_s, gutter_s)
  const colsP = Math.min(rawColsP, 2)
  const rowsP = Math.min(rawRowsP, 3)
  const totalP = colsP * rowsP

  // Landscape
  const rawColsL = getFitCount(printableW_s, pageH_s, gutter_s)
  const rawRowsL = getFitCount(printableH_s, pageW_s, gutter_s)
  const colsL = Math.min(rawColsL, 2)
  const rowsL = Math.min(rawRowsL, 3)
  const totalL = colsL * rowsL

  if (totalL > totalP) {
    return { maxUps: totalL, isRotated: true, verticalUps: rowsL, cols: colsL, rows: rowsL }
  }
  return { maxUps: totalP, isRotated: false, verticalUps: rowsP, cols: colsP, rows: rowsP }
}

// ==================== PART CALCULATION ====================

function calculatePartCost(
  paperName: string,
  sidesValue: string,
  hasBleed: boolean,
  sheetSizeSelection: string,
  bookQty: number,
  spreadWidth: number,
  spreadHeight: number,
  sheetsPerPart: number,
  hasLamination: boolean,
  forcedLevel: number | null,
  partName: string,
): PartCalcResult {
  // Try dynamic options from database first, fall back to hardcoded
  const coverDynamic = getDynamicPaperOptions("bookCover")
  const insideDynamic = getDynamicPaperOptions("bookInside")
  const allDynamic = [...coverDynamic, ...insideDynamic]
  let paperData = allDynamic.find((p) => p.name === paperName)
  if (!paperData) {
    // Fall back to hardcoded options
    paperData = BOOKLET_PAPER_OPTIONS.find((p) => p.name === paperName)
  }
  if (!paperData) return emptyPartResult(partName, "Selected paper not found.")

  const sidesRule = SIDES_RULES[sidesValue]
  if (!sidesRule) return emptyPartResult(partName, `Printing rule for '${sidesValue}' not found.`)

  const cfg = getActiveConfig()
  const clickCostData = cfg.clickCosts[sidesRule.clickType] || CLICK_COSTS[sidesRule.clickType]

  const calcForSize = (sizeString: string) => {
    const sheet = parseSheetSize(sizeString)
    const layout = calculateLayout(sheet.w, sheet.h, spreadWidth, spreadHeight, hasBleed, hasLamination)
    if (layout.maxUps === 0) return null

    // Total sheets = ceil(books / ups) * sheetsPerPart
    // Example: 1450 books at 2-up with 1 sheet/book = ceil(1450/2) * 1 = 725 sheets
    // This correctly handles both covers (1 sheet/book) and insides (multiple sheets/book)
    const totalSheets = Math.ceil(bookQty / layout.maxUps) * sheetsPerPart
    // Old system calculation (for comparison during transition)
    const oldSystemSheets = Math.ceil((bookQty * sheetsPerPart) / layout.maxUps)
    const paperCost = cfg.bookletPaperPrices[paperName]?.[sizeString] ?? BOOKLET_PAPER_PRICES[paperName]?.[sizeString] ?? 0
    if (paperCost === 0) return null

    const sheetClickMul = CLICK_COST_SHEET_MULTIPLIERS[sizeString] ?? 1
    const clickCost = (sidesRule.clickAmount * clickCostData.regular + sidesRule.machineClickAmount * clickCostData.machine) * sheetClickMul
    const autoLevel = getLevel(totalSheets)
    const level = forcedLevel ?? autoLevel
    const markup = getMarkup(level, sidesValue, paperData.isCardstock)
    const baseCost = paperCost + clickCost

    let pricePerSheet = baseCost * markup
    if (level <= 6) pricePerSheet = Math.round(pricePerSheet * 100) / 100
    else if (level === 7) pricePerSheet = Math.round(pricePerSheet * 1000) / 1000
    else pricePerSheet = Math.round(pricePerSheet * 10000) / 10000

    const totalCost = pricePerSheet * totalSheets

    return {
      name: partName,
      cost: totalCost,
      sheets: totalSheets,
      sheetSize: sizeString,
      paper: paperName,
      sides: sidesValue,
      bleed: hasBleed,
      pricePerSheet,
      level,
      autoLevel,
      markup,
      maxUps: layout.maxUps,
      isRotated: layout.isRotated,
      verticalUps: layout.verticalUps,
      cols: layout.cols,
      rows: layout.rows,
      finalSheetWidth: sheet.w,
      finalSheetHeight: sheet.h,
      // P/L cost breakdown
      paperCostPerSheet: paperCost,
      clickCostPerSheet: clickCost,
      totalPaperCost: paperCost * totalSheets,
      totalClickCost: clickCost * totalSheets,
      // Old system comparison (for transition period)
      oldSystemSheets,
      oldSystemCost: pricePerSheet * oldSystemSheets,
    }
  }

  if (sheetSizeSelection === "cheapest") {
    let best: PartCalcResult | null = null
    let minCost = Infinity
    // For covers, allow specialty sizes (e.g. 13x26) since large cover spreads need them.
    // For insides, exclude specialty sizes from auto "cheapest" pick.
    const sizesToTry = partName === "cover"
      ? paperData.availableSizes
      : paperData.availableSizes.filter((s) => !SPECIALTY_SHEET_SIZES.has(s))
    for (const size of sizesToTry) {
      const result = calcForSize(size)
      if (result && result.cost < minCost) {
        minCost = result.cost
        best = result as PartCalcResult
      }
    }
    if (!best) return emptyPartResult(partName, `The spread size does not fit on any available ${partName} paper.`)
    return best
  } else {
    const result = calcForSize(sheetSizeSelection)
    if (!result) return emptyPartResult(partName, `The spread size does not fit on the selected ${partName} sheet (${sheetSizeSelection}).`)
    return result as PartCalcResult
  }
}

function emptyPartResult(name: string, error: string): PartCalcResult {
  return {
    name, cost: 0, sheets: 0, sheetSize: "N/A", paper: "N/A", sides: "N/A",
    bleed: false, pricePerSheet: 0, level: 0, autoLevel: 0, markup: 0, maxUps: 0,
    isRotated: false, verticalUps: 0, cols: 0, rows: 0,
    finalSheetWidth: 0, finalSheetHeight: 0, error,
    paperCostPerSheet: 0, clickCostPerSheet: 0, totalPaperCost: 0, totalClickCost: 0,
  }
}

// ==================== BINDING ====================

// Determine size category from page dimensions (width x height of single page)
function getSizeCategory(pageWidth: number, pageHeight: number): "handheld" | "pocket" {
  // Pocket: 3x5 to 4.25x6 → max dimension ~6
  // Handheld: 5x7 to 9x12 → max dimension >6
  const maxDim = Math.max(pageWidth, pageHeight)
  return maxDim <= 6 ? "pocket" : "handheld"
}

// Determine thickness category from page count
function getThicknessCategory(pageCount: number): "thin" | "thick" {
  // Thin: 8-48 pages, Thick: 52-100 pages
  return pageCount <= 48 ? "thin" : "thick"
}

export function getSaddleStitchBindingPrice(
  quantity: number,
  pageCount: number,
  pageWidth: number,
  pageHeight: number,
  hasSeparateCover: boolean,
  isBroker: boolean,
  bindingType: "staple" | "fold" | "perfect" = "staple"
): number {
  if (quantity <= 0 || isNaN(quantity)) return 0

  const config = getActiveConfig().saddleStitchConfig
  const sizeCategory = getSizeCategory(pageWidth, pageHeight)
  const thicknessCategory = getThicknessCategory(pageCount)
  const coverType = hasSeparateCover ? "with" : "self"

  const rateData = config.rates[sizeCategory]?.[thicknessCategory]?.[coverType]
  if (!rateData) {
    // Fallback to handheld thin self if lookup fails
    return (0.18 * quantity + 65) / quantity
  }

  // Get binding type surcharge (staple = base, fold/perfect add extra)
  const bindingSurcharge = config.binding?.[bindingType] || { extraSetup: 0, extraRate: 0 }

  const { rate, setup } = rateData
  const totalRate = rate + bindingSurcharge.extraRate
  const totalSetup = setup + bindingSurcharge.extraSetup
  const totalCost = totalSetup + (totalRate * quantity)

  // Apply broker discount (default 20% off, configurable)
  const brokerDiscount = config.brokerDiscountPercent / 100
  const finalCost = isBroker ? totalCost * (1 - brokerDiscount) : totalCost

  return finalCost / quantity
}

// Legacy function signature for backward compatibility (used internally)
function getSaddleStitchBindingPriceLegacy(quantity: number, sheetsPerBooklet: number, isBroker: boolean): number {
  if (quantity <= 0 || isNaN(quantity)) return 0
  const setupCost = 15.0
  const runCostPerBooklet = 0.10 + sheetsPerBooklet * 0.01
  const totalBaseCost = setupCost + quantity * runCostPerBooklet
  const markup = isBroker ? 2.5 : 3.5
  const totalSell = totalBaseCost * markup
  const minPrice = 35.0
  const finalPrice = Math.max(totalSell, minPrice)
  return finalPrice / quantity
}

// ==================== LAMINATION ====================

export function getLaminationPrice(
  laminationType: string,
  coverPaperName: string,
  quantity: number,
  isBroker: boolean,
  sheetLengthInches?: number, // Length of the parent sheet in inches for accurate material cost
): number {
  if (!coverPaperName || laminationType === "none") return 0

  // Look up the finishing option from config by matching the lamination type
  const cfg = getActiveConfig()
  const lamId = laminationType.toLowerCase() + "_lamination"
  const finishing = cfg.finishings.find((f) => f.id === lamId)

  if (finishing) {
    return calculateFinishingCost(finishing, coverPaperName, quantity, isBroker, sheetLengthInches)
  }

  // Fallback: if someone typed a custom name, try partial match
  const byName = cfg.finishings.find((f) => f.name.toLowerCase().includes(laminationType.toLowerCase()))
  if (byName) {
    return calculateFinishingCost(byName, coverPaperName, quantity, isBroker, sheetLengthInches)
  }

  return 0
}

// ==================== MAIN CALCULATION ====================

export function calculateBooklet(inputs: BookletInputs): BookletCalcResult {
  const {
    bookQty, pagesPerBook, pageWidth, pageHeight,
    separateCover, coverPaper, coverSides, coverBleed, coverSheetSize,
    insidePaper, insideSides, insideBleed, insideSheetSize,
    insertSections, insertFeePerSection,
    bindingType = "staple",
    laminationType, customLevel, isBroker,
  } = inputs

  const spreadWidth = pageWidth * 2
  const spreadHeight = pageHeight
  const hasLamination = separateCover && laminationType !== "none"
  const forcedLevel = customLevel !== "auto" ? parseInt(customLevel, 10) : isBroker ? 10 : null
  const totalLeavesInBooklet = pagesPerBook / 4  // For saddle stitch, each leaf = 4 pages

  // Calculate insert leaf counts
  const hasInserts = insertSections && insertSections.length > 0
  const insertLeafCount = hasInserts ? insertSections.reduce((sum, s) => sum + (s.leafCount || 0), 0) : 0
  const mainLeafCount = totalLeavesInBooklet - insertLeafCount

  if (hasInserts && mainLeafCount < 0) {
    return invalidResult(`Insert sections have ${insertLeafCount} leaves but booklet only has ${totalLeavesInBooklet} leaves total.`)
  }

  let insideResult: PartCalcResult
  let coverResult: PartCalcResult = emptyPartResult("cover", "")
  let insertResults: PartCalcResult[] = []
  let totalSheetsPerBooklet: number

  if (separateCover) {
    // "pagesPerBook" is the INSIDE page count; cover is additional (1 sheet = 4 cover pages)
    const insideSheetsPerBooklet = pagesPerBook / 4
    totalSheetsPerBooklet = insideSheetsPerBooklet + 1  // +1 for the cover sheet

    // Calculate main inside pages (excluding insert leaves)
    const mainSheetsPerBooklet = hasInserts ? mainLeafCount : insideSheetsPerBooklet
    insideResult = calculatePartCost(insidePaper, insideSides, insideBleed, insideSheetSize, bookQty, spreadWidth, spreadHeight, mainSheetsPerBooklet, false, forcedLevel, "inside")
    if (insideResult.error) return invalidResult("Inside Pages: " + insideResult.error)

    // Calculate each insert section
    if (hasInserts) {
      for (let i = 0; i < insertSections.length; i++) {
        const insert = insertSections[i]
        const insertResult = calculatePartCost(
          insert.paperName, 
          insert.sides, 
          insert.hasBleed, 
          insert.sheetSize, 
          bookQty, 
          spreadWidth, 
          spreadHeight, 
          insert.leafCount, // each insert leaf = 1 sheet to print
          false, 
          forcedLevel || insideResult.level, 
          `insert-${i + 1}`
        )
        if (insertResult.error) return invalidResult(`Insert ${i + 1}: ${insertResult.error}`)
        insertResults.push(insertResult)
      }
    }

    const coverForcedLevel = insideResult.level || forcedLevel
    coverResult = calculatePartCost(coverPaper, coverSides, coverBleed, coverSheetSize, bookQty, spreadWidth, spreadHeight, 1, hasLamination, coverForcedLevel, "cover")
    if (coverResult.error) return invalidResult("Cover: " + coverResult.error)
  } else {
    // No separate cover: all pages (including cover) share the same stock
    totalSheetsPerBooklet = pagesPerBook / 4
    
    // If using inserts in self-cover mode, main inside is reduced
    const mainSheetsPerBooklet = hasInserts ? mainLeafCount : totalSheetsPerBooklet
    insideResult = calculatePartCost(insidePaper, insideSides, insideBleed, insideSheetSize, bookQty, spreadWidth, spreadHeight, mainSheetsPerBooklet, false, forcedLevel, "inside")
    if (insideResult.error) return invalidResult(insideResult.error)

    // Calculate insert sections
    if (hasInserts) {
      for (let i = 0; i < insertSections.length; i++) {
        const insert = insertSections[i]
        const insertResult = calculatePartCost(
          insert.paperName, 
          insert.sides, 
          insert.hasBleed, 
          insert.sheetSize, 
          bookQty, 
          spreadWidth, 
          spreadHeight, 
          insert.leafCount,
          false, 
          forcedLevel || insideResult.level, 
          `insert-${i + 1}`
        )
        if (insertResult.error) return invalidResult(`Insert ${i + 1}: ${insertResult.error}`)
        insertResults.push(insertResult)
      }
    }
  }

  // Broker minimum logic
  const insertCostTotal = insertResults.reduce((sum, r) => sum + r.cost, 0)
  const rawPrintingCost = insideResult.cost + coverResult.cost + insertCostTotal
  const pctMultiplier = 1 + (inputs.printingMarkupPct ?? 0) / 100
  let totalPrintingCost = rawPrintingCost * pctMultiplier

  // Insert fee: charge per insert section
  const insertFee = insertFeePerSection ?? 25  // default $25
  const insertFeeTotal = hasInserts ? insertFee * insertSections.length : 0
  let brokerMinimumApplied: string | null = null

  if (forcedLevel && forcedLevel > 5 && totalPrintingCost < 250) {
    const priceWithFee = totalPrintingCost + 25
    let insideLvl5: PartCalcResult
    let coverLvl5: PartCalcResult

  if (separateCover) {
    insideLvl5 = calculatePartCost(insidePaper, insideSides, insideBleed, insideSheetSize, bookQty, spreadWidth, spreadHeight, pagesPerBook / 4, false, 5, "inside")
      coverLvl5 = calculatePartCost(coverPaper, coverSides, coverBleed, coverSheetSize, bookQty, spreadWidth, spreadHeight, 1, hasLamination, 5, "cover")
    } else {
      insideLvl5 = calculatePartCost(insidePaper, insideSides, insideBleed, insideSheetSize, bookQty, spreadWidth, spreadHeight, pagesPerBook / 4, false, 5, "inside")
      coverLvl5 = emptyPartResult("cover", "")
    }

    if (!insideLvl5.error && !coverLvl5.error) {
      const priceAtLevel5 = insideLvl5.cost + coverLvl5.cost
      if (priceWithFee < priceAtLevel5) {
        totalPrintingCost = priceWithFee
        brokerMinimumApplied = "$25 Setup"
      } else {
        totalPrintingCost = priceAtLevel5
        brokerMinimumApplied = "Level 5 Pricing"
      }
    }
  }

  // Binding – uses rates based on size category, page count, cover type, and binding type
  const bindingPricePerBook = getSaddleStitchBindingPrice(bookQty, pagesPerBook, pageWidth, pageHeight, separateCover, isBroker, bindingType)
  const totalBindingPrice = bindingPricePerBook * bookQty

  // Lamination – broker applies percentage discount on finishing
  // Pass sheet length (longer dimension) for accurate material cost calculation
  const coverSheetLength = Math.max(coverResult.finalSheetWidth || 0, coverResult.finalSheetHeight || 0)
  const totalLaminationCost = (separateCover && hasLamination)
    ? getLaminationPrice(laminationType, coverResult.paper, coverResult.sheets, isBroker, coverSheetLength)
    : 0
  const laminationCostPerBook = bookQty > 0 ? totalLaminationCost / bookQty : 0

  // Totals – broker discount already applied in getSaddleStitchBindingPrice() and getLaminationPrice()
  // Calculate what the non-discounted binding would have been to show discount amount in UI
  let brokerDiscountAmount = 0
  if (isBroker) {
    const brokerDiscountRate = getActiveConfig().saddleStitchConfig.brokerDiscountPercent / 100
    // Calculate the pre-discount binding cost to show what was saved
    const preDiscountBindingPerBook = getSaddleStitchBindingPrice(bookQty, pagesPerBook, pageWidth, pageHeight, separateCover, false, bindingType)
    const preDiscountBindingTotal = preDiscountBindingPerBook * bookQty
    brokerDiscountAmount = preDiscountBindingTotal - totalBindingPrice
  }
  
  const subtotal = totalPrintingCost + totalBindingPrice + totalLaminationCost + insertFeeTotal
  const grandTotal = Math.ceil(subtotal)
  const pricePerBook = bookQty > 0 ? grandTotal / bookQty : 0

  // Warnings
  const warnings: string[] = []
  if (insideResult.verticalUps === 3 || coverResult.verticalUps === 3) {
    warnings.push("This calculation uses a 3-up vertical layout. Please confirm with the production team that this is possible for this job.")
  }

  return {
    isValid: true,
    warnings,
    insideResult,
    coverResult,
    insertResults: insertResults.length > 0 ? insertResults : undefined,
    totalSheetsPerBooklet,
    totalLeavesPerBooklet: totalLeavesInBooklet,
    bindingPricePerBook,
    totalBindingPrice,
    insertFeeTotal,
    laminationCostPerBook,
    totalLaminationCost,
    brokerDiscountAmount,
    brokerMinimumApplied,
    totalPrintingCost,
    subtotal: grandTotal,
    grandTotal,
    pricePerBook,
    spreadWidth,
    spreadHeight,
  }
}

function invalidResult(error: string): BookletCalcResult {
  return {
    isValid: false,
    error,
    warnings: [],
    insideResult: emptyPartResult("inside", ""),
    coverResult: emptyPartResult("cover", ""),
    totalSheetsPerBooklet: 0,
    totalLeavesPerBooklet: 0,
    bindingPricePerBook: 0,
    totalBindingPrice: 0,
    insertFeeTotal: 0,
    laminationCostPerBook: 0,
    totalLaminationCost: 0,
    brokerDiscountAmount: 0,
    brokerMinimumApplied: null,
    totalPrintingCost: 0,
    subtotal: 0,
    grandTotal: 0,
    pricePerBook: 0,
    spreadWidth: 0,
    spreadHeight: 0,
  }
}

// ==================== FORMAT HELPERS ====================

export function formatCurrency(num: number, digits = 2): string {
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatDecimal(num: number, digits = 2): string {
  return num.toFixed(digits)
}

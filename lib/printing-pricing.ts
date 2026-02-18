import type {
  PaperOption,
  SheetDimensions,
  LayoutResult,
  CutsResult,
  PrintingInputs,
  PrintingCalcResult,
  SheetOptionRow,
  FullPrintingResult,
  FinishingCostLine,
  ScoreFoldCostLine,
  LaminationCostLine,
} from "./printing-types"
import { getActiveConfig, calculateFinishingCost, calculateScoreFoldCost } from "./pricing-config"
import { calculateLamination, LAMINATION_DEFAULTS } from "./lamination-pricing"

// ==================== DATA CONSTANTS ====================

export const PAPER_OPTIONS: PaperOption[] = [
  { name: "20lb Offset", isCardstock: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "12.5x19"] },
  { name: "60lb Offset", isCardstock: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12.5x19"] },
  { name: "80lb Text Gloss", isCardstock: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "100lb Text Gloss", isCardstock: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "67 Cover (White)", isCardstock: true, thickness: 0.00225, availableSizes: ["8.5x11", "11x17"] },
  { name: "80 Cover Gloss", isCardstock: true, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "10pt Offset", isCardstock: true, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "10pt Gloss", isCardstock: true, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "12pt Gloss", isCardstock: true, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19", "13x26"] },
  { name: "14pt Gloss", isCardstock: true, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "Sticker (Crack & Peel)", isCardstock: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
]

export const PAPER_PRICES: Record<string, Record<string, number>> = {
  "20lb Offset": { "8.5x11": 0.0078, "11x17": 0.0174, "12x18": 0.0293, "12.5x19": 0.0277 },
  "60lb Offset": { "8.5x11": 0.015, "11x17": 0.0295, "12x18": 0.0346, "12.5x19": 0.032 },
  "80lb Text Gloss": { "8.5x11": 0.025, "11x17": 0.049, "12x18": 0.046, "13x19": 0.0615 },
  "100lb Text Gloss": { "8.5x11": 0.03, "11x17": 0.0565, "12x18": 0.0565, "13x19": 0.0653 },
  "67 Cover (White)": { "8.5x11": 0.032, "11x17": 0.063 },
  "80 Cover Gloss": { "8.5x11": 0.05795, "11x17": 0.1159, "12x18": 0.1159, "13x19": 0.1159 },
  "10pt Offset": { "8.5x11": 0.0578, "11x17": 0.113, "12x18": 0.113, "13x19": 0.113 },
  "10pt Gloss": { "8.5x11": 0.06605, "11x17": 0.1321, "12x18": 0.1321, "13x19": 0.1321 },
  "12pt Gloss": { "8.5x11": 0.0745, "11x17": 0.149, "12x18": 0.149, "13x19": 0.149, "13x26": 0.447 },
  "14pt Gloss": { "8.5x11": 0.09455, "11x17": 0.1891, "12x18": 0.1891, "13x19": 0.1891 },
  "Sticker (Crack & Peel)": { "8.5x11": 0.187, "11x17": 0.373, "12x18": 0.373, "13x19": 0.373 },
}

export const CLICK_COSTS: Record<string, { regular: number; machine: number }> = {
  BW: { regular: 0.0039, machine: 0.00365 },
  Color: { regular: 0.049, machine: 0.0087 },
}

/** Sheet sizes that multiply the base click cost (e.g. 13x26 costs 3x per click) */
export const CLICK_COST_SHEET_MULTIPLIERS: Record<string, number> = {
  "13x26": 3,
}

/**
 * Specialty / large-format sheet sizes that should NOT be auto-selected as
 * "cheapest". They are still shown in the options table / dropdown for manual
 * selection (e.g. large brochures, perfect-binding covers).
 */
export const SPECIALTY_SHEET_SIZES = new Set(["13x26"])

export const SIDES_RULES: Record<string, { name: string; clickAmount: number; clickType: string; machineClickAmount: number }> = {
  "S/S": { name: "B&W - Front Only", clickAmount: 1, clickType: "BW", machineClickAmount: 1 },
  "D/S": { name: "B&W - Both Sides", clickAmount: 2, clickType: "BW", machineClickAmount: 2 },
  "4/0": { name: "Color - Front Only", clickAmount: 1, clickType: "Color", machineClickAmount: 1 },
  "4/4": { name: "Color - Both Sides", clickAmount: 2, clickType: "Color", machineClickAmount: 2 },
  "1/0": { name: "B&W - Front Only (alt)", clickAmount: 0.25, clickType: "Color", machineClickAmount: 1 },
  "1/1": { name: "B&W - Both Sides (alt)", clickAmount: 0.5, clickType: "Color", machineClickAmount: 2 },
}

const LEVEL_BRACKETS = [
  { level: 1, from: 1 },
  { level: 2, from: 10 },
  { level: 3, from: 100 },
  { level: 4, from: 250 },
  { level: 5, from: 1000 },
  { level: 6, from: 2000 },
  { level: 7, from: 3500 },
  { level: 8, from: 5000 },
  { level: 9, from: 100000 },
  { level: 10, from: 1000000 },
]

const MARKUP_PERCENTAGES: Record<string, Record<number, number>> = {
  BW: { 1: 15, 2: 8, 3: 4, 4: 3.5, 5: 3.13, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.9 },
  "Color Paper": { 1: 12, 2: 6, 3: 4, 4: 3.5, 5: 3, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.52 },
  "Color Card": { 1: 12, 2: 6, 3: 4, 4: 3.4, 5: 3.15, 6: 2.95, 7: 2.5, 8: 2.2, 9: 2.05, 10: 1.52 },
}

const GUTTER_AMOUNT = 0.2
const BLEED_MARGIN = 0.25

// ==================== HELPER FUNCTIONS ====================

export function getAvailableSides(paperName: string): string[] {
  const paper = PAPER_OPTIONS.find((p) => p.name === paperName)
  if (!paper) return []
  if (paperName === "Sticker (Crack & Peel)") {
    return ["S/S", "4/0", "1/0"]
  }
  if (paper.isCardstock) {
    return ["4/4", "4/0", "1/1", "1/0"]
  }
  return ["S/S", "D/S", "4/4", "4/0", "1/1", "1/0"]
}

function getLevel(quantity: number): number {
  let determinedLevel = 1
  for (let i = LEVEL_BRACKETS.length - 1; i >= 0; i--) {
    if (quantity >= LEVEL_BRACKETS[i].from) {
      determinedLevel = LEVEL_BRACKETS[i].level
      break
    }
  }
  return determinedLevel
}

function getMarkup(level: number, sidesValue: string, isCardstock: boolean): number {
  const sidesRule = SIDES_RULES[sidesValue]
  if (!sidesRule) return 1
  const category = sidesRule.clickType === "BW" ? "BW" : isCardstock ? "Color Card" : "Color Paper"
  const markups = getActiveConfig().markups
  return markups[category]?.[level] || MARKUP_PERCENTAGES[category]?.[level] || 1
}

export function parseSheetSize(sizeString: string): SheetDimensions {
  const parts = sizeString.replace("Short ", "").split("x")
  let w = parseFloat(parts[0])
  let h = parseFloat(parts[1])
  if (sizeString.startsWith("Short")) {
    return { w: h, h: w }
  }
  return { w, h }
}

export function calculateLayout(
  sheetW: number,
  sheetH: number,
  pageW: number,
  pageH: number,
  hasBleed: boolean
): LayoutResult {
  const SCALE = 10000
  const getFitCount = (area_s: number, item_s: number, gutter_s: number) => {
    if (item_s > area_s) return 0
    return Math.floor((area_s + gutter_s) / (item_s + gutter_s))
  }

  let printableW_s = Math.round(sheetW * SCALE)
  let printableH_s = Math.round(sheetH * SCALE)
  const gutter_s = hasBleed ? Math.round(GUTTER_AMOUNT * SCALE) : 0
  const bleedMargin_s = hasBleed ? Math.round(BLEED_MARGIN * SCALE) : 0

  if (hasBleed) {
    printableW_s -= bleedMargin_s * 2
    printableH_s -= bleedMargin_s * 2
  }

  if (printableW_s < 0 || printableH_s < 0) return { cols: 0, rows: 0, isRotated: false }

  const pageW_s = Math.round(pageW * SCALE)
  const pageH_s = Math.round(pageH * SCALE)

  const colsPortrait = getFitCount(printableW_s, pageW_s, gutter_s)
  const rowsPortrait = getFitCount(printableH_s, pageH_s, gutter_s)
  const totalPortrait = colsPortrait * rowsPortrait

  const colsRotated = getFitCount(printableW_s, pageH_s, gutter_s)
  const rowsRotated = getFitCount(printableH_s, pageW_s, gutter_s)
  const totalRotated = colsRotated * rowsRotated

  if (totalRotated > totalPortrait) {
    return { cols: colsRotated, rows: rowsRotated, isRotated: true }
  }
  return { cols: colsPortrait, rows: rowsPortrait, isRotated: false }
}

export function calculateCuts(
  layout: LayoutResult,
  sheet: SheetDimensions,
  print: { w: number; h: number },
  hasBleed: boolean
): CutsResult {
  const { cols, rows, isRotated } = layout
  const pageW = isRotated ? print.h : print.w
  const pageH = isRotated ? print.w : print.h
  const epsilon = 0.01

  let verticalCuts = 0
  if (cols > 0) {
    if (hasBleed) {
      verticalCuts = (cols - 1) * 2 + 2
    } else {
      const totalWidth = cols * pageW
      if (Math.abs(totalWidth - sheet.w) < epsilon) {
        verticalCuts = cols - 1
      } else {
        verticalCuts = cols + 1
      }
    }
  }

  let horizontalCuts = 0
  if (rows > 0) {
    if (hasBleed) {
      horizontalCuts = (rows - 1) * 2 + 2
    } else {
      const totalHeight = rows * pageH
      if (Math.abs(totalHeight - sheet.h) < epsilon) {
        horizontalCuts = rows - 1
      } else {
        horizontalCuts = rows + 1
      }
    }
  }

  return { vertical: verticalCuts, horizontal: horizontalCuts, total: verticalCuts + horizontalCuts }
}

// ==================== MAIN CALCULATION ====================

export function calculatePrintingCost(inputs: PrintingInputs, size: string): PrintingCalcResult | null {
  const { qty, width, height, paperName, sidesValue, hasBleed } = inputs
  const paperData = PAPER_OPTIONS.find((p) => p.name === paperName)
  if (!paperData) return null

  const sidesRule = SIDES_RULES[sidesValue]
  if (!sidesRule) return null

  const cfg = getActiveConfig()
  const clickCostData = cfg.clickCosts[sidesRule.clickType] || CLICK_COSTS[sidesRule.clickType]
  const sheet = parseSheetSize(size)
  const layout = calculateLayout(sheet.w, sheet.h, width, height, hasBleed)
  const maxUps = layout.cols * layout.rows

  if (maxUps === 0) return null

  const totalParentSheets = Math.ceil(qty / maxUps)
  const paperCostPerSheet = cfg.paperPrices[paperName]?.[size] ?? PAPER_PRICES[paperName]?.[size] ?? 0
  if (paperCostPerSheet === 0) return null

  const sheetClickMultiplier = CLICK_COST_SHEET_MULTIPLIERS[size] ?? 1
  const clickCostPerSheet =
    (sidesRule.clickAmount * clickCostData.regular + sidesRule.machineClickAmount * clickCostData.machine) * sheetClickMultiplier
  const autoLevel = inputs.isBroker ? 10 : getLevel(totalParentSheets)
  const level = inputs.levelOverride ? Math.max(1, Math.min(10, inputs.levelOverride)) : autoLevel
  const markup = getMarkup(level, sidesValue, paperData.isCardstock)
  const baseCostPerSheet = paperCostPerSheet + clickCostPerSheet

  let effectivePricePerSheet = baseCostPerSheet * markup
  if (level <= 6) effectivePricePerSheet = Math.round(effectivePricePerSheet * 100) / 100
  else if (level === 7) effectivePricePerSheet = Math.round(effectivePricePerSheet * 1000) / 1000
  else effectivePricePerSheet = Math.round(effectivePricePerSheet * 10000) / 10000

  let totalCost = effectivePricePerSheet * totalParentSheets
  const cuts = calculateCuts(layout, sheet, { w: width, h: height }, hasBleed)

  let wasPrintingMinApplied = false
  const isBW = sidesValue === "S/S" || sidesValue === "D/S"
  const printingMinimum = isBW ? 3.0 : 6.5
  if (totalCost < printingMinimum) {
    totalCost = printingMinimum
    wasPrintingMinApplied = true
  }

  const stackThreshold = paperData.isCardstock ? 500 : 700
  const numberOfStacks = totalParentSheets > 0 ? Math.ceil(totalParentSheets / stackThreshold) : 0
  let cuttingCost = 0
  let wasCuttingMinApplied = false
  if (cuts.total > 0 && numberOfStacks > 0) {
    const cuttingCostPerStack = 5 + Math.max(0, cuts.total - 5)
    cuttingCost = cuttingCostPerStack * numberOfStacks
    if (cuts.total > 0 && cuts.total < 5) {
      wasCuttingMinApplied = true
    }
  }

  return {
    cost: totalCost,
    sheets: totalParentSheets,
    sheetSize: size,
    layout,
    level,
    markup,
    pricePerSheet: effectivePricePerSheet,
    sheetDimensions: sheet,
    bleed: hasBleed,
    cuts,
    maxUps,
    cuttingCost,
    numberOfStacks,
    wasPrintingMinApplied,
    wasCuttingMinApplied,
  }
}

// ==================== FULL CALCULATION WITH ALL SHEET SIZES ====================

function getFinishingCosts(inputs: PrintingInputs, parentSheets: number): { lines: FinishingCostLine[]; total: number } {
  const ids = inputs.finishingIds || []
  if (ids.length === 0) return { lines: [], total: 0 }
  const cfg = getActiveConfig()
  const isBroker = inputs.isBroker || false
  const lines: FinishingCostLine[] = []
  let total = 0
  for (const id of ids) {
    const f = cfg.finishings.find((o) => o.id === id)
    if (!f) continue
    const cost = calculateFinishingCost(f, inputs.paperName, parentSheets, isBroker)
    lines.push({ id: f.id, name: f.name, cost })
    total += cost
  }
  return { lines, total }
}

function getScoreFoldCost(inputs: PrintingInputs): ScoreFoldCostLine | null {
  const op = inputs.scoreFoldOperation
  const ft = inputs.scoreFoldType
  if (!op || !ft) return null
  const result = calculateScoreFoldCost(op, ft, inputs.paperName, inputs.width, inputs.height, inputs.qty, inputs.isBroker || false)
  if (!result) return null
  const foldLabels: Record<string, string> = { foldInHalf: "Fold in Half", foldIn3: "Fold in 3", foldIn4: "Fold in 4", gateFold: "Gate Fold" }
  return {
    operation: op === "folding" ? "Folding" : "Score & Fold",
    foldType: foldLabels[ft] || ft,
    cost: result.cost,
    isMinApplied: result.isMinApplied,
    suggestion: result.suggestion,
  }
}

export function calculateAllSheetOptions(inputs: PrintingInputs): SheetOptionRow[] {
  const paper = PAPER_OPTIONS.find((p) => p.name === inputs.paperName)
  if (!paper) return []

  const results: SheetOptionRow[] = []
  for (const size of paper.availableSizes) {
    const result = calculatePrintingCost(inputs, size)
    if (!result) continue

    const printingCost = result.cost
    const pctMultiplier = 1 + (inputs.printingMarkupPct ?? 10) / 100
    const printingCostPlus10 = result.wasPrintingMinApplied ? printingCost : printingCost * pctMultiplier
    const { total: finishTotal } = getFinishingCosts(inputs, result.sheets)
    const sfCost = getScoreFoldCost(inputs)
    const lamInputs = inputs.lamination || LAMINATION_DEFAULTS
    const lamResult = calculateLamination(result.sheets, inputs.paperName, lamInputs, inputs.isBroker || false)
    const lamCost = lamResult?.total || 0
    const price = printingCostPlus10 + result.cuttingCost + inputs.addOnCharge + finishTotal + (sfCost?.cost || 0) + lamCost
    const totalJobCuts = result.cuts.total > 0 ? result.cuts.total * result.numberOfStacks : 0

    results.push({
      size,
      ups: result.maxUps,
      sheets: result.sheets,
      totalCuts: totalJobCuts,
      price,
      result,
    })
  }

  // Sort standard sizes by price (cheapest first), specialty sizes always at the end
  return results.sort((a, b) => {
    const aSpec = SPECIALTY_SHEET_SIZES.has(a.size) ? 1 : 0
    const bSpec = SPECIALTY_SHEET_SIZES.has(b.size) ? 1 : 0
    if (aSpec !== bSpec) return aSpec - bSpec
    return a.price - b.price
  })
}

export function buildFullResult(
  inputs: PrintingInputs,
  result: PrintingCalcResult,
  finishingCalcCosts?: { id: string; name: string; cost: number }[],
): FullPrintingResult {
  const printingCost = result.cost
  const pctMultiplier = 1 + (inputs.printingMarkupPct ?? 10) / 100
  const printingCostPlus10 = result.wasPrintingMinApplied ? printingCost : printingCost * pctMultiplier
  const { lines: finishingCosts, total: totalFinishing } = getFinishingCosts(inputs, result.sheets)
  const scoreFoldCost = getScoreFoldCost(inputs)
  // Lamination cost (per parent sheet)
  const lamInputs = inputs.lamination || LAMINATION_DEFAULTS
  const lamResult = calculateLamination(result.sheets, inputs.paperName, lamInputs, inputs.isBroker || false)
  const laminationCost: LaminationCostLine | null = lamResult
    ? { type: lamInputs.type, sides: lamInputs.sides, cost: lamResult.total, isMinimumApplied: lamResult.isMinimumApplied, timeMinutes: lamResult.timeMinutes }
    : null

  const fcCosts = finishingCalcCosts || []
  const totalFinishingCalcCost = fcCosts.reduce((sum, c) => sum + c.cost, 0)
  const subtotal = printingCostPlus10 + result.cuttingCost + inputs.addOnCharge + totalFinishing + (scoreFoldCost?.cost || 0) + totalFinishingCalcCost + (laminationCost?.cost || 0)
  const grandTotal = subtotal

  return {
    printingCost,
    printingCostPlus10,
    addOnCharge: inputs.addOnCharge,
    addOnDescription: inputs.addOnDescription,
    cuttingCost: result.cuttingCost,
    finishingCosts,
    totalFinishing,
    scoreFoldCost,
    laminationCost,
    finishingCalcCosts: fcCosts,
    totalFinishingCalcCost,
    subtotal,
    grandTotal,
    result,
    inputs,
  }
}

// ==================== FORMAT HELPERS ====================

export function formatCurrency(num: number, maxDigits = 2): string {
  const formatted = num.toFixed(maxDigits).replace(/(\.0+)$/, "")
  return "$" + formatted
}

export function formatVariableDecimal(num: number): string {
  return "$" + parseFloat(num.toFixed(4))
}

// ─── Perfect Binding Pricing Engine ──────────────────────
import type { PerfectInputs, PerfectPartInputs, PerfectPartResult, PerfectCalcResult, PaperOption } from "./perfect-types"
import { PAPER_OPTIONS } from "./perfect-types"
import { SPECIALTY_SHEET_SIZES } from "./printing-pricing"

// ─── Constants ───────────────────────────────────────────
const BLEED_MARGIN = 0.25
const GUTTER_AMOUNT = 0.2
const BROKER_DISCOUNT_RATE = 0.15

// ─── Paper Prices ────────────────────────────────────────
const PAPER_PRICES: Record<string, Record<string, number>> = {
  "80 Gloss":         { "11x17": 0.1159, "12x18": 0.1159, "13x19": 0.1159 },
  "80 Matte":         { "8.5x11": 0.052, "11x17": 0.1138, "12x18": 0.1138, "13x19": 0.1138 },
  "10pt Offset":      { "8.5x11": 0.0578, "11x17": 0.1130, "12x18": 0.1130, "13x19": 0.1130 },
  "10pt Gloss":       { "11x17": 0.1321, "12x18": 0.1321, "13x19": 0.1321 },
  "10pt Matte":       { "11x17": 0.1272, "12x18": 0.1272, "13x19": 0.1272 },
  "12pt Gloss":       { "11x17": 0.1490, "12x18": 0.1490, "13x19": 0.1490 },
  "12pt Matte":       { "11x17": 0.1601, "12x18": 0.1601, "13x19": 0.1601 },
  "20lb Offset":      { "8.5x11": 0.0092, "11x17": 0.0174, "12x18": 0.0293, "12.5x19": 0.0270, "Short 11x17": 0.0184 },
  "60lb Offset":      { "8.5x11": 0.015, "11x17": 0.0295, "12x18": 0.0346, "12.5x19": 0.0320, "Short 12x18": 0.0360, "Short 12.5x19": 0.0410 },
  "80lb Text Gloss":  { "8.5x11": 0.025, "11x17": 0.0490, "12x18": 0.0490, "13x19": 0.0615, "Short 11x17": 0.0523, "Short 12x18": 0.0523 },
  "100lb Text Gloss": { "8.5x11": 0.03, "11x17": 0.0565, "12x18": 0.0565, "13x19": 0.0653, "Short 11x17": 0.0675, "Short 12x18": 0.0675 },
}

// ─── Click Costs ─────────────────────────────────────────
const CLICK_COSTS: Record<string, { regular: number; machine: number }> = {
  "BW":    { regular: 0.0039, machine: 0.00365 },
  "Color": { regular: 0.049,  machine: 0.0087  },
}

// ─── Sides Rules ─────────────────────────────────────────
const SIDES_RULES: Record<string, { clickAmount: number; clickType: string; machineClickAmount: number }> = {
  "S/S": { clickAmount: 1,    clickType: "BW",    machineClickAmount: 1 },
  "D/S": { clickAmount: 2,    clickType: "BW",    machineClickAmount: 2 },
  "4/0": { clickAmount: 1,    clickType: "Color", machineClickAmount: 1 },
  "4/1": { clickAmount: 2,    clickType: "Color", machineClickAmount: 2 },
  "4/4": { clickAmount: 2,    clickType: "Color", machineClickAmount: 2 },
  "1/0": { clickAmount: 0.25, clickType: "Color", machineClickAmount: 1 },
  "1/1": { clickAmount: 0.5,  clickType: "Color", machineClickAmount: 2 },
}

// ─── Level Brackets ──────────────────────────────────────
const LEVEL_BRACKETS = [
  { level: 1, from: 1 }, { level: 2, from: 10 }, { level: 3, from: 100 },
  { level: 4, from: 250 }, { level: 5, from: 1000 }, { level: 6, from: 2000 },
  { level: 7, from: 3500 }, { level: 8, from: 5000 }, { level: 9, from: 100000 },
  { level: 10, from: 1000000 },
]

// ─── Markup Percentages ──────────────────────────────────
const MARKUP_PERCENTAGES: Record<string, Record<number, number>> = {
  "BW":          { 1: 15, 2: 8, 3: 4, 4: 3.5, 5: 3.13, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.9 },
  "Color Paper": { 1: 12, 2: 6, 3: 4, 4: 3.5, 5: 3, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.52 },
  "Color Card":  { 1: 12, 2: 6, 3: 4, 4: 3.4, 5: 3.15, 6: 2.95, 7: 2.5, 8: 2.2, 9: 2.05, 10: 1.52 },
}

// ─── Helpers ─────────────────────────────────────────────
function getLevel(qty: number): number {
  let level = 1
  for (let i = LEVEL_BRACKETS.length - 1; i >= 0; i--) {
    if (qty >= LEVEL_BRACKETS[i].from) { level = LEVEL_BRACKETS[i].level; break }
  }
  return level
}

function getMarkup(level: number, sidesValue: string, isCardstock: boolean): number {
  const rule = SIDES_RULES[sidesValue]
  if (!rule) return 1
  let cat: string
  if (rule.clickType === "BW") cat = "BW"
  else cat = isCardstock ? "Color Card" : "Color Paper"
  return MARKUP_PERCENTAGES[cat]?.[level] ?? 1
}

function parseSheetSize(s: string): { w: number; h: number } {
  const clean = s.replace("Short ", "")
  const [a, b] = clean.split("x").map(Number)
  if (s.startsWith("Short")) return { w: b, h: a }
  return { w: a, h: b }
}

// ─── Sheet Layout ────────────────────────────────────────
export function calculateLayout(
  sheetW: number, sheetH: number,
  pageW: number, pageH: number,
  hasBleed: boolean, partName: "cover" | "inside",
  hasLamination: boolean
): { maxUps: number; isRotated: boolean } {
  const S = 10000
  const gutter_s = Math.round((hasBleed ? GUTTER_AMOUNT : 0) * S)

  let sw = Math.round(sheetW * S)
  let sh = Math.round(sheetH * S)

  if (partName === "cover" && hasLamination) {
    const lm = Math.round(0.15 * S)
    if (sw < sh) sw -= lm; else sh -= lm
  }

  let bmx = 0, bmy = 0
  if (hasBleed) {
    if (partName === "inside") {
      if (sheetW > sheetH) { bmx = Math.round(0.25 * S); bmy = Math.round(0.15 * S) }
      else { bmx = Math.round(0.15 * S); bmy = Math.round(0.25 * S) }
    } else {
      bmx = Math.round(BLEED_MARGIN * S); bmy = Math.round(BLEED_MARGIN * S)
    }
  }

  const pw = sw - bmx * 2
  const ph = sh - bmy * 2
  if (pw < 0 || ph < 0) return { maxUps: 0, isRotated: false }

  const fit = (area: number, item: number, g: number) => {
    if (item > area) return 0
    return Math.floor((area + g) / (item + g))
  }

  const pws = Math.round(pageW * S)
  const phs = Math.round(pageH * S)

  if (partName === "inside") {
    return { maxUps: fit(pw, pws, gutter_s) * fit(ph, phs, gutter_s), isRotated: false }
  }
  const portrait = fit(pw, pws, gutter_s) * fit(ph, phs, gutter_s)
  const landscape = fit(pw, phs, gutter_s) * fit(ph, pws, gutter_s)
  return { maxUps: Math.max(portrait, landscape), isRotated: landscape > portrait }
}

// ─── Part calculation ────────────────────────────────────
function calculatePart(
  partName: "cover" | "inside",
  part: PerfectPartInputs,
  bookQty: number,
  pageW: number, pageH: number,
  sheetsPerPart: number,
  hasLamination: boolean,
  forcedLevel: number | null,
): PerfectPartResult | { error: string } {
  if (!part.paperName || !part.sides) return { error: `Please fill out the '${partName}' section completely.` }

  const paperData = PAPER_OPTIONS.find(p => p.name === part.paperName)
  if (!paperData) return { error: `Paper "${part.paperName}" not found.` }

  const rule = SIDES_RULES[part.sides]
  if (!rule) return { error: `Printing rule for '${part.sides}' not found.` }
  const clickData = CLICK_COSTS[rule.clickType]

  const calcForSize = (sizeStr: string) => {
    const sheet = parseSheetSize(sizeStr)
    const layout = calculateLayout(sheet.w, sheet.h, pageW, pageH, part.hasBleed, partName, hasLamination)
    if (layout.maxUps === 0) return null

    const totalSheets = Math.ceil(bookQty / layout.maxUps) * sheetsPerPart
    const paperCost = PAPER_PRICES[part.paperName]?.[sizeStr] ?? 0
    if (paperCost === 0) return null

    const clickPerSheet = (rule.clickAmount * clickData.regular) + (rule.machineClickAmount * clickData.machine)
    const autoLevel = getLevel(totalSheets)
    const level = forcedLevel ?? autoLevel
    const markup = getMarkup(level, part.sides, paperData.isCardstock)
    const base = paperCost + clickPerSheet
    let price = base * markup
    if (level <= 6) price = Math.round(price * 100) / 100
    else if (level === 7) price = Math.round(price * 1000) / 1000
    else price = Math.round(price * 10000) / 10000

    return {
      cost: price * totalSheets,
      sheets: totalSheets, sheetSize: sizeStr, paper: part.paperName,
      sides: part.sides, bleed: part.hasBleed, isRotated: layout.isRotated,
      finalSheetWidth: sheet.w, finalSheetHeight: sheet.h,
      maxUps: layout.maxUps, pricePerSheet: price, level, autoLevel, markup,
    }
  }

  if (part.sheetSize === "cheapest") {
    let best: ReturnType<typeof calcForSize> = null
    let minCost = Infinity
    // Exclude specialty/large-format sizes from auto "cheapest" pick
    const standardSizes = paperData.availableSizes.filter((s) => !SPECIALTY_SHEET_SIZES.has(s))
    for (const sz of standardSizes) {
      const r = calcForSize(sz)
      if (r && r.cost < minCost) { minCost = r.cost; best = r }
    }
    if (!best) return { error: `The ${partName} (${pageW}" x ${pageH}") does not fit on any available paper.` }
    return { name: partName, ...best }
  }

  const result = calcForSize(part.sheetSize)
  if (!result) return { error: `The ${partName} (${pageW}" x ${pageH}") does not fit on ${part.sheetSize}.` }
  return { name: partName, ...result }
}

// ─── Binding Price ───────────────────────────────────────
function getBindingPrice(
  qty: number, pages: number, paperName: string,
  width: number, height: number, isBroker: boolean
): number {
  if (qty <= 0) return 0
  const setupCost = 25
  const scoringSpeed = 25
  const scoringRate = 30
  const scoringMinutes = qty / scoringSpeed
  const scoringCost = (scoringMinutes / 60) * scoringRate

  const isGloss = paperName.toLowerCase().includes("gloss")
  const bindingSpeed = isGloss ? 250 : 300
  const bindingRate = 60
  const bindingHours = qty / bindingSpeed
  const bindingCost = bindingHours * bindingRate

  const totalCost = setupCost + scoringCost + bindingCost
  const markup = isBroker ? 2.25 : 3
  const baseSell = totalCost * markup

  let surchargePerBook = 0
  if (width < 4 || height < 6) surchargePerBook += 0.20 * markup
  if (pages >= 600) surchargePerBook += isBroker ? 0.15 : 0.20

  return (baseSell + surchargePerBook * qty) / qty
}

// ─── Lamination Price ────────────────────────────────────
export function getLaminationPrice(
  type: string, coverPaper: string, qty: number, isBroker: boolean
): number {
  if (type === "none") return 0
  const cap = type.charAt(0).toUpperCase() + type.slice(1)

  const runtimeCosts: Record<string, Record<string, number>> = {
    "80Cover":   { Silk: 0.1333, default: 0.0667 },
    "Cardstock": { Silk: 0.05,   default: 0.025 },
  }
  const rollCosts: Record<string, number> = { Gloss: 0.1058, Matte: 0.1045, Silk: 0.1009, Leather: 0.1045 }
  const rollChangeFees: Record<string, number> = { Gloss: 0, Matte: 10, Silk: 10, Leather: 10 }
  const wastePcts: Record<string, number> = { Gloss: 0.05, Matte: 0.05, Silk: 0.10, Leather: 0.05 }
  const minSheets: Record<string, number> = { Gloss: 5, Matte: 5, Silk: 10, Leather: 5 }
  const setupCost = 10
  const baseMarkup = 225
  const brokerDiscount = 30
  const minimumJobPrice = 45

  const cat = coverPaper.toLowerCase().includes("80") ? "80Cover" : "Cardstock"
  const runtime = runtimeCosts[cat][cap] ?? runtimeCosts[cat].default
  const sheets = Math.max(qty, minSheets[cap] ?? 5)
  const withWaste = sheets * (1 + (wastePcts[cap] ?? 0.05))
  const total = setupCost + withWaste * runtime + withWaste * (rollCosts[cap] ?? 0) + (rollChangeFees[cap] ?? 0)
  let effectiveMarkup = baseMarkup
  if (isBroker) effectiveMarkup *= (1 - brokerDiscount / 100)
  return Math.max(total + total * (effectiveMarkup / 100), minimumJobPrice)
}

// ─── Main Calculate ──────────────────────────────────────
export function calculatePerfect(inp: PerfectInputs): PerfectCalcResult | { error: string } {
  const { bookQty, pagesPerBook, pageWidth, pageHeight, cover, inside, laminationType, isBroker, customLevel } = inp
  if (bookQty <= 0 || pagesPerBook < 40) return { error: "Qty must be > 0, pages >= 40." }
  if (pageWidth < 2.5 || pageHeight < 2.5) return { error: "Page dimensions must be at least 2.5\"." }

  const hasLamination = laminationType !== "none"
  const forcedLevel = customLevel !== "auto" ? parseInt(customLevel, 10) : isBroker ? 10 : null

  const isDS = ["D/S", "4/4", "1/1"].includes(inside.sides)
  const sidesForCalc = isDS ? 2 : 1
  const finishedSheetsPerBook = Math.ceil(pagesPerBook / sidesForCalc)

  // Inside
  const insideRes = calculatePart("inside", inside, bookQty, pageWidth, pageHeight, finishedSheetsPerBook, false, forcedLevel)
  if ("error" in insideRes) return insideRes

  // Cover spread dimensions
  const insidePaper = PAPER_OPTIONS.find(p => p.name === inside.paperName)
  const caliper = insidePaper?.thickness ?? 0.004
  const spineWidth = (pagesPerBook / 2) * caliper
  let coverPageWidth = pageWidth * 2 + spineWidth
  let coverPageHeight = pageHeight
  if (cover.hasBleed && inside.hasBleed) coverPageHeight += 0.2

  // Cover (forced to inside level)
  const coverForcedLevel = insideRes.level ?? forcedLevel ?? null
  const coverRes = calculatePart("cover", cover, bookQty, coverPageWidth, coverPageHeight, 1, hasLamination, coverForcedLevel)
  if ("error" in coverRes) return coverRes

  const totalPrintingCost = insideRes.cost + coverRes.cost
  const bindingPricePerBook = getBindingPrice(bookQty, pagesPerBook, inside.paperName, pageWidth, pageHeight, isBroker)
  const totalBindingPrice = bindingPricePerBook * bookQty
  const totalLaminationCost = hasLamination ? getLaminationPrice(laminationType, coverRes.paper, coverRes.sheets, isBroker) : 0
  const laminationCostPerBook = bookQty > 0 ? totalLaminationCost / bookQty : 0

  let subtotal = totalPrintingCost + totalBindingPrice + totalLaminationCost
  let brokerDiscountAmount = 0
  if (isBroker) {
    brokerDiscountAmount = (totalBindingPrice + totalLaminationCost) * BROKER_DISCOUNT_RATE
    subtotal -= brokerDiscountAmount
  }
  const subtotalRounded = Math.ceil(subtotal)
  const grandTotal = subtotalRounded

  return {
    coverResult: coverRes as PerfectPartResult,
    insideResult: insideRes as PerfectPartResult,
    finishedSheetsPerBook, spineWidth, coverPageWidth, coverPageHeight,
    totalPrintingCost, bindingPricePerBook, totalBindingPrice,
    laminationCostPerBook, totalLaminationCost,
    brokerDiscountAmount, subtotalRounded, grandTotal,
    pricePerBook: bookQty > 0 ? grandTotal / bookQty : 0,
    bookQty, pagesPerBook, pageWidth, pageHeight, isBroker, laminationType,
  }
}

// ─── Available paper helpers ─────────────────────────────
export function getCoverPapers(): PaperOption[] {
  return PAPER_OPTIONS.filter(p => p.isCardstock).sort((a, b) => a.name.localeCompare(b.name))
}
export function getInsidePapers(): PaperOption[] {
  return PAPER_OPTIONS.filter(p => !p.isCardstock).sort((a, b) => a.name.localeCompare(b.name))
}
export function canLaminate(paperName: string): boolean {
  return PAPER_OPTIONS.find(p => p.name === paperName)?.canLaminate ?? false
}

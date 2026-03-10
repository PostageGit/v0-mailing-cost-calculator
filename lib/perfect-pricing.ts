// ─── Perfect Binding Pricing Engine ────────────────────────────────────────
import type { PerfectInputs, PerfectPartInputs, PerfectPartResult, PerfectCalcResult, PaperOption } from "./perfect-types"
import { PAPER_OPTIONS } from "./perfect-types"
import { SPECIALTY_SHEET_SIZES } from "./printing-pricing"
import { getActiveConfig } from "./pricing-config"
import { getLaminationPrice } from "./booklet-pricing"

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
  "12pt Gloss":       { "11x17": 0.1490, "12x18": 0.1490, "13x19": 0.1490, "13x26": 0.4470 },
  "12pt Matte":       { "11x17": 0.1601, "12x18": 0.1601, "13x19": 0.1601, "13x26": 0.4803 },
  "20lb Offset":      { "8.5x11": 0.0092, "11x17": 0.0174, "12x18": 0.0293, "12.5x19": 0.0270, "Short 11x17": 0.0184 },
  "20 lb Cream":      { "8.5x11": 0.0110, "11x17": 0.0200, "12x18": 0.0350, "12.5x19": 0.0320 },  // cream variant of 20lb
  "60lb Offset":      { "8.5x11": 0.015, "11x17": 0.0295, "12x18": 0.0346, "12.5x19": 0.0320, "Short 12x18": 0.0360, "Short 12.5x19": 0.0410 },
  "60 lb Cream":      { "8.5x11": 0.018, "11x17": 0.035, "12x18": 0.042, "13x19": 0.050 },
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
  // Read from config first (editable in settings), fall back to local defaults
  const markups = getActiveConfig().markups
  return markups[cat]?.[level] || MARKUP_PERCENTAGES[cat]?.[level] || 1
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
    }
    // Cover: NO boundary margins - cover spread already includes bleed
    // The bleed extends to sheet edge, cut off during trimming
  }

  const pw = sw - bmx * 2
  const ph = sh - bmy * 2
  if (pw < 0 || ph < 0) return { maxUps: 0, isRotated: false }

  // Fit formula: n items need n*item + (n-1)*gutter space
  // Solving for max n: n = floor((area + gutter) / (item + gutter))
  const fit = (area: number, item: number, g: number) => {
    if (item > area) return 0
    return Math.floor((area + g) / (item + g))
  }

  const pws = Math.round(pageW * S)
  const phs = Math.round(pageH * S)

  if (partName === "inside") {
    // Inside pages: NO rotation allowed
    // "Short" sizes provide the alternative orientation (e.g., "Short 12x18" = 18x12)
    // The system checks ALL size options (regular + Short) and picks cheapest
    const maxUps = fit(pw, pws, gutter_s) * fit(ph, phs, gutter_s)
    return { maxUps, isRotated: false }
  }
  
  // Covers: CAN rotate - try both orientations and pick the best
  const portrait = fit(pw, pws, gutter_s) * fit(ph, phs, gutter_s)
  const landscape = fit(pw, phs, gutter_s) * fit(ph, pws, gutter_s)
  return { maxUps: Math.max(portrait, landscape), isRotated: landscape > portrait }
}

/** Paper data that can come from database or hardcoded options */
interface PaperInfo {
  name: string
  isCardstock: boolean
  thickness: number
  availableSizes: string[]
  prices: Record<string, number>
}

// ─���─ Part calculation ────────────────────────────────────
function calculatePart(
  partName: "cover" | "inside",
  part: PerfectPartInputs,
  bookQty: number,
  pageW: number, pageH: number,
  sheetsPerPart: number,
  hasLamination: boolean,
  forcedLevel: number | null,
  paperLookup?: Record<string, PaperInfo>,  // optional database paper lookup
): PerfectPartResult | { error: string } {
  if (!part.paperName || !part.sides) return { error: `Please fill out the '${partName}' section completely.` }

  // Try database paper first, fall back to hardcoded
  let paperData: PaperInfo | undefined
  if (paperLookup && paperLookup[part.paperName]) {
    paperData = paperLookup[part.paperName]
  } else {
    const hardcoded = PAPER_OPTIONS.find(p => p.name === part.paperName)
    if (hardcoded) {
      paperData = {
        name: hardcoded.name,
        isCardstock: hardcoded.isCardstock,
        thickness: hardcoded.thickness,
        availableSizes: hardcoded.availableSizes,
        prices: PAPER_PRICES[hardcoded.name] || {},
      }
    }
  }
  if (!paperData) return { error: `Paper "${part.paperName}" not found.` }

  const rule = SIDES_RULES[part.sides]
  if (!rule) return { error: `Printing rule for '${part.sides}' not found.` }
  const cfg = getActiveConfig()
  const clickData = cfg.clickCosts[rule.clickType] || CLICK_COSTS[rule.clickType]

  const calcForSize = (sizeStr: string) => {
    const sheet = parseSheetSize(sizeStr)
    const layout = calculateLayout(sheet.w, sheet.h, pageW, pageH, part.hasBleed, partName, hasLamination)
    if (layout.maxUps === 0) return null

    // Sheet calculation depends on part type:
    // - COVER: Each book needs 1 cover, so total sheets = ceil(books / ups)
    //   Example: 1450 books at 2-up = ceil(1450/2) = 725 sheets
    // - INSIDE: Gang run (all pages printed together, then cut and collated)
    const isCover = partName === "cover"
    const totalSheets = isCover
      ? Math.ceil(bookQty / layout.maxUps)  // 1 cover per book, grouped by ups
      : Math.ceil((bookQty * sheetsPerPart) / layout.maxUps) // Gang run for insides
    // Old system calculation (for comparison during transition)
    const oldSystemSheets = Math.ceil((bookQty * sheetsPerPart) / layout.maxUps)
    // Use database prices first, then config, then hardcoded
    const paperCost = paperData.prices[sizeStr] ?? cfg.bookletPaperPrices[part.paperName]?.[sizeStr] ?? PAPER_PRICES[part.paperName]?.[sizeStr] ?? 0
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

    const isShort = sizeStr.startsWith("Short ")
    // Old system cost for comparison (during transition)
    const oldSystemCost = price * oldSystemSheets
    return {
      cost: price * totalSheets,
      sheets: totalSheets, sheetSize: sizeStr, paper: part.paperName,
      sides: part.sides, bleed: part.hasBleed, isRotated: layout.isRotated,
      isShort, // Flag when using Short paper orientation
      finalSheetWidth: sheet.w, finalSheetHeight: sheet.h,
      maxUps: layout.maxUps, pricePerSheet: price, level, autoLevel, markup,
      // P/L cost breakdown
      paperCostPerSheet: paperCost,
      clickCostPerSheet: clickPerSheet,
      totalPaperCost: paperCost * totalSheets,
      totalClickCost: clickPerSheet * totalSheets,
      // Old system comparison (for transition period)
      oldSystemSheets,
      oldSystemCost,
    }
  }

  if (part.sheetSize === "cheapest") {
    let best: ReturnType<typeof calcForSize> = null
    let minCost = Infinity
    // For covers, allow specialty sizes (e.g. 13x26) since large cover spreads need them.
    // For insides, exclude specialty sizes from auto "cheapest" pick.
    const sizesToTry = partName === "cover"
      ? paperData.availableSizes
      : paperData.availableSizes.filter((s) => !SPECIALTY_SHEET_SIZES.has(s))
    for (const sz of sizesToTry) {
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
// Uses the shared config-based lamination from booklet-pricing (same engine, reads from settings)
// getLaminationPrice is imported from booklet-pricing and re-exported for any external consumers
export { getLaminationPrice } from "./booklet-pricing"

// ─── Main Calculate ──────────────────────────────────────
/** 
 * @param inp - Perfect bind inputs
 * @param paperData - Optional map of paper name -> paper info (thickness, prices, etc). 
 *                    If provided, uses database values for spine and pricing.
 *                    Falls back to PAPER_OPTIONS if not provided.
 */
export function calculatePerfect(
  inp: PerfectInputs, 
  paperData?: Record<string, PaperInfo>
): PerfectCalcResult | { error: string } {
  const { bookQty, pagesPerBook, pageWidth, pageHeight, cover, inside, insideSections, laminationType, isBroker, customLevel, coverLevelOverride } = inp
  
  // Helper to get paper thickness - prefer database values, fall back to hardcoded
  const getThickness = (paperName: string): number => {
    if (paperData && paperData[paperName]?.thickness !== undefined) {
      return paperData[paperName].thickness
    }
    const paper = PAPER_OPTIONS.find(p => p.name === paperName)
    return paper?.thickness ?? 0.004
  }
  if (bookQty <= 0 || pagesPerBook < 40) return { error: "Qty must be > 0, pages >= 40." }
  if (pageWidth < 2.5 || pageHeight < 2.5) return { error: "Page dimensions must be at least 2.5\"." }

  const hasLamination = laminationType !== "none"
  const forcedLevel = customLevel !== "auto" ? parseInt(customLevel, 10) : isBroker ? 10 : null
  
  // Determine if using sections mode
  const useSections = insideSections && insideSections.length > 0
  
  // Validate sections total pages match
  if (useSections) {
    const totalSectionPages = insideSections.reduce((sum, s) => sum + (s.pageCount || 0), 0)
    if (totalSectionPages !== pagesPerBook) {
      return { error: `Section pages (${totalSectionPages}) must equal total pages (${pagesPerBook}).` }
    }
  }

  // Calculate spine width from all inside papers
  // Spine = sum of (sheets in section * paper thickness)
  // Sheets = pages / 2 (since pages are printed double-sided)
  let spineWidth = 0
  if (useSections) {
    for (const section of insideSections) {
      const caliper = getThickness(section.paperName)
      const sheetsInSection = section.pageCount / 2  // pages to sheets
      spineWidth += sheetsInSection * caliper
    }
  } else {
    const caliper = getThickness(inside.paperName)
    spineWidth = (pagesPerBook / 2) * caliper
  }

  // Calculate inside cost (single or multi-section)
  let insideRes: PerfectPartResult | { error: string }
  let sectionResults: PerfectPartResult[] = []
  
  if (useSections) {
    // Calculate each section separately
    let totalInsideCost = 0
    let totalInsideSheets = 0
    for (const section of insideSections) {
      const isDS = ["D/S", "4/4", "1/1"].includes(section.sides)
      const sidesForCalc = isDS ? 2 : 1
      const sheetsForSection = Math.ceil(section.pageCount / sidesForCalc)
      
      // Use section-specific level if provided, otherwise use global forcedLevel
      const sectionLevel = section.levelOverride ?? forcedLevel
      
      const sectionRes = calculatePart("inside", section, bookQty, pageWidth, pageHeight, sheetsForSection, false, sectionLevel, paperData)
      if ("error" in sectionRes) return { error: `Section "${section.paperName}": ${(sectionRes as {error: string}).error}` }
      
      const res = sectionRes as PerfectPartResult
      
      // Add page count to the section result
      const resWithPages = { ...res, pagesInSection: section.pageCount }
      sectionResults.push(resWithPages)
      totalInsideCost += res.cost
      totalInsideSheets += res.sheets
    }
    // Create combined inside result from first section but with totals
    const firstSection = sectionResults[0]
    insideRes = {
      ...firstSection,
      cost: totalInsideCost,
      sheets: totalInsideSheets,
    }
  } else {
    const isDS = ["D/S", "4/4", "1/1"].includes(inside.sides)
    const sidesForCalc = isDS ? 2 : 1
    const finishedSheetsPerBook = Math.ceil(pagesPerBook / sidesForCalc)
    insideRes = calculatePart("inside", inside, bookQty, pageWidth, pageHeight, finishedSheetsPerBook, false, forcedLevel, paperData)
  }
  
  if ("error" in insideRes) return insideRes
  // Cover wraps: front cover + spine + back cover
  // Add bleed margins if cover has bleed (0.125" on each side = 0.25" total per dimension)
  const bleedMargin = cover.hasBleed ? 0.25 : 0
  let coverPageWidth = (pageWidth * 2) + spineWidth + bleedMargin
  let coverPageHeight = pageHeight + bleedMargin
  // Additional height adjustment if both cover and inside have bleed
  if (cover.hasBleed && inside.hasBleed) coverPageHeight += 0.2

  // Cover (use cover override if provided, otherwise match inside level)
  const coverForcedLevel = coverLevelOverride ?? insideRes.level ?? forcedLevel ?? null
  const coverRes = calculatePart("cover", cover, bookQty, coverPageWidth, coverPageHeight, 1, hasLamination, coverForcedLevel, paperData)
  if ("error" in coverRes) {
    const errMsg = (coverRes as { error: string }).error
    if (errMsg.includes("does not fit")) {
      return { error: `The cover paper (${cover.paperName}) doesn't come in a large enough sheet. Try 12pt Gloss instead.` }
    }
    return coverRes
  }

  const totalPrintingCost = insideRes.cost + coverRes.cost
  // Broker applies percentage discount on finishing (binding + lamination)
  const bindingPricePerBook = getBindingPrice(bookQty, pagesPerBook, inside.paperName, pageWidth, pageHeight, isBroker)
  const totalBindingPrice = bindingPricePerBook * bookQty
  const totalLaminationCost = hasLamination ? getLaminationPrice(laminationType, coverRes.paper, coverRes.sheets, isBroker) : 0
  const laminationCostPerBook = bookQty > 0 ? totalLaminationCost / bookQty : 0

  // Section fee: charge per additional section beyond the first
  const sectionFeePerSection = inp.sectionFeePerSection ?? 25  // default $25 if not specified
  const numSections = useSections ? insideSections.length : 0
  const sectionFeeTotal = numSections > 1 ? sectionFeePerSection * (numSections - 1) : 0

  // Broker discount on non-printing costs (binding + lamination)
  let brokerDiscountAmount = 0
  let subtotal = totalPrintingCost + totalBindingPrice + totalLaminationCost + sectionFeeTotal
  if (isBroker) {
    brokerDiscountAmount = (totalBindingPrice + totalLaminationCost) * BROKER_DISCOUNT_RATE
    subtotal -= brokerDiscountAmount
  }
  const subtotalRounded = Math.ceil(subtotal)
  const grandTotal = subtotalRounded

  // Calculate finishedSheetsPerBook for backwards compat
  const isDS = ["D/S", "4/4", "1/1"].includes(inside.sides)
  const sidesForCalc = isDS ? 2 : 1
  const finishedSheetsPerBook = Math.ceil(pagesPerBook / sidesForCalc)

  return {
    coverResult: coverRes as PerfectPartResult,
    insideResult: insideRes as PerfectPartResult,
    insideSectionResults: sectionResults.length > 0 ? sectionResults : undefined,  // multi-section details
    finishedSheetsPerBook, 
    spineWidth, 
    coverSpreadWidth: coverPageWidth,  // full cover spread including spine
    coverSpreadHeight: coverPageHeight,
    coverPageWidth, coverPageHeight,  // keep for backwards compat
    totalPrintingCost, bindingPricePerBook, totalBindingPrice, sectionFeeTotal,
    laminationCostPerBook, totalLaminationCost,
    brokerDiscountAmount, subtotalRounded, grandTotal,
    pricePerBook: bookQty > 0 ? grandTotal / bookQty : 0,
    bookQty, pagesPerBook, pageWidth, pageHeight, isBroker, laminationType,
  }
}

// ─── Available paper helpers ─────────────────────────────
import { getDynamicPaperOptions, type DynamicPaperOption } from "./pricing-config"

export function getCoverPapers(): PaperOption[] {
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
  return PAPER_OPTIONS.filter(p => p.isCardstock).sort((a, b) => a.name.localeCompare(b.name))
}
export function getInsidePapers(): PaperOption[] {
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
  return PAPER_OPTIONS.filter(p => !p.isCardstock).sort((a, b) => a.name.localeCompare(b.name))
}
export function canLaminate(paperName: string): boolean {
  // Check dynamic options first
  const coverDynamic = getDynamicPaperOptions("bookCover")
  const insideDynamic = getDynamicPaperOptions("bookInside")
  const allDynamic = [...coverDynamic, ...insideDynamic]
  if (allDynamic.length > 0) {
    return allDynamic.find(p => p.name === paperName)?.canLaminate ?? false
  }
  return PAPER_OPTIONS.find(p => p.name === paperName)?.canLaminate ?? false
}

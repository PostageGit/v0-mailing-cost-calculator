// ─── Spiral Binding Pricing Engine ───────────────────────
// Refactored to use Paper Management database system
import type { SpiralInputs, SpiralPartInputs, SpiralPartResult, SpiralCalcResult } from "./spiral-types"
import type { PaperOption } from "./perfect-types"
import { getActiveConfig, getDynamicPaperOptions } from "./pricing-config"

// ─── Constants ───────────────────────────────────────────
const BLEED_MARGIN = 0.25
const GUTTER_AMOUNT = 0.2
const EPSILON = 1e-9

export const EXTRA_COVER_PRICES = { plastic: 0.50, vinyl: 0.50 }

// ─── Click Costs (same as perfect-pricing) ───────────────
const CLICK_COSTS: Record<string, { regular: number; machine: number }> = {
  "BW":    { regular: 0.0039, machine: 0.00365 },
  "Color": { regular: 0.049,  machine: 0.0087  },
}

// ─── Sides Rules ─────────────────────────────────────────
const SIDES_RULES: Record<string, { clickAmount: number; clickType: string; machineClickAmount: number; sheetMultiplier: number }> = {
  "S/S": { clickAmount: 1,    clickType: "BW",    machineClickAmount: 1, sheetMultiplier: 1 },
  "D/S": { clickAmount: 2,    clickType: "BW",    machineClickAmount: 2, sheetMultiplier: 2 },
  "4/0": { clickAmount: 1,    clickType: "Color", machineClickAmount: 1, sheetMultiplier: 1 },
  "4/1": { clickAmount: 2,    clickType: "Color", machineClickAmount: 2, sheetMultiplier: 2 },
  "4/4": { clickAmount: 2,    clickType: "Color", machineClickAmount: 2, sheetMultiplier: 2 },
  "1/0": { clickAmount: 0.25, clickType: "Color", machineClickAmount: 1, sheetMultiplier: 1 },
  "1/1": { clickAmount: 0.5,  clickType: "Color", machineClickAmount: 2, sheetMultiplier: 2 },
}

// ─── Markup Percentages ──────────────────────────────────
const MARKUP_PERCENTAGES: Record<string, Record<number, number>> = {
  "BW":          { 1: 15, 2: 8, 3: 4, 4: 3.5, 5: 3.13, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.9 },
  "Color Paper": { 1: 12, 2: 6, 3: 4, 4: 3.5, 5: 3, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.52 },
  "Color Card":  { 1: 12, 2: 6, 3: 4, 4: 3.4, 5: 3.15, 6: 2.95, 7: 2.5, 8: 2.2, 9: 2.05, 10: 1.52 },
}

// Binding price per book by sheet-thickness tier x quantity bracket
const BINDING_TABLE: { min: number; max: number; q1_10: number; q11_26: number; q26_100: number; q101_1000: number }[] = [
  { min: 5, max: 80, q1_10: 6.50, q11_26: 4.00, q26_100: 3.65, q101_1000: 3.25 },
  { min: 81, max: 100, q1_10: 7.50, q11_26: 4.25, q26_100: 3.95, q101_1000: 3.50 },
  { min: 101, max: 150, q1_10: 8.50, q11_26: 4.50, q26_100: 4.25, q101_1000: 3.75 },
  { min: 151, max: 200, q1_10: 10.00, q11_26: 5.50, q26_100: 4.75, q101_1000: 4.75 },
  { min: 201, max: 290, q1_10: 15.00, q11_26: 12.00, q26_100: 10.00, q101_1000: 10.00 },
]

// ─── Level Brackets (consistent with perfect-pricing) ────
const LEVEL_BRACKETS = [
  { level: 1, from: 1 }, { level: 2, from: 10 }, { level: 3, from: 100 },
  { level: 4, from: 250 }, { level: 5, from: 1000 }, { level: 6, from: 2000 },
  { level: 7, from: 3500 }, { level: 8, from: 5000 }, { level: 9, from: 100000 },
  { level: 10, from: 1000000 },
]

// Sheet dimensions lookup
const SHEET_DIMS: Record<string, { w: number; h: number }> = {
  "8.5x11": { w: 8.5, h: 11 },
  "11x17": { w: 11, h: 17 },
  "12x18": { w: 12, h: 18 },
  "12.5x19": { w: 12.5, h: 19 },
  "13x19": { w: 13, h: 19 },
}

// ─── Fallback Paper Options (for backward compatibility) ─
const SPIRAL_PAPER_OPTIONS: PaperOption[] = [
  // Inside papers
  { name: "20lb Offset",      isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18"] },
  { name: "60lb Offset",      isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18"] },
  { name: "80lb Text Gloss",  isCardstock: false, canLaminate: false, thickness: 0.004,   availableSizes: ["8.5x11", "11x17", "12x18"] },
  { name: "100lb Text Gloss", isCardstock: false, canLaminate: false, thickness: 0.004,   availableSizes: ["8.5x11", "11x17", "12x18"] },
  // Cover papers
  { name: "10pt Gloss",       isCardstock: true,  canLaminate: true,  thickness: 0.010,   availableSizes: ["8.5x11", "11x17", "12x18"] },
  { name: "12pt Gloss",       isCardstock: true,  canLaminate: true,  thickness: 0.012,   availableSizes: ["8.5x11", "11x17", "12x18"] },
  { name: "14pt Gloss",       isCardstock: true,  canLaminate: true,  thickness: 0.014,   availableSizes: ["8.5x11", "11x17", "12x18"] },
  { name: "14pt Offset",      isCardstock: true,  canLaminate: true,  thickness: 0.014,   availableSizes: ["8.5x11", "11x17", "12x18"] },
  { name: "67 Cover (White)", isCardstock: true,  canLaminate: true,  thickness: 0.009,   availableSizes: ["8.5x11", "11x17", "12x18"] },
  { name: "80 Cover Gloss",   isCardstock: true,  canLaminate: true,  thickness: 0.011,   availableSizes: ["8.5x11", "11x17", "12x18"] },
]

// ─── Fallback Paper Prices ───────────────────────────────
const PAPER_PRICES: Record<string, Record<string, number>> = {
  // Inside papers
  "20lb Offset":      { "8.5x11": 0.0092, "11x17": 0.0174, "12x18": 0.0293 },
  "60lb Offset":      { "8.5x11": 0.015, "11x17": 0.0295, "12x18": 0.0346 },
  "80lb Text Gloss":  { "8.5x11": 0.025, "11x17": 0.049, "12x18": 0.049 },
  "100lb Text Gloss": { "8.5x11": 0.03, "11x17": 0.0565, "12x18": 0.0565 },
  // Cover papers
  "10pt Gloss":       { "8.5x11": 0.054, "11x17": 0.102, "12x18": 0.102 },
  "12pt Gloss":       { "8.5x11": 0.063, "11x17": 0.118, "12x18": 0.118 },
  "14pt Gloss":       { "8.5x11": 0.068, "11x17": 0.128, "12x18": 0.128 },
  "14pt Offset":      { "8.5x11": 0.065, "11x17": 0.122, "12x18": 0.122 },
  "67 Cover (White)": { "8.5x11": 0.032, "11x17": 0.063, "12x18": 0.063 },
  "80 Cover Gloss":   { "8.5x11": 0.045, "11x17": 0.085, "12x18": 0.085 },
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
  const markups = getActiveConfig().markups
  return markups[cat]?.[level] || MARKUP_PERCENTAGES[cat]?.[level] || 1
}

// ─── Dynamic Paper Options (from database) ───────────────
export function getSpiralPaperOptions(type: "inside" | "cover", paperLookup?: Record<string, PaperOption>): PaperOption[] {
  // Try database first via paperLookup passed from context
  if (paperLookup) {
    return Object.values(paperLookup).filter(p => 
      type === "cover" ? p.isCardstock : !p.isCardstock
    )
  }
  // Try dynamic options from pricing config
  const dynamic = type === "cover" 
    ? getDynamicPaperOptions("bookCover")
    : getDynamicPaperOptions("bookInside")
  if (dynamic.length > 0) return dynamic
  // Fall back to hardcoded
  return SPIRAL_PAPER_OPTIONS.filter(p => type === "cover" ? p.isCardstock : !p.isCardstock)
}

// Get paper data by name (from database first, then fallback)
function getPaperData(paperName: string, paperLookup?: Record<string, PaperOption>): PaperOption | undefined {
  // Try database lookup first
  if (paperLookup?.[paperName]) return paperLookup[paperName]
  // Try dynamic options
  const coverDynamic = getDynamicPaperOptions("bookCover")
  const insideDynamic = getDynamicPaperOptions("bookInside")
  const allDynamic = [...coverDynamic, ...insideDynamic]
  const dynamic = allDynamic.find(p => p.name === paperName)
  if (dynamic) return dynamic
  // Fall back to hardcoded
  return SPIRAL_PAPER_OPTIONS.find(p => p.name === paperName)
}

// ─── Public helpers ──────────────────────────────────────
export function getPaperNames(paperLookup?: Record<string, PaperOption>): string[] {
  if (paperLookup) {
    return Object.keys(paperLookup).sort((a, b) => {
      const aNum = parseInt(a, 10) || 0
      const bNum = parseInt(b, 10) || 0
      if (aNum !== bNum) return aNum - bNum
      return a.localeCompare(b)
    })
  }
  return SPIRAL_PAPER_OPTIONS.map(p => p.name)
}

export function getAvailableSizes(paperName: string, paperLookup?: Record<string, PaperOption>): string[] {
  const paper = getPaperData(paperName, paperLookup)
  return paper?.availableSizes || ["8.5x11", "11x17", "12x18"]
}

export function getAvailableSides(paperName: string, sizeId?: string, paperLookup?: Record<string, PaperOption>): string[] {
  // For now return all standard sides - can be refined later based on paper type
  const paper = getPaperData(paperName, paperLookup)
  if (paper?.isCardstock) {
    return ["4/0", "4/4", "1/0", "1/1"]
  }
  return ["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]
}

export function getPaperType(paperName: string, paperLookup?: Record<string, PaperOption>): string {
  const paper = getPaperData(paperName, paperLookup)
  return paper?.isCardstock ? "cover" : "paper"
}

// ─── Binding price lookup ────────────────────────────────
export function getBindingPrice(sheetsPerBook: number, bookQty: number): number {
  if (sheetsPerBook <= 0) return 0
  let tier = BINDING_TABLE.find((t) => sheetsPerBook >= t.min && sheetsPerBook <= t.max)
  if (!tier && sheetsPerBook < BINDING_TABLE[0].min) tier = BINDING_TABLE[0]
  if (!tier) return 0
  if (bookQty <= 10) return tier.q1_10
  if (bookQty <= 26) return tier.q11_26
  if (bookQty <= 100) return tier.q26_100
  return tier.q101_1000
}

// ─── Sheet layout (how many pages fit on one sheet) ──────
export function calculateLayout(sheetW: number, sheetH: number, pageW: number, pageH: number, hasBleed: boolean): { maxUps: number; isRotated: boolean } {
  const gutter = hasBleed ? GUTTER_AMOUNT : 0
  const bleedTotal = hasBleed ? BLEED_MARGIN * 2 : 0
  const pW = sheetW - bleedTotal
  const pH = sheetH - bleedTotal
  if (pW < 0 || pH < 0) return { maxUps: 0, isRotated: false }
  const fit = (area: number, item: number, g: number) => (item > area + EPSILON) ? 0 : 1 + Math.floor(((area - item) / (item + g)) + EPSILON)
  const portrait = fit(pW, pageW, gutter) * fit(pH, pageH, gutter)
  const landscape = fit(pW, pageH, gutter) * fit(pH, pageW, gutter)
  return { maxUps: Math.max(portrait, landscape), isRotated: landscape > portrait }
}

// ─── Calculate a single part ─────────────────────────────
export function calculatePart(
  partName: string,
  bookQty: number,
  pageWidth: number,
  pageHeight: number,
  sheetsPerPart: number,
  part: SpiralPartInputs,
  forcedLevel?: string,
  paperLookup?: Record<string, PaperOption>,
): SpiralPartResult | { error: string } | null {
  const { paperName, sheetSize, sides, hasBleed } = part
  if (!paperName || !sheetSize || !sides) {
    if (partName === "inside") return { error: `Please fill out the '${partName} pages' section completely.` }
    return null
  }

  // Get paper data from database first, then fallback to hardcoded catalog
  const paperData = getPaperData(paperName, paperLookup)
  const cfg = getActiveConfig()

  let finalW: number, finalH: number, maxUps: number, isRotated: boolean, finalSizeId: string
  let paperCostPerSheet = 0
  let clickCostPerSheet = 0

  if (sheetSize === "cheapest") {
    // Use database paper sizes if available, otherwise use catalog
    const availableSizes = paperData?.availableSizes || ["8.5x11", "11x17", "12x18"]
    let best: { name: string; w: number; h: number; maxUps: number; isRotated: boolean; totalSheets: number; paperCost: number; clickCost: number } | null = null
    
    for (const sizeId of availableSizes) {
      const dim = SHEET_DIMS[sizeId]
      if (!dim) continue
      
      // Get paper price from database first, then config, then hardcoded
      const pCost = paperData?.prices?.[sizeId] ?? cfg.bookletPaperPrices[paperName]?.[sizeId] ?? PAPER_PRICES[paperName]?.[sizeId] ?? 0
      if (pCost === 0) continue // Skip sizes without prices
      
      const layout = calculateLayout(dim.w, dim.h, pageWidth, pageHeight, hasBleed)
      if (layout.maxUps > 0) {
        const total = Math.ceil(bookQty / layout.maxUps) * sheetsPerPart
        
        // Calculate click cost
        const rule = SIDES_RULES[sides]
        const clickType = rule?.clickType || "BW"
        const clickAmt = rule?.clickAmount || 1
        const cCost = (CLICK_COSTS[clickType]?.regular || 0) * clickAmt
        
        const totalCost = (pCost + cCost) * total
        
        if (!best || totalCost < (best.paperCost + best.clickCost) * best.totalSheets) {
          best = { name: sizeId, w: dim.w, h: dim.h, maxUps: layout.maxUps, isRotated: layout.isRotated, totalSheets: total, paperCost: pCost, clickCost: cCost }
        }
      }
    }
    if (!best) return { error: `Page size too large for any available sheet for ${partName}.` }
    finalW = best.w; finalH = best.h; maxUps = best.maxUps; isRotated = best.isRotated; finalSizeId = best.name
    paperCostPerSheet = best.paperCost; clickCostPerSheet = best.clickCost
  } else {
    const dim = SHEET_DIMS[sheetSize]
    if (!dim) return { error: `Unknown sheet size: ${sheetSize}` }
    finalW = dim.w; finalH = dim.h; finalSizeId = sheetSize
    const layout = calculateLayout(finalW, finalH, pageWidth, pageHeight, hasBleed)
    maxUps = layout.maxUps; isRotated = layout.isRotated
    
    // Calculate paper and click costs for specific size selection
    paperCostPerSheet = paperData?.prices?.[sheetSize] ?? cfg.bookletPaperPrices[paperName]?.[sheetSize] ?? PAPER_PRICES[paperName]?.[sheetSize] ?? 0
    const rule = SIDES_RULES[sides]
    const clickType = rule?.clickType || "BW"
    const clickAmt = rule?.clickAmount || 1
    clickCostPerSheet = (CLICK_COSTS[clickType]?.regular || 0) * clickAmt
  }

  if (maxUps === 0) return { error: `Page size too large for selected sheet for ${partName}.` }

  const totalSheets = Math.ceil(bookQty / maxUps) * sheetsPerPart
  
  // Calculate level and markup
  const autoLevel = getLevel(totalSheets)
  const level = forcedLevel ? parseInt(forcedLevel.replace("Level ", ""), 10) : autoLevel
  const isCardstock = paperData?.isCardstock ?? false
  const markup = getMarkup(level, sides, isCardstock)
  
  // Final price per sheet = (paper + click) * markup
  const pricePerSheet = (paperCostPerSheet + clickCostPerSheet) * markup

  return {
    name: partName,
    cost: pricePerSheet * totalSheets,
    sheets: totalSheets,
    sheetSize: finalSizeId,
    paper: paperName,
    sides,
    bleed: hasBleed,
    isRotated,
    finalSheetWidth: finalW,
    finalSheetHeight: finalH,
    maxUps,
    pricePerSheet,
    levelName: `Level ${level}`,
    autoLevelName: `Level ${autoLevel}`,
    // P/L cost breakdown - now using dynamic pricing
    paperCostPerSheet,
    clickCostPerSheet,
    totalPaperCost: paperCostPerSheet * totalSheets,
    totalClickCost: clickCostPerSheet * totalSheets,
  }
}

// ─── Main entry point ─────────────────────────────────────
export function calculateSpiral(inputs: SpiralInputs, paperLookup?: Record<string, PaperOption>): SpiralCalcResult | { error: string } {
  const { bookQty, pagesPerBook, pageWidth, pageHeight } = inputs
  if (!bookQty || !pagesPerBook || !pageWidth || !pageHeight) {
    return { error: "Please fill in all fields." }
  }

  const isDS = ["D/S", "4/4", "1/1"].includes(inputs.inside.sides)
  const sidesMultiplier = isDS ? 2 : 1
  const sheetsPerBook = Math.ceil(pagesPerBook / sidesMultiplier)

  if (sheetsPerBook > 290) {
    return { error: `Inside pages require ${sheetsPerBook} sheets -- too thick to bind (max 290).` }
  }

  // Determine level override: explicit custom > broker default > auto
  const userLevel = inputs.customLevel !== "auto" ? inputs.customLevel : inputs.isBroker ? "Level 10" : undefined

  const insideResult = calculatePart("inside", bookQty, pageWidth, pageHeight, sheetsPerBook, inputs.inside, userLevel, paperLookup)
  if (!insideResult || "error" in insideResult) return { error: (insideResult as { error: string })?.error || "Inside calculation failed." }

  const forcedLevel = insideResult.levelName

  let frontResult: SpiralPartResult | null = null
  if (inputs.useFrontCover) {
    const fr = calculatePart("front", bookQty, pageWidth, pageHeight, 1, inputs.front, forcedLevel, paperLookup)
    if (fr && "error" in fr) return { error: fr.error }
    frontResult = fr as SpiralPartResult | null
  }

  let backResult: SpiralPartResult | null = null
  if (inputs.useBackCover) {
    const br = calculatePart("back", bookQty, pageWidth, pageHeight, 1, inputs.back, forcedLevel, paperLookup)
    if (br && "error" in br) return { error: br.error }
    backResult = br as SpiralPartResult | null
  }

  let totalPrinting = insideResult.cost
  if (frontResult) totalPrinting += frontResult.cost
  if (backResult) totalPrinting += backResult.cost

  const bindingPerBook = getBindingPrice(sheetsPerBook, bookQty)
  const totalBinding = bindingPerBook * bookQty

  const extraPerBook = (inputs.clearPlastic ? EXTRA_COVER_PRICES.plastic : 0) + (inputs.blackVinyl ? EXTRA_COVER_PRICES.vinyl : 0)
  const totalExtras = extraPerBook * bookQty

  const grandTotal = Math.ceil(totalPrinting + totalBinding + totalExtras)

  return {
    insideResult,
    frontResult,
    backResult,
    sheetsPerBook,
    totalPrintingCost: totalPrinting,
    bindingPricePerBook: bindingPerBook,
    totalBindingPrice: totalBinding,
    extraCoversCostPerBook: extraPerBook,
    totalExtrasCost: totalExtras,
    grandTotal,
    pricePerBook: bookQty > 0 ? grandTotal / bookQty : 0,
    levelName: insideResult.levelName,
    autoLevelName: insideResult.autoLevelName,
    hasClearPlastic: inputs.clearPlastic,
    hasBlackVinyl: inputs.blackVinyl,
    bookQty,
    pagesPerBook,
    pageWidth,
    pageHeight,
  }
}

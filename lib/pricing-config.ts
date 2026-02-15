/**
 * Shared pricing configuration for both Flat Printing and Saddle Stitch calculators.
 *
 * Default values are hardcoded here. They can be overridden at runtime by loading
 * overrides from app_settings (keys: pricing_click_costs, pricing_paper_prices,
 * pricing_booklet_paper_prices, pricing_markups).
 *
 * The calculation logic in printing-pricing.ts and booklet-pricing.ts is NOT
 * touched -- only the data constants they read are swapped to come from here.
 */

// ==================== CLICK COSTS ====================

export interface ClickCostEntry {
  regular: number
  machine: number
}

export const DEFAULT_CLICK_COSTS: Record<string, ClickCostEntry> = {
  BW: { regular: 0.0039, machine: 0.00365 },
  Color: { regular: 0.049, machine: 0.0087 },
}

// ==================== FLAT PAPER PRICES ====================

export const DEFAULT_PAPER_PRICES: Record<string, Record<string, number>> = {
  "20lb Offset": { "8.5x11": 0.0078, "11x17": 0.0174, "12x18": 0.0293, "12.5x19": 0.0277 },
  "60lb Offset": { "8.5x11": 0.015, "11x17": 0.0295, "12x18": 0.0346, "12.5x19": 0.032 },
  "80lb Text Gloss": { "8.5x11": 0.025, "11x17": 0.049, "12x18": 0.046, "13x19": 0.0615 },
  "100lb Text Gloss": { "8.5x11": 0.03, "11x17": 0.0565, "12x18": 0.0565, "13x19": 0.0653 },
  "67 Cover (White)": { "8.5x11": 0.032, "11x17": 0.063 },
  "80 Cover Gloss": { "8.5x11": 0.05795, "11x17": 0.1159, "12x18": 0.1159, "13x19": 0.1159 },
  "10pt Offset": { "8.5x11": 0.0578, "11x17": 0.113, "12x18": 0.113, "13x19": 0.113 },
  "10pt Gloss": { "8.5x11": 0.06605, "11x17": 0.1321, "12x18": 0.1321, "13x19": 0.1321 },
  "12pt Gloss": { "8.5x11": 0.0745, "11x17": 0.149, "12x18": 0.149, "13x19": 0.149 },
  "14pt Gloss": { "8.5x11": 0.09455, "11x17": 0.1891, "12x18": 0.1891, "13x19": 0.1891 },
  "Sticker (Crack & Peel)": { "8.5x11": 0.187, "11x17": 0.373, "12x18": 0.373, "13x19": 0.373 },
}

// ==================== BOOKLET PAPER PRICES ====================

export const DEFAULT_BOOKLET_PAPER_PRICES: Record<string, Record<string, number>> = {
  "80 Gloss": { "11x17": 0.1159, "12x18": 0.1159, "13x19": 0.1159 },
  "80 Matte": { "8.5x11": 0.052, "11x17": 0.1138, "12x18": 0.1138, "13x19": 0.1138 },
  "10pt Offset": { "8.5x11": 0.0578, "11x17": 0.1130, "12x18": 0.1130, "13x19": 0.1130 },
  "10pt Gloss": { "11x17": 0.1321, "12x18": 0.1321, "13x19": 0.1321 },
  "10pt Matte": { "11x17": 0.1272, "12x18": 0.1272, "13x19": 0.1272 },
  "12pt Gloss": { "11x17": 0.1490, "12x18": 0.1490, "13x19": 0.1490 },
  "12pt Matte": { "11x17": 0.1601, "12x18": 0.1601, "13x19": 0.1601 },
  "20lb Offset": { "8.5x11": 0.0092, "11x17": 0.0174, "12x18": 0.0293, "12.5x19": 0.0270, "Short 11x17": 0.0184 },
  "60lb Offset": { "8.5x11": 0.015, "11x17": 0.0295, "12x18": 0.0346, "12.5x19": 0.0320, "Short 12x18": 0.0360, "Short 12.5x19": 0.0410 },
  "80lb Text Gloss": { "8.5x11": 0.025, "11x17": 0.0490, "12x18": 0.0490, "13x19": 0.0615, "Short 11x17": 0.0523, "Short 12x18": 0.0523 },
  "100lb Text Gloss": { "8.5x11": 0.03, "11x17": 0.0565, "12x18": 0.0565, "13x19": 0.0653, "Short 11x17": 0.0675, "Short 12x18": 0.0675 },
}

// ==================== MARKUP PERCENTAGES ====================

export const DEFAULT_MARKUPS: Record<string, Record<number, number>> = {
  BW: { 1: 15, 2: 8, 3: 4, 4: 3.5, 5: 3.13, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.9 },
  "Color Paper": { 1: 12, 2: 6, 3: 4, 4: 3.5, 5: 3, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.52 },
  "Color Card": { 1: 12, 2: 6, 3: 4, 4: 3.4, 5: 3.15, 6: 2.95, 7: 2.5, 8: 2.2, 9: 2.05, 10: 1.52 },
}

// ==================== FINISHING OPTIONS ====================

/**
 * Each finishing option describes a process applied per parent sheet (the big
 * printer sheet, not the cut piece).  For saddle stitch, lamination is applied
 * to the cover sheets.  For flat, it is applied to each parent sheet.
 *
 * Cost model:
 *   baseCost  = setupCost + sheets * runtimeCostPerSheet + sheets * rollCostPerSheet + rollChangeFee
 *   sheets    = max(quantity, minSheets) * (1 + wastePercent)
 *   sell      = baseCost * (1 + markupPercent/100)  [broker gets brokerDiscountPercent off]
 *   final     = max(sell, minimumJobPrice)
 */
export interface FinishingOption {
  id: string                   // e.g. "gloss_lamination"
  name: string                 // display name: "Gloss Lamination"
  category: "lamination" | "finishing"
  setupCost: number
  /** Per-sheet runtime cost by paper weight category */
  runtimeCosts: Record<string, Record<string, number>>
  rollCostPerSheet: number
  rollChangeFee: number
  wastePercent: number
  minSheets: number
  markupPercent: number
  brokerDiscountPercent: number
  minimumJobPrice: number
  /** If true, it shrinks the printable area by 0.15" on the short side */
  reducesSheetArea: boolean
}

export const DEFAULT_FINISHING_OPTIONS: FinishingOption[] = [
  {
    id: "gloss_lamination",
    name: "Gloss Lamination",
    category: "lamination",
    setupCost: 10,
    runtimeCosts: { "80Cover": { default: 0.0667 }, Cardstock: { default: 0.025 } },
    rollCostPerSheet: 0.1058,
    rollChangeFee: 0,
    wastePercent: 0.05,
    minSheets: 5,
    markupPercent: 225,
    brokerDiscountPercent: 30,
    minimumJobPrice: 45,
    reducesSheetArea: true,
  },
  {
    id: "matte_lamination",
    name: "Matte Lamination",
    category: "lamination",
    setupCost: 10,
    runtimeCosts: { "80Cover": { default: 0.0667 }, Cardstock: { default: 0.025 } },
    rollCostPerSheet: 0.1045,
    rollChangeFee: 10,
    wastePercent: 0.05,
    minSheets: 5,
    markupPercent: 225,
    brokerDiscountPercent: 30,
    minimumJobPrice: 45,
    reducesSheetArea: true,
  },
  {
    id: "silk_lamination",
    name: "Silk Lamination",
    category: "lamination",
    setupCost: 10,
    runtimeCosts: { "80Cover": { Silk: 0.1333, default: 0.1333 }, Cardstock: { Silk: 0.05, default: 0.05 } },
    rollCostPerSheet: 0.1009,
    rollChangeFee: 10,
    wastePercent: 0.10,
    minSheets: 10,
    markupPercent: 225,
    brokerDiscountPercent: 30,
    minimumJobPrice: 45,
    reducesSheetArea: true,
  },
  {
    id: "leather_lamination",
    name: "Leather Lamination",
    category: "lamination",
    setupCost: 10,
    runtimeCosts: { "80Cover": { default: 0.0667 }, Cardstock: { default: 0.025 } },
    rollCostPerSheet: 0.1045,
    rollChangeFee: 10,
    wastePercent: 0.05,
    minSheets: 5,
    markupPercent: 225,
    brokerDiscountPercent: 30,
    minimumJobPrice: 45,
    reducesSheetArea: true,
  },
]

// ==================== RUNTIME CONFIG ====================

export interface PricingConfig {
  clickCosts: Record<string, ClickCostEntry>
  paperPrices: Record<string, Record<string, number>>
  bookletPaperPrices: Record<string, Record<string, number>>
  markups: Record<string, Record<number, number>>
  finishings: FinishingOption[]
}

/** The active runtime config. Starts as defaults, gets merged with DB overrides. */
let _activeConfig: PricingConfig = {
  clickCosts: { ...DEFAULT_CLICK_COSTS },
  paperPrices: deepClonePrices(DEFAULT_PAPER_PRICES),
  bookletPaperPrices: deepClonePrices(DEFAULT_BOOKLET_PAPER_PRICES),
  markups: deepCloneMarkups(DEFAULT_MARKUPS),
  finishings: structuredClone(DEFAULT_FINISHING_OPTIONS),
}

export function getActiveConfig(): PricingConfig {
  return _activeConfig
}

/**
 * Merge DB overrides into the active config. Only provided keys are overridden;
 * everything else stays at default. Called once when the app loads settings.
 */
export function applyOverrides(overrides: Partial<{
  pricing_click_costs: Record<string, ClickCostEntry>
  pricing_paper_prices: Record<string, Record<string, number>>
  pricing_booklet_paper_prices: Record<string, Record<string, number>>
  pricing_markups: Record<string, Record<number, number>>
  pricing_finishings: FinishingOption[]
}>) {
  _activeConfig = {
    clickCosts: overrides.pricing_click_costs
      ? deepMerge(deepCloneClickCosts(DEFAULT_CLICK_COSTS), overrides.pricing_click_costs)
      : deepCloneClickCosts(DEFAULT_CLICK_COSTS),
    paperPrices: overrides.pricing_paper_prices
      ? deepMerge(deepClonePrices(DEFAULT_PAPER_PRICES), overrides.pricing_paper_prices)
      : deepClonePrices(DEFAULT_PAPER_PRICES),
    bookletPaperPrices: overrides.pricing_booklet_paper_prices
      ? deepMerge(deepClonePrices(DEFAULT_BOOKLET_PAPER_PRICES), overrides.pricing_booklet_paper_prices)
      : deepClonePrices(DEFAULT_BOOKLET_PAPER_PRICES),
    markups: overrides.pricing_markups
      ? deepMerge(deepCloneMarkups(DEFAULT_MARKUPS), overrides.pricing_markups)
      : deepCloneMarkups(DEFAULT_MARKUPS),
    finishings: overrides.pricing_finishings
      ? structuredClone(overrides.pricing_finishings)
      : structuredClone(DEFAULT_FINISHING_OPTIONS),
  }
}

/** Calculate the cost of a single finishing applied to a given number of parent sheets. */
export function calculateFinishingCost(
  finishing: FinishingOption,
  paperName: string,
  parentSheets: number,
  isBroker: boolean,
): number {
  if (parentSheets <= 0) return 0

  // Determine paper category
  const category = paperName.toLowerCase().includes("80") ? "80Cover" : "Cardstock"
  const catCosts = finishing.runtimeCosts[category] || finishing.runtimeCosts["Cardstock"] || {}
  const runtimeCostPerSheet = catCosts[finishing.name] || catCosts["default"] || Object.values(catCosts)[0] || 0

  const sheets = Math.max(parentSheets, finishing.minSheets)
  const sheetsWithWaste = sheets * (1 + finishing.wastePercent)
  const totalBaseCost = finishing.setupCost + sheetsWithWaste * runtimeCostPerSheet + sheetsWithWaste * finishing.rollCostPerSheet + finishing.rollChangeFee

  let effectiveMarkup = finishing.markupPercent
  if (isBroker) effectiveMarkup *= (1 - finishing.brokerDiscountPercent / 100)
  const totalWithMarkup = totalBaseCost * (1 + effectiveMarkup / 100)
  return Math.max(totalWithMarkup, finishing.minimumJobPrice)
}

// ==================== DEEP CLONE / MERGE HELPERS ====================

function deepClonePrices(obj: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const [k, v] of Object.entries(obj)) out[k] = { ...v }
  return out
}

function deepCloneClickCosts(obj: Record<string, ClickCostEntry>): Record<string, ClickCostEntry> {
  const out: Record<string, ClickCostEntry> = {}
  for (const [k, v] of Object.entries(obj)) out[k] = { ...v }
  return out
}

function deepCloneMarkups(obj: Record<string, Record<number, number>>): Record<string, Record<number, number>> {
  const out: Record<string, Record<number, number>> = {}
  for (const [k, v] of Object.entries(obj)) out[k] = { ...v }
  return out
}

function deepMerge<T extends Record<string, unknown>>(base: T, overrides: Partial<T>): T {
  const result = { ...base }
  for (const [key, val] of Object.entries(overrides)) {
    if (val && typeof val === "object" && !Array.isArray(val) && typeof (result as Record<string, unknown>)[key] === "object") {
      (result as Record<string, unknown>)[key] = { ...(result as Record<string, unknown>)[key] as object, ...val }
    } else {
      (result as Record<string, unknown>)[key] = val
    }
  }
  return result
}

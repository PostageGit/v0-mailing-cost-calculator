/**
 * Shared pricing configuration for both Flat Printing and Saddle Stitch calculators.
 *
 * Default values are hardcoded here. They can be overridden at runtime by loading
 * overrides from app_settings (keys: pricing_click_costs, pricing_paper_prices,
 * pricing_booklet_paper_prices, pricing_markups, envelope_settings).
 *
 * The calculation logic in printing-pricing.ts and booklet-pricing.ts is NOT
 * touched -- only the data constants they read are swapped to come from here.
 */

import { type EnvelopeSettings, DEFAULT_ENVELOPE_SETTINGS } from "./envelope-pricing"

// ==================== CLICK COSTS ====================

export interface ClickCostEntry {
  regular: number
  machine: number
}

export const DEFAULT_CLICK_COSTS: Record<string, ClickCostEntry> = {
  BW: { regular: 0.0039, machine: 0.00365 },
  Color: { regular: 0.049, machine: 0.0087 },
}

// ==================== SHEET SIZE DEFINITIONS ====================

/** All regular (non-short) sheet sizes in display order */
export const ALL_REGULAR_SIZES = ["8.5x11", "11x17", "12x18", "12.5x19", "13x19", "13x26"] as const

/** All "Short" sheet sizes in display order */
export const ALL_SHORT_SIZES = ["Short 11x17", "Short 12x18", "Short 12.5x19"] as const

// ==================== FLAT PAPER PRICES ====================

export const DEFAULT_PAPER_PRICES: Record<string, Record<string, number>> = {
  "20lb Offset": { "8.5x11": 0.0078, "11x17": 0.0174, "12x18": 0.0293, "12.5x19": 0.0277 },
  "60lb Offset": { "8.5x11": 0.015, "11x17": 0.0295, "12x18": 0.0346, "12.5x19": 0.032 },
  "80lb Text Gloss": { "8.5x11": 0.025, "11x17": 0.049, "12x18": 0.046, "13x19": 0.0615 },
  "100lb Text Gloss": { "8.5x11": 0.03, "11x17": 0.0565, "12x18": 0.0565, "13x19": 0.0653 },
  "65 Cover (White)": { "8.5x11": 0.032, "11x17": 0.063 },
  "67 Cover (White)": { "8.5x11": 0.032, "11x17": 0.063 },
  "67 Cover (Off-White)": { "8.5x11": 0.032, "11x17": 0.063 },
  "80 Cover Gloss": { "8.5x11": 0.05795, "11x17": 0.1159, "12x18": 0.1159, "13x19": 0.1159 },
  "10pt Offset": { "8.5x11": 0.0578, "11x17": 0.113, "12x18": 0.113, "13x19": 0.113 },
  "10pt Gloss": { "8.5x11": 0.06605, "11x17": 0.1321, "12x18": 0.1321, "13x19": 0.1321 },
  "12pt Gloss": { "8.5x11": 0.0745, "11x17": 0.149, "12x18": 0.149, "13x19": 0.149, "13x26": 0.447 },
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
  "12pt Gloss": { "11x17": 0.1490, "12x18": 0.1490, "13x19": 0.1490, "13x26": 0.4470 },
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
  *   sell      = baseCost * (markupPercent/100)  [broker gets brokerDiscountPercent off]
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

// ==================== SCORE & FOLD (per-piece finishing) ====================

export interface ScoreFoldEntry {
  setup: string   // "Level 1" - "Level 5", "N/A", or "hand fold"
  runtime: number // minutes per 100 pieces
}

export interface ScoreFoldConfig {
  setupLevels: Record<string, number>  // level name -> minutes
  setupCostPerHour: number
  machineChargePerHour: number
  runtimeCostPerHour: number
  markupPercent: number
  minimumJobPrice: number
  brokerDiscountPercent: number
  /** operation -> paperType -> size -> foldType -> entry */
  data: Record<string, Record<string, Record<string, Record<string, ScoreFoldEntry>>>>
}

export const DEFAULT_SCORE_FOLD_CONFIG: ScoreFoldConfig = {
  setupLevels: { "Level 1": 15, "Level 2": 17, "Level 3": 20, "Level 4": 22, "Level 5": 25 },
  setupCostPerHour: 60,
  machineChargePerHour: 5,
  runtimeCostPerHour: 30,
  markupPercent: 250,
  minimumJobPrice: 50,
  brokerDiscountPercent: 30,
  data: {
    folding: {
      "80text": {
        "11x17":   { foldInHalf: { setup: "Level 3", runtime: 40/60 }, foldIn3: { setup: "Level 3", runtime: 45/60 }, foldIn4: { setup: "Level 5", runtime: 120/60 }, gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x11":  { foldInHalf: { setup: "Level 3", runtime: 30/60 }, foldIn3: { setup: "Level 3", runtime: 35/60 }, foldIn4: { setup: "Level 5", runtime: 0 },      gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x5.5": { foldInHalf: { setup: "Level 3", runtime: 25/60 }, foldIn3: { setup: "Level 4", runtime: 0 },     foldIn4: { setup: "hand fold", runtime: 0 },    gateFold: { setup: "Level 5", runtime: 0 } },
      },
      "100text": {
        "11x17":   { foldInHalf: { setup: "Level 2", runtime: 40/60 }, foldIn3: { setup: "Level 3", runtime: 45/60 }, foldIn4: { setup: "Level 5", runtime: 120/60 }, gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x11":  { foldInHalf: { setup: "Level 2", runtime: 30/60 }, foldIn3: { setup: "Level 3", runtime: 35/60 }, foldIn4: { setup: "Level 5", runtime: 0 },      gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x5.5": { foldInHalf: { setup: "Level 2", runtime: 25/60 }, foldIn3: { setup: "Level 4", runtime: 0 },     foldIn4: { setup: "hand fold", runtime: 0 },    gateFold: { setup: "Level 5", runtime: 0 } },
      },
      cardstock: {
        "11x17":   { foldInHalf: { setup: "N/A", runtime: 0 }, foldIn3: { setup: "N/A", runtime: 0 }, foldIn4: { setup: "N/A", runtime: 0 }, gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x11":  { foldInHalf: { setup: "N/A", runtime: 0 }, foldIn3: { setup: "N/A", runtime: 0 }, foldIn4: { setup: "N/A", runtime: 0 }, gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x5.5": { foldInHalf: { setup: "N/A", runtime: 0 }, foldIn3: { setup: "N/A", runtime: 0 }, foldIn4: { setup: "N/A", runtime: 0 }, gateFold: { setup: "N/A", runtime: 0 } },
      },
    },
    scoring: {
      "80text": {
        "11x17":   { foldInHalf: { setup: "N/A", runtime: 0 }, foldIn3: { setup: "N/A", runtime: 0 }, foldIn4: { setup: "N/A", runtime: 0 }, gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x11":  { foldInHalf: { setup: "N/A", runtime: 0 }, foldIn3: { setup: "N/A", runtime: 0 }, foldIn4: { setup: "N/A", runtime: 0 }, gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x5.5": { foldInHalf: { setup: "N/A", runtime: 0 }, foldIn3: { setup: "N/A", runtime: 0 }, foldIn4: { setup: "N/A", runtime: 0 }, gateFold: { setup: "N/A", runtime: 0 } },
      },
      "100text": {
        "11x17":   { foldInHalf: { setup: "Level 2", runtime: 215/60 }, foldIn3: { setup: "Level 3", runtime: 225/60 }, foldIn4: { setup: "hand fold", runtime: 0 }, gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x11":  { foldInHalf: { setup: "Level 2", runtime: 260/60 }, foldIn3: { setup: "Level 3", runtime: 260/60 }, foldIn4: { setup: "hand fold", runtime: 0 }, gateFold: { setup: "N/A", runtime: 0 } },
        "8.5x5.5": { foldInHalf: { setup: "Level 3", runtime: 120/60 }, foldIn3: { setup: "Level 4", runtime: 140/60 }, foldIn4: { setup: "hand fold", runtime: 0 }, gateFold: { setup: "Level 5", runtime: 0 } },
      },
      cardstock: {
        "11x17":   { foldInHalf: { setup: "Level 1", runtime: 155/60 }, foldIn3: { setup: "Level 2", runtime: 225/60 }, foldIn4: { setup: "hand fold", runtime: 0 }, gateFold: { setup: "Level 4", runtime: 240/60 } },
        "8.5x11":  { foldInHalf: { setup: "Level 1", runtime: 140/60 }, foldIn3: { setup: "Level 4", runtime: 200/60 }, foldIn4: { setup: "Level 4", runtime: 0 },    gateFold: { setup: "Level 4", runtime: 0 } },
        "8.5x5.5": { foldInHalf: { setup: "Level 2", runtime: 120/60 }, foldIn3: { setup: "Level 3", runtime: 0 },      foldIn4: { setup: "hand fold", runtime: 0 }, gateFold: { setup: "Level 4", runtime: 0 } },
      },
    },
  },
}

/** Map flat printing paper names to score-fold paper categories */
export function mapPaperToScoreFoldCategory(paperName: string): string | null {
  const lower = paperName.toLowerCase()
  // 80 text / 60lb offset
  if (lower.includes("80lb text") || lower.includes("80 text") || lower.includes("60lb") || lower.includes("20lb")) return "80text"
  if (lower.includes("100lb text") || lower.includes("100 text")) return "100text"
  // Everything with "cover", "pt", "card" is cardstock
  if (lower.includes("cover") || lower.includes("pt") || lower.includes("card") || lower.includes("sticker")) return "cardstock"
  return null
}

/** Map the user's cut-piece dimensions (width x height) to a standard fold size */
export function mapDimensionsToFoldSize(w: number, h: number): string | null {
  const [short, long] = w < h ? [w, h] : [h, w]
  // Check with 0.25" tolerance for bleed
  const t = 0.25
  if (Math.abs(short - 11) <= t && Math.abs(long - 17) <= t) return "11x17"
  if (Math.abs(short - 8.5) <= t && Math.abs(long - 11) <= t) return "8.5x11"
  if (Math.abs(short - 5.5) <= t && Math.abs(long - 8.5) <= t) return "8.5x5.5"
  return null
}

export type ScoreFoldValidation =
  | { valid: true }
  | { valid: false; reason: "no_paper_match" | "no_size_match" | "not_available" | "hand_fold" | "zero_runtime"; message: string }

/** Validate whether a score-fold combo is possible */
export function validateScoreFold(
  operation: string,
  paperName: string,
  width: number,
  height: number,
  foldType: string,
): ScoreFoldValidation {
  const paperCat = mapPaperToScoreFoldCategory(paperName)
  if (!paperCat) return { valid: false, reason: "no_paper_match", message: `Paper "${paperName}" doesn't map to a foldable category.` }

  const foldSize = mapDimensionsToFoldSize(width, height)
  if (!foldSize) return { valid: false, reason: "no_size_match", message: `Size ${width}" x ${height}" doesn't match a standard fold size (11x17, 8.5x11, or 8.5x5.5).` }

  const cfg = getActiveConfig().scoreFold
  const entry = cfg.data[operation]?.[paperCat]?.[foldSize]?.[foldType]
  if (!entry || entry.setup === "N/A") {
    if (operation === "folding" && paperCat === "cardstock") {
      return { valid: false, reason: "not_available", message: "Cardstock cannot be folded directly. Use Score and Fold instead." }
    }
    if (operation === "scoring" && paperCat === "80text") {
      return { valid: false, reason: "not_available", message: "80 Text doesn't need scoring -- it's thin enough to fold directly. Switch to Folding." }
    }
    return { valid: false, reason: "not_available", message: `${operation === "folding" ? "Folding" : "Score & Fold"} is not available for ${paperCat} at ${foldSize} with this fold type.` }
  }
  if (entry.setup === "hand fold") {
    return { valid: false, reason: "hand_fold", message: "This combination requires hand folding (no machine support). Contact for manual quote." }
  }
  if (entry.runtime === 0) {
    return { valid: false, reason: "zero_runtime", message: "Machine runtime is zero for this combination. It may not be fully supported." }
  }
  return { valid: true }
}

/** Calculate score-fold cost for a given piece quantity */
export function calculateScoreFoldCost(
  operation: string,
  foldType: string,
  paperName: string,
  width: number,
  height: number,
  quantity: number,
  isBroker: boolean,
): { cost: number; isMinApplied: boolean; suggestion?: string } | null {
  const paperCat = mapPaperToScoreFoldCategory(paperName)
  const foldSize = mapDimensionsToFoldSize(width, height)
  if (!paperCat || !foldSize) return null

  const cfg = getActiveConfig().scoreFold
  const entry = cfg.data[operation]?.[paperCat]?.[foldSize]?.[foldType]
  if (!entry || entry.setup === "N/A" || entry.setup === "hand fold") return null

  const setupTime = cfg.setupLevels[entry.setup] || 20
  const setupCost = (setupTime / 60) * cfg.setupCostPerHour
  const baseRuntime = (quantity / 100) * entry.runtime
  const totalRuntime = baseRuntime + 5
  const runtimeCost = (totalRuntime / 60) * cfg.runtimeCostPerHour
  const machineCharge = (totalRuntime / 60) * cfg.machineChargePerHour
  const totalBeforeMarkup = setupCost + runtimeCost + machineCharge
  let finalCost = totalBeforeMarkup * (1 + cfg.markupPercent / 100)

  if (isBroker) finalCost *= (1 - cfg.brokerDiscountPercent / 100)

  const isMinApplied = finalCost < cfg.minimumJobPrice
  finalCost = Math.max(finalCost, cfg.minimumJobPrice)

  // Check if the alternative operation would be cheaper
  let suggestion: string | undefined
  const altOp = operation === "folding" ? "scoring" : "folding"
  const altPaper = operation === "folding" ? "100text" : "80text"
  const altEntry = cfg.data[altOp]?.[altPaper]?.[foldSize]?.[foldType]
  if (altEntry && altEntry.setup !== "N/A" && altEntry.setup !== "hand fold" && altEntry.runtime > 0) {
    const altSetup = cfg.setupLevels[altEntry.setup] || 20
    const altSetupCost = (altSetup / 60) * cfg.setupCostPerHour
    const altBaseRt = (quantity / 100) * altEntry.runtime
    const altTotalRt = altBaseRt + 5
    const altRuntimeCost = (altTotalRt / 60) * cfg.runtimeCostPerHour
    const altMachine = (altTotalRt / 60) * cfg.machineChargePerHour
    let altFinal = (altSetupCost + altRuntimeCost + altMachine) * (1 + cfg.markupPercent / 100)
    if (isBroker) altFinal *= (1 - cfg.brokerDiscountPercent / 100)
    altFinal = Math.max(altFinal, cfg.minimumJobPrice)
    if (altFinal < finalCost) {
      const label = altOp === "folding" ? "Folding with 80 Text" : "Score & Fold with 100 Text"
      suggestion = `${label} would be cheaper at $${altFinal.toFixed(2)}.`
    }
  }

  return { cost: finalCost, isMinApplied, suggestion }
}

// ==================== ADDRESSING BRACKET CONFIG ====================

export interface AddressingBracket {
  /** Max qty for this bracket (null = unlimited) */
  maxQty: number | null
  /** If set, this is a flat minimum charge (ignores qty) */
  flatMin?: number
  /** Per-piece rate (used when flatMin is not set) */
  perPiece?: number
}

export interface AddressingConfig {
  /** Brackets for letters/postcards (non-flat), ordered by maxQty ascending */
  letterPostcard: AddressingBracket[]
  /** Brackets for flats */
  flat: AddressingBracket[]
}

export const DEFAULT_ADDRESSING_CONFIG: AddressingConfig = {
  letterPostcard: [
    { maxQty: 2500, flatMin: 125 },
    { maxQty: 5000, perPiece: 0.05 },
    { maxQty: null, perPiece: 0.04 },
  ],
  flat: [
    { maxQty: 1000, flatMin: 200 },
    { maxQty: null, perPiece: 0.20 },
  ],
}

// ==================== TABBING BRACKET CONFIG ====================

export interface TabbingConfig {
  /** Brackets for tabbing, ordered by maxQty ascending */
  brackets: AddressingBracket[]
}

export const DEFAULT_TABBING_CONFIG: TabbingConfig = {
  brackets: [
    { maxQty: 1000, flatMin: 125 },
    { maxQty: null, perPiece: 0.125 },
  ],
}

// ==================== PAPER WEIGHT CONFIG ====================

/**
 * Paper weight config: ONE reference weight per paper.
 * User enters: lbs per 1,000 sheets at a chosen sheet size (e.g. "11x17").
 * The system derives weight for ANY piece size via area ratio.
 *
 * Formula: pieceWeightOz = (lbs/1000 * 16) * (pieceArea / sheetArea)
 */
export const WEIGHT_SHEET_SIZES = ["8.5x11", "11x17", "12x18", "13x19"] as const
export type WeightSheetSize = typeof WEIGHT_SHEET_SIZES[number]

/** Parse "WxH" -> [w, h] */
export function parseSheetSize(s: string): [number, number] {
  const [w, h] = s.split("x").map(Number)
  return [w, h]
}

export interface PaperWeightEntry {
  /** The sheet size the weight is based on, e.g. "11x17" */
  size: WeightSheetSize
  /** Lbs per 1,000 sheets at that size */
  lbs: number
  /** Thickness per sheet in inches (caliper), e.g. 0.004 */
  thicknessIn?: number
}

export type PaperWeightConfig = Record<string, PaperWeightEntry>

export const DEFAULT_PAPER_WEIGHT_CONFIG: PaperWeightConfig = {
  "20lb Offset":            { size: "11x17", lbs: 24,  thicknessIn: 0.004  },
  "60lb Offset":            { size: "11x17", lbs: 38,  thicknessIn: 0.005  },
  "80lb Text Gloss":        { size: "11x17", lbs: 46,  thicknessIn: 0.005  },
  "100lb Text Gloss":       { size: "11x17", lbs: 56,  thicknessIn: 0.006  },
  "65 Cover (White)":       { size: "11x17", lbs: 68,  thicknessIn: 0.009  },
  "67 Cover (White)":       { size: "11x17", lbs: 70,  thicknessIn: 0.009  },
  "67 Cover (Off-White)":   { size: "11x17", lbs: 70,  thicknessIn: 0.009  },
  "80 Cover Gloss":         { size: "11x17", lbs: 82,  thicknessIn: 0.010  },
  "10pt Offset":            { size: "11x17", lbs: 95,  thicknessIn: 0.010  },
  "10pt Gloss":             { size: "11x17", lbs: 100, thicknessIn: 0.010  },
  "12pt Gloss":             { size: "11x17", lbs: 118, thicknessIn: 0.012  },
  "14pt Gloss":             { size: "11x17", lbs: 135, thicknessIn: 0.014  },
  "Sticker (Crack & Peel)": { size: "11x17", lbs: 70,  thicknessIn: 0.008  },
}

// ==================== ENVELOPE WEIGHT CONFIG ====================

export interface EnvelopeWeightEntry {
  /** Weight per envelope in ounces */
  oz: number
  /** Thickness per envelope in inches */
  thicknessIn?: number
}

export type EnvelopeWeightConfig = Record<string, EnvelopeWeightEntry>

export const DEFAULT_ENVELOPE_WEIGHT_CONFIG: EnvelopeWeightConfig = {
  "#10":          { oz: 0.16, thicknessIn: 0.005 },
  "#10 Window":   { oz: 0.17, thicknessIn: 0.005 },
  "#10 DW":       { oz: 0.18, thicknessIn: 0.005 },
  "6x9":          { oz: 0.25, thicknessIn: 0.006 },
  "9x12":         { oz: 0.62, thicknessIn: 0.008 },
  "10x13":        { oz: 0.75, thicknessIn: 0.008 },
  "A-2":          { oz: 0.10, thicknessIn: 0.004 },
  "A-6":          { oz: 0.13, thicknessIn: 0.004 },
  "A-7":          { oz: 0.16, thicknessIn: 0.005 },
  "A-9":          { oz: 0.25, thicknessIn: 0.005 },
  "A-10":         { oz: 0.30, thicknessIn: 0.006 },
  "6.5x9.5":      { oz: 0.30, thicknessIn: 0.006 },
}

// ==================== SORT LEVEL MIX CONFIG ====================

/**
 * Default % split across sort levels per mail class.
 * Key = service type key (FCM_COMM, MKT_COMM, MKT_NP) + "_" + mailType (AUTO, CR)
 * Value = Record<TierKey, percent (0-100)> -- must sum to 100.
 * SAT is always separate (not included in the mix).
 */
export type SortLevelMixConfig = Record<string, Record<string, number>>

export const DEFAULT_SORT_LEVEL_MIX: SortLevelMixConfig = {
  // FC Presort Letters: Mixed AADC / AADC / 5-Digit
  "FCM_COMM_LETTER_AUTO": { MIX: 15, ADC: 35, FD: 50 },
  // FC Presort Flats: Mixed ADC / ADC / 3-Digit / 5-Digit
  "FCM_COMM_FLAT_AUTO":   { MIX: 10, ADC: 20, TD: 30, FD: 40 },
  // FC Presort Postcards
  "FCM_COMM_POSTCARD_AUTO": { MIX: 15, ADC: 35, FD: 50 },
  // Marketing Auto Letters: Mixed / AADC / 5-Digit
  "MKT_COMM_LETTER_AUTO": { MIX: 15, ADC: 35, FD: 50 },
  // Marketing Auto Flats: Mixed / ADC / 3-Digit / 5-Digit
  "MKT_COMM_FLAT_AUTO":   { MIX: 10, ADC: 20, TD: 30, FD: 40 },
  // Marketing CR Letters: CR Basic / CR HD / CR HD+
  "MKT_COMM_LETTER_CR":   { CR_B: 40, CR_H: 40, CR_HP: 20 },
  // Marketing CR Flats
  "MKT_COMM_FLAT_CR":     { CR_B: 40, CR_H: 40, CR_HP: 20 },
  // Nonprofit Auto Letters
  "MKT_NP_LETTER_AUTO":   { MIX: 15, ADC: 35, FD: 50 },
  // Nonprofit Auto Flats
  "MKT_NP_FLAT_AUTO":     { MIX: 10, ADC: 20, TD: 30, FD: 40 },
  // Nonprofit CR Letters
  "MKT_NP_LETTER_CR":     { CR_B: 40, CR_H: 40, CR_HP: 20 },
  // Nonprofit CR Flats
  "MKT_NP_FLAT_CR":       { CR_B: 40, CR_H: 40, CR_HP: 20 },
}

/** Build the config key for looking up the sort mix */
export function sortMixKey(service: string, shape: string, mailType: string): string {
  return `${service}_${shape}_${mailType}`
}

// ==================== RUNTIME CONFIG ====================

export interface PricingConfig {
  clickCosts: Record<string, ClickCostEntry>
  paperPrices: Record<string, Record<string, number>>
  bookletPaperPrices: Record<string, Record<string, number>>
  markups: Record<string, Record<number, number>>
  finishings: FinishingOption[]
  scoreFold: ScoreFoldConfig
  envelopeSettings: EnvelopeSettings
  addressingConfig: AddressingConfig
  tabbingConfig: TabbingConfig
  paperWeightConfig: PaperWeightConfig
  envelopeWeightConfig: EnvelopeWeightConfig
  sortLevelMix: SortLevelMixConfig
}

export type { EnvelopeSettings }

/** The active runtime config. Starts as defaults, gets merged with DB overrides. */
let _activeConfig: PricingConfig = {
  clickCosts: { ...DEFAULT_CLICK_COSTS },
  paperPrices: deepClonePrices(DEFAULT_PAPER_PRICES),
  bookletPaperPrices: deepClonePrices(DEFAULT_BOOKLET_PAPER_PRICES),
  markups: deepCloneMarkups(DEFAULT_MARKUPS),
  finishings: structuredClone(DEFAULT_FINISHING_OPTIONS),
  scoreFold: structuredClone(DEFAULT_SCORE_FOLD_CONFIG),
  envelopeSettings: structuredClone(DEFAULT_ENVELOPE_SETTINGS),
  addressingConfig: structuredClone(DEFAULT_ADDRESSING_CONFIG),
  tabbingConfig: structuredClone(DEFAULT_TABBING_CONFIG),
  paperWeightConfig: structuredClone(DEFAULT_PAPER_WEIGHT_CONFIG),
  envelopeWeightConfig: structuredClone(DEFAULT_ENVELOPE_WEIGHT_CONFIG),
  sortLevelMix: structuredClone(DEFAULT_SORT_LEVEL_MIX),
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
  pricing_score_fold: ScoreFoldConfig
  envelope_settings: EnvelopeSettings
  addressing_config: AddressingConfig
  tabbing_config: TabbingConfig
  paper_weight_config: PaperWeightConfig
  envelope_weight_config: EnvelopeWeightConfig
  sort_level_mix: SortLevelMixConfig
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
    scoreFold: overrides.pricing_score_fold
      ? structuredClone(overrides.pricing_score_fold)
      : structuredClone(DEFAULT_SCORE_FOLD_CONFIG),
    envelopeSettings: overrides.envelope_settings
      ? structuredClone(overrides.envelope_settings)
      : structuredClone(DEFAULT_ENVELOPE_SETTINGS),
    addressingConfig: overrides.addressing_config
      ? structuredClone(overrides.addressing_config)
      : structuredClone(DEFAULT_ADDRESSING_CONFIG),
    tabbingConfig: overrides.tabbing_config
      ? structuredClone(overrides.tabbing_config)
      : structuredClone(DEFAULT_TABBING_CONFIG),
    paperWeightConfig: overrides.paper_weight_config
      ? { ...structuredClone(DEFAULT_PAPER_WEIGHT_CONFIG), ...overrides.paper_weight_config }
      : structuredClone(DEFAULT_PAPER_WEIGHT_CONFIG),
    envelopeWeightConfig: overrides.envelope_weight_config
      ? { ...structuredClone(DEFAULT_ENVELOPE_WEIGHT_CONFIG), ...overrides.envelope_weight_config }
      : structuredClone(DEFAULT_ENVELOPE_WEIGHT_CONFIG),
    sortLevelMix: overrides.sort_level_mix
      ? { ...structuredClone(DEFAULT_SORT_LEVEL_MIX), ...overrides.sort_level_mix }
      : structuredClone(DEFAULT_SORT_LEVEL_MIX),
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

  // 225% markup means selling price = base * 2.25 (NOT base + base*2.25)
  let effectiveMarkup = finishing.markupPercent
  if (isBroker) effectiveMarkup *= (1 - finishing.brokerDiscountPercent / 100)
  const totalWithMarkup = totalBaseCost * (effectiveMarkup / 100)
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

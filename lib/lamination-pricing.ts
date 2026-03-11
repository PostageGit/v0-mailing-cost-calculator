// ==================== LAMINATION PRICING ENGINE ====================
// Uses config from pricing-config.ts (Settings -> Finishing)
// Fully dynamic - add as many lamination types as you want in Settings
// Priced per parent sheet in the flat-printing flow.

import { getActiveConfig, type FinishingOption } from "./pricing-config"

// Lamination type is now fully dynamic - any string from config
export type LaminationType = string
export type LaminationSides = "S/S" | "D/S"
export type LaminationPaperCategory = "100 Text/80 Cover" | "Card Stock"

export interface LaminationInputs {
  enabled: boolean
  type: LaminationType
  sides: LaminationSides
  /** Markup percentage on lamination base cost (default 225) */
  markupPct: number
  /** Broker discount percentage off the markup (10-30, default 30) */
  brokerDiscountPct: number
}

export interface LaminationResult {
  setupCost: number
  materialCost: number
  laborCost: number
  rollChangeFee: number
  baseTotal: number
  markupAmount: number
  total: number
  isMinimumApplied: boolean
  sheetsUsed: number
  timeMinutes: number
}

// Get available lamination types from config (dynamic)
export function getLaminationTypes(): string[] {
  const cfg = getActiveConfig()
  return cfg.finishings
    .filter(f => f.category === "lamination")
    .map(f => f.name.replace(" Lamination", ""))
}

export const LAMINATION_DEFAULTS: LaminationInputs = {
  enabled: false,
  type: "Gloss",
  sides: "S/S",
  markupPct: 225,
  brokerDiscountPct: 30,
}

// For backward compatibility - now pulls from config dynamically
export const LAMINATION_TYPES: string[] = getLaminationTypes()

// ---- Helper to get finishing option from config ----

function getLaminationConfig(type: string): FinishingOption | null {
  const cfg = getActiveConfig()
  // Try to find by name match (e.g., "Gloss" matches "Gloss Lamination")
  return cfg.finishings.find(f => 
    f.category === "lamination" && 
    (f.name.replace(" Lamination", "") === type || f.name === type || f.id === type)
  ) || null
}

// ---- Paper category mapper ----

/** Map a flat-printing paper name to a lamination paper category */
export function toLaminationPaperCategory(paperName: string): LaminationPaperCategory {
  // Cardstock papers in flat printing
  const cardstockPapers = [
    "67 Cover (White)", "80 Cover Gloss",
    "10pt Offset", "10pt Gloss", "12pt Gloss", "14pt Gloss",
  ]
  if (cardstockPapers.some((c) => paperName.includes(c) || paperName.startsWith(c.split(" ")[0]))) {
    return "Card Stock"
  }
  return "100 Text/80 Cover"
}

// ---- Main calculation ----

export function calculateLamination(
  parentSheets: number,
  paperName: string,
  lam: LaminationInputs,
  isBroker: boolean,
  sheetLengthInches?: number, // Length of the parent sheet in inches (e.g., 19 for 13x19)
): LaminationResult | null {
  if (!lam.enabled || parentSheets <= 0) return null

  const type = lam.type
  const sides = lam.sides
  const paperCat = toLaminationPaperCategory(paperName)
  const isSilk = type.toLowerCase() === "silk"
  
  // Get config from database/settings
  const config = getLaminationConfig(type)
  if (!config) {
    return null
  }

  // Get values from config
  const rollChangeFee = config.rollChangeFee
  const wastePct = config.wastePercent
  const minSheets = config.minSheets
  const setupCost = config.setupCost
  const minimumJobPrice = config.minimumJobPrice

  // Calculate material cost per sheet based on actual sheet size
  // If sheet length is provided, calculate feet per sheet; otherwise use config default
  let rollCostPerSheet: number
  if (sheetLengthInches && config.rollCost && config.rollLengthFt) {
    // Convert sheet length from inches to feet, then calculate cost
    const sheetLengthFt = sheetLengthInches / 12
    const costPerFoot = config.rollCost / config.rollLengthFt
    rollCostPerSheet = costPerFoot * sheetLengthFt
  } else {
    // Use the pre-calculated rollCostPerSheet from config
    rollCostPerSheet = config.rollCostPerSheet
  }

  // Get runtime costs from config
  const runtimeKey = paperCat === "Card Stock" ? "Cardstock" : "80Cover"
  const runtimeCosts = config.runtimeCosts[runtimeKey] || config.runtimeCosts["Cardstock"] || {}
  const runtimeCostPerSheet = runtimeCosts.default || (isSilk ? 0.05 : 0.025)

  // Sheets with waste and minimum
  const sheets = Math.max(parentSheets, minSheets)
  const sheetsWithWaste = sheets * (1 + wastePct)
  const sideCount = sides === "D/S" ? 2 : 1

  // Labor (runtime)
  let laborCost = sheetsWithWaste * runtimeCostPerSheet * sideCount
  if (sides === "D/S") {
    // 2nd side costs more
    const secondSideCost = runtimeCostPerSheet * 2.25
    laborCost += sheetsWithWaste * secondSideCost
  }

  // Material (roll) - now uses actual sheet size if provided
  const materialCost = sheetsWithWaste * rollCostPerSheet * sideCount

  // Base total before markup
  const baseTotal = setupCost + laborCost + materialCost + rollChangeFee

  // Markup with optional broker discount
  let effectiveMarkup = config.markupPercent
  if (isBroker) {
    effectiveMarkup *= (1 - config.brokerDiscountPercent / 100)
  }
  // 225% markup means selling price = base * 2.25 (NOT base + base*2.25)
  const total_before_min = baseTotal * (effectiveMarkup / 100)
  const markupAmount = total_before_min - baseTotal

  let total = total_before_min

  // Minimum order
  let isMinimumApplied = false
  if (total < minimumJobPrice) {
    total = minimumJobPrice
    isMinimumApplied = true
  }

  // Time estimate
  const setupTimeMin = 10
  const runtimePerSheetMin = isSilk ? 0.2 : 0.1
  let runtimeMin = sheetsWithWaste * runtimePerSheetMin * sideCount
  if (sides === "D/S") runtimeMin += sheetsWithWaste * runtimePerSheetMin
  const rollChangeMin = type === "Gloss" ? 0 : 5
  const timeMinutes = setupTimeMin + runtimeMin + rollChangeMin

  return {
    setupCost,
    materialCost,
    laborCost,
    rollChangeFee,
    baseTotal,
    markupAmount,
    total,
    isMinimumApplied,
    sheetsUsed: Math.ceil(sheetsWithWaste),
    timeMinutes: Math.round(timeMinutes),
  }
}

// ==================== LAMINATION PRICING ENGINE ====================
// Ported from the Lamination.html calculator.
// Priced per parent sheet in the flat-printing flow.

export type LaminationType = "Gloss" | "Matte" | "Silk" | "Leather" | "Linen"
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

export const LAMINATION_DEFAULTS: LaminationInputs = {
  enabled: false,
  type: "Gloss",
  sides: "S/S",
  markupPct: 225,
  brokerDiscountPct: 30,
}

export const LAMINATION_TYPES: LaminationType[] = ["Gloss", "Matte", "Silk", "Leather", "Linen"]

// ---- Constants ----

const ROLL_COSTS: Record<LaminationType, number> = {
  Gloss: 0.1058,
  Matte: 0.1045,
  Silk: 0.1009,
  Leather: 0.1045,
  Linen: 0.1045,
}

const ROLL_CHANGE_FEES: Record<LaminationType, number> = {
  Gloss: 0,
  Matte: 10,
  Silk: 10,
  Leather: 10,
  Linen: 10,
}

const WASTE_PCT: Record<LaminationType, number> = {
  Gloss: 0.05,
  Matte: 0.05,
  Silk: 0.10,
  Leather: 0.05,
  Linen: 0.05,
}

const MIN_SHEETS: Record<LaminationType, number> = {
  Gloss: 5,
  Matte: 5,
  Silk: 10,
  Leather: 5,
  Linen: 5,
}

// Runtime cost per sheet (1st side)
const RUNTIME_COST: Record<LaminationPaperCategory, Record<"silk" | "other", number>> = {
  "100 Text/80 Cover": { silk: 0.1333, other: 0.0667 },
  "Card Stock":        { silk: 0.05,   other: 0.025 },
}

// Runtime cost per sheet (2nd side -- only used for D/S)
const RUNTIME_COST_2ND: Record<LaminationPaperCategory, Record<"silk" | "other", number>> = {
  "100 Text/80 Cover": { silk: 0.30, other: 0.15 },
  "Card Stock":        { silk: 0.10, other: 0.05 },
}

const SETUP_COST = 10  // $10 per job
const MINIMUM_ORDER = 45 // $45 minimum

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
): LaminationResult | null {
  if (!lam.enabled || parentSheets <= 0) return null

  const type = lam.type
  const sides = lam.sides
  const paperCat = toLaminationPaperCategory(paperName)
  const isSilk = type === "Silk"
  const runtimeKey = isSilk ? "silk" : "other"

  // Sheets with waste and minimum
  const sheets = Math.max(parentSheets, MIN_SHEETS[type])
  const sheetsWithWaste = sheets * (1 + WASTE_PCT[type])
  const sideCount = sides === "D/S" ? 2 : 1

  // Setup
  const setupCost = SETUP_COST

  // Labor (runtime)
  let laborCost = sheetsWithWaste * RUNTIME_COST[paperCat][runtimeKey] * sideCount
  if (sides === "D/S") {
    laborCost += sheetsWithWaste * RUNTIME_COST_2ND[paperCat][runtimeKey]
  }

  // Material (roll)
  const materialCost = sheetsWithWaste * ROLL_COSTS[type] * sideCount

  // Roll change fee
  const rollChangeFee = ROLL_CHANGE_FEES[type]

  // Base total before markup
  const baseTotal = setupCost + laborCost + materialCost + rollChangeFee

  // Markup with optional broker discount
  let effectiveMarkup = lam.markupPct
  if (isBroker) {
    effectiveMarkup *= (1 - lam.brokerDiscountPct / 100)
  }
  const markupAmount = baseTotal * (effectiveMarkup / 100)

  let total = baseTotal + markupAmount

  // Minimum order
  let isMinimumApplied = false
  if (total < MINIMUM_ORDER) {
    total = MINIMUM_ORDER
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

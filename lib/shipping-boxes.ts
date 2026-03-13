/**
 * Shipping Box Library
 *
 * Defines all available box sizes and provides algorithms to select
 * the best-fitting box(es) for an order based on piece dimensions,
 * quantity, and weight.
 */

export interface BoxSize {
  name: string
  lengthIn: number
  widthIn: number
  heightIn: number
  /** Cubic inches */
  volume: number
  /** Whether this box is safe for UPS shipping */
  upsEligible: boolean
  /** Any notes about this box */
  notes?: string
  /** Approximate box weight in oz */
  boxWeightOz: number
}

/**
 * Default box sizes - used as fallback if no custom config exists.
 */
export const DEFAULT_BOX_SIZES: BoxSize[] = [
  { name: "P3",     lengthIn: 11.75, widthIn: 8.75,  heightIn: 3,    volume: 11.75 * 8.75 * 3,     upsEligible: true,  boxWeightOz: 6 },
  { name: "12104",  lengthIn: 12,    widthIn: 10,    heightIn: 4,    volume: 12 * 10 * 4,           upsEligible: true,  boxWeightOz: 8 },
  { name: "14-4",   lengthIn: 14,    widthIn: 10.5,  heightIn: 4,    volume: 14 * 10.5 * 4,         upsEligible: true,  boxWeightOz: 8 },
  { name: "P6",     lengthIn: 11.75, widthIn: 8.75,  heightIn: 6,    volume: 11.75 * 8.75 * 6,      upsEligible: true,  boxWeightOz: 8 },
  { name: "T-17-6", lengthIn: 17.25, widthIn: 11.25, heightIn: 6,    volume: 17.25 * 11.25 * 6,     upsEligible: true,  boxWeightOz: 10 },
  { name: "T-18-6", lengthIn: 18.25, widthIn: 12.25, heightIn: 6,    volume: 18.25 * 12.25 * 6,     upsEligible: true,  boxWeightOz: 12 },
  { name: "B30",    lengthIn: 12,    widthIn: 10,    heightIn: 8,    volume: 12 * 10 * 8,           upsEligible: true,  boxWeightOz: 10 },
  { name: "14-8",   lengthIn: 14,    widthIn: 10.5,  heightIn: 8,    volume: 14 * 10.5 * 8,         upsEligible: true,  boxWeightOz: 12 },
  { name: "P9",     lengthIn: 11.75, widthIn: 8.75,  heightIn: 9,    volume: 11.75 * 8.75 * 9,      upsEligible: true,  boxWeightOz: 10 },
  { name: "17-10",  lengthIn: 17.25, widthIn: 11.25, heightIn: 10,   volume: 17.25 * 11.25 * 10,    upsEligible: true,  boxWeightOz: 14 },
  { name: "P12",    lengthIn: 11.75, widthIn: 8.75,  heightIn: 12,   volume: 11.75 * 8.75 * 12,     upsEligible: false, notes: "NOT for UPS, not Strong", boxWeightOz: 10 },
  { name: "D1",     lengthIn: 12.5,  widthIn: 9.5,   heightIn: 13.5, volume: 12.5 * 9.5 * 13.5,     upsEligible: false, notes: "NOT for UPS, not Strong", boxWeightOz: 12 },
].sort((a, b) => a.volume - b.volume)

/**
 * Mutable runtime box sizes - can be updated via setBoxSizes()
 */
let BOX_SIZES: BoxSize[] = [...DEFAULT_BOX_SIZES]

/** Update the box sizes at runtime (called after loading from settings) */
export function setBoxSizes(boxes: BoxSize[]) {
  BOX_SIZES = [...boxes].sort((a, b) => a.volume - b.volume)
}

/** Get current box sizes */
export function getBoxSizes(): BoxSize[] {
  return BOX_SIZES
}

export { BOX_SIZES }

/** Get only UPS-eligible boxes */
export function getUPSEligibleBoxes(): BoxSize[] {
  return BOX_SIZES.filter((b) => b.upsEligible)
}

// ── Box selection algorithm ──

export interface BoxSelectionInput {
  /** Width of each piece in inches */
  pieceWidthIn: number
  /** Height of each piece in inches */
  pieceHeightIn: number
  /** Thickness per piece in inches (default 0.01 for a single sheet) */
  thicknessPerPieceIn?: number
  /** Total number of pieces */
  quantity: number
  /** Total weight of all pieces in oz */
  totalWeightOz: number
  /** Only consider UPS-eligible boxes? */
  upsOnly?: boolean
}

export interface PackingLayout {
  /** Number of stacks along the length of box */
  stacksAlongLength: number
  /** Number of stacks along the width of box */
  stacksAlongWidth: number
  /** Total number of stacks side by side */
  totalStacks: number
  /** Pieces per stack (height) */
  piecesPerStack: number
  /** Piece orientation: width along box length, height along box width */
  pieceOrientation: "normal" | "rotated"
  /** Piece dimensions as placed */
  pieceWidthAsPlaced: number
  pieceHeightAsPlaced: number
}

export interface BoxRecommendation {
  box: BoxSize
  count: number
  piecesPerBox: number
  weightPerBoxOz: number
  fillPercent: number
  /** Packing layout details for visualization */
  packingLayout?: PackingLayout
}

export interface ShippingEstimate {
  recommendations: BoxRecommendation[]
  totalBoxes: number
  totalShippingWeightOz: number
  totalShippingWeightLbs: number
  hasNonUPSBoxes: boolean
}

/**
 * Find all boxes where the piece footprint fits flat inside (L x W).
 * We try both orientations of the piece.
 */
function boxFitsPiece(box: BoxSize, pieceW: number, pieceH: number): boolean {
  // Try piece orientation 1: piece W along box L, piece H along box W
  if (pieceW <= box.lengthIn && pieceH <= box.widthIn) return true
  // Try orientation 2: rotated
  if (pieceH <= box.lengthIn && pieceW <= box.widthIn) return true
  return false
}

/** UPS weight limit per box */
const UPS_MAX_WEIGHT_OZ = 50 * 16 // 50 lbs

/** Max weight a person can comfortably carry (~35 lbs) */
const CARRY_MAX_OZ = 35 * 16

/**
 * Group boxes by footprint family (same L x W).
 * Returns the smallest footprint area for the given piece dimensions.
 */
function getSmallestFootprintArea(candidates: BoxSize[]): number {
  let minArea = Infinity
  for (const box of candidates) {
    const area = box.lengthIn * box.widthIn
    if (area < minArea) minArea = area
  }
  return minArea
}

/**
 * Score a candidate plan. Lower score = better.
 *
 * Philosophy: PACK FULL, USE FEWEST BOXES, smallest footprint that fits.
 * Fill every box to max capacity. Only the last box gets the remainder,
 * and we try to use a smaller same-footprint box for that last one.
 *
 * Priority order:
 * 1. Fewest total boxes (absolute priority -- each box costs shipping $$)
 * 2. Smallest footprint (don't use a 17" box for 8.5" pieces)
 * 3. Single box type when possible
 * 4. Carriable weight (under 50 lbs for UPS, prefer under 40 lbs)
 * 5. UPS eligibility
 */
function scorePlan(
  recs: BoxRecommendation[],
  pieceWidthIn: number,
  pieceHeightIn: number,
  smallestFootprint: number,
): number {
  const totalBoxes = recs.reduce((s, r) => s + r.count, 0)
  const uniqueTypes = new Set(recs.map((r) => r.box.name)).size
  const hasNonUPS = recs.some((r) => !r.box.upsEligible)

  // ── 1. Box count (STRONGEST factor) ──
  // Every extra box costs real money in shipping. This is #1.
  const countPenalty = totalBoxes * 200

  // ── 2. Footprint waste ──
  // Prefer smallest footprint, but NOT at the cost of more boxes.
  let footprintScore = 0
  for (const r of recs) {
    const boxArea = r.box.lengthIn * r.box.widthIn
    const ratio = boxArea / smallestFootprint
    footprintScore += (ratio - 1) * r.count
  }

  // ── 3. Box type consistency ──
  // Nice to have: using one box type is practical. But 2 types is fine
  // when the last box is smaller.
  const typePenalty = uniqueTypes > 2 ? (uniqueTypes - 1) * 40 : (uniqueTypes - 1) * 15

  // ── 4. Carry weight ──
  // Penalise boxes over 40 lbs (hard for one person).
  let carryPenalty = 0
  for (const r of recs) {
    if (r.weightPerBoxOz > CARRY_MAX_OZ) {
      const overLbs = (r.weightPerBoxOz - CARRY_MAX_OZ) / 16
      carryPenalty += overLbs * 5 * r.count
    }
  }

  // ── 5. UPS eligibility ──
  const upsPenalty = hasNonUPS ? 80 : 0

  return (
    countPenalty +               // fewest boxes is king
    footprintScore * 60 +        // then smallest footprint
    typePenalty +                 // consistency
    carryPenalty +                // carriable
    upsPenalty                    // UPS eligible
  )
}

/**
 * Build a recommendation for a given primary box.
 * Strategy: pack every box to MAXIMUM capacity. Only the last box
 * gets the remainder, and we find the smallest same-footprint box for it.
 */
function buildPlan(
  primaryBox: BoxSize,
  candidates: BoxSize[],
  quantity: number,
  thicknessPerPieceIn: number,
  weightPerPieceOz: number,
  pieceWidthIn: number,
  pieceHeightIn: number,
): BoxRecommendation[] | null {
  // Calculate how many stacks fit side by side in the box floor (multi-stack logic v2)
  // Try both orientations of the piece and pick the one that fits more stacks
  const stacksOpt1Length = Math.floor(primaryBox.lengthIn / pieceWidthIn)
  const stacksOpt1Width = Math.floor(primaryBox.widthIn / pieceHeightIn)
  const stacksOpt1 = stacksOpt1Length * stacksOpt1Width
  
  const stacksOpt2Length = Math.floor(primaryBox.lengthIn / pieceHeightIn)
  const stacksOpt2Width = Math.floor(primaryBox.widthIn / pieceWidthIn)
  const stacksOpt2 = stacksOpt2Length * stacksOpt2Width
  
  // Pick the best orientation
  const useOpt1 = stacksOpt1 >= stacksOpt2
  const stacksAlongLength = useOpt1 ? stacksOpt1Length : stacksOpt2Length
  const stacksAlongWidth = useOpt1 ? stacksOpt1Width : stacksOpt2Width
  const numStacks = Math.max(stacksOpt1, stacksOpt2, 1) // At least 1 stack if piece fits
  const pieceOrientation = useOpt1 ? "normal" : "rotated" as const
  const pieceWidthAsPlaced = useOpt1 ? pieceWidthIn : pieceHeightIn
  const pieceHeightAsPlaced = useOpt1 ? pieceHeightIn : pieceWidthIn
  
  // Pieces per stack (height / thickness)
  const piecesPerStack = Math.floor(primaryBox.heightIn / thicknessPerPieceIn)
  if (piecesPerStack <= 0) return null
  
  // Total pieces per box = stacks * pieces per stack
  const rawMaxPerBox = numStacks * piecesPerStack
  if (rawMaxPerBox <= 0) return null
  
  // Round DOWN to strategic easy-to-count numbers for packing/receiving
  // Strategy: round to nearest 25, 50, or 100 depending on quantity size
  const roundToStrategicNumber = (n: number): number => {
    if (n >= 500) return Math.floor(n / 100) * 100  // Round to 100s (500, 600, 700...)
    if (n >= 100) return Math.floor(n / 50) * 50    // Round to 50s (100, 150, 200...)
    if (n >= 50) return Math.floor(n / 25) * 25     // Round to 25s (50, 75, 100...)
    if (n >= 20) return Math.floor(n / 10) * 10     // Round to 10s (20, 30, 40...)
    return Math.floor(n / 5) * 5                     // Round to 5s for small quantities
  }
  
  const maxPerBox = roundToStrategicNumber(rawMaxPerBox)
  if (maxPerBox <= 0) return null
  
  console.log("[v0] Box packing calc:", {
    box: primaryBox.name,
    pieceSize: `${pieceWidthIn}x${pieceHeightIn}`,
    boxFloor: `${primaryBox.lengthIn}x${primaryBox.widthIn}`,
    opt1: `${stacksOpt1Length}x${stacksOpt1Width}=${stacksOpt1}`,
    opt2: `${stacksOpt2Length}x${stacksOpt2Width}=${stacksOpt2}`,
    numStacks,
    piecesPerStack,
    rawMaxPerBox,
    maxPerBox,
  })
  
  // Create packing layout info for visualization
  const packingLayout: PackingLayout = {
    stacksAlongLength,
    stacksAlongWidth,
    totalStacks: numStacks,
    piecesPerStack,
    pieceOrientation,
    pieceWidthAsPlaced,
    pieceHeightAsPlaced,
  }

  // Enforce UPS weight limit: cap pieces per box
  let effectiveMax = maxPerBox
  if (weightPerPieceOz > 0) {
    const upsMax = Math.floor((UPS_MAX_WEIGHT_OZ - primaryBox.boxWeightOz) / weightPerPieceOz)
    effectiveMax = Math.min(effectiveMax, upsMax)
  }
  if (effectiveMax <= 0) return null

  const fullBoxCount = Math.floor(quantity / effectiveMax)
  const remainder = quantity - fullBoxCount * effectiveMax

  const recs: BoxRecommendation[] = []

  if (fullBoxCount > 0) {
    const weightFull = (weightPerPieceOz * effectiveMax) + primaryBox.boxWeightOz
    const fillFull = ((effectiveMax * thicknessPerPieceIn) / primaryBox.heightIn) * 100
    recs.push({
      box: primaryBox,
      count: fullBoxCount,
      piecesPerBox: effectiveMax,
      weightPerBoxOz: weightFull,
      fillPercent: Math.min(fillFull, 100),
      packingLayout,
    })
  }

  if (remainder > 0) {
    const remainderStack = remainder * thicknessPerPieceIn

    // For the last box: find the SMALLEST box (by height) from the
    // same footprint family that fits the remainder. This is the key:
    // all full boxes are packed tight, last box uses a shorter box.
    const primaryFootprint = `${primaryBox.lengthIn}x${primaryBox.widthIn}`
    let lastBox = primaryBox

    // First: try same-footprint family (same L x W, shorter height)
    for (const box of candidates) {
      const fp = `${box.lengthIn}x${box.widthIn}`
      if (fp !== primaryFootprint) continue
      if (box.heightIn >= remainderStack) {
        lastBox = box
        break // candidates are sorted smallest first, so first fit = smallest
      }
    }

    // If no same-footprint box found (remainder is tiny), try any candidate
    if (lastBox === primaryBox && remainderStack < primaryBox.heightIn * 0.3) {
      for (const box of candidates) {
        if (box.heightIn >= remainderStack) {
          lastBox = box
          break
        }
      }
    }

    const lastWeight = (weightPerPieceOz * remainder) + lastBox.boxWeightOz
    const lastFill = (remainderStack / lastBox.heightIn) * 100

    if (lastBox.name === primaryBox.name && fullBoxCount > 0) {
      // Same box type -- merge into one entry
      recs[0].count = fullBoxCount + 1
    } else {
      recs.push({
        box: lastBox,
        count: 1,
        piecesPerBox: remainder,
        weightPerBoxOz: lastWeight,
        fillPercent: Math.min(lastFill, 100),
        packingLayout, // Use same layout - pieces fit the same way
      })
    }
  }

  return recs
}

/**
 * Select the most practical box(es) for an order.
 *
 * Strategy: PACK FULL, FEWEST BOXES.
 * 1. Filter boxes that can fit the piece footprint
 * 2. Generate plans for EVERY candidate box as the "primary" box
 * 3. Each plan packs boxes to MAX capacity
 * 4. Last box remainder uses the smallest same-footprint box that fits
 * 5. Score on: fewest boxes > smallest footprint > consistency > carriable
 * 6. Return the plan with the best (lowest) score
 */
export function selectBestBoxes(input: BoxSelectionInput): ShippingEstimate | null {
  const {
    pieceWidthIn,
    pieceHeightIn,
    thicknessPerPieceIn = 0.01,
    quantity,
    totalWeightOz,
    upsOnly = false,
  } = input

  console.log("[v0] selectBestBoxes INPUT:", { pieceWidthIn, pieceHeightIn, thicknessPerPieceIn, quantity })

  if (quantity <= 0 || pieceWidthIn <= 0 || pieceHeightIn <= 0) return null

  const candidates = BOX_SIZES.filter((box) => {
    if (upsOnly && !box.upsEligible) return false
    return boxFitsPiece(box, pieceWidthIn, pieceHeightIn)
  })

  if (candidates.length === 0) return null

  const weightPerPieceOz = quantity > 0 ? totalWeightOz / quantity : 0
  const smallestFootprint = getSmallestFootprintArea(candidates)

  // Generate a plan for every candidate as the primary box
  let bestPlan: BoxRecommendation[] | null = null
  let bestScore = Infinity

  for (const primaryBox of candidates) {
    const plan = buildPlan(primaryBox, candidates, quantity, thicknessPerPieceIn, weightPerPieceOz, pieceWidthIn, pieceHeightIn)
    if (!plan) continue

    const score = scorePlan(plan, pieceWidthIn, pieceHeightIn, smallestFootprint)
    if (score < bestScore) {
      bestScore = score
      bestPlan = plan
    }
  }

  if (!bestPlan) return null

  const recalcTotal = bestPlan.reduce(
    (sum, r) => sum + r.weightPerBoxOz * r.count, 0
  )

  return {
    recommendations: bestPlan,
    totalBoxes: bestPlan.reduce((s, r) => s + r.count, 0),
    totalShippingWeightOz: recalcTotal,
    totalShippingWeightLbs: recalcTotal / 16,
    hasNonUPSBoxes: bestPlan.some((r) => !r.box.upsEligible),
  }
}

/**
 * Format weight for shipping display (always lbs for shipping context)
 */
export function formatShippingWeight(oz: number): string {
  const lbs = oz / 16
  if (lbs < 1) return `${oz.toFixed(1)} oz`
  return `${lbs.toFixed(1)} lbs`
}

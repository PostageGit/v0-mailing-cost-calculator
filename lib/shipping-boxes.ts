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
 * All available box sizes, sorted smallest to largest by volume.
 */
export const BOX_SIZES: BoxSize[] = [
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

export interface BoxRecommendation {
  box: BoxSize
  count: number
  piecesPerBox: number
  weightPerBoxOz: number
  fillPercent: number
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
 * Philosophy: use the smallest footprint box that fits, stick to one box
 * type as much as possible, keep boxes carriable, and find the sweet spot
 * between "not too many boxes" and "not too heavy to carry".
 *
 * Factors (tuned for practical balance):
 * 1. Smallest footprint (strongest factor -- don't use a 17" box for 8.5" pieces)
 * 2. Single box type (consistency -- easier to stack, order, carry)
 * 3. Reasonable box count (a few more small boxes is OK; too many is not)
 * 4. Good fill (50-85% sweet spot -- room to close lid, not rattling around)
 * 5. Carriable weight (penalise boxes over 35 lbs; hard-block over 50 lbs via UPS limit)
 * 6. UPS eligibility
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

  // ── 1. Footprint waste (STRONGEST factor) ──
  // Heavily penalise using a bigger footprint than needed.
  // Ratio of each box footprint to the smallest possible footprint.
  let footprintScore = 0
  for (const r of recs) {
    const boxArea = r.box.lengthIn * r.box.widthIn
    const ratio = boxArea / smallestFootprint  // 1.0 = perfect, 1.5 = 50% bigger
    footprintScore += (ratio - 1) * r.count
  }

  // ── 2. Box type consistency ──
  // Strongly prefer using one box type throughout.
  const typePenalty = (uniqueTypes - 1) * 60

  // ── 3. Box count ──
  // Moderate penalty. We don't want 20 tiny boxes, but 3-5 medium ones is fine.
  // Use a curve: first 4 boxes are "free", then it ramps up.
  const countPenalty = totalBoxes <= 4
    ? totalBoxes * 15
    : 4 * 15 + (totalBoxes - 4) * 40

  // ── 4. Fill quality ──
  // Sweet spot is 50-85%. Under 35% is wasteful, over 92% is hard to close.
  let fillPenalty = 0
  for (const r of recs) {
    const f = r.fillPercent
    if (f < 35) fillPenalty += (35 - f) * 0.8 * r.count
    else if (f < 50) fillPenalty += (50 - f) * 0.2 * r.count
    if (f > 92) fillPenalty += (f - 92) * 0.6 * r.count
  }

  // ── 5. Carry weight ──
  // Penalise boxes over 35 lbs (hard for one person).
  let carryPenalty = 0
  for (const r of recs) {
    if (r.weightPerBoxOz > CARRY_MAX_OZ) {
      const overLbs = (r.weightPerBoxOz - CARRY_MAX_OZ) / 16
      carryPenalty += overLbs * 8 * r.count
    }
  }

  // ── 6. UPS eligibility ──
  const upsPenalty = hasNonUPS ? 80 : 0

  return (
    footprintScore * 120 +   // smallest footprint is king
    typePenalty +              // stick with one box type
    countPenalty +             // reasonable count (not too many)
    fillPenalty * 2 +          // good fill
    carryPenalty +             // carriable
    upsPenalty                 // UPS eligible
  )
}

/**
 * Build a recommendation for a given primary box, optionally using
 * a same-footprint smaller box for the last partial batch.
 */
function buildPlan(
  primaryBox: BoxSize,
  candidates: BoxSize[],
  quantity: number,
  thicknessPerPieceIn: number,
  weightPerPieceOz: number,
): BoxRecommendation[] | null {
  const maxPerBox = Math.floor(primaryBox.heightIn / thicknessPerPieceIn)
  if (maxPerBox <= 0) return null

  // Enforce UPS weight limit & carry weight: cap pieces per box
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
    })
  }

  if (remainder > 0) {
    const remainderStack = remainder * thicknessPerPieceIn

    // Prefer a same-footprint-family box first (same L x W, shorter height).
    // This keeps the stacking uniform. Only fall back to a different footprint
    // if no same-family box gives decent fill.
    const primaryFootprint = `${primaryBox.lengthIn}x${primaryBox.widthIn}`
    let lastBox = primaryBox

    // First pass: same footprint family, good fill (>=40%)
    for (const box of candidates) {
      const fp = `${box.lengthIn}x${box.widthIn}`
      if (fp !== primaryFootprint) continue
      const fill = (remainderStack / box.heightIn) * 100
      if (box.heightIn >= remainderStack && fill >= 40) {
        lastBox = box
        break
      }
    }

    // If same-family didn't work, try any candidate with >=30% fill
    if (lastBox === primaryBox && remainderStack < primaryBox.heightIn * 0.35) {
      for (const box of candidates) {
        const fill = (remainderStack / box.heightIn) * 100
        if (box.heightIn >= remainderStack && fill >= 30) {
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
      })
    }
  }

  return recs
}

/**
 * Select the most practical box(es) for an order.
 *
 * Strategy:
 * 1. Filter boxes that can fit the piece footprint (both orientations)
 * 2. Generate plans for EVERY candidate box as the "primary" box
 * 3. Score each plan on practicality:
 *    - Smallest footprint that fits (don't upsize unnecessarily)
 *    - Same box type throughout (easy to stack/order)
 *    - Reasonable count (a few more small boxes > one huge heavy box)
 *    - Good fill (50-85% sweet spot)
 *    - Carriable (<35 lbs per box ideal)
 * 4. Return the plan with the best (lowest) score
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
    const plan = buildPlan(primaryBox, candidates, quantity, thicknessPerPieceIn, weightPerPieceOz)
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

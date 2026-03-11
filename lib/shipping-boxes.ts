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

/**
 * Select the best box(es) for an order.
 *
 * Strategy:
 * 1. Filter boxes that can fit the piece footprint
 * 2. For each candidate box, calculate how many pieces stack (by height)
 * 3. Pick the smallest box that fits everything, or split across multiple if needed
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

  const weightPerPieceOz = totalWeightOz / quantity
  const totalStackHeight = quantity * thicknessPerPieceIn

  // Try to find a single box that fits everything
  for (const box of candidates) {
    const maxPiecesInBox = Math.floor(box.heightIn / thicknessPerPieceIn)
    if (maxPiecesInBox >= quantity) {
      const fillPercent = (totalStackHeight / box.heightIn) * 100
      return {
        recommendations: [{
          box,
          count: 1,
          piecesPerBox: quantity,
          weightPerBoxOz: totalWeightOz + box.boxWeightOz,
          fillPercent: Math.min(fillPercent, 100),
        }],
        totalBoxes: 1,
        totalShippingWeightOz: totalWeightOz + box.boxWeightOz,
        totalShippingWeightLbs: (totalWeightOz + box.boxWeightOz) / 16,
        hasNonUPSBoxes: !box.upsEligible,
      }
    }
  }

  // Need multiple boxes -- pick the largest candidate
  // Use the biggest fitting box to minimize box count
  const bestBox = candidates[candidates.length - 1]
  const maxPerBox = Math.floor(bestBox.heightIn / thicknessPerPieceIn)

  if (maxPerBox <= 0) return null

  const boxCount = Math.ceil(quantity / maxPerBox)
  const piecesInLastBox = quantity - (boxCount - 1) * maxPerBox
  const weightPerFullBox = (weightPerPieceOz * maxPerBox) + bestBox.boxWeightOz
  const weightLastBox = (weightPerPieceOz * piecesInLastBox) + bestBox.boxWeightOz
  const totalShippingWeight = (weightPerFullBox * (boxCount - 1)) + weightLastBox

  const fillPercentFull = ((maxPerBox * thicknessPerPieceIn) / bestBox.heightIn) * 100
  const fillPercentLast = ((piecesInLastBox * thicknessPerPieceIn) / bestBox.heightIn) * 100

  const recommendations: BoxRecommendation[] = []

  if (boxCount > 1) {
    recommendations.push({
      box: bestBox,
      count: boxCount - 1,
      piecesPerBox: maxPerBox,
      weightPerBoxOz: weightPerFullBox,
      fillPercent: Math.min(fillPercentFull, 100),
    })
  }

  // Last (potentially partial) box -- could be a smaller box
  // Try to find a smaller box for the remaining pieces
  const lastStackHeight = piecesInLastBox * thicknessPerPieceIn
  let lastBox = bestBox
  for (const box of candidates) {
    if (box.heightIn >= lastStackHeight) {
      lastBox = box
      break
    }
  }

  const lastBoxWeight = (weightPerPieceOz * piecesInLastBox) + lastBox.boxWeightOz
  const lastFill = (lastStackHeight / lastBox.heightIn) * 100

  if (lastBox.name === bestBox.name && boxCount > 1) {
    // Same box type, merge into one entry
    recommendations[0].count = boxCount
  } else {
    recommendations.push({
      box: lastBox,
      count: 1,
      piecesPerBox: piecesInLastBox,
      weightPerBoxOz: lastBoxWeight,
      fillPercent: Math.min(lastFill, 100),
    })
  }

  const recalcTotal = recommendations.reduce(
    (sum, r) => sum + r.weightPerBoxOz * r.count, 0
  )

  return {
    recommendations,
    totalBoxes: recommendations.reduce((s, r) => s + r.count, 0),
    totalShippingWeightOz: recalcTotal,
    totalShippingWeightLbs: recalcTotal / 16,
    hasNonUPSBoxes: recommendations.some((r) => !r.box.upsEligible),
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

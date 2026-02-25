/**
 * Paper Weight Library
 *
 * Calculates per-piece weight from the user-editable "lbs per 1,000 sheets"
 * stored per sheet size in PricingConfig.paperWeightConfig.
 *
 * FORMULA:
 *   1. Find the smallest parent sheet that can contain the piece dimensions
 *   2. sheetWeightOz = (lbsPer1000[size] / 1000) * 16
 *   3. sheetArea = W * H of that parent sheet
 *   4. pieceWeight = sheetWeightOz * (pieceArea / sheetArea)
 *
 * For booklets: cover = 1 sheet of cover stock, inside = N sheets of text stock
 */

import { getActiveConfig, WEIGHT_SHEET_SIZES, parseSheetSize, type PaperWeightEntry } from "./pricing-config"

// ── Constants ──

/**
 * Standard envelope weights in ounces.
 */
export const ENVELOPE_WEIGHTS: Record<string, number> = {
  "#10":          0.16,
  "#10 Window":   0.17,
  "#10 DW":       0.18,
  "6x9":          0.25,
  "9x12":         0.62,
  "10x13":        0.75,
  "A-2":          0.10,
  "A-6":          0.13,
  "A-7":          0.16,
  "A-9":          0.25,
  "A-10":         0.30,
  "6.5x9.5":      0.30,
  "Postcard":     0,
}

/**
 * Find the paper weight entry from config (fuzzy match by name).
 */
function findPaperWeightEntry(paperName: string): PaperWeightEntry | null {
  const cfg = getActiveConfig().paperWeightConfig
  // Direct match
  if (cfg[paperName]) return cfg[paperName]
  // Case-insensitive
  const lower = paperName.toLowerCase()
  for (const [key, val] of Object.entries(cfg)) {
    if (key.toLowerCase() === lower) return val
  }
  // Partial match
  for (const [key, val] of Object.entries(cfg)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return val
    }
  }
  return null
}

/**
 * Find the best parent sheet size for a given piece dimension.
 * Returns the smallest sheet that can fit the piece, and the lbs/1000 for that sheet.
 *
 * A piece fits if: (pieceW <= sheetW && pieceH <= sheetH) OR (pieceW <= sheetH && pieceH <= sheetW)
 */
function findBestSheet(
  entry: PaperWeightEntry,
  pieceW: number,
  pieceH: number,
): { sheetW: number; sheetH: number; lbsPer1000: number } | null {
  let best: { sheetW: number; sheetH: number; lbsPer1000: number; area: number } | null = null

  for (const sizeKey of WEIGHT_SHEET_SIZES) {
    const lbs = entry[sizeKey]
    if (lbs == null || lbs <= 0) continue

    const [sw, sh] = parseSheetSize(sizeKey)
    // Check if piece fits in this sheet (either orientation)
    const fits =
      (pieceW <= sw + 0.01 && pieceH <= sh + 0.01) ||
      (pieceW <= sh + 0.01 && pieceH <= sw + 0.01)
    if (!fits) continue

    const area = sw * sh
    if (!best || area < best.area) {
      best = { sheetW: sw, sheetH: sh, lbsPer1000: lbs, area }
    }
  }

  return best ? { sheetW: best.sheetW, sheetH: best.sheetH, lbsPer1000: best.lbsPer1000 } : null
}

/**
 * Calculate weight of a single sheet/piece in ounces.
 *
 * @param paperName - Name of paper (must match PAPER_OPTIONS / paperWeightConfig)
 * @param widthIn - Width of the printed piece in inches
 * @param heightIn - Height of the printed piece in inches
 * @returns Weight in ounces, or null if paper not found or no sheet fits
 */
export function calcSheetWeightOz(
  paperName: string,
  widthIn: number,
  heightIn: number,
): number | null {
  const entry = findPaperWeightEntry(paperName)
  if (!entry) return null

  const sheet = findBestSheet(entry, widthIn, heightIn)
  if (!sheet) {
    // Fallback: use the largest available sheet and do area ratio
    let largestLbs = 0
    let largestArea = 0
    let largestW = 0
    let largestH = 0
    for (const sizeKey of WEIGHT_SHEET_SIZES) {
      const lbs = entry[sizeKey]
      if (lbs == null || lbs <= 0) continue
      const [sw, sh] = parseSheetSize(sizeKey)
      const area = sw * sh
      if (area > largestArea) {
        largestArea = area
        largestLbs = lbs
        largestW = sw
        largestH = sh
      }
    }
    if (largestArea === 0) return null
    // Extrapolate by area ratio
    const sheetOz = (largestLbs / 1000) * 16
    const ozPerSqIn = sheetOz / largestArea
    return Math.round(ozPerSqIn * widthIn * heightIn * 10000) / 10000
  }

  const sheetOz = (sheet.lbsPer1000 / 1000) * 16
  const sheetArea = sheet.sheetW * sheet.sheetH
  const pieceArea = widthIn * heightIn
  return Math.round(sheetOz * (pieceArea / sheetArea) * 10000) / 10000
}

/**
 * Calculate total assembled mail piece weight in ounces.
 */
export function calcMailPieceWeightOz(params: {
  pieces: Array<{
    paperName: string
    widthIn: number
    heightIn: number
    sheetsPerPiece: number
    label?: string
  }>
  envelopeType?: string
  extraInsertOz?: number
}): { totalOz: number; breakdown: Array<{ label: string; oz: number }> } | null {
  const { pieces, envelopeType, extraInsertOz = 0 } = params

  const breakdown: Array<{ label: string; oz: number }> = []
  let totalOz = 0

  for (const piece of pieces) {
    const sheetOz = calcSheetWeightOz(piece.paperName, piece.widthIn, piece.heightIn)
    if (sheetOz === null) return null
    const pieceOz = sheetOz * piece.sheetsPerPiece
    breakdown.push({
      label: `${piece.paperName} ${piece.widthIn}x${piece.heightIn} (${piece.sheetsPerPiece} sht${piece.sheetsPerPiece !== 1 ? "s" : ""})`,
      oz: Math.round(pieceOz * 100) / 100,
    })
    totalOz += pieceOz
  }

  if (envelopeType) {
    const envOz = getEnvelopeWeightOz(envelopeType)
    if (envOz > 0) {
      breakdown.push({ label: `Envelope (${envelopeType})`, oz: envOz })
      totalOz += envOz
    }
  }

  if (extraInsertOz > 0) {
    breakdown.push({ label: "Extra inserts", oz: extraInsertOz })
    totalOz += extraInsertOz
  }

  return {
    totalOz: Math.round(totalOz * 100) / 100,
    breakdown,
  }
}

/**
 * Look up envelope weight by type name (fuzzy match).
 */
export function getEnvelopeWeightOz(envelopeType: string): number {
  if (ENVELOPE_WEIGHTS[envelopeType] !== undefined) return ENVELOPE_WEIGHTS[envelopeType]
  const normalized = envelopeType.replace(/\s+/g, "").toLowerCase()
  for (const [key, val] of Object.entries(ENVELOPE_WEIGHTS)) {
    if (key.replace(/\s+/g, "").toLowerCase() === normalized) return val
  }
  for (const [key, val] of Object.entries(ENVELOPE_WEIGHTS)) {
    if (normalized.includes(key.replace(/\s+/g, "").toLowerCase())) return val
  }
  return 0
}

/**
 * Format weight for display.
 */
export function formatWeight(oz: number): string {
  if (oz < 16) return `${oz.toFixed(2)} oz`
  const lbs = Math.floor(oz / 16)
  const remainOz = oz % 16
  if (remainOz < 0.01) return `${lbs} lb${lbs !== 1 ? "s" : ""}`
  return `${lbs} lb${lbs !== 1 ? "s" : ""} ${remainOz.toFixed(1)} oz`
}

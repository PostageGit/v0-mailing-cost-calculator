/**
 * Paper Weight Library
 *
 * Derives per-piece weight from the user-editable "lbs per 1,000 sheets of 11x17"
 * stored in PricingConfig.paperWeightConfig.
 *
 * FORMULA:
 *   One 11x17 sheet weighs: (lbsPer1000 / 1000) lbs = (lbsPer1000 / 1000) * 16 oz
 *   Area of 11x17 = 187 sq in
 *   Weight per sq in = sheetWeightOz / 187
 *   Weight of custom size = weightPerSqIn * (w * h)
 */

import { getActiveConfig } from "./pricing-config"

// ── Constants ──
const SHEET_11x17_AREA = 11 * 17 // 187 sq in

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
 * Get weight of a single 11x17 sheet in ounces from the config.
 */
function getSheetWeight11x17Oz(paperName: string): number | null {
  const cfg = getActiveConfig().paperWeightConfig
  // Direct match
  if (cfg[paperName] != null) {
    return (cfg[paperName] / 1000) * 16
  }
  // Case-insensitive
  const lower = paperName.toLowerCase()
  for (const [key, val] of Object.entries(cfg)) {
    if (key.toLowerCase() === lower) return (val / 1000) * 16
  }
  // Partial match
  for (const [key, val] of Object.entries(cfg)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return (val / 1000) * 16
    }
  }
  return null
}

/**
 * Calculate weight of a single sheet in ounces.
 *
 * @param paperName - Name of paper (must match PAPER_OPTIONS / paperWeightConfig)
 * @param widthIn - Width in inches
 * @param heightIn - Height in inches
 * @returns Weight in ounces, or null if paper not found
 */
export function calcSheetWeightOz(
  paperName: string,
  widthIn: number,
  heightIn: number,
): number | null {
  const sheetOz11x17 = getSheetWeight11x17Oz(paperName)
  if (sheetOz11x17 === null) return null

  const ozPerSqIn = sheetOz11x17 / SHEET_11x17_AREA
  const areaIn2 = widthIn * heightIn
  return Math.round(ozPerSqIn * areaIn2 * 10000) / 10000
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
      label: `${piece.paperName} ${piece.widthIn}x${piece.heightIn} (${piece.sheetsPerPiece} sheet${piece.sheetsPerPiece !== 1 ? "s" : ""})`,
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

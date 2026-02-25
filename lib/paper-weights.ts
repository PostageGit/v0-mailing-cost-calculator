/**
 * Paper Weight Library
 *
 * Each paper has ONE reference weight: lbs per 1,000 sheets at a known size.
 * From that single number we can compute weight for ANY piece dimension
 * using simple area ratio.
 *
 * FORMULA:
 *   sheetWeightOz = (lbs / 1000) * 16
 *   sheetArea     = refWidth * refHeight  (the reference sheet size)
 *   pieceArea     = pieceWidth * pieceHeight
 *   pieceWeightOz = sheetWeightOz * (pieceArea / sheetArea)
 */

import { getActiveConfig, parseSheetSize, type PaperWeightEntry } from "./pricing-config"

// ── Envelope weights (oz) ──

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

// ── Lookup ──

function findEntry(paperName: string): PaperWeightEntry | null {
  const cfg = getActiveConfig().paperWeightConfig
  if (cfg[paperName]) return cfg[paperName]
  const lower = paperName.toLowerCase()
  for (const [key, val] of Object.entries(cfg)) {
    if (key.toLowerCase() === lower) return val
  }
  for (const [key, val] of Object.entries(cfg)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return val
  }
  return null
}

// ── Core calc ──

/**
 * Weight of a single piece (any custom dimensions) in ounces.
 *
 * Uses the paper's reference weight (lbs per 1000 sheets at a known size)
 * and scales by area ratio to the actual piece dimensions.
 */
export function calcSheetWeightOz(
  paperName: string,
  widthIn: number,
  heightIn: number,
): number | null {
  const entry = findEntry(paperName)
  if (!entry || !entry.lbs || entry.lbs <= 0) return null

  const [refW, refH] = parseSheetSize(entry.size)
  const refArea = refW * refH
  if (refArea <= 0) return null

  const sheetOz = (entry.lbs / 1000) * 16          // weight of one reference sheet in oz
  const pieceArea = widthIn * heightIn
  const ozPerSqIn = sheetOz / refArea               // oz per square inch
  return Math.round(ozPerSqIn * pieceArea * 10000) / 10000
}

/**
 * Compute total assembled mail piece weight (all inserts + envelope).
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

  for (const p of pieces) {
    const oz = calcSheetWeightOz(p.paperName, p.widthIn, p.heightIn)
    if (oz === null) return null
    const pieceOz = oz * p.sheetsPerPiece
    breakdown.push({
      label: `${p.paperName} ${p.widthIn}x${p.heightIn} (${p.sheetsPerPiece} sht${p.sheetsPerPiece !== 1 ? "s" : ""})`,
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

  return { totalOz: Math.round(totalOz * 100) / 100, breakdown }
}

// ── Helpers ──

export function getEnvelopeWeightOz(envelopeType: string): number {
  if (ENVELOPE_WEIGHTS[envelopeType] !== undefined) return ENVELOPE_WEIGHTS[envelopeType]
  const n = envelopeType.replace(/\s+/g, "").toLowerCase()
  for (const [key, val] of Object.entries(ENVELOPE_WEIGHTS)) {
    if (key.replace(/\s+/g, "").toLowerCase() === n) return val
  }
  for (const [key, val] of Object.entries(ENVELOPE_WEIGHTS)) {
    if (n.includes(key.replace(/\s+/g, "").toLowerCase())) return val
  }
  return 0
}

export function formatWeight(oz: number): string {
  if (oz < 16) return `${oz.toFixed(2)} oz`
  const lbs = Math.floor(oz / 16)
  const rem = oz % 16
  if (rem < 0.01) return `${lbs} lb${lbs !== 1 ? "s" : ""}`
  return `${lbs} lb${lbs !== 1 ? "s" : ""} ${rem.toFixed(1)} oz`
}

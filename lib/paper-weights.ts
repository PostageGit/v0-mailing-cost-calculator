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

// ── Envelope weights -- read from config ──

/** Get all envelope entries from config (for settings UI) */
export function getEnvelopeWeightEntries() {
  return getActiveConfig().envelopeWeightConfig
}

/**
 * Legacy compat -- returns Record<string, number> for components that just need oz values.
 * Reads from the editable config, not hardcoded.
 */
export function getEnvelopeWeightsRecord(): Record<string, number> {
  const cfg = getActiveConfig().envelopeWeightConfig
  const result: Record<string, number> = {}
  for (const [key, entry] of Object.entries(cfg)) {
    result[key] = entry.oz
  }
  result["Postcard"] = 0
  return result
}

/** For backward compatibility with components importing ENVELOPE_WEIGHTS */
export const ENVELOPE_WEIGHTS = new Proxy({} as Record<string, number>, {
  get(_target, prop: string) {
    if (prop === "Postcard") return 0
    const cfg = getActiveConfig().envelopeWeightConfig
    return cfg[prop]?.oz ?? 0
  },
  ownKeys() {
    return [...Object.keys(getActiveConfig().envelopeWeightConfig), "Postcard"]
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    return { configurable: true, enumerable: true, value: this.get!(_target, prop, _target) }
  },
})

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
  if (envelopeType === "Postcard" || !envelopeType) return 0
  const cfg = getActiveConfig().envelopeWeightConfig
  if (cfg[envelopeType]) return cfg[envelopeType].oz
  const n = envelopeType.replace(/\s+/g, "").toLowerCase()
  for (const [key, entry] of Object.entries(cfg)) {
    if (key.replace(/\s+/g, "").toLowerCase() === n) return entry.oz
  }
  for (const [key, entry] of Object.entries(cfg)) {
    if (n.includes(key.replace(/\s+/g, "").toLowerCase())) return entry.oz
  }
  return 0
}

/** Get envelope thickness in inches */
export function getEnvelopeThicknessIn(envelopeType: string): number {
  if (envelopeType === "Postcard" || !envelopeType) return 0
  const cfg = getActiveConfig().envelopeWeightConfig
  if (cfg[envelopeType]) return cfg[envelopeType].thicknessIn ?? 0
  const n = envelopeType.replace(/\s+/g, "").toLowerCase()
  for (const [key, entry] of Object.entries(cfg)) {
    if (key.replace(/\s+/g, "").toLowerCase() === n) return entry.thicknessIn ?? 0
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

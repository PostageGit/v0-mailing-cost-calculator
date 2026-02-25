/**
 * Paper Weight Library
 * 
 * Industry-standard basis weights, GSM, and per-square-inch weights
 * for calculating mail piece weight from paper type + dimensions.
 * 
 * FORMULA:
 *   Weight (oz) = gsm × area_sq_in × 0.00010034
 *   where 0.00010034 = 1 / (sq_in_per_sq_m × grams_per_oz)
 *                     = 1 / (1550.003 × 28.3495)
 * 
 * Basic sheet sizes (ream of 500):
 *   Bond / Writing / Ledger: 17" × 22"  (374 sq in)
 *   Offset / Text / Book:    25" × 38"  (950 sq in)
 *   Cover / Bristol:          20" × 26"  (520 sq in)
 *   Index:                    25.5" × 30.5" (777.75 sq in)
 *   Tag:                      24" × 36"  (864 sq in)
 *   Newsprint:                24" × 36"  (864 sq in)
 * 
 * Point (pt) caliper → approximate gsm using density of coated/uncoated stock.
 */

export type PaperCategory = "bond" | "offset" | "text" | "cover" | "index" | "tag" | "cardstock_pt"

/** Basic sheet areas in sq inches for basis weight categories */
export const BASIC_SHEET_AREAS: Record<PaperCategory, number> = {
  bond: 374,       // 17 × 22
  offset: 950,     // 25 × 38
  text: 950,       // 25 × 38  (same as offset)
  cover: 520,      // 20 × 26
  index: 777.75,   // 25.5 × 30.5
  tag: 864,        // 24 × 36
  cardstock_pt: 0, // uses caliper, not basis weight
}

/** One entry in the paper weight table */
export interface PaperWeightEntry {
  /** Display name -- must match PAPER_OPTIONS names */
  name: string
  /** Category of paper for basis weight calculation */
  category: PaperCategory
  /** Basis weight in lbs (per 500 sheets of basic size). 0 for pt-based stocks. */
  basisWeight: number
  /** GSM (grams per square meter). This is the universal unit. */
  gsm: number
  /** Caliper / thickness in inches (for stacking height calc) */
  caliperInches: number
  /** Is this a cardstock / heavy stock? */
  isCardstock: boolean
  /** User can override */
  userOverride?: boolean
}

/**
 * Industry standard paper weight table.
 * 
 * Sources:
 * - Midland Paper weight conversion chart
 * - Finch Paper conversion tables
 * - Neenah Paper spec sheets
 * - Common digital press stock specifications
 * 
 * GSM = basisWeight × (1550.003 / basicSheetArea) × (453.592 / 500)
 * Simplified: GSM = basisWeight × conversionFactor
 * 
 * Conversion factors:
 *   Bond:    basisWeight × 3.760
 *   Offset/Text: basisWeight × 1.480
 *   Cover:   basisWeight × 2.704
 */
export const DEFAULT_PAPER_WEIGHTS: PaperWeightEntry[] = [
  // ── Bond / Writing ──
  { name: "20lb Bond",           category: "bond",   basisWeight: 20,  gsm: 75.2,   caliperInches: 0.004,  isCardstock: false },
  { name: "24lb Bond",           category: "bond",   basisWeight: 24,  gsm: 90.3,   caliperInches: 0.0045, isCardstock: false },
  { name: "28lb Bond",           category: "bond",   basisWeight: 28,  gsm: 105.0,  caliperInches: 0.005,  isCardstock: false },
  { name: "32lb Bond",           category: "bond",   basisWeight: 32,  gsm: 120.0,  caliperInches: 0.006,  isCardstock: false },

  // ── Offset / Book (Uncoated) ──
  { name: "20lb Offset",         category: "offset", basisWeight: 20,  gsm: 29.6,   caliperInches: 0.003,  isCardstock: false },
  { name: "50lb Offset",         category: "offset", basisWeight: 50,  gsm: 74.0,   caliperInches: 0.004,  isCardstock: false },
  { name: "60lb Offset",         category: "offset", basisWeight: 60,  gsm: 89.0,   caliperInches: 0.005,  isCardstock: false },
  { name: "70lb Offset",         category: "offset", basisWeight: 70,  gsm: 104.0,  caliperInches: 0.006,  isCardstock: false },
  { name: "80lb Offset",         category: "offset", basisWeight: 80,  gsm: 118.0,  caliperInches: 0.006,  isCardstock: false },

  // ── Text / Book (Coated) ──
  { name: "80lb Text Gloss",     category: "text",   basisWeight: 80,  gsm: 118.0,  caliperInches: 0.004,  isCardstock: false },
  { name: "80lb Text Matte",     category: "text",   basisWeight: 80,  gsm: 118.0,  caliperInches: 0.005,  isCardstock: false },
  { name: "100lb Text Gloss",    category: "text",   basisWeight: 100, gsm: 148.0,  caliperInches: 0.005,  isCardstock: false },
  { name: "100lb Text Matte",    category: "text",   basisWeight: 100, gsm: 148.0,  caliperInches: 0.006,  isCardstock: false },

  // ── Cover (Uncoated) ──
  { name: "65lb Cover",          category: "cover",  basisWeight: 65,  gsm: 176.0,  caliperInches: 0.009,  isCardstock: true },
  { name: "65 Cover (White)",    category: "cover",  basisWeight: 65,  gsm: 176.0,  caliperInches: 0.009,  isCardstock: true },
  { name: "67 Cover (White)",    category: "cover",  basisWeight: 67,  gsm: 181.0,  caliperInches: 0.009,  isCardstock: true },
  { name: "67 Cover (Off-White)",category: "cover",  basisWeight: 67,  gsm: 181.0,  caliperInches: 0.009,  isCardstock: true },
  { name: "80lb Cover",          category: "cover",  basisWeight: 80,  gsm: 216.0,  caliperInches: 0.010,  isCardstock: true },
  { name: "110lb Cover",         category: "cover",  basisWeight: 110, gsm: 298.0,  caliperInches: 0.013,  isCardstock: true },

  // ── Cover (Coated / Gloss) ──
  { name: "80 Cover Gloss",      category: "cover",  basisWeight: 80,  gsm: 216.0,  caliperInches: 0.008,  isCardstock: true },
  { name: "100lb Cover Gloss",   category: "cover",  basisWeight: 100, gsm: 270.0,  caliperInches: 0.010,  isCardstock: true },

  // ── Point (pt) Cardstock -- caliper-based ──
  // GSM approximations from coated stock density tables
  { name: "10pt Offset",         category: "cardstock_pt", basisWeight: 0, gsm: 250.0, caliperInches: 0.010, isCardstock: true },
  { name: "10pt Gloss",          category: "cardstock_pt", basisWeight: 0, gsm: 260.0, caliperInches: 0.010, isCardstock: true },
  { name: "12pt Gloss",          category: "cardstock_pt", basisWeight: 0, gsm: 310.0, caliperInches: 0.012, isCardstock: true },
  { name: "14pt Gloss",          category: "cardstock_pt", basisWeight: 0, gsm: 350.0, caliperInches: 0.014, isCardstock: true },
  { name: "16pt Gloss",          category: "cardstock_pt", basisWeight: 0, gsm: 400.0, caliperInches: 0.016, isCardstock: true },
  { name: "18pt Gloss",          category: "cardstock_pt", basisWeight: 0, gsm: 445.0, caliperInches: 0.018, isCardstock: true },

  // ── Specialty ──
  { name: "Sticker (Crack & Peel)", category: "text", basisWeight: 0, gsm: 180.0, caliperInches: 0.007, isCardstock: false },
]

/**
 * Standard envelope weights in ounces.
 * Source: USPS standards + measured averages for commercial stock.
 */
export const ENVELOPE_WEIGHTS: Record<string, number> = {
  "#10":          0.16,   // #10 standard (4.125 x 9.5)
  "#10 Window":   0.17,   // #10 with window
  "#10 DW":       0.18,   // #10 double window
  "6x9":          0.25,   // 6x9 booklet
  "9x12":         0.62,   // 9x12 catalog
  "10x13":        0.75,   // 10x13 catalog
  "A-2":          0.10,   // 4.375 x 5.75
  "A-6":          0.13,   // 4.75 x 6.5
  "A-7":          0.16,   // 5.25 x 7.25
  "A-9":          0.25,   // 5.75 x 8.75
  "A-10":         0.30,   // 6 x 9.5
  "6.5x9.5":      0.30,   // 6.5 x 9.5
  "Postcard":     0,       // no envelope
}

// ── CONVERSION CONSTANTS ──
/** Square inches per square meter */
const SQ_IN_PER_SQ_M = 1550.003
/** Grams per ounce */
const G_PER_OZ = 28.3495
/** Master factor: multiply gsm × area_sq_in × this = weight in ounces */
const GSM_SQIN_TO_OZ = 1 / (SQ_IN_PER_SQ_M * G_PER_OZ)
// ≈ 0.00002276 oz per (gsm × sq_in)

/**
 * Calculate weight of a single sheet in ounces.
 * 
 * @param paperName - Name of paper (matches PaperWeightEntry.name)
 * @param widthIn - Width in inches
 * @param heightIn - Height in inches
 * @param paperTable - Custom paper table (defaults to DEFAULT_PAPER_WEIGHTS)
 * @returns Weight in ounces, or null if paper not found
 */
export function calcSheetWeightOz(
  paperName: string,
  widthIn: number,
  heightIn: number,
  paperTable: PaperWeightEntry[] = DEFAULT_PAPER_WEIGHTS
): number | null {
  const entry = findPaper(paperName, paperTable)
  if (!entry) return null

  const areaIn2 = widthIn * heightIn
  const weightOz = entry.gsm * areaIn2 * GSM_SQIN_TO_OZ
  return Math.round(weightOz * 10000) / 10000 // 4 decimal places
}

/**
 * Calculate total assembled mail piece weight in ounces.
 * 
 * Includes:
 *  - All printed pieces (paper weight × sheets per piece)
 *  - Envelope weight
 *  - Optional inserts
 * 
 * @returns Total weight in ounces, rounded to 2 decimals
 */
export function calcMailPieceWeightOz(params: {
  pieces: Array<{
    paperName: string
    widthIn: number
    heightIn: number
    /** Number of sheets per finished piece (e.g. 1 for flat, pages/2 for booklet) */
    sheetsPerPiece: number
  }>
  envelopeType?: string
  extraInsertOz?: number
  paperTable?: PaperWeightEntry[]
}): { totalOz: number; breakdown: Array<{ label: string; oz: number }> } | null {
  const { pieces, envelopeType, extraInsertOz = 0, paperTable = DEFAULT_PAPER_WEIGHTS } = params

  const breakdown: Array<{ label: string; oz: number }> = []
  let totalOz = 0

  for (const piece of pieces) {
    const sheetOz = calcSheetWeightOz(piece.paperName, piece.widthIn, piece.heightIn, paperTable)
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
  // Direct match
  if (ENVELOPE_WEIGHTS[envelopeType] !== undefined) return ENVELOPE_WEIGHTS[envelopeType]

  // Fuzzy: strip spaces, lowercase compare
  const normalized = envelopeType.replace(/\s+/g, "").toLowerCase()
  for (const [key, val] of Object.entries(ENVELOPE_WEIGHTS)) {
    if (key.replace(/\s+/g, "").toLowerCase() === normalized) return val
  }

  // Try partial match (e.g. "9x12 Catalog" → "9x12")
  for (const [key, val] of Object.entries(ENVELOPE_WEIGHTS)) {
    if (normalized.includes(key.replace(/\s+/g, "").toLowerCase())) return val
  }

  return 0
}

/**
 * Find a paper entry by name with fuzzy matching.
 */
export function findPaper(
  paperName: string,
  table: PaperWeightEntry[] = DEFAULT_PAPER_WEIGHTS
): PaperWeightEntry | null {
  // Exact match
  const exact = table.find((p) => p.name === paperName)
  if (exact) return exact

  // Case-insensitive
  const lower = paperName.toLowerCase()
  const ci = table.find((p) => p.name.toLowerCase() === lower)
  if (ci) return ci

  // Fuzzy: strip common variations
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/-/g, "").replace(/lb/gi, "").replace(/pt/gi, "pt")
  const norm = normalize(paperName)
  const fuzzy = table.find((p) => normalize(p.name) === norm)
  if (fuzzy) return fuzzy

  // Partial: "20lb Offset" should match "20lb Offset - White"
  const partial = table.find((p) => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower))
  if (partial) return partial

  return null
}

/**
 * Format weight for display.
 * Under 16oz shows as "X.XX oz", 16+ shows as "X lbs Y oz"
 */
export function formatWeight(oz: number): string {
  if (oz < 16) {
    return `${oz.toFixed(2)} oz`
  }
  const lbs = Math.floor(oz / 16)
  const remainOz = oz % 16
  if (remainOz < 0.01) return `${lbs} lb${lbs !== 1 ? "s" : ""}`
  return `${lbs} lb${lbs !== 1 ? "s" : ""} ${remainOz.toFixed(1)} oz`
}

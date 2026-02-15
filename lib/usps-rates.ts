// USPS Bulk Rate Calculator -- Jan 2026 Rates (Notice 123)
// ---------------------------------------------------------------
// IMPORTANT: "Flat" here is the USPS mail SHAPE (large envelope).
// This is NOT related to "Flat Printing" (the printing calculator).
// ---------------------------------------------------------------
// No Parcel rates -- removed per business rules.
// Postcards are First-Class ONLY -- disabled for Marketing/Nonprofit.
// ---------------------------------------------------------------

// --- Types ---

export type USPSServiceType = "FCM_COMM" | "FCM_RETAIL" | "MKT_COMM" | "MKT_NP"
export type USPSShape = "POSTCARD" | "LETTER" | "FLAT"
export type USPSPack = "ENV" | "PLAS" | "SM_CARD" | "SM_FOLD" | "SM_BOOK"
export type USPSEntry = "ORIGIN" | "DSCF" | "DDU"
export type SortLevel = 1 | 2 | 3 // 1=Mixed, 2=ADC/AADC, 3=5-Digit

export const SERVICE_LABELS: Record<USPSServiceType, string> = {
  FCM_COMM: "First-Class Presort",
  FCM_RETAIL: "First-Class Retail",
  MKT_COMM: "Marketing Mail",
  MKT_NP: "Nonprofit",
}

export const SORT_LABELS: Record<SortLevel, string> = {
  1: "Mixed (Basic)",
  2: "ADC / AADC",
  3: "5-Digit (Dense)",
}

export const ENTRY_LABELS: Record<USPSEntry, string> = {
  ORIGIN: "Origin (Local PO)",
  DSCF: "DSCF (Regional Hub)",
  DDU: "DDU (Local Carrier)",
}

export const SHAPE_LABELS: Record<USPSShape, string> = {
  POSTCARD: "Postcard",
  LETTER: "Letter",
  FLAT: "Flat", // USPS mail shape, NOT "Flat Printing"
}

export interface USPSInputs {
  service: USPSServiceType
  shape: USPSShape
  pack: USPSPack
  quantity: number
  saturationQty: number // separate saturation quantity (Marketing only)
  weight: number // ounces
  sortLevel: SortLevel
  entry: USPSEntry
}

export interface USPSResult {
  avgPerPiece: number
  total: number
  className: string
  description: string // e.g. "4000 @ $0.407 (ADC) + 1000 @ $0.244 (Sat)"
  alerts: { type: "error" | "warning" | "info"; message: string }[]
  isValid: boolean
  // For the labels display
  rateAtLevel: Record<SortLevel, number>
  satRate: number
}

// -------------------------------------------------------------------
// RATE TABLES -- Exact values from Notice 123 (Jan 2026)
// Sort: 1=Mixed, 2=ADC/AADC, 3=5-Digit
// -------------------------------------------------------------------

const RATES = {
  // === FIRST-CLASS RETAIL (Single Piece / Stamps) ===
  FCM_RETAIL: {
    LETTER: 0.78,
    FLAT: 1.63,
    POSTCARD: 0.61,
  },

  // === FIRST-CLASS PRESORT (500+ pieces) ===
  FCM_COMM: {
    LETTER:   { 1: 0.672, 2: 0.641, 3: 0.593 } as Record<number, number>,
    NONMACH:  { 1: 1.088, 2: 0.939, 3: 0.813 } as Record<number, number>,
    POSTCARD: { 1: 0.462, 2: 0.445, 3: 0.420 } as Record<number, number>,
    // Flats: base price at 1oz, additional oz charged separately
    FLAT_BASE: { 1: 1.488, 2: 1.331, 3: 0.970 } as Record<number, number>,
  },

  // === MARKETING MAIL -- COMMERCIAL ===
  MKT_COMM: {
    LETTER:  { 1: 0.433, 2: 0.407, 3: 0.372, SAT: 0.244 } as Record<string, number>,
    NONMACH: { 1: 1.220, 2: 1.110, 3: 0.869 } as Record<string, number>,
    // Flats <= 4oz (light)
    FLAT_LIGHT:       { 1: 1.185, 2: 1.101, 3: 0.770, SAT: 0.351 } as Record<string, number>,
    // Flats > 4oz (heavy): piece price + pound rate
    FLAT_HEAVY_PIECE: { 1: 1.039, 2: 0.955, 3: 0.624, SAT: 0.165 } as Record<string, number>,
    FLAT_POUND: {
      AUTO: { ORIGIN: 0.745, DSCF: 0.433, DDU: 0.307 },
      CR:   { ORIGIN: 0.710, DSCF: 0.398, DDU: 0.307 },
    },
  },

  // === MARKETING MAIL -- NONPROFIT ===
  MKT_NP: {
    LETTER:  { 1: 0.239, 2: 0.213, 3: 0.178, SAT: 0.155 } as Record<string, number>,
    NONMACH: { 1: 0.953, 2: 0.843, 3: 0.602 } as Record<string, number>,
    // Flats <= 4oz (light)
    FLAT_LIGHT:       { 1: 0.918, 2: 0.834, 3: 0.503, SAT: 0.311 } as Record<string, number>,
    // Flats > 4oz (heavy): piece price + pound rate
    FLAT_HEAVY_PIECE: { 1: 0.786, 2: 0.702, 3: 0.371, SAT: 0.063 } as Record<string, number>,
    FLAT_POUND: {
      AUTO: { ORIGIN: 0.690, DSCF: 0.378, DDU: 0.277 },
      CR:   { ORIGIN: 0.680, DSCF: 0.368, DDU: 0.277 },
    },
  },
} as const

// -------------------------------------------------------------------
// SPECS
// -------------------------------------------------------------------
export const SPECS: Record<USPSShape, { min: string; max: string; weight: string }> = {
  POSTCARD: { min: "3.5 x 5 x 0.007 in", max: "6 x 9 x 0.016 in", weight: "N/A" },
  LETTER:   { min: "3.5 x 5 x 0.007 in", max: "6.125 x 11.5 x 0.25 in", weight: "3.5 oz" },
  FLAT:     { min: "6.125 x 11.5 x 0.25 in", max: "12 x 15 x 0.75 in", weight: "13 oz (FCM) / 16 oz (MKT)" },
}

// -------------------------------------------------------------------
// CORE: Get rate for a single piece at a given sort level
// -------------------------------------------------------------------
function getRateForLevel(
  service: USPSServiceType,
  shape: USPSShape,
  pack: USPSPack,
  level: SortLevel | "SAT",
  weight: number,
  entry: USPSEntry,
): number {
  const isSat = level === "SAT"
  const isPlastic = pack === "PLAS"

  // --- FCM RETAIL: flat per-piece, no presort ---
  if (service === "FCM_RETAIL") {
    if (shape === "POSTCARD") return RATES.FCM_RETAIL.POSTCARD
    if (shape === "LETTER") {
      let p = RATES.FCM_RETAIL.LETTER
      if (weight > 1) p += Math.ceil(weight - 1) * 0.28
      return p
    }
    if (shape === "FLAT") {
      let p = RATES.FCM_RETAIL.FLAT
      if (weight > 1) p += Math.ceil(weight - 1) * 0.28
      return p
    }
    return 0
  }

  // --- FCM PRESORT: Flats have weight-based adders ---
  if (service === "FCM_COMM" && shape === "FLAT") {
    const lvl = isSat ? 3 : (level as SortLevel) // FCM has no saturation, use 5-digit
    let basePrice = RATES.FCM_COMM.FLAT_BASE[lvl] ?? 0
    if (weight > 1) {
      const extraOz = Math.ceil(weight - 1)
      let totalAdd = 0
      for (let i = 0; i < extraOz; i++) {
        if ((1 + i) < 4) totalAdd += 0.27       // oz 2-4
        else if ((1 + i) < 9) totalAdd += 0.28  // oz 5-9
        else totalAdd += 0.30                     // oz 10-13
      }
      basePrice += totalAdd
    }
    return basePrice
  }

  // --- MARKETING FLATS (Light vs Heavy) ---
  if ((service === "MKT_COMM" || service === "MKT_NP") && shape === "FLAT") {
    const table = service === "MKT_COMM" ? RATES.MKT_COMM : RATES.MKT_NP

    if (weight > 4) {
      // Heavy flat: piece price + (weight_in_lbs * pound_rate)
      const priceKey = isSat ? "SAT" : String(level)
      const piecePrice = table.FLAT_HEAVY_PIECE[priceKey] ?? 0
      // Saturation uses CR pound table, others use AUTO
      const poundTable = isSat ? table.FLAT_POUND.CR : table.FLAT_POUND.AUTO
      const poundRate = poundTable[entry] ?? poundTable.ORIGIN
      return piecePrice + ((weight / 16) * poundRate)
    } else {
      // Light flat
      const priceKey = isSat ? "SAT" : String(level)
      let basePrice = table.FLAT_LIGHT[priceKey] ?? 0
      // DSCF discount for light flats
      if (entry === "DSCF") basePrice -= 0.04
      // DDU + Saturation discount
      if (entry === "DDU" && isSat) basePrice -= 0.05
      return basePrice
    }
  }

  // --- FCM PRESORT: Letters / Postcards ---
  if (service === "FCM_COMM") {
    const lvl = isSat ? 3 : (level as SortLevel)
    if (shape === "POSTCARD") return RATES.FCM_COMM.POSTCARD[lvl] ?? 0
    if (shape === "LETTER") {
      return isPlastic
        ? (RATES.FCM_COMM.NONMACH[lvl] ?? 0)
        : (RATES.FCM_COMM.LETTER[lvl] ?? 0)
    }
    return 0
  }

  // --- MARKETING LETTERS ---
  if ((service === "MKT_COMM" || service === "MKT_NP") && shape === "LETTER") {
    const table = service === "MKT_COMM" ? RATES.MKT_COMM : RATES.MKT_NP

    if (isPlastic) {
      // Non-machinable -- no SAT rate exists (SAT key absent from NONMACH table)
      const nmKey = isSat ? "SAT" : String(level)
      let price = (table.NONMACH as Record<string, number>)[nmKey] ?? 0
      // DSCF discount applies to all marketing letters
      if (entry === "DSCF") price -= 0.007
      return price
    }

    const priceKey = isSat ? "SAT" : String(level)
    let price = table.LETTER[priceKey] ?? 0

    // DSCF discount for ALL marketing letters (including saturation)
    if (entry === "DSCF") price -= 0.007

    return price
  }

  return 0
}

// -------------------------------------------------------------------
// MAIN CALCULATION
// -------------------------------------------------------------------
export function calculateUSPSPostage(inputs: USPSInputs): USPSResult {
  const { service, shape, pack, quantity, saturationQty, weight, sortLevel, entry } = inputs
  const alerts: USPSResult["alerts"] = []

  // Build rate labels for all levels
  const rateAtLevel: Record<SortLevel, number> = {
    1: getRateForLevel(service, shape, pack, 1, weight, entry),
    2: getRateForLevel(service, shape, pack, 2, weight, entry),
    3: getRateForLevel(service, shape, pack, 3, weight, entry),
  }
  const satRate = getRateForLevel(service, shape, pack, "SAT", weight, entry)

  // Empty/invalid
  if (!quantity || quantity < 1) {
    return { avgPerPiece: 0, total: 0, className: "", description: "", alerts: [], isValid: false, rateAtLevel, satRate }
  }

  const isMkt = service === "MKT_COMM" || service === "MKT_NP"
  const isRetail = service === "FCM_RETAIL"

  // --- Rule: Postcards are FCM only ---
  if (isMkt && shape === "POSTCARD") {
    alerts.push({ type: "error", message: "Postcards do not exist in USPS Marketing Mail / Nonprofit. Use First-Class for postcard pricing." })
    return { avgPerPiece: 0, total: 0, className: "", description: "Not available", alerts, isValid: false, rateAtLevel, satRate }
  }

  // --- Weight limits ---
  if (shape === "LETTER" && weight > 3.5) {
    alerts.push({ type: "error", message: "Letters cannot weigh more than 3.5 oz. Switch to Flat for heavier pieces." })
    return { avgPerPiece: 0, total: 0, className: "", description: "Not available", alerts, isValid: false, rateAtLevel, satRate }
  }
  if (service === "FCM_COMM" && shape === "FLAT" && weight > 13) {
    alerts.push({ type: "error", message: "First-Class Flats max 13 oz." })
    return { avgPerPiece: 0, total: 0, className: "", description: "Not available", alerts, isValid: false, rateAtLevel, satRate }
  }

  // --- Minimum quantity ---
  if (service === "FCM_COMM" && quantity < 500) {
    alerts.push({ type: "warning", message: "Minimum 500 pieces required for First-Class Presort." })
  }
  if (isMkt && quantity < 200) {
    alerts.push({ type: "warning", message: "Minimum 200 pieces required for Marketing Mail." })
  }

  // --- Packaging warnings ---
  const isSelfMailer = pack === "SM_CARD" || pack === "SM_FOLD" || pack === "SM_BOOK"
  if (isSelfMailer) {
    alerts.push({ type: "warning", message: `Self-Mailer (${pack === "SM_CARD" ? "Card" : pack === "SM_FOLD" ? "Folded" : "Booklet"}): Must use wafer seals / tabs per USPS DMM 201.3. Unsealed edges cause rejects.` })
  }
  if (pack === "PLAS" && shape === "LETTER") {
    alerts.push({ type: "warning", message: "Plastic: Letters in poly bags are Non-Machinable. Surcharge applied." })
  }

  // --- Calculate ---
  let totalCost = 0
  let desc = ""
  let className = ""

  if (isRetail) {
    // Retail: single piece, no presort, no saturation
    const p = getRateForLevel(service, shape, pack, 1, weight, entry)
    totalCost = quantity * p
    desc = "Single Piece Retail"
    className = "First-Class Retail " + SHAPE_LABELS[shape]
  } else {
    // Presort: split between saturation qty and remainder
    const qtySat = isMkt ? Math.min(saturationQty, quantity) : 0
    const qtyRem = quantity - qtySat

    let costSat = 0
    let costRem = 0
    let satRateUsed = 0
    let remRateUsed = 0

    if (qtySat > 0) {
      satRateUsed = getRateForLevel(service, shape, pack, "SAT", weight, entry)
      costSat = qtySat * satRateUsed
    }
    if (qtyRem > 0) {
      remRateUsed = getRateForLevel(service, shape, pack, sortLevel, weight, entry)
      costRem = qtyRem * remRateUsed
    }

    totalCost = costSat + costRem

    // Build description
    const parts: string[] = []
    if (qtySat > 0) parts.push(`${qtySat.toLocaleString()} @ $${satRateUsed.toFixed(3)} (Sat)`)
    if (qtyRem > 0) parts.push(`${qtyRem.toLocaleString()} @ $${remRateUsed.toFixed(3)} (${getSortName(sortLevel)})`)
    desc = parts.join(" + ")

    // Class name
    if (service === "FCM_COMM") {
      className = "First-Class " + (shape === "POSTCARD" ? "Card" : SHAPE_LABELS[shape])
    } else {
      const modeLabel = service === "MKT_NP" ? "Nonprofit" : "Marketing"
      className = `${modeLabel} ${SHAPE_LABELS[shape]}`
    }
  }

  const avgPerPiece = quantity > 0 ? totalCost / quantity : 0

  return {
    avgPerPiece,
    total: totalCost,
    className,
    description: desc,
    alerts,
    isValid: totalCost > 0,
    rateAtLevel,
    satRate,
  }
}

function getSortName(s: SortLevel): string {
  if (s === 1) return "Mixed"
  if (s === 2) return "ADC"
  if (s === 3) return "5-Digit"
  return ""
}

// Utility: 3-decimal display for per-piece postage
export function formatPostageRate(value: number): string {
  return "$" + value.toFixed(3)
}

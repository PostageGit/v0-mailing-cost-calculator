// USPS Bulk Rate Calculator -- Jan 2026 Rates (Notice 123)
// ---------------------------------------------------------------
// All rates verified against official USPS Postage Statement Forms
// (PS 3600-FCM, 3602-R, 3602-N) dated Jan 2026.
//
// Rate Table Keys:
//   Entry:  O = Origin,  D = DSCF,  U = DDU (CR flats only)
//   Tiers:  MIX = Mixed,  ADC = AADC/ADC,  TD = 3-Digit,  FD = 5-Digit
//   CR:     CR_B = Basic,  CR_H = High Density,  CR_HP = HD Plus
//   SAT = Saturation (separate qty input; not in slider)
// ---------------------------------------------------------------

// --- Types ---

export type USPSServiceType = "FCM_COMM" | "FCM_RETAIL" | "MKT_COMM" | "MKT_NP"
export type USPSShape = "POSTCARD" | "LETTER" | "FLAT" | "PARCEL"
export type USPSPack = "ENV" | "PLAS" | "SM_CARD" | "SM_FOLD" | "SM_BOOK"
export type USPSEntry = "ORIGIN" | "DSCF" | "DDU"
export type USPSMailType = "AUTO" | "CR"

/** Tier key used in the rate tables */
export type TierKey = "MIX" | "ADC" | "TD" | "FD" | "CR_B" | "CR_H" | "CR_HP" | "SAT"

/** One tier definition for UI display */
export interface TierDef {
  k: TierKey
  l: string // display label
}

export const SERVICE_LABELS: Record<USPSServiceType, string> = {
  FCM_COMM: "First-Class Presort",
  FCM_RETAIL: "First-Class Retail",
  MKT_COMM: "Marketing Mail",
  MKT_NP: "Nonprofit",
}

export const ENTRY_LABELS: Record<USPSEntry, string> = {
  ORIGIN: "Origin (Local PO)",
  DSCF: "DSCF (Regional Hub)",
  DDU: "DDU (Local Carrier)",
}

export const SHAPE_LABELS: Record<USPSShape, string> = {
  POSTCARD: "Postcard",
  LETTER: "Letter",
  FLAT: "Flat",
  PARCEL: "Parcel",
}

// --- Inputs & Result ---

export interface USPSInputs {
  service: USPSServiceType
  shape: USPSShape
  pack: USPSPack
  quantity: number
  saturationQty: number
  weight: number        // ounces
  tierIndex: number     // index into getActiveTiers() array
  entry: USPSEntry
  mailType: USPSMailType // AUTO or CR (Marketing/NP only)
  isNonMachinable: boolean
}

export interface USPSResult {
  avgPerPiece: number
  total: number
  className: string
  description: string
  alerts: { type: "error" | "warning" | "info"; message: string }[]
  isValid: boolean
  tierPrices: { tier: TierDef; price: number }[]
  satRate: number
}

// ═══════════════════════════════════════════════════════════════
//  RATE TABLES -- Exact values from Notice 123 (Jan 2026)
// ═══════════════════════════════════════════════════════════════

const R = {
  // ── RETAIL SINGLE PIECE ─────────────────────────────────────
  RET: {
    POSTCARD: 0.610,
    NM_SURCH: 0.490,
    LT: [0.78, 1.07, 1.36, 1.65],       // 1-4 oz; index = ceil(oz)-1
    FL: [1.63, 1.90, 2.17, 2.44, 2.72,
         3.00, 3.28, 3.56, 3.84, 4.14,
         4.44, 4.74, 5.04],              // 1-13 oz
  },

  // ── FIRST-CLASS COMMERCIAL PRESORT ──────────────────────────
  FCM: {
    LT:    { MIX: 0.672, ADC: 0.641, FD: 0.593 },
    LT_NM: { MIX: 1.088, ADC: 0.939, FD: 0.813 },
    PC:    { MIX: 0.462, ADC: 0.445, FD: 0.420 },
    FL:    { MIX: 1.488, ADC: 1.331, TD: 1.235, FD: 0.970 },
  },

  // ── MARKETING MAIL COMMERCIAL ──────────────────────────────
  MKT: {
    LT_AUTO: {
      O: { MIX: 0.433, ADC: 0.407, FD: 0.372 },
      D: { MIX: 0.433, ADC: 0.390, FD: 0.355 },
    },
    LT_CR: {
      O: { SAT: 0.244, CR_HP: 0.275, CR_H: 0.365, CR_B: 0.501 },
      D: { SAT: 0.227, CR_HP: 0.258, CR_H: 0.348, CR_B: 0.463 },
    },
    LT_NM: {
      O: { MIX: 1.220, ADC: 1.110, TD: 1.046, FD: 0.869 },
      D: { MIX: 1.220, ADC: 1.072, TD: 1.008, FD: 0.831 },
    },
    LT_NM_PC: { MIX: 1.074, ADC: 0.964, TD: 0.900, FD: 0.723 },
    LT_NM_LB: { O: 0.745, D: 0.433 },
    FL_L: {
      O: { MIX: 1.185, ADC: 1.101, TD: 0.986, FD: 0.770, CR_B: 0.501, CR_H: 0.418, CR_HP: 0.351, SAT: 0.290 },
      D: { MIX: 1.185, ADC: 1.063, TD: 0.948, FD: 0.732, CR_B: 0.463, CR_H: 0.380, CR_HP: 0.313, SAT: 0.252 },
      U: { CR_B: 0.452, CR_H: 0.369, CR_HP: 0.302, SAT: 0.241 },
    },
    FL_H_PC: { MIX: 1.039, ADC: 0.955, TD: 0.840, FD: 0.624, CR_B: 0.376, CR_H: 0.293, CR_HP: 0.227, SAT: 0.165 },
    FL_LB: {
      AU: { O: 0.745, D: 0.433, U: 0.307 },
      CR: { O: 0.710, D: 0.398, U: 0.307 },
    },
  },

  // ── NONPROFIT MARKETING MAIL ───────────────────────────────
  NP: {
    LT_AUTO: {
      O: { MIX: 0.239, ADC: 0.213, FD: 0.178 },
      D: { MIX: 0.239, ADC: 0.196, FD: 0.161 },
    },
    LT_CR: {
      O: { SAT: 0.155, CR_HP: 0.171, CR_H: 0.175, CR_B: 0.415 },
      D: { SAT: 0.138, CR_HP: 0.154, CR_H: 0.158, CR_B: 0.377 },
    },
    LT_NM: {
      O: { MIX: 0.953, ADC: 0.843, TD: 0.779, FD: 0.602 },
      D: { MIX: 0.953, ADC: 0.805, TD: 0.741, FD: 0.564 },
    },
    LT_NM_PC: { MIX: 0.821, ADC: 0.711, TD: 0.647, FD: 0.470 },
    LT_NM_LB: { O: 0.690, D: 0.378 },
    FL_L: {
      O: { MIX: 0.918, ADC: 0.834, TD: 0.719, FD: 0.503, CR_B: 0.415, CR_H: 0.332, CR_HP: 0.214, SAT: 0.180 },
      D: { MIX: 0.918, ADC: 0.796, TD: 0.681, FD: 0.465, CR_B: 0.377, CR_H: 0.294, CR_HP: 0.176, SAT: 0.142 },
      U: { CR_B: 0.366, CR_H: 0.283, CR_HP: 0.165, SAT: 0.131 },
    },
    FL_H_PC: { MIX: 0.786, ADC: 0.702, TD: 0.587, FD: 0.371, CR_B: 0.298, CR_H: 0.215, CR_HP: 0.097, SAT: 0.063 },
    FL_LB: {
      AU: { O: 0.690, D: 0.378, U: 0.277 },
      CR: { O: 0.680, D: 0.368, U: 0.277 },
    },
  },
} as const

// ═══════════════════════════════════════════════════════════════
//  TIER DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const TIERS = {
  FCM_LT:  [{ k: "MIX" as TierKey, l: "Mixed AADC" }, { k: "ADC" as TierKey, l: "AADC" }, { k: "FD" as TierKey, l: "5-Digit" }],
  FCM_FL:  [{ k: "MIX" as TierKey, l: "Mixed ADC" }, { k: "ADC" as TierKey, l: "ADC" }, { k: "TD" as TierKey, l: "3-Digit" }, { k: "FD" as TierKey, l: "5-Digit" }],
  AUTO_LT: [{ k: "MIX" as TierKey, l: "Mixed" }, { k: "ADC" as TierKey, l: "AADC" }, { k: "FD" as TierKey, l: "5-Digit" }],
  AUTO_FL: [{ k: "MIX" as TierKey, l: "Mixed" }, { k: "ADC" as TierKey, l: "ADC" }, { k: "TD" as TierKey, l: "3-Digit" }, { k: "FD" as TierKey, l: "5-Digit" }],
  CR:      [{ k: "CR_B" as TierKey, l: "CR Basic" }, { k: "CR_H" as TierKey, l: "CR HD" }, { k: "CR_HP" as TierKey, l: "CR HD+" }],
}

export function getActiveTiers(
  service: USPSServiceType,
  shape: USPSShape,
  mailType: USPSMailType,
): TierDef[] {
  if (service === "FCM_RETAIL") return []
  if (service === "FCM_COMM") return shape === "FLAT" ? TIERS.FCM_FL : TIERS.FCM_LT
  // MKT_COMM or MKT_NP
  if (mailType === "CR") return TIERS.CR
  return shape === "FLAT" ? TIERS.AUTO_FL : TIERS.AUTO_LT
}

// ═══════════════════════════════════════════════════════════════
//  RATE LOOKUP -- matches HTML getPrice() exactly
// ═══════════════════════════════════════════════════════════════

function getPrice(
  service: USPSServiceType,
  shape: USPSShape,
  tierKey: TierKey,
  weight: number,
  entry: USPSEntry,
  isNM: boolean,
): number {
  const isCR = tierKey === "SAT" || tierKey.startsWith("CR_")

  // Effective entry shorthand
  let ent: "O" | "D" | "U" = entry === "DSCF" ? "D" : entry === "DDU" ? "U" : "O"
  if (tierKey === "MIX") ent = "O"           // Mixed always ORIGIN
  if (!isCR && ent === "U") ent = "O"        // DDU only for CR tiers

  // ── RETAIL ──────────────────────────────────────────────────
  if (service === "FCM_RETAIL") {
    if (shape === "POSTCARD") return R.RET.POSTCARD
    if (shape === "LETTER") {
      const oz = Math.ceil(weight)
      const i = Math.min(oz - 1, R.RET.LT.length - 1)
      let p = R.RET.LT[i]
      if (isNM) p += R.RET.NM_SURCH
      return p
    }
    if (shape === "FLAT") {
      const oz = Math.ceil(weight)
      const i = Math.min(oz - 1, R.RET.FL.length - 1)
      return R.RET.FL[i]
    }
    return 0
  }

  // ── FCM PRESORT ─────────────────────────────────────────────
  if (service === "FCM_COMM") {
    if (shape === "POSTCARD") return (R.FCM.PC as Record<string, number>)[tierKey] ?? 0

    if (shape === "FLAT") {
      const base = (R.FCM.FL as Record<string, number>)[tierKey] ?? 0
      const topOz = Math.ceil(weight)
      let addOz = 0
      for (let oz = 2; oz <= topOz; oz++)
        addOz += oz <= 4 ? 0.27 : oz <= 9 ? 0.28 : 0.30
      return base + addOz
    }

    // FCM Letter
    return isNM
      ? ((R.FCM.LT_NM as Record<string, number>)[tierKey] ?? 0)
      : ((R.FCM.LT as Record<string, number>)[tierKey] ?? 0)
  }

  // ── MARKETING / NONPROFIT ──────────────────────────────────
  const T = service === "MKT_COMM" ? R.MKT : R.NP

  // FLAT
  if (shape === "FLAT") {
    if (weight <= 4) {
      const tbl = (T.FL_L as Record<string, Record<string, number>>)[ent] ?? (T.FL_L as Record<string, Record<string, number>>).O
      return tbl[tierKey] ?? 0
    }
    // Heavy flat: piece price + per-pound * weight/16
    const pc = (T.FL_H_PC as Record<string, number>)[tierKey] ?? 0
    const lbTbl = isCR ? T.FL_LB.CR : T.FL_LB.AU
    const lb = (lbTbl as Record<string, number>)[ent] ?? (lbTbl as Record<string, number>).O
    return pc + (weight / 16) * lb
  }

  // LETTER
  if (isNM) {
    const nmEnt = ent === "D" ? "D" : "O"
    if (weight <= 4) {
      const nmTbl = (T.LT_NM as Record<string, Record<string, number>>)[nmEnt]
      return nmTbl?.[tierKey] ?? 0
    }
    const pc = (T.LT_NM_PC as Record<string, number>)[tierKey] ?? 0
    const lb = (T.LT_NM_LB as Record<string, number>)[nmEnt] ?? (T.LT_NM_LB as Record<string, number>).O
    return pc + (weight / 16) * lb
  }

  if (isCR) {
    const crEnt = ent === "D" ? "D" : "O"
    const crTbl = (T.LT_CR as Record<string, Record<string, number>>)[crEnt]
    return crTbl?.[tierKey] ?? 0
  }

  // Automation letter
  const ltEnt = ent === "D" ? "D" : "O"
  const ltTbl = (T.LT_AUTO as Record<string, Record<string, number>>)[ltEnt]
  return ltTbl?.[tierKey] ?? 0
}

// ═══════════════════════════════════════════════════════════════
//  MAIN CALCULATION
// ═══════════════════════════════════════════════════════════════

export function calculateUSPSPostage(inputs: USPSInputs): USPSResult {
  const { service, shape, pack, quantity, saturationQty, weight, tierIndex, entry, mailType, isNonMachinable } = inputs
  const alerts: USPSResult["alerts"] = []

  const isNM = isNonMachinable && shape === "LETTER"
  const isMkt = service === "MKT_COMM" || service === "MKT_NP"
  const isRetail = service === "FCM_RETAIL"

  // Get active tiers for display
  const tiers = getActiveTiers(service, shape, mailType)
  const tierPrices = tiers.map((t) => ({
    tier: t,
    price: getPrice(service, shape, t.k, weight, entry, isNM),
  }))
  const satRate = isMkt
    ? getPrice(service, shape, "SAT", weight, entry, isNM)
    : 0

  const emptyResult = (msg?: string): USPSResult => ({
    avgPerPiece: 0, total: 0, className: "", description: msg ?? "", alerts, isValid: false, tierPrices, satRate,
  })

  if (!quantity || quantity < 1) return emptyResult()

  // --- Postcards are FCM only ---
  if (isMkt && shape === "POSTCARD") {
    alerts.push({ type: "error", message: "Postcards do not exist in USPS Marketing Mail / Nonprofit. Use First-Class." })
    return emptyResult("Not available")
  }

  // --- Weight limits ---
  if (shape === "LETTER" && weight > 3.5) {
    alerts.push({ type: "error", message: "Letters cannot exceed 3.5 oz. Switch to Flat for heavier pieces." })
    return emptyResult("Not available")
  }
  if (service === "FCM_COMM" && shape === "FLAT" && weight > 13) {
    alerts.push({ type: "error", message: "First-Class Flats max 13 oz." })
    return emptyResult("Not available")
  }
  if (isMkt && shape === "FLAT" && weight > 16) {
    alerts.push({ type: "error", message: "Marketing Mail Flats max 16 oz." })
    return emptyResult("Not available")
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
    alerts.push({ type: "warning", message: `Self-Mailer: Must use wafer seals / tabs per USPS DMM 201.3.` })
  }
  if (pack === "PLAS" && shape === "LETTER") {
    alerts.push({ type: "warning", message: "Plastic: Letters in poly bags are Non-Machinable. Surcharge applied." })
  }
  if (entry === "DDU" && shape === "LETTER") {
    alerts.push({ type: "info", message: "DDU entry applies to Carrier Route Flats only. Letter rates use Origin pricing." })
  }

  // --- Calculate ---
  if (isRetail) {
    const p = getPrice(service, shape, "MIX", weight, entry, isNM)
    return {
      avgPerPiece: p, total: quantity * p, className: "First-Class Retail " + SHAPE_LABELS[shape],
      description: "Single Piece Retail", alerts, isValid: p > 0, tierPrices, satRate,
    }
  }

  // Presort: split sat vs remainder
  const clampedIdx = Math.min(tierIndex, tiers.length - 1)
  const selTier = tiers[clampedIdx >= 0 ? clampedIdx : 0]
  if (!selTier) return emptyResult()

  const qtySat = isMkt ? Math.min(saturationQty, quantity) : 0
  const qtyRem = quantity - qtySat

  const remRate = getPrice(service, shape, selTier.k, weight, entry, isNM)
  const satRateUsed = qtySat > 0 ? satRate : 0

  const total = (qtySat * satRateUsed) + (qtyRem * remRate)

  const parts: string[] = []
  if (qtySat > 0 && satRateUsed > 0)
    parts.push(`${qtySat.toLocaleString()} x $${satRateUsed.toFixed(3)} SAT`)
  if (qtyRem > 0)
    parts.push(`${qtyRem.toLocaleString()} x $${remRate.toFixed(3)} ${selTier.l}`)

  let className = ""
  if (service === "FCM_COMM") {
    className = "First-Class " + (shape === "POSTCARD" ? "Card" : SHAPE_LABELS[shape])
  } else {
    const modeLabel = service === "MKT_NP" ? "Nonprofit" : "Marketing"
    className = `${modeLabel} ${SHAPE_LABELS[shape]}`
  }

  return {
    avgPerPiece: quantity > 0 ? total / quantity : 0,
    total,
    className,
    description: parts.join(" + ") || "",
    alerts,
    isValid: total > 0,
    tierPrices,
    satRate,
  }
}

// ═══════════════════════════════════════════════════════════════
//  TAB 2 -- PARCELS & SPECIAL CLASSES
// ═══════════════════════════════════════════════════════════════

export type Tab2Service = "PS" | "MM" | "LM" | "BPM"
export type Tab2PSEntry = "DDU" | "DHUB" | "DSCF"
export type Tab2BPMShape = "FL" | "PC"
export type Tab2BPMSort = "NP" | "CR" | "PS"
export type Tab2BPMEntry = "NONE" | "DSCF" | "DDU"

export interface Tab2Inputs {
  service: Tab2Service
  quantity: number
  weight: number          // lbs
  // Parcel Select
  psEntry: Tab2PSEntry
  psOversized: boolean
  // BPM
  bpmShape: Tab2BPMShape
  bpmSort: Tab2BPMSort
  bpmEntry: Tab2BPMEntry
}

export interface Tab2Result {
  perPiece: number
  total: number
  description: string
  rateInfo: string
  alerts: { type: "error" | "warning" | "info"; message: string }[]
  isValid: boolean
}

// Parcel Select Destination Entry weight table
const PS_TBL: { max: number; ddu: number; dhub: number; dscf: number }[] = [
  { max: 0.25, ddu: 5.60, dhub: 6.15, dscf: 6.15 }, { max: 0.5, ddu: 5.60, dhub: 6.15, dscf: 6.15 },
  { max: 0.75, ddu: 5.60, dhub: 6.15, dscf: 6.15 }, { max: 1, ddu: 5.60, dhub: 6.15, dscf: 6.15 },
  { max: 2, ddu: 5.83, dhub: 6.31, dscf: 6.31 }, { max: 3, ddu: 6.23, dhub: 6.78, dscf: 6.78 },
  { max: 4, ddu: 6.32, dhub: 6.86, dscf: 6.86 }, { max: 5, ddu: 6.67, dhub: 7.22, dscf: 7.22 },
  { max: 6, ddu: 6.79, dhub: 7.32, dscf: 7.32 }, { max: 7, ddu: 7.15, dhub: 7.37, dscf: 7.37 },
  { max: 8, ddu: 7.50, dhub: 7.68, dscf: 7.68 }, { max: 9, ddu: 7.91, dhub: 8.37, dscf: 8.37 },
  { max: 10, ddu: 8.72, dhub: 9.17, dscf: 9.17 }, { max: 11, ddu: 9.46, dhub: 9.91, dscf: 9.91 },
  { max: 12, ddu: 10.08, dhub: 10.53, dscf: 10.53 }, { max: 13, ddu: 10.62, dhub: 11.08, dscf: 11.08 },
  { max: 14, ddu: 11.08, dhub: 11.53, dscf: 11.53 }, { max: 15, ddu: 11.45, dhub: 11.90, dscf: 11.90 },
  { max: 16, ddu: 11.73, dhub: 12.18, dscf: 12.18 }, { max: 17, ddu: 11.92, dhub: 12.38, dscf: 12.38 },
  { max: 18, ddu: 12.02, dhub: 12.47, dscf: 12.47 }, { max: 19, ddu: 12.10, dhub: 12.55, dscf: 12.55 },
  { max: 20, ddu: 12.41, dhub: 12.69, dscf: 12.69 }, { max: 21, ddu: 13.75, dhub: 14.34, dscf: 14.34 },
  { max: 22, ddu: 15.00, dhub: 15.60, dscf: 15.60 }, { max: 23, ddu: 16.51, dhub: 17.11, dscf: 17.11 },
  { max: 24, ddu: 18.27, dhub: 18.87, dscf: 18.87 }, { max: 25, ddu: 20.00, dhub: 20.60, dscf: 20.60 },
  { max: 26, ddu: 20.84, dhub: 21.43, dscf: 21.43 }, { max: 27, ddu: 21.67, dhub: 22.27, dscf: 22.27 },
  { max: 28, ddu: 22.34, dhub: 22.94, dscf: 22.94 }, { max: 29, ddu: 22.99, dhub: 23.59, dscf: 23.59 },
  { max: 30, ddu: 23.63, dhub: 24.23, dscf: 24.23 }, { max: 31, ddu: 24.25, dhub: 24.85, dscf: 24.85 },
  { max: 32, ddu: 24.88, dhub: 25.47, dscf: 25.47 }, { max: 33, ddu: 25.50, dhub: 26.10, dscf: 26.10 },
  { max: 34, ddu: 26.11, dhub: 26.71, dscf: 26.71 }, { max: 35, ddu: 26.73, dhub: 27.33, dscf: 27.33 },
  { max: 36, ddu: 27.31, dhub: 27.91, dscf: 27.91 }, { max: 37, ddu: 27.92, dhub: 28.51, dscf: 28.51 },
  { max: 38, ddu: 28.50, dhub: 29.10, dscf: 29.10 }, { max: 39, ddu: 29.10, dhub: 29.70, dscf: 29.70 },
  { max: 40, ddu: 29.68, dhub: 30.28, dscf: 30.28 }, { max: 41, ddu: 30.25, dhub: 30.84, dscf: 30.84 },
  { max: 42, ddu: 30.82, dhub: 31.42, dscf: 31.42 }, { max: 43, ddu: 31.38, dhub: 31.98, dscf: 31.98 },
  { max: 44, ddu: 31.95, dhub: 32.54, dscf: 32.54 }, { max: 45, ddu: 32.48, dhub: 33.08, dscf: 33.08 },
  { max: 46, ddu: 33.05, dhub: 33.65, dscf: 33.65 }, { max: 47, ddu: 33.57, dhub: 34.17, dscf: 34.17 },
  { max: 48, ddu: 34.11, dhub: 34.71, dscf: 34.71 }, { max: 49, ddu: 34.65, dhub: 35.24, dscf: 35.24 },
  { max: 50, ddu: 35.15, dhub: 35.75, dscf: 35.75 }, { max: 51, ddu: 35.66, dhub: 36.25, dscf: 36.25 },
  { max: 52, ddu: 36.17, dhub: 36.77, dscf: 36.77 }, { max: 53, ddu: 36.67, dhub: 37.26, dscf: 37.26 },
  { max: 54, ddu: 37.16, dhub: 37.76, dscf: 37.76 }, { max: 55, ddu: 37.65, dhub: 38.25, dscf: 38.25 },
  { max: 56, ddu: 38.13, dhub: 38.73, dscf: 38.73 }, { max: 57, ddu: 38.61, dhub: 39.21, dscf: 39.21 },
  { max: 58, ddu: 39.07, dhub: 39.66, dscf: 39.66 }, { max: 59, ddu: 39.54, dhub: 40.14, dscf: 40.14 },
  { max: 60, ddu: 39.98, dhub: 40.58, dscf: 40.58 }, { max: 61, ddu: 40.44, dhub: 41.03, dscf: 41.03 },
  { max: 62, ddu: 40.89, dhub: 41.49, dscf: 41.49 }, { max: 63, ddu: 41.31, dhub: 41.91, dscf: 41.91 },
  { max: 64, ddu: 41.75, dhub: 42.34, dscf: 42.34 }, { max: 65, ddu: 42.16, dhub: 42.76, dscf: 42.76 },
  { max: 66, ddu: 42.58, dhub: 43.18, dscf: 43.18 }, { max: 67, ddu: 42.99, dhub: 43.59, dscf: 43.59 },
  { max: 68, ddu: 43.41, dhub: 44.01, dscf: 44.01 }, { max: 69, ddu: 43.81, dhub: 44.40, dscf: 44.40 },
  { max: 70, ddu: 44.19, dhub: 44.79, dscf: 44.79 },
  { max: Infinity, ddu: 34.30, dhub: 34.89, dscf: 34.89 }, // Oversized flat rate
]

// BPM Nonpresorted lookup tables
const BPM_FL_NP = [
  { max: 1, p: 2.55 }, { max: 1.5, p: 2.68 }, { max: 2, p: 2.84 }, { max: 2.5, p: 3.00 },
  { max: 3, p: 3.15 }, { max: 3.5, p: 3.33 }, { max: 4, p: 3.52 }, { max: 4.5, p: 3.70 },
  { max: 5, p: 3.92 }, { max: 6, p: 4.13 }, { max: 7, p: 4.36 }, { max: 8, p: 4.60 },
  { max: 9, p: 4.85 }, { max: 10, p: 5.11 }, { max: 11, p: 5.40 }, { max: 12, p: 5.69 },
  { max: 13, p: 6.01 }, { max: 14, p: 6.32 }, { max: 15, p: 6.69 },
]

const BPM_PC_NP = [
  { max: 1, p: 3.95 }, { max: 1.5, p: 4.04 }, { max: 2, p: 4.15 }, { max: 2.5, p: 4.33 },
  { max: 3, p: 4.51 }, { max: 3.5, p: 4.72 }, { max: 4, p: 4.90 }, { max: 4.5, p: 5.08 },
  { max: 5, p: 5.27 }, { max: 6, p: 5.64 }, { max: 7, p: 6.03 }, { max: 8, p: 6.40 },
  { max: 9, p: 6.79 }, { max: 10, p: 7.14 }, { max: 11, p: 7.56 }, { max: 12, p: 7.91 },
  { max: 13, p: 8.29 }, { max: 14, p: 8.68 }, { max: 15, p: 9.06 },
]

// BPM CR & Presorted: piece + (lbs x per_pound)
const BPM_CRPS: Record<string, Record<string, { cr: number; ps: number; lb: number }>> = {
  FL: {
    NONE: { cr: 1.816, ps: 2.009, lb: 0.053 },
    DSCF: { cr: 1.049, ps: 1.242, lb: 0.053 },
    DDU:  { cr: 0.453, ps: 0.646, lb: 0.053 },
  },
  PC: {
    NONE: { cr: 2.286, ps: 2.479, lb: 0.272 },
    DSCF: { cr: 1.519, ps: 1.712, lb: 0.072 },
    DDU:  { cr: 0.923, ps: 1.116, lb: 0.072 },
  },
}

function psLookup(lbs: number, entry: Tab2PSEntry, oversized: boolean): number | null {
  if (oversized) {
    const row = PS_TBL[PS_TBL.length - 1]
    return row[entry.toLowerCase() as "ddu" | "dhub" | "dscf"]
  }
  const row = PS_TBL.find((r) => lbs <= r.max && r.max !== Infinity)
  return row ? row[entry.toLowerCase() as "ddu" | "dhub" | "dscf"] : null
}

function mmRate(lbs: number): number | null {
  if (lbs < 0.001 || lbs > 70) return null
  return +(4.47 + (Math.ceil(lbs) - 1) * 0.75).toFixed(2)
}

function lmRate(lbs: number): number | null {
  if (lbs < 0.001 || lbs > 70) return null
  return +(4.25 + (Math.ceil(lbs) - 1) * 0.71).toFixed(2)
}

function bpmRate(lbs: number, shape: Tab2BPMShape, sort: Tab2BPMSort, entry: Tab2BPMEntry): number | null {
  if (sort === "NP") {
    const tbl = shape === "FL" ? BPM_FL_NP : BPM_PC_NP
    const row = tbl.find((r) => lbs <= r.max)
    return row ? row.p : null
  }
  const row = BPM_CRPS[shape]?.[entry]
  if (!row) return null
  const pc = sort === "CR" ? row.cr : row.ps
  return +(pc + lbs * row.lb).toFixed(3)
}

export function calculateTab2Postage(inputs: Tab2Inputs): Tab2Result {
  const { service, quantity, weight, psEntry, psOversized, bpmShape, bpmSort, bpmEntry } = inputs
  const alerts: Tab2Result["alerts"] = []

  if (!quantity || !weight) {
    return { perPiece: 0, total: 0, description: "", rateInfo: "Enter quantity and weight.", alerts, isValid: false }
  }

  let rate: number | null = null
  let desc = ""
  let rateInfo = ""

  if (service === "PS") {
    if (!psOversized && weight > 70) {
      alerts.push({ type: "error", message: "Parcel Select max is 70 lbs. Check Oversized for L+G 108-130\"." })
      return { perPiece: 0, total: 0, description: "", rateInfo: "", alerts, isValid: false }
    }
    rate = psLookup(weight, psEntry, psOversized)
    const el = { DDU: "DDU (Carrier Unit)", DHUB: "DHUB (Hub)", DSCF: "DSCF (Sect. Center)" }[psEntry]
    desc = psOversized ? `Oversized - ${el}` : `${weight} lb - ${el}`
    rateInfo = psOversized
      ? `Oversized rate: $${rate?.toFixed(2)} (L+Girth 108"-130", weight irrelevant)`
      : `Parcel Select: $${rate?.toFixed(2)} per piece - ${el}`
  } else if (service === "MM") {
    if (weight > 70) {
      alerts.push({ type: "error", message: "Media Mail max is 70 lbs." })
      return { perPiece: 0, total: 0, description: "", rateInfo: "", alerts, isValid: false }
    }
    rate = mmRate(weight)
    desc = `${Math.ceil(weight)} lb Media Mail`
    rateInfo = `Media Mail: $${rate} per piece (${Math.ceil(weight)} lb)`
    alerts.push({ type: "info", message: "Media Mail accepts books, CDs, DVDs, printed music, recorded video. Contents may be inspected." })
  } else if (service === "LM") {
    if (weight > 70) {
      alerts.push({ type: "error", message: "Library Mail max is 70 lbs." })
      return { perPiece: 0, total: 0, description: "", rateInfo: "", alerts, isValid: false }
    }
    rate = lmRate(weight)
    desc = `${Math.ceil(weight)} lb Library Mail`
    rateInfo = `Library Mail: $${rate} per piece (${Math.ceil(weight)} lb)`
    alerts.push({ type: "info", message: "Library Mail is for materials sent to/from libraries and qualifying educational institutions." })
  } else if (service === "BPM") {
    if (bpmSort === "NP" && weight > 15) {
      alerts.push({ type: "error", message: "BPM Nonpresorted max is 15 lbs." })
      return { perPiece: 0, total: 0, description: "", rateInfo: "", alerts, isValid: false }
    }
    rate = bpmRate(weight, bpmShape, bpmSort, bpmEntry)
    if (rate === null) {
      alerts.push({ type: "error", message: "Weight out of range." })
      return { perPiece: 0, total: 0, description: "", rateInfo: "", alerts, isValid: false }
    }
    const shL = bpmShape === "FL" ? "Flat" : "Parcel"
    const sortL = { NP: "Nonpresorted", CR: "Carrier Route", PS: "Presorted" }[bpmSort]
    const entL = bpmSort === "NP" ? "" : ` - ${bpmEntry}`
    desc = `BPM ${shL} ${sortL}${entL}`
    if (bpmSort !== "NP") {
      const row = BPM_CRPS[bpmShape]?.[bpmEntry]
      if (row) {
        const pc = bpmSort === "CR" ? row.cr : row.ps
        rateInfo = `BPM ${shL}: $${pc.toFixed(3)} piece + $${row.lb.toFixed(3)}/lb x ${weight} lb = $${rate}`
      }
    } else {
      rateInfo = `BPM ${shL} Nonpresorted: $${rate} per piece`
    }
    alerts.push({ type: "info", message: "BPM is for catalogs, directories, and permanently bound printed advertising matter." })
  }

  if (rate === null || rate <= 0) {
    return { perPiece: 0, total: 0, description: "", rateInfo: "", alerts, isValid: false }
  }

  return {
    perPiece: rate,
    total: rate * quantity,
    description: desc,
    rateInfo,
    alerts,
    isValid: true,
  }
}

// ── UTILITIES ──────────────────────────────────────────────────

export const SPECS: Record<USPSShape, { min: string; max: string; weight: string }> = {
  POSTCARD: { min: "3.5 x 5 x 0.007 in", max: "6 x 9 x 0.016 in", weight: "N/A" },
  LETTER:   { min: "3.5 x 5 x 0.007 in", max: "6.125 x 11.5 x 0.25 in", weight: "3.5 oz" },
  FLAT:     { min: "6.125 x 11.5 x 0.25 in", max: "12 x 15 x 0.75 in", weight: "13 oz (FCM) / 16 oz (MKT)" },
  PARCEL:   { min: "Any (exceeds Flat)", max: "L+W+H 108 in (130 oversized)", weight: "70 lbs" },
}

export function formatPostageRate(value: number): string {
  return "$" + value.toFixed(3)
}

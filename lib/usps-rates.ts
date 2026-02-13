// USPS Commercial Bulk Rate Calculator -- 2026 Rates (Notice 123)
// ---------------------------------------------------------------
// IMPORTANT: "Flat" here is the USPS mail SHAPE (large envelope).
// This is NOT related to "Flat Printing" (the printing calculator).
// ---------------------------------------------------------------

export type USPSMode = "COMM" | "NP"           // Commercial vs Nonprofit
export type USPSService = "MKT" | "FCM"        // Marketing Mail vs First-Class Presort
export type USPSShape = "POSTCARD" | "LETTER" | "FLAT" | "PARCEL"
export type USPSPack = "ENV" | "FOLD" | "PLAS" // Standard / Folded Self-Mailer / Plastic Poly Bag
export type USPSEntry = "NONE" | "DSCF" | "DDU" // Origin / DSCF Regional / DDU Local Delivery
export type PresortLevel = 1 | 2 | 3 | 4       // Mixed / AADC / 5-Digit / Carrier Route (Saturation)

export const PRESORT_LABELS: Record<PresortLevel, string> = {
  1: "Mixed (Basic)",
  2: "AADC (Avg)",
  3: "5-Digit (Dense)",
  4: "Carrier Rt (Sat)",
}

export const SHAPE_LABELS: Record<USPSShape, string> = {
  POSTCARD: "Postcard",
  LETTER: "Letter",
  FLAT: "Flat",       // USPS Flat = large envelope, NOT "Flat Printing"
  PARCEL: "Parcel",
}

export const ENTRY_LABELS: Record<USPSEntry, string> = {
  NONE: "Origin (Local PO)",
  DSCF: "DSCF (Regional)",
  DDU: "DDU (Local Delivery)",
}

export interface USPSInputs {
  mode: USPSMode
  service: USPSService
  shape: USPSShape
  pack: USPSPack
  quantity: number
  weight: number        // ounces
  presort: PresortLevel
  entry: USPSEntry
  fullServiceIMb: boolean
}

export interface USPSResult {
  pricePerPiece: number
  total: number
  className: string     // e.g. "Marketing Letter", "First-Class Flat"
  category: string      // presort level label
  alerts: { type: "error" | "warning" | "info"; message: string }[]
  isValid: boolean
}

// -------------------------------------------------------------------
// RATE TABLES -- Verified from 2026 Notice 123
// Sort levels: 1=Mixed, 2=AADC, 3=5-Digit, 4=Carrier Route/Saturation
// -------------------------------------------------------------------
type RateTable = Record<number, number>

const RATES = {
  // ===== FIRST-CLASS PRESORT (FCM) =====
  // Note: FCM has no Carrier Route -- level 4 maps to level 3 rates
  FCM: {
    LETTER:         { 1: 0.672, 2: 0.641, 3: 0.593, 4: 0.593 } as RateTable,
    LETTER_NONMACH: { 1: 1.088, 2: 0.813, 3: 0.813, 4: 0.813 } as RateTable,
    POSTCARD:       { 1: 0.462, 2: 0.445, 3: 0.420, 4: 0.420 } as RateTable,
    FLAT:           { 1: 1.488, 2: 1.331, 3: 0.970, 4: 0.970 } as RateTable,
  },

  // ===== MARKETING MAIL -- COMMERCIAL =====
  MMM_COMM: {
    // Origin entry
    LETTER:           { 1: 0.433, 2: 0.407, 3: 0.372, 4: 0.244 } as RateTable,
    LETTER_NONMACH:   { 1: 1.220, 2: 1.046, 3: 0.869, 4: 0.504 } as RateTable,
    FLAT:             { 1: 1.185, 2: 1.101, 3: 0.770, 4: 0.351 } as RateTable,
    // DSCF entry
    DSCF_LETTER:      { 1: 0.429, 2: 0.403, 3: 0.368, 4: 0.227 } as RateTable,
    DSCF_FLAT:        { 1: 1.063, 2: 0.948, 3: 0.732, 4: 0.353 } as RateTable,
    // DDU entry (Saturation only for Flats)
    DDU_FLAT:         { 4: 0.349 } as RateTable,
    // Parcels
    PARCEL_ORIGIN:    { 1: 4.296, 2: 3.866, 3: 3.651, 4: 3.651 } as RateTable,
    PARCEL_ENTRY:     { 1: 3.742, 2: 3.097, 3: 2.225, 4: 2.225 } as RateTable, // DSCF
  },

  // ===== MARKETING MAIL -- NONPROFIT =====
  MMM_NP: {
    LETTER:           { 1: 0.239, 2: 0.213, 3: 0.178, 4: 0.155 } as RateTable,
    LETTER_NONMACH:   { 1: 0.953, 2: 0.779, 3: 0.602, 4: 0.332 } as RateTable,
    FLAT:             { 1: 0.918, 2: 0.834, 3: 0.503, 4: 0.313 } as RateTable,
    DSCF_LETTER:      { 1: 0.235, 2: 0.209, 3: 0.174, 4: 0.138 } as RateTable,
    DSCF_FLAT:        { 1: 0.796, 2: 0.681, 3: 0.465, 4: 0.315 } as RateTable,
    DDU_FLAT:         { 4: 0.311 } as RateTable,
    PARCEL_ORIGIN:    { 1: 4.164, 2: 3.734, 3: 3.519, 4: 3.519 } as RateTable,
    PARCEL_ENTRY:     { 1: 3.656, 2: 3.011, 3: 2.139, 4: 2.139 } as RateTable,
  },

  // Parcel Select DDU (local drop, <1lb)
  PS_DDU: 5.60,
} as const

// -------------------------------------------------------------------
// CALCULATION
// -------------------------------------------------------------------
export function calculateUSPSPostage(inputs: USPSInputs): USPSResult {
  const { mode, service, shape, pack, quantity, weight, presort, entry, fullServiceIMb } = inputs
  const alerts: USPSResult["alerts"] = []
  let price = 0
  let className = ""
  let isPlastic = pack === "PLAS"

  // ---- Validation ----
  if (!quantity || quantity < 1) {
    return { pricePerPiece: 0, total: 0, className: "", category: "", alerts: [], isValid: false }
  }

  // ---- Alerts for packaging ----
  if (pack === "FOLD" && shape !== "PARCEL") {
    alerts.push({ type: "error", message: "TABS REQUIRED: Folded self-mailers must be sealed with wafer seals (tabs). Unsealed edges jam machines and are rejected." })
  }
  if (isPlastic && shape === "LETTER") {
    alerts.push({ type: "error", message: "NON-MACHINABLE: Letters in plastic cannot be machine sorted. Surcharge applied." })
  }

  // ---- FIRST-CLASS PRESORT ----
  if (service === "FCM") {
    if (shape === "PARCEL") {
      // Zone-based -- cannot calculate here
      className = "Ground Advantage"
      alerts.push({ type: "warning", message: "ZONE RATE: First-Class Parcels use Ground Advantage with zone-based pricing. Cannot calculate exact rate here." })
    } else {
      const tbl = RATES.FCM
      if (shape === "POSTCARD") {
        price = tbl.POSTCARD[presort] ?? 0
      } else if (shape === "LETTER") {
        price = isPlastic ? (tbl.LETTER_NONMACH[presort] ?? 0) : (tbl.LETTER[presort] ?? 0)
      } else if (shape === "FLAT") {
        // USPS FLAT shape, NOT "Flat Printing"
        price = tbl.FLAT[presort] ?? 0
      }

      // FCM Full-Service IMb discount: -$0.003/pc
      if (fullServiceIMb && price > 0) {
        price -= 0.003
      }

      className = "First-Class " + (shape === "POSTCARD" ? "Card" : shape === "LETTER" ? "Letter" : "Flat")

      if (mode === "NP") {
        alerts.push({ type: "info", message: "Note: No Nonprofit rates exist for First-Class." })
      }
      if (quantity < 500) {
        alerts.push({ type: "warning", message: "Minimum 500 pieces required for FCM Presort." })
      }
    }
  }

  // ---- MARKETING MAIL ----
  else {
    const tbl = mode === "NP" ? RATES.MMM_NP : RATES.MMM_COMM
    const modeLabel = mode === "NP" ? "Nonprofit" : "Marketing"

    // LETTER or POSTCARD (Postcards run as Letters in Marketing Mail)
    if (shape === "LETTER" || shape === "POSTCARD") {
      if (isPlastic) {
        price = tbl.LETTER_NONMACH[presort] ?? 0
      } else {
        if (entry === "DSCF") {
          price = tbl.DSCF_LETTER?.[presort] ?? tbl.LETTER[presort] ?? 0
        } else {
          price = tbl.LETTER[presort] ?? 0
        }
      }
      className = `${modeLabel} Letter`
      if (shape === "POSTCARD") {
        alerts.push({ type: "info", message: "Marketing Mail 'Cards' run as Letters." })
      }
    }

    // FLAT (USPS mail shape -- NOT "Flat Printing")
    else if (shape === "FLAT") {
      if (entry === "DDU" && presort === 4) {
        price = tbl.DDU_FLAT?.[4] ?? tbl.FLAT[4] ?? 0
      } else if (entry === "DSCF") {
        price = tbl.DSCF_FLAT?.[presort] ?? tbl.FLAT[presort] ?? 0
      } else {
        price = tbl.FLAT[presort] ?? 0
      }
      className = `${modeLabel} Flat`

      // Weight adder >4oz
      if (weight > 4) {
        const extra = ((weight - 4) / 16) * 0.90
        price += extra
        alerts.push({ type: "info", message: "Includes heavy weight surcharge (>4oz)." })
      }
    }

    // PARCEL
    else if (shape === "PARCEL") {
      if (entry === "DDU") {
        price = RATES.PS_DDU
        className = "Parcel Select DDU"
        if (weight > 16) {
          price += (Math.ceil(weight / 16) - 1) * 0.50
        }
      } else if (entry === "DSCF") {
        price = tbl.PARCEL_ENTRY?.[presort] ?? 0
        className = `${modeLabel} Parcel (DSCF)`
      } else {
        // Origin -- no Saturation at Origin, cap at 5-Digit
        const s = presort === 4 ? 3 : presort
        price = tbl.PARCEL_ORIGIN?.[s] ?? 0
        className = `${modeLabel} Parcel (Origin)`
        if (presort === 4) {
          alerts.push({ type: "info", message: "Saturation unavailable at Origin entry. Using 5-Digit rate." })
        }
      }

      alerts.push({ type: "warning", message: "Standard commercial parcels use zone-based Ground Advantage. This tool calculates Parcel Select DDU (local drop) or Marketing Parcels only." })

      if (quantity < 200 && entry !== "DDU") {
        alerts.push({ type: "warning", message: "Minimum 200 pieces for Marketing Parcels." })
      }
    }

    // Marketing Mail Full-Service IMb discount: -$0.005/pc (Letters/Flats only)
    if (fullServiceIMb && shape !== "PARCEL" && price > 0) {
      price -= 0.005
    }
  }

  // Ensure price doesn't go negative from discounts
  price = Math.max(price, 0)

  const category = PRESORT_LABELS[presort]
  const total = price * quantity

  return {
    pricePerPiece: price,
    total,
    className,
    category,
    alerts,
    isValid: price > 0,
  }
}

// Utility for 3-decimal display used for per-piece postage
export function formatPostageRate(value: number): string {
  return "$" + value.toFixed(3)
}

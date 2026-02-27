// ─── Pad Calculator Types ────────────────────────────────
import type { SpiralPartInputs, SpiralPartResult } from "./spiral-types"

/** One tier in the padding price table */
export interface PadTier {
  min: number
  max: number       // use Infinity for the last tier
  label: string     // e.g. "1-50 pads"
  pricePerPad: number
}

/** Editable padding settings */
export interface PadSettings {
  tiers: PadTier[]
  setupCharge: number
  chipBoardPerPad: number
}

/** Pad calculator inputs */
export interface PadInputs {
  padQty: number
  pagesPerPad: number
  pageWidth: number
  pageHeight: number
  inside: SpiralPartInputs
  useChipBoard: boolean
  isBroker: boolean
  customLevel: "auto" | string
}

/** Pad calculator result */
export interface PadCalcResult {
  insideResult: SpiralPartResult
  sheetsPerPad: number
  totalPrintingCost: number
  paddingRate: number          // per-pad rate looked up from tiers
  totalPaddingCost: number     // paddingRate * padQty
  setupCharge: number
  chipBoardCost: number        // chipBoardPerPad * padQty (0 if disabled)
  grandTotal: number
  pricePerPad: number
  levelName: string
  autoLevelName: string
  padQty: number
  pagesPerPad: number
  pageWidth: number
  pageHeight: number
  settings: PadSettings
}

/** Default settings matching the screenshot data */
export const DEFAULT_PAD_SETTINGS: PadSettings = {
  tiers: [
    { min: 1,    max: 50,       label: "1-50 pads",      pricePerPad: 0.90 },
    { min: 51,   max: 150,      label: "51-150 pads",    pricePerPad: 0.60 },
    { min: 151,  max: 500,      label: "151-500 pads",   pricePerPad: 0.40 },
    { min: 501,  max: 1000,     label: "501-1000 pads",  pricePerPad: 0.45 },
    { min: 1001, max: Infinity, label: "1000+ pads",     pricePerPad: 0.40 },
  ],
  setupCharge: 60.00,
  chipBoardPerPad: 0.20,
}

/** Reuse the part inputs defaults */
export const DEFAULT_PAD_PART: SpiralPartInputs = {
  paperName: "20lb offset - White",
  sheetSize: "cheapest",
  sides: "S/S",
  hasBleed: false,
}

export function defaultPadInputs(): PadInputs {
  return {
    padQty: 0,
    pagesPerPad: 0,
    pageWidth: 0,
    pageHeight: 0,
    inside: { ...DEFAULT_PAD_PART },
    useChipBoard: true,
    isBroker: false,
    customLevel: "auto",
  }
}

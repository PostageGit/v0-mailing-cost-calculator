// ─── Perfect Binding Types ───────────────────────────────

export interface PerfectPartInputs {
  paperName: string
  sheetSize: string   // "8.5x11" | "11x17" | "12x18" | "13x19" | "cheapest"
  sides: string       // "S/S" | "D/S" | "4/0" | "4/4" | "1/0" | "1/1"
  hasBleed: boolean
}

export interface PerfectInputs {
  bookQty: number
  pagesPerBook: number
  pageWidth: number
  pageHeight: number
  cover: PerfectPartInputs
  inside: PerfectPartInputs
  laminationType: "none" | "gloss" | "matte" | "silk" | "leather"
  isBroker: boolean
  customLevel: "auto" | string   // "auto" | "1"-"10"
}

export interface PerfectPartResult {
  name: string
  cost: number
  sheets: number
  sheetSize: string
  paper: string
  sides: string
  bleed: boolean
  isRotated: boolean
  finalSheetWidth: number
  finalSheetHeight: number
  maxUps: number
  pricePerSheet: number
  level: number
  markup: number
}

export interface PerfectCalcResult {
  coverResult: PerfectPartResult
  insideResult: PerfectPartResult
  finishedSheetsPerBook: number
  spineWidth: number
  coverPageWidth: number
  coverPageHeight: number
  totalPrintingCost: number
  bindingPricePerBook: number
  totalBindingPrice: number
  laminationCostPerBook: number
  totalLaminationCost: number
  brokerDiscountAmount: number
  subtotalRounded: number
  grandTotal: number
  pricePerBook: number
  bookQty: number
  pagesPerBook: number
  pageWidth: number
  pageHeight: number
  isBroker: boolean
  laminationType: string
}

// ─── Paper Catalog ─────────────────────────────────────
export interface PaperOption {
  name: string
  isCardstock: boolean
  canLaminate: boolean
  thickness: number
  availableSizes: string[]
}

export const PAPER_OPTIONS: PaperOption[] = [
  { name: "80 Gloss",         isCardstock: true,  canLaminate: true,  thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19"] },
  { name: "80 Matte",         isCardstock: true,  canLaminate: true,  thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "10pt Offset",      isCardstock: true,  canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] },
  { name: "10pt Gloss",       isCardstock: true,  canLaminate: true,  thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19"] },
  { name: "10pt Matte",       isCardstock: true,  canLaminate: true,  thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19"] },
  { name: "12pt Gloss",       isCardstock: true,  canLaminate: true,  thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19"] },
  { name: "12pt Matte",       isCardstock: true,  canLaminate: true,  thickness: 0.00225, availableSizes: ["11x17", "12x18", "13x19"] },
  { name: "20lb Offset",      isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "12.5x19", "Short 11x17"] },
  { name: "60lb Offset",      isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12.5x19", "Short 12x18", "Short 12.5x19"] },
  { name: "80lb Text Gloss",  isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19", "Short 11x17", "Short 12x18"] },
  { name: "100lb Text Gloss", isCardstock: false, canLaminate: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "13x19", "Short 11x17", "Short 12x18"] },
]

// Cover sides options
export const COVER_SIDES = ["4/4", "4/0", "1/1", "1/0"] as const
// Inside sides options
export const INSIDE_SIDES = ["4/4", "4/0", "1/1", "1/0", "D/S", "S/S"] as const

export const DEFAULT_PERFECT_PART: PerfectPartInputs = {
  paperName: "",
  sheetSize: "cheapest",
  sides: "",
  hasBleed: false,
}

export function defaultPerfectInputs(): PerfectInputs {
  return {
    bookQty: 0,
    pagesPerBook: 0,
    pageWidth: 0,
    pageHeight: 0,
    cover: { paperName: "80 Gloss", sheetSize: "cheapest", sides: "4/4", hasBleed: false },
    inside: { paperName: "20lb Offset", sheetSize: "cheapest", sides: "S/S", hasBleed: false },
    laminationType: "none",
    isBroker: false,
    customLevel: "auto",
  }
}

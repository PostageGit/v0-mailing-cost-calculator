// ─── Spiral Binding Types ────────────────────────────────

export interface SpiralPartInputs {
  paperName: string
  sheetSize: string   // "8.5x11" | "11x17" | "12x18" | "cheapest"
  sides: string       // "S/S" | "D/S" | "4/0" | "4/4" | "1/0" | "1/1"
  hasBleed: boolean
}

export interface SpiralInputs {
  bookQty: number
  pagesPerBook: number
  pageWidth: number
  pageHeight: number
  inside: SpiralPartInputs
  useFrontCover: boolean
  front: SpiralPartInputs
  useBackCover: boolean
  back: SpiralPartInputs
  clearPlastic: boolean
  blackVinyl: boolean
  isBroker: boolean
  customLevel: "auto" | string   // "auto" | "Level 2" - "Level 10"
  multiQty?: { enabled: boolean; quantities: number[] }
}

export interface SpiralPartResult {
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
  levelName: string
  autoLevelName: string
  // P/L cost breakdown
  paperCostPerSheet: number
  clickCostPerSheet: number
  totalPaperCost: number
  totalClickCost: number
}

export interface SpiralCalcResult {
  insideResult: SpiralPartResult
  frontResult: SpiralPartResult | null
  backResult: SpiralPartResult | null
  sheetsPerBook: number
  totalPrintingCost: number
  bindingPricePerBook: number
  totalBindingPrice: number
  extraCoversCostPerBook: number
  totalExtrasCost: number
  grandTotal: number
  pricePerBook: number
  levelName: string
  autoLevelName: string
  hasClearPlastic: boolean
  hasBlackVinyl: boolean
  bookQty: number
  pagesPerBook: number
  pageWidth: number
  pageHeight: number
}

export const DEFAULT_SPIRAL_PART: SpiralPartInputs = {
  paperName: "20lb offset - White",
  sheetSize: "cheapest",
  sides: "S/S",
  hasBleed: false,
}

export function defaultSpiralInputs(): SpiralInputs {
  return {
    bookQty: 0,
    pagesPerBook: 0,
    pageWidth: 0,
    pageHeight: 0,
    inside: { ...DEFAULT_SPIRAL_PART },
    useFrontCover: false,
    front: { ...DEFAULT_SPIRAL_PART },
    useBackCover: false,
    back: { ...DEFAULT_SPIRAL_PART },
    clearPlastic: false,
    blackVinyl: false,
    isBroker: false,
    customLevel: "auto",
  }
}

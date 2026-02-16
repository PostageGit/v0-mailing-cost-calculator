// Types for the Saddle Stitch Booklet Calculator

export interface BookletPaperOption {
  name: string
  isCardstock: boolean
  canLaminate: boolean
  thickness: number
  availableSizes: string[]
}

export interface BookletInputs {
  bookQty: number
  pagesPerBook: number
  pageWidth: number
  pageHeight: number
  separateCover: boolean
  // Cover settings
  coverPaper: string
  coverSides: string
  coverBleed: boolean
  coverSheetSize: string // "cheapest" or specific size
  // Inside settings
  insidePaper: string
  insideSides: string
  insideBleed: boolean
  insideSheetSize: string // "cheapest" or specific size
  // Options
  laminationType: "none" | "gloss" | "matte" | "silk" | "leather"
  customLevel: string // "auto" or "1"-"10"
  isBroker: boolean
  /** Extra percentage on printing cost (default 10) */
  printingMarkupPct: number
}

export interface PartCalcResult {
  name: string
  cost: number
  sheets: number
  sheetSize: string
  paper: string
  sides: string
  bleed: boolean
  pricePerSheet: number
  level: number
  markup: number
  maxUps: number
  isRotated: boolean
  verticalUps: number
  cols: number
  rows: number
  finalSheetWidth: number
  finalSheetHeight: number
  error?: string
}

export interface BookletCalcResult {
  isValid: boolean
  error?: string
  warnings: string[]

  // Core results
  insideResult: PartCalcResult
  coverResult: PartCalcResult

  // Booklet info
  totalSheetsPerBooklet: number
  bindingPricePerBook: number
  totalBindingPrice: number
  laminationCostPerBook: number
  totalLaminationCost: number
  brokerDiscountAmount: number
  brokerMinimumApplied: string | null

  // Totals
  totalPrintingCost: number
  subtotal: number
  grandTotal: number
  pricePerBook: number

  // Spread dimensions
  spreadWidth: number
  spreadHeight: number
}

export interface BookletOrderItem {
  id: number
  summary: {
    description: string
    details: Record<string, string>
    subtotal: number
    total: number
  }
  inputs: BookletInputs
  result: BookletCalcResult
}

// Types for the Saddle Stitch Booklet Calculator

export interface BookletPaperOption {
  name: string
  isCardstock: boolean
  canLaminate: boolean
  thickness: number
  availableSizes: string[]
}

/** Insert section for saddle stitch - just specify number of leaves with different paper */
export interface BookletInsertSection {
  id: string                         // unique id for React key
  leafCount: number                  // number of leaves in this insert (1 leaf = 4 pages)
  paperName: string
  sides: string                      // "4/4", "4/0", etc.
  hasBleed: boolean
  sheetSize: string                  // "cheapest" or specific size
}

export function createInsertSection(leafCount = 1): BookletInsertSection {
  return {
    id: crypto.randomUUID(),
    leafCount,
    paperName: "",
    sides: "",
    hasBleed: false,
    sheetSize: "cheapest",
  }
}

/** Binding type for saddle stitch: staple, fold only, or perfect binding */
export type BookletBindingType = "staple" | "fold" | "perfect"

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
  // Insert sections (leaves with different paper)
  insertSections: BookletInsertSection[]
  insertFeePerSection: number  // extra fee per insert section (default $25)
  // Binding type
  bindingType: BookletBindingType  // staple (default), fold only, or perfect
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
  autoLevel: number
  markup: number
  maxUps: number
  isRotated: boolean
  verticalUps: number
  cols: number
  rows: number
  finalSheetWidth: number
  finalSheetHeight: number
  error?: string
  // P/L cost breakdown
  paperCostPerSheet: number
  clickCostPerSheet: number
  totalPaperCost: number
  totalClickCost: number
}

export interface BookletCalcResult {
  isValid: boolean
  error?: string
  warnings: string[]

  // Core results
  insideResult: PartCalcResult
  coverResult: PartCalcResult
  insertResults?: PartCalcResult[]  // results for each insert section

  // Booklet info
  totalSheetsPerBooklet: number
  totalLeavesPerBooklet: number     // for saddle stitch: total leaves (sheets folded)
  bindingPricePerBook: number
  totalBindingPrice: number
  insertFeeTotal: number            // extra fee for insert sections
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

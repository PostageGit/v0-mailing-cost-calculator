// Types for the Flat Printing Calculator

export interface PaperOption {
  name: string
  isCardstock: boolean
  thickness: number
  availableSizes: string[]
}

export interface SheetDimensions {
  w: number
  h: number
}

export interface LayoutResult {
  cols: number
  rows: number
  isRotated: boolean
}

export interface CutsResult {
  vertical: number
  horizontal: number
  total: number
}

export interface PrintingInputs {
  qty: number
  width: number
  height: number
  paperName: string
  sidesValue: string
  hasBleed: boolean
  addOnCharge: number
  addOnDescription: string
  /** IDs of sheet finishing options to apply (e.g. ["gloss_lamination"]) */
  finishingIds?: string[]
  isBroker?: boolean
  /** Score & fold settings (per-piece finishing) */
  scoreFoldOperation?: "folding" | "scoring" | ""
  scoreFoldType?: "foldInHalf" | "foldIn3" | "foldIn4" | "gateFold" | ""
  /** IDs of custom finishing calculators to apply */
  finishingCalcIds?: string[]
  /** Override the auto-detected level (1-8) */
  levelOverride?: number
  /** Extra percentage on printing cost (default 10) */
  printingMarkupPct: number
}

export interface PrintingCalcResult {
  cost: number
  sheets: number
  sheetSize: string
  layout: LayoutResult
  level: number
  markup: number
  pricePerSheet: number
  sheetDimensions: SheetDimensions
  bleed: boolean
  cuts: CutsResult
  maxUps: number
  cuttingCost: number
  numberOfStacks: number
  wasPrintingMinApplied: boolean
  wasCuttingMinApplied: boolean
}

export interface SheetOptionRow {
  size: string
  ups: number
  sheets: number
  totalCuts: number
  price: number
  result: PrintingCalcResult
}

export interface FinishingCostLine {
  id: string
  name: string
  cost: number
}

export interface ScoreFoldCostLine {
  operation: string
  foldType: string
  cost: number
  isMinApplied: boolean
  suggestion?: string
}

export interface FullPrintingResult {
  printingCost: number
  printingCostPlus10: number
  addOnCharge: number
  addOnDescription: string
  cuttingCost: number
  finishingCosts: FinishingCostLine[]
  totalFinishing: number
  scoreFoldCost: ScoreFoldCostLine | null
  /** Costs from custom finishing calculators */
  finishingCalcCosts: { id: string; name: string; cost: number }[]
  totalFinishingCalcCost: number
  subtotal: number
  grandTotal: number
  result: PrintingCalcResult
  inputs: PrintingInputs
}

export interface OrderItem {
  id: number
  summary: {
    description: string
    details: string
    subtotal: number
    total: number
  }
  inputs: PrintingInputs
  fullResult: FullPrintingResult
}

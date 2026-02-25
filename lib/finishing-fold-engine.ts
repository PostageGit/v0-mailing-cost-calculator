// ============================================================
// Finishing Fold Pricing Engine
// ============================================================
// ALL CALCULATIONS NOW RUN FROM:
//   calculators/fold-score-calculator.html
// via the bridge API at /api/fold-calc
//
// All local calculation code has been COMMENTED OUT below.
// The bridge reads the actual HTML file every time so any
// changes you make on GitHub are picked up automatically.
// ============================================================

import type { FoldCategory } from "./finishing-fold-data"

// ── Settings type (matches the settings UI) ──
export interface FoldFinishingSettings {
  hourlyRate: number
  markupPercent: number
  brokerDiscountPercent: number
  longSheetSetupFee: number
  handFoldHourlyRate: number
  handFoldRatePerPiece: number
  minimumJobPrice: number
  setupLevels: { label: string; minutes: number }[]
  runRate?: number
}

export const DEFAULT_FOLD_SETTINGS: FoldFinishingSettings = {
  hourlyRate: 60,
  markupPercent: 300,
  brokerDiscountPercent: 30,
  longSheetSetupFee: 35,
  handFoldHourlyRate: 25,
  handFoldRatePerPiece: 0.25,
  minimumJobPrice: 45,
  runRate: 30,
  setupLevels: [
    { label: "Level 1", minutes: 5 },
    { label: "Level 2", minutes: 7 },
    { label: "Level 3", minutes: 10 },
    { label: "Level 4", minutes: 12 },
    { label: "Level 5", minutes: 15 },
  ],
}

// ── Result types (unchanged -- UI depends on these) ──
export interface FoldAlternative {
  type: "switch_finish" | "switch_paper" | "switch_fold"
  label: string
  description: string
  finishType?: string
  paperName?: string
  foldType?: string
}

export interface FoldFinishResult {
  baseCost: number
  setupCost: number
  sellPrice: number
  isMinApplied: boolean
  isLongSheet: boolean
  warnings: string[]
  suggestion: string | null
  foldedDimensions: { w: number; h: number } | null
  matchedSize: string
  paperCategory: string
  resolution: "ok" | "hand" | "score_only" | "na"
  autoLevel: number | null
  alternatives: FoldAlternative[]
  fromBridge?: boolean
}

export interface FoldFinishInput {
  openWidth: number
  openHeight: number
  qty: number
  paperName: string
  finishType: "fold" | "score_and_fold" | "score_only"
  foldType: string
  isBroker: boolean
  orientation: "width" | "height"
}

// ── Paper name → fold data key mapping ──
// Mapping from the FINAL HTML calculator data:
//   FOLD has: "80text" (80 Text / 60lb / 70lb), "100text" (100 Text)
//   SF has:   "100text_80cover" (100 Text / 80 Cover), "cardstock" (Card Stock Any)
//
// Rules:
//   - 20lb Offset: too thin -> no fold, no S&F
//   - 60lb Offset: FOLD under "80text", no S&F
//   - 80lb Text Gloss: FOLD under "80text", no S&F
//   - 100lb Text Gloss: FOLD under "100text", S&F under "100text_80cover"
//   - 65/67 Cover: no fold (cover stock), S&F under "cardstock" (same as 10pt/12pt)
//   - 80 Cover Gloss: no fold (cover stock), S&F under "100text_80cover"
//   - 10pt/12pt/14pt (any cardstock): no fold, S&F under "cardstock"
//   - Sticker: no fold, no S&F
export function mapPaperToFoldKey(paperName: string): { foldKey: string | null; sfKey: string | null } {
  const lower = paperName.toLowerCase()
  // 20lb Offset -- too thin for fold or S&F
  if (lower.includes("20lb")) return { foldKey: null, sfKey: null }
  // Sticker -- not foldable or scoreable
  if (lower.includes("sticker")) return { foldKey: null, sfKey: null }
  // 60lb Offset -- FOLD only under "80text"
  if (lower.includes("60lb")) return { foldKey: "80text", sfKey: null }
  // 70lb Offset -- FOLD only under "80text"
  if (lower.includes("70lb")) return { foldKey: "80text", sfKey: null }
  // 80lb Text Gloss -- FOLD only under "80text"
  if (lower.includes("80lb text") || lower.includes("80 text")) return { foldKey: "80text", sfKey: null }
  // 100lb Text Gloss -- FOLD under "100text", S&F under "100text_80cover"
  if (lower.includes("100lb text") || lower.includes("100 text")) return { foldKey: "100text", sfKey: "100text_80cover" }
  // 80 Cover Gloss -- no fold, S&F under "100text_80cover"
  if (lower.includes("80 cover") || lower.includes("80cover")) return { foldKey: null, sfKey: "100text_80cover" }
  // 65/67 Cover -- cardstock, no fold, S&F under "cardstock" (same as 10pt/12pt/14pt)
  if (lower.includes("65 cover") || lower.includes("67 cover")) return { foldKey: null, sfKey: "cardstock" }
  // Cardstock: 10pt, 12pt, 14pt -- no fold, S&F under "cardstock"
  if (lower.includes("10pt") || lower.includes("12pt") || lower.includes("14pt") || lower.includes("card")) return { foldKey: null, sfKey: "cardstock" }
  // Fallback: unknown paper
  return { foldKey: null, sfKey: null }
}

// ── Fold type ID → data key mapping ──
// (still needed to translate UI fold type IDs to the data key names in the HTML file)
export function mapFoldTypeToDataKey(foldType: string): string {
  switch (foldType) {
    case "half": return "Fold in Half"
    case "tri": return "Fold in 3"
    case "z": return "Fold in 3"
    case "gate": return "Gate Fold"
    case "double_parallel": return "Fold in 4"
    case "accordion": return "Fold in 4"
    case "roll": return "Fold in 3"
    default: return "Fold in Half"
  }
}

// ── Validation warnings ──
// Exact port of all rules from original HTML calculator (Rules page lines 232-242):
//   Rule 1: N/A options show the closest alternative
//   Rule 2: Score & Fold N/A → "Score Only." Otherwise change size/paper
//   Rule 3: Max trifold height = 11"
//   Rule 4: Max fold width = 13" (length = any)
//   Rule 5: Level > 1 → auto-checks thicker paper; cheaper = auto-upgrade
//   Rule 6: Long sheets (13x26+) get a flat setup fee (Score & Fold only)
// Also from original HTML size limits:
//   - Trifold max height: 11"
//   - Max fold width: 13"
//   - Length: no limit
//   - No universal minimum fold size -- matchSize maps all small sheets to "7x4" or "7.5x5" tier
export interface FoldWarning {
  type: "amber" | "red" | "blue"
  message: string
}

export function validateFoldCombo(w: number, h: number, finish: string, axis: "w" | "h"): FoldWarning[] {
  const warnings: FoldWarning[] = []
  const f = finish.replace("Score & ", "")
  const divW = axis === "w"
  const foldDim = divW ? w : h
  let panels: number
  if (f === "Fold in Half") panels = 2
  else if (f === "Fold in 3") panels = 3
  else if (f === "Fold in 4" || f === "Gate Fold") panels = 4
  else panels = 1
  const foldedDim = panels > 1 ? foldDim / panels : foldDim
  const foldedW = divW ? foldedDim : w
  const fh = divW ? h : foldedDim

  // Rule 3: Trifold max height = 11"
  if (f === "Fold in 3") {
    const maxH = divW ? h : fh
    if (maxH > 11) warnings.push({ type: "amber", message: `Rule 3: Trifold max height is 11" -- your finished height is ${maxH.toFixed(2)}".` })
  }

  // Rule 4: Max fold width = 13"
  if (foldedW > 13) warnings.push({ type: "amber", message: `Rule 4: Max fold width is 13" -- your folded width would be ${foldedW.toFixed(2)}".` })

  // Note: there is no universal minimum size in the original HTML calculator.
  // The matchSize function maps ANY small sheet to "7x4" or "7.5x5" tier,
  // and the data entries handle availability (l:"na" + alt text) per tier.

  return warnings
}

// ============================================================
// COMMENTED OUT: All local calculation functions
// The bridge API (/api/fold-calc) now handles ALL pricing
// by executing the original HTML calculator code.
// ============================================================

/*
// ── FALLBACK: Core pricing function ──
export function calculateFoldPrice(opt, qty, isLong, settings) { ... }

// ── Auto-upgrade check ──
export function findAutoUpgrade(cat, paperKey, sizeKey, finish, qty, isLong, settings) { ... }

// ── Resolve finish entry ──
export function resolveFinishEntry(cat, paperKey, sizeKey, finish) { ... }

// ── ALTERNATIVES FINDER ──
function findAlternatives(openWidth, openHeight, qty, paperName, currentFinishType, currentFoldType, isBroker, cfg) { ... }

// ── Main sync entry point ──
export function calculateFoldFinish(input, settings) { ... }
*/

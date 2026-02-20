// ============================================================
// Finishing Fold Pricing Engine — ported from HTML calculator
// ============================================================

import {
  FOLD_DATA,
  SF_DATA,
  type FoldFinishEntry,
  type FoldCategory,
  matchFoldSize,
} from "./finishing-fold-data"

// ── Settings type ──
export interface FoldFinishingSettings {
  /** Labor rate $/hr for setup */
  labor: number
  /** Running rate $/hr for production */
  run: number
  /** Markup percentage (e.g. 300 = 300% markup) */
  markup: number
  /** Broker discount percentage (e.g. 30 = 30% off retail) */
  brokerDiscount: number
  /** Long sheet flat setup fee $ (Score & Fold only) */
  longSetup: number
  /** Setup minutes per level (1-5) */
  levels: Record<number, number>
}

export const DEFAULT_FOLD_SETTINGS: FoldFinishingSettings = {
  labor: 60,
  run: 30,
  markup: 300,
  brokerDiscount: 30,
  longSetup: 35,
  levels: { 1: 5, 2: 7, 3: 10, 4: 12, 5: 15 },
}

// ── Price result ──
export interface FoldPriceResult {
  level: number
  setupMinutes: number
  setupCost: number
  longFee: number
  runSeconds: number
  runMinutes: number
  runCost: number
  base: number
  retail: number
  broker: number
  perPiece: number
  brokerPerPiece: number
  batchSize: number
  secondsPerBatch: number
  isLong: boolean
  isScoreOnly: boolean
}

// ── Core pricing function (exact port of priceIt) ──
export function calculateFoldPrice(
  opt: FoldFinishEntry,
  qty: number,
  isLong: boolean,
  settings: FoldFinishingSettings
): FoldPriceResult | null {
  const lv = opt.l
  if (typeof lv !== "number" || !opt.b || !opt.s) return null

  const setupMin = settings.levels[lv] || 5
  const setupCost = (setupMin / 60) * settings.labor
  const longFee = isLong ? settings.longSetup : 0

  const runSec = (qty / opt.b) * opt.s
  const runMin = runSec / 60
  const runCost = (runMin / 60) * settings.run

  const base = setupCost + longFee + runCost
  const retail = base * (1 + settings.markup / 100)
  const broker = retail * (1 - settings.brokerDiscount / 100)

  return {
    level: lv,
    setupMinutes: setupMin,
    setupCost,
    longFee,
    runSeconds: runSec,
    runMinutes: runMin,
    runCost,
    base,
    retail,
    broker,
    perPiece: retail / qty,
    brokerPerPiece: broker / qty,
    batchSize: opt.b,
    secondsPerBatch: opt.s,
    isLong,
    isScoreOnly: !!opt.so,
  }
}

// ── Auto-upgrade check (Rule 5) ──
// When level > 1, check if a thicker paper results in cheaper pricing
export interface UpgradeResult {
  upgradedEntry: FoldFinishEntry
  upgradedPaperLabel: string
  upgradedPrice: FoldPriceResult
  originalPrice: FoldPriceResult
  savings: number
}

export function findAutoUpgrade(
  cat: FoldCategory,
  paperKey: string,
  sizeKey: string,
  finish: string,
  qty: number,
  isLong: boolean,
  settings: FoldFinishingSettings
): UpgradeResult | null {
  const db = cat === "folding" ? FOLD_DATA : SF_DATA
  const currentPaper = db[paperKey]
  if (!currentPaper) return null

  const currentSizeData = currentPaper.sizes[sizeKey]
  if (!currentSizeData) return null

  const currentOpt = currentSizeData[finish] as FoldFinishEntry | undefined
  if (!currentOpt || typeof currentOpt.l !== "number" || currentOpt.l <= 1) return null

  const origPrice = calculateFoldPrice(currentOpt, qty, isLong, settings)
  if (!origPrice) return null

  let best: UpgradeResult | null = null

  for (const [pk, pv] of Object.entries(db)) {
    if (pk === paperKey || pv.thick <= currentPaper.thick) continue

    const sd = pv.sizes[sizeKey]
    if (!sd) continue

    const fd = sd[finish] as FoldFinishEntry | undefined
    if (!fd || fd.l === "na" || fd.l === "hand" || typeof fd.l !== "number") continue

    if (fd.l < currentOpt.l) {
      const trial = calculateFoldPrice(fd, qty, isLong, settings)
      if (trial && trial.retail < origPrice.retail) {
        const savings = origPrice.retail - trial.retail
        if (!best || savings > best.savings) {
          best = {
            upgradedEntry: fd,
            upgradedPaperLabel: pv.label,
            upgradedPrice: trial,
            originalPrice: origPrice,
            savings,
          }
        }
      }
    }
  }

  return best
}

// ── Validation warnings ──
export interface FoldWarning {
  type: "amber" | "red" | "blue"
  message: string
}

export function validateFoldCombo(
  w: number,
  h: number,
  finish: string,
  axis: "w" | "h"
): FoldWarning[] {
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

  // Rule 3: Trifold max height
  if (f === "Fold in 3") {
    const maxH = divW ? h : fh
    if (maxH > 11) {
      warnings.push({
        type: "amber",
        message: `Rule 3: Trifold max height is 11" -- your finished height is ${maxH.toFixed(2)}".`,
      })
    }
  }

  // Rule 4: Max fold width
  if (foldedW > 13) {
    warnings.push({
      type: "amber",
      message: `Rule 4: Max fold width is 13" -- your folded width would be ${foldedW.toFixed(2)}".`,
    })
  }

  return warnings
}

// ── Resolve finish entry with N/A + score-only + hand handling ──
export interface ResolvedFinish {
  status: "ok" | "score_only" | "hand" | "na"
  entry: FoldFinishEntry | null
  message?: string
}

export function resolveFinishEntry(
  cat: FoldCategory,
  paperKey: string,
  sizeKey: string,
  finish: string
): ResolvedFinish {
  const db = cat === "folding" ? FOLD_DATA : SF_DATA
  const paper = db[paperKey]
  if (!paper) return { status: "na", entry: null, message: "Paper type not found" }

  const sizeData = paper.sizes[sizeKey]
  if (!sizeData) return { status: "na", entry: null, message: `No pricing data for ${paper.label} at ${sizeKey}` }

  const opt = sizeData[finish] as FoldFinishEntry | undefined
  if (!opt) return { status: "na", entry: null, message: `${finish} not found for this size/paper combo` }

  // Hand fold
  if (opt.l === "hand") {
    return { status: "hand", entry: opt, message: "Hand Fold -- Manual calc needed. Contact production." }
  }

  // N/A with score-only fallback
  if (opt.l === "na" && opt.so) {
    return {
      status: "score_only",
      entry: opt,
      message: "Score Only -- Full fold N/A. Pricing as Score Only.",
    }
  }

  // N/A no fallback
  if (opt.l === "na") {
    return {
      status: "na",
      entry: null,
      message: opt.alt || "Not available for this combination.",
    }
  }

  // OK -- also check if score-only flag is set
  if (opt.so) {
    return { status: "score_only", entry: opt }
  }

  return { status: "ok", entry: opt }
}

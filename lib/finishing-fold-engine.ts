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

// ── Settings type (matches the settings UI) ──
export interface FoldFinishingSettings {
  /** Hourly rate $/hr for setup & production */
  hourlyRate: number
  /** Markup percentage (e.g. 300 = 4x multiplier) */
  markupPercent: number
  /** Broker discount percentage (e.g. 30 = 30% off retail) */
  brokerDiscountPercent: number
  /** Long sheet flat setup fee $ */
  longSheetSetupFee: number
  /** Hand fold hourly rate */
  handFoldHourlyRate: number
  /** Minimum job price $ */
  minimumJobPrice: number
  /** Setup levels: label + minutes */
  setupLevels: { label: string; minutes: number }[]
}

export const DEFAULT_FOLD_SETTINGS: FoldFinishingSettings = {
  hourlyRate: 60,
  markupPercent: 300,
  brokerDiscountPercent: 30,
  longSheetSetupFee: 35,
  handFoldHourlyRate: 25,
  minimumJobPrice: 45,
  setupLevels: [
    { label: "Level 1", minutes: 5 },
    { label: "Level 2", minutes: 7 },
    { label: "Level 3", minutes: 10 },
    { label: "Level 4", minutes: 12 },
    { label: "Level 5", minutes: 15 },
  ],
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
  // Level can be a number, "na" (score-only with b/s), or "hand"
  const lv = opt.l
  if (!opt.b || !opt.s) return null
  // For score-only entries, l is "na" but b/s are present — use level 3 as default
  const effectiveLevel = typeof lv === "number" ? lv : 3
  if (lv === "hand") return null

  // Level is 1-indexed in data, 0-indexed in setupLevels array
  const levelIdx = Math.max(0, Math.min(effectiveLevel - 1, settings.setupLevels.length - 1))
  const setupMin = settings.setupLevels[levelIdx]?.minutes || 5
  const setupCost = (setupMin / 60) * settings.hourlyRate
  const longFee = isLong ? settings.longSheetSetupFee : 0

  const runSec = (qty / opt.b) * opt.s
  const runMin = runSec / 60
  const runCost = (runMin / 60) * settings.hourlyRate

  const base = setupCost + longFee + runCost
  const retail = base * (1 + settings.markupPercent / 100)
  const broker = retail * (1 - settings.brokerDiscountPercent / 100)

  return {
    level: effectiveLevel,
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

// ── Paper name → fold data key mapping ──
function mapPaperToFoldKey(paperName: string): { foldKey: string | null; sfKey: string | null } {
  const lower = paperName.toLowerCase()

  // 80 Text / 60lb / 70lb → FOLD only
  if (lower.includes("60lb") || lower.includes("70lb") || lower.includes("80lb text")) {
    return { foldKey: "80text_60_70", sfKey: null }
  }
  // 100 Text → FOLD only
  if (lower.includes("100lb text") || lower.includes("100 text")) {
    return { foldKey: "100text", sfKey: null }
  }
  // 80 Cover / 67 Cover → SF
  if (lower.includes("80 cover") || lower.includes("67 cover") || lower.includes("80cover")) {
    return { foldKey: null, sfKey: "100text_80cover" }
  }
  // Cardstock / 10pt / 12pt / 14pt → SF cardstock
  if (lower.includes("10pt") || lower.includes("12pt") || lower.includes("14pt") || lower.includes("card")) {
    return { foldKey: null, sfKey: "cardstock" }
  }
  // 20lb / sticker → treat like 80 text for folds
  if (lower.includes("20lb") || lower.includes("sticker")) {
    return { foldKey: "80text_60_70", sfKey: null }
  }
  // Fallback
  return { foldKey: "80text_60_70", sfKey: "100text_80cover" }
}

// ── Fold type ID → data key mapping ──
function mapFoldTypeToDataKey(foldType: string): string {
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

// ── HIGH-LEVEL API ──
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
  /** The level auto-detected from the data (1-5), null if N/A or hand */
  autoLevel: number | null
}

export function calculateFoldFinish(
  input: FoldFinishInput,
  settings?: FoldFinishingSettings,
): FoldFinishResult {
  const cfg = settings || DEFAULT_FOLD_SETTINGS
  const { openWidth, openHeight, qty, paperName, finishType, foldType, isBroker, orientation } = input

  // Determine category and paper key
  const cat: FoldCategory = finishType === "fold" ? "folding" : "sf"
  const paperMap = mapPaperToFoldKey(paperName)
  const paperKey = cat === "folding" ? paperMap.foldKey : paperMap.sfKey
  const paperLabel = cat === "folding" ? "text" : (paperKey === "cardstock" ? "cardstock" : "cover")

  if (!paperKey) {
    return {
      baseCost: 0, setupCost: 0, sellPrice: 0,
      isMinApplied: false, isLongSheet: false,
      warnings: [`${finishType === "fold" ? "Folding" : "Score & Fold"} not available for ${paperName}`],
      suggestion: finishType === "fold"
        ? "This paper may require scoring. Try Score & Fold."
        : "This paper may only need folding. Try Fold.",
      foldedDimensions: null,       matchedSize: "N/A", paperCategory: paperLabel,
      resolution: "na", autoLevel: null,
    }
  }

  // Match size tier
  const sizeKey = matchFoldSize(openWidth, openHeight, cat)
  const isLong = sizeKey === "long"

  // Map fold type ID to data key with prefix
  const dataFoldKey = mapFoldTypeToDataKey(foldType)
  const finishDataKey = cat === "sf" ? `Score & ${dataFoldKey}` : dataFoldKey

  // Resolve entry
  const resolved = resolveFinishEntry(cat, paperKey, sizeKey, finishDataKey)

  // Calculate fold dimensions
  const axis = orientation === "width" ? "w" : "h"
  const foldDim = axis === "w" ? openWidth : openHeight
  let panels: number
  const f = dataFoldKey
  if (f === "Fold in Half") panels = 2
  else if (f === "Fold in 3") panels = 3
  else if (f === "Fold in 4" || f === "Gate Fold") panels = 4
  else panels = 1
  const divided = panels > 1 ? foldDim / panels : foldDim
  const foldedW = axis === "w" ? Math.round(divided * 100) / 100 : openWidth
  const foldedH = axis === "w" ? openHeight : Math.round(divided * 100) / 100

  // Warnings from validation
  const validationWarnings = validateFoldCombo(openWidth, openHeight, finishDataKey, axis)
  const warnings = validationWarnings.map((w) => w.message)

  if (resolved.status === "na") {
    return {
      baseCost: 0, setupCost: 0, sellPrice: 0,
      isMinApplied: false, isLongSheet: isLong,
      warnings: [...warnings, resolved.message || "Not available"],
      suggestion: null,
      foldedDimensions: { w: foldedW, h: foldedH },
      matchedSize: sizeKey, paperCategory: paperLabel,
      resolution: "na", autoLevel: null,
    }
  }

  if (resolved.status === "hand") {
    // Hand fold: estimate based on hourly rate
    const estimatedMinutes = (qty / 500) * 60 // rough: 500 pieces/hr
    const handCost = (estimatedMinutes / 60) * cfg.handFoldHourlyRate
    const sellPrice = Math.max(handCost * (1 + cfg.markupPercent / 100), cfg.minimumJobPrice)
    return {
      baseCost: handCost, setupCost: 0, sellPrice: isBroker ? sellPrice * (1 - cfg.brokerDiscountPercent / 100) : sellPrice,
      isMinApplied: sellPrice === cfg.minimumJobPrice,
      isLongSheet: isLong,
      warnings: [...warnings, "Hand fold required -- machine fold not available"],
      suggestion: null,
      foldedDimensions: { w: foldedW, h: foldedH },
      matchedSize: sizeKey, paperCategory: paperLabel,
      resolution: "hand", autoLevel: null,
    }
  }

  // Calculate price using entry
  const entry = resolved.entry!
  const priceResult = calculateFoldPrice(entry, qty, isLong, cfg)

  if (!priceResult) {
    return {
      baseCost: 0, setupCost: 0, sellPrice: 0,
      isMinApplied: false, isLongSheet: isLong,
      warnings: [...warnings, "Could not calculate price"],
      suggestion: null,
      foldedDimensions: { w: foldedW, h: foldedH },
      matchedSize: sizeKey, paperCategory: paperLabel,
      resolution: "na", autoLevel: null,
    }
  }

  const sellPrice = isBroker ? priceResult.broker : priceResult.retail
  const finalPrice = Math.max(sellPrice, cfg.minimumJobPrice)
  const isMin = finalPrice === cfg.minimumJobPrice && sellPrice < cfg.minimumJobPrice

  // Check for auto-upgrade suggestion
  let suggestion: string | null = null
  const upgrade = findAutoUpgrade(cat, paperKey, sizeKey, finishDataKey, qty, isLong, cfg)
  if (upgrade) {
    const upgradeSell = isBroker ? upgrade.upgradedPrice.broker : upgrade.upgradedPrice.retail
    suggestion = `Upgrade to ${upgrade.upgradedPaperLabel}: save $${upgrade.savings.toFixed(2)} (${isBroker ? "broker" : "retail"}: $${upgradeSell.toFixed(2)} vs $${sellPrice.toFixed(2)})`
  }

  if (resolved.status === "score_only") {
    warnings.push("Score only -- no machine fold available")
  }

  return {
    baseCost: priceResult.base,
    setupCost: priceResult.setupCost + priceResult.longFee,
    sellPrice: finalPrice,
    isMinApplied: isMin,
    isLongSheet: isLong,
    warnings,
    suggestion,
    foldedDimensions: { w: foldedW, h: foldedH },
    matchedSize: sizeKey,
    paperCategory: paperLabel,
    resolution: resolved.status,
    autoLevel: priceResult.level,
  }
}

// ============================================================
// Finishing Fold Pricing Engine
// ============================================================
// This engine now calls the ORIGINAL calculator via the bridge
// API (/api/fold-calc) which reads calculators/fold-score-calculator.html.
//
// If the bridge is unavailable (HTML not uploaded yet), it falls
// back to the commented-out local data below.
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
  hourlyRate: number
  markupPercent: number
  brokerDiscountPercent: number
  longSheetSetupFee: number
  handFoldHourlyRate: number
  minimumJobPrice: number
  setupLevels: { label: string; minutes: number }[]
  /** Hourly rate for machine running (original code uses separate "run" rate) */
  runRate?: number
}

export const DEFAULT_FOLD_SETTINGS: FoldFinishingSettings = {
  hourlyRate: 60,
  markupPercent: 300,
  brokerDiscountPercent: 30,
  longSheetSetupFee: 35,
  handFoldHourlyRate: 25,
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

// ── FALLBACK: Core pricing function (used only when bridge unavailable) ──
export function calculateFoldPrice(
  opt: FoldFinishEntry,
  qty: number,
  isLong: boolean,
  settings: FoldFinishingSettings
): FoldPriceResult | null {
  const lv = opt.l
  if (!opt.b || !opt.s) return null
  const effectiveLevel = typeof lv === "number" ? lv : 3
  if (lv === "hand") return null

  const levelIdx = Math.max(0, Math.min(effectiveLevel - 1, settings.setupLevels.length - 1))
  const setupMin = settings.setupLevels[levelIdx]?.minutes || 5
  const setupCost = (setupMin / 60) * settings.hourlyRate
  const longFee = isLong ? settings.longSheetSetupFee : 0

  // Original code: (qty/b*s) / 60 / 60 * runRate
  const runRate = settings.runRate || settings.hourlyRate
  const runSec = (qty / opt.b) * opt.s
  const runMin = runSec / 60
  const runCost = (runMin / 60) * runRate

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
          best = { upgradedEntry: fd, upgradedPaperLabel: pv.label, upgradedPrice: trial, originalPrice: origPrice, savings }
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
  if (f === "Fold in 3") {
    const maxH = divW ? h : fh
    if (maxH > 11) warnings.push({ type: "amber", message: `Rule 3: Trifold max height is 11" -- your finished height is ${maxH.toFixed(2)}".` })
  }
  if (foldedW > 13) warnings.push({ type: "amber", message: `Rule 4: Max fold width is 13" -- your folded width would be ${foldedW.toFixed(2)}".` })
  return warnings
}

// ── Resolve finish entry ──
export interface ResolvedFinish {
  status: "ok" | "score_only" | "hand" | "na"
  entry: FoldFinishEntry | null
  message?: string
}

export function resolveFinishEntry(cat: FoldCategory, paperKey: string, sizeKey: string, finish: string): ResolvedFinish {
  const db = cat === "folding" ? FOLD_DATA : SF_DATA
  const paper = db[paperKey]
  if (!paper) return { status: "na", entry: null, message: "Paper type not found" }
  const sizeData = paper.sizes[sizeKey]
  if (!sizeData) return { status: "na", entry: null, message: `No pricing data for ${paper.label} at ${sizeKey}` }
  const opt = sizeData[finish] as FoldFinishEntry | undefined
  if (!opt) return { status: "na", entry: null, message: `${finish} not found for this size/paper combo` }
  if (opt.l === "hand") return { status: "hand", entry: opt, message: "Hand Fold -- Manual calc needed. Contact production." }
  if (opt.l === "na" && opt.so) return { status: "score_only", entry: opt, message: "Score Only -- Full fold N/A. Pricing as Score Only." }
  if (opt.l === "na") return { status: "na", entry: null, message: opt.alt || "Not available for this combination." }
  if (opt.so) return { status: "score_only", entry: opt }
  return { status: "ok", entry: opt }
}

// ── Paper name → fold data key mapping ──
function mapPaperToFoldKey(paperName: string): { foldKey: string | null; sfKey: string | null } {
  const lower = paperName.toLowerCase()
  if (lower.includes("60lb") || lower.includes("70lb") || lower.includes("80lb text")) return { foldKey: "80text_60_70", sfKey: null }
  if (lower.includes("100lb text") || lower.includes("100 text")) return { foldKey: "100text", sfKey: null }
  if (lower.includes("80 cover") || lower.includes("67 cover") || lower.includes("80cover")) return { foldKey: null, sfKey: "100text_80cover" }
  if (lower.includes("10pt") || lower.includes("12pt") || lower.includes("14pt") || lower.includes("card")) return { foldKey: null, sfKey: "cardstock" }
  if (lower.includes("20lb") || lower.includes("sticker")) return { foldKey: "80text_60_70", sfKey: null }
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

// ── ALTERNATIVES FINDER ──
function findAlternatives(
  openWidth: number, openHeight: number, qty: number, paperName: string,
  currentFinishType: string, currentFoldType: string, isBroker: boolean, cfg: FoldFinishingSettings,
): FoldAlternative[] {
  const alts: FoldAlternative[] = []
  const paperMap = mapPaperToFoldKey(paperName)
  const otherFinishTypes = [
    { id: "fold", label: "Fold", cat: "folding" as FoldCategory },
    { id: "score_and_fold", label: "Score & Fold", cat: "sf" as FoldCategory },
    { id: "score_only", label: "Score Only", cat: "sf" as FoldCategory },
  ].filter((ft) => ft.id !== currentFinishType)

  for (const ft of otherFinishTypes) {
    const pk = ft.cat === "folding" ? paperMap.foldKey : paperMap.sfKey
    if (!pk) continue
    const sk = matchFoldSize(openWidth, openHeight, ft.cat)
    const dk = mapFoldTypeToDataKey(currentFoldType)
    const fdk = ft.cat === "sf" ? `Score & ${dk}` : dk
    const resolved = resolveFinishEntry(ft.cat, pk, sk, fdk)
    if ((resolved.status === "ok" || resolved.status === "score_only") && resolved.entry) {
      const pr = calculateFoldPrice(resolved.entry, qty, sk === "long", cfg)
      if (pr) {
        const price = isBroker ? pr.broker : pr.retail
        alts.push({ type: "switch_finish", label: `Switch to ${ft.label}`, description: `$${Math.max(price, cfg.minimumJobPrice).toFixed(2)} with ${ft.label}`, finishType: ft.id })
      }
    }
  }

  const paperSuggestions: { name: string; cat: FoldCategory; key: string }[] = []
  if (!paperMap.foldKey && paperMap.sfKey) {
    paperSuggestions.push({ name: "80lb Text Gloss", cat: "folding", key: "80text_60_70" }, { name: "100lb Text Gloss", cat: "folding", key: "100text" })
  }
  if (paperMap.foldKey && !paperMap.sfKey) {
    paperSuggestions.push({ name: "80 Cover Gloss", cat: "sf", key: "100text_80cover" })
  }
  if (paperMap.sfKey === "cardstock") paperSuggestions.push({ name: "80 Cover Gloss", cat: "sf", key: "100text_80cover" })
  if (paperMap.sfKey === "100text_80cover") paperSuggestions.push({ name: "12pt Gloss", cat: "sf", key: "cardstock" })

  for (const ps of paperSuggestions) {
    const cat: FoldCategory = currentFinishType === "fold" ? "folding" : "sf"
    const pk = cat === ps.cat ? ps.key : null
    if (!pk) continue
    const sk = matchFoldSize(openWidth, openHeight, cat)
    const dk = mapFoldTypeToDataKey(currentFoldType)
    const fdk = cat === "sf" ? `Score & ${dk}` : dk
    const resolved = resolveFinishEntry(cat, pk, sk, fdk)
    if ((resolved.status === "ok" || resolved.status === "score_only") && resolved.entry) {
      const pr = calculateFoldPrice(resolved.entry, qty, sk === "long", cfg)
      if (pr) {
        const price = isBroker ? pr.broker : pr.retail
        alts.push({ type: "switch_paper", label: `Use ${ps.name}`, description: `$${Math.max(price, cfg.minimumJobPrice).toFixed(2)} on ${ps.name}`, paperName: ps.name })
      }
    }
  }

  const simplerFolds = [{ id: "half", label: "Fold in Half" }, { id: "tri", label: "Tri-Fold" }].filter((f) => f.id !== currentFoldType)
  for (const sf of simplerFolds) {
    const cat: FoldCategory = currentFinishType === "fold" ? "folding" : "sf"
    const pk = cat === "folding" ? paperMap.foldKey : paperMap.sfKey
    if (!pk) continue
    const sk = matchFoldSize(openWidth, openHeight, cat)
    const dk = mapFoldTypeToDataKey(sf.id)
    const fdk = cat === "sf" ? `Score & ${dk}` : dk
    const resolved = resolveFinishEntry(cat, pk, sk, fdk)
    if (resolved.status === "ok" && resolved.entry) {
      const pr = calculateFoldPrice(resolved.entry, qty, sk === "long", cfg)
      if (pr) {
        const price = isBroker ? pr.broker : pr.retail
        alts.push({ type: "switch_fold", label: `Use ${sf.label}`, description: `$${Math.max(price, cfg.minimumJobPrice).toFixed(2)} with ${sf.label}`, foldType: sf.id })
      }
    }
  }

  return alts
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
  /** true when pricing came from the original HTML calculator via bridge */
  fromBridge?: boolean
}

/**
 * Try the bridge API first. If it returns valid data, use it.
 * Otherwise fall back to the local (commented-out) logic.
 */
async function tryBridge(input: FoldFinishInput, cfg: FoldFinishingSettings): Promise<FoldFinishResult | null> {
  try {
    const cat: "folding" | "sf" = input.finishType === "fold" ? "folding" : "sf"
    const paperMap = mapPaperToFoldKey(input.paperName)
    const paperKey = cat === "folding" ? paperMap.foldKey : paperMap.sfKey
    if (!paperKey) return null

    const dataFoldKey = mapFoldTypeToDataKey(input.foldType)
    const finishDataKey = cat === "sf" ? `Score & ${dataFoldKey}` : dataFoldKey

    const resp = await fetch(`${typeof window !== "undefined" ? "" : "http://localhost:3000"}/api/fold-calc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cat,
        paperKey,
        w: input.openWidth,
        h: input.openHeight,
        finish: finishDataKey,
        qty: input.qty,
        axis: input.orientation === "width" ? "w" : "h",
        settings: {
          labor: cfg.hourlyRate,
          run: cfg.runRate || cfg.hourlyRate,
          markup: cfg.markupPercent,
          bdisc: cfg.brokerDiscountPercent,
          longSetup: cfg.longSheetSetupFee,
          lv: Object.fromEntries(cfg.setupLevels.map((s, i) => [i + 1, s.minutes])),
        },
      }),
    })

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      if (data.fallback) return null // bridge not loaded, use fallback
      return null
    }

    const data = await resp.json()

    if (data.error && data.resolution === "na") {
      // Bridge says N/A -- build result
      const axis = input.orientation === "width" ? "w" : "h"
      const divW = axis === "w"
      const foldDim = divW ? input.openWidth : input.openHeight
      const dk = dataFoldKey
      let panels = 1
      if (dk === "Fold in Half") panels = 2
      else if (dk === "Fold in 3") panels = 3
      else if (dk === "Fold in 4" || dk === "Gate Fold") panels = 4
      const divided = panels > 1 ? foldDim / panels : foldDim
      const foldedW = divW ? Math.round(divided * 100) / 100 : input.openWidth
      const foldedH = divW ? input.openHeight : Math.round(divided * 100) / 100
      const validationWarnings = validateFoldCombo(input.openWidth, input.openHeight, finishDataKey, axis)
      const warnings = [...validationWarnings.map((w) => w.message), data.error]

      // Get alternatives from local logic (faster than another API call)
      const alts = findAlternatives(input.openWidth, input.openHeight, input.qty, input.paperName, input.finishType, input.foldType, input.isBroker, cfg)

      return {
        baseCost: 0, setupCost: 0, sellPrice: 0,
        isMinApplied: false, isLongSheet: data.sizeKey === "long",
        warnings, suggestion: null,
        foldedDimensions: { w: foldedW, h: foldedH },
        matchedSize: data.sizeKey || "N/A",
        paperCategory: cat === "folding" ? "text" : (paperKey === "cardstock" ? "cardstock" : "cover"),
        resolution: data.resolution === "hand" ? "hand" : "na",
        autoLevel: null, alternatives: alts, fromBridge: true,
      }
    }

    if (data.price) {
      const p = data.price
      const axis = input.orientation === "width" ? "w" : "h"
      const divW = axis === "w"
      const foldDim = divW ? input.openWidth : input.openHeight
      const dk = dataFoldKey
      let panels = 1
      if (dk === "Fold in Half") panels = 2
      else if (dk === "Fold in 3") panels = 3
      else if (dk === "Fold in 4" || dk === "Gate Fold") panels = 4
      const divided = panels > 1 ? foldDim / panels : foldDim
      const foldedW = divW ? Math.round(divided * 100) / 100 : input.openWidth
      const foldedH = divW ? input.openHeight : Math.round(divided * 100) / 100
      const validationWarnings = validateFoldCombo(input.openWidth, input.openHeight, finishDataKey, axis)
      const warnings = validationWarnings.map((w) => w.message)
      if (data.isScoreOnly) warnings.push("Score only -- no machine fold available")

      const sellPrice = input.isBroker ? p.broker : p.retail
      const finalPrice = Math.max(sellPrice, cfg.minimumJobPrice)

      return {
        baseCost: p.base,
        setupCost: p.setupCost + p.longFee,
        sellPrice: finalPrice,
        isMinApplied: finalPrice === cfg.minimumJobPrice && sellPrice < cfg.minimumJobPrice,
        isLongSheet: data.isLong,
        warnings, suggestion: null,
        foldedDimensions: { w: foldedW, h: foldedH },
        matchedSize: data.sizeKey,
        paperCategory: cat === "folding" ? "text" : (paperKey === "cardstock" ? "cardstock" : "cover"),
        resolution: data.isScoreOnly ? "score_only" : "ok",
        autoLevel: p.level, alternatives: [], fromBridge: true,
      }
    }

    return null // unexpected response, fall back
  } catch {
    return null // network error, fall back
  }
}

/**
 * Main entry point. Tries bridge first, falls back to local logic.
 * The async version is preferred -- use calculateFoldFinishSync for
 * contexts where async isn't possible.
 */
export async function calculateFoldFinishAsync(
  input: FoldFinishInput,
  settings?: FoldFinishingSettings,
): Promise<FoldFinishResult> {
  const cfg = settings || DEFAULT_FOLD_SETTINGS

  // Try bridge first
  const bridgeResult = await tryBridge(input, cfg)
  if (bridgeResult) return bridgeResult

  // Fall back to local logic
  return calculateFoldFinish(input, cfg)
}

/**
 * Synchronous version (uses local data only -- no bridge).
 * This is the original logic, kept as fallback.
 */
export function calculateFoldFinish(
  input: FoldFinishInput,
  settings?: FoldFinishingSettings,
): FoldFinishResult {
  const cfg = settings || DEFAULT_FOLD_SETTINGS
  const { openWidth, openHeight, qty, paperName, finishType, foldType, isBroker, orientation } = input

  const cat: FoldCategory = finishType === "fold" ? "folding" : "sf"
  const paperMap = mapPaperToFoldKey(paperName)
  const paperKey = cat === "folding" ? paperMap.foldKey : paperMap.sfKey
  const paperLabel = cat === "folding" ? "text" : (paperKey === "cardstock" ? "cardstock" : "cover")

  if (!paperKey) {
    const alts = findAlternatives(openWidth, openHeight, qty, paperName, finishType, foldType, isBroker, cfg)
    return {
      baseCost: 0, setupCost: 0, sellPrice: 0,
      isMinApplied: false, isLongSheet: false,
      warnings: [`${finishType === "fold" ? "Folding" : "Score & Fold"} not available for ${paperName}`],
      suggestion: null, foldedDimensions: null, matchedSize: "N/A", paperCategory: paperLabel,
      resolution: "na", autoLevel: null, alternatives: alts,
    }
  }

  const sizeKey = matchFoldSize(openWidth, openHeight, cat)
  const isLong = sizeKey === "long"
  const dataFoldKey = mapFoldTypeToDataKey(foldType)
  const finishDataKey = cat === "sf" ? `Score & ${dataFoldKey}` : dataFoldKey
  const resolved = resolveFinishEntry(cat, paperKey, sizeKey, finishDataKey)

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

  const validationWarnings = validateFoldCombo(openWidth, openHeight, finishDataKey, axis)
  const warnings = validationWarnings.map((w) => w.message)

  if (resolved.status === "na") {
    const alts = findAlternatives(openWidth, openHeight, qty, paperName, finishType, foldType, isBroker, cfg)
    return {
      baseCost: 0, setupCost: 0, sellPrice: 0,
      isMinApplied: false, isLongSheet: isLong,
      warnings: [...warnings, resolved.message || "Not available"],
      suggestion: null, foldedDimensions: { w: foldedW, h: foldedH },
      matchedSize: sizeKey, paperCategory: paperLabel,
      resolution: "na", autoLevel: null, alternatives: alts,
    }
  }

  if (resolved.status === "hand") {
    const estimatedMinutes = (qty / 500) * 60
    const handCost = (estimatedMinutes / 60) * cfg.handFoldHourlyRate
    const sellPrice = Math.max(handCost * (1 + cfg.markupPercent / 100), cfg.minimumJobPrice)
    const alts = findAlternatives(openWidth, openHeight, qty, paperName, finishType, foldType, isBroker, cfg)
    return {
      baseCost: handCost, setupCost: 0, sellPrice: isBroker ? sellPrice * (1 - cfg.brokerDiscountPercent / 100) : sellPrice,
      isMinApplied: sellPrice === cfg.minimumJobPrice, isLongSheet: isLong,
      warnings: [...warnings, "Hand fold required -- machine fold not available"],
      suggestion: null, foldedDimensions: { w: foldedW, h: foldedH },
      matchedSize: sizeKey, paperCategory: paperLabel,
      resolution: "hand", autoLevel: null, alternatives: alts,
    }
  }

  const entry = resolved.entry!
  const priceResult = calculateFoldPrice(entry, qty, isLong, cfg)

  if (!priceResult) {
    const alts = findAlternatives(openWidth, openHeight, qty, paperName, finishType, foldType, isBroker, cfg)
    return {
      baseCost: 0, setupCost: 0, sellPrice: 0,
      isMinApplied: false, isLongSheet: isLong,
      warnings: [...warnings, "Could not calculate price"],
      suggestion: null, foldedDimensions: { w: foldedW, h: foldedH },
      matchedSize: sizeKey, paperCategory: paperLabel,
      resolution: "na", autoLevel: null, alternatives: alts,
    }
  }

  const sellPrice = isBroker ? priceResult.broker : priceResult.retail
  const finalPrice = Math.max(sellPrice, cfg.minimumJobPrice)
  const isMin = finalPrice === cfg.minimumJobPrice && sellPrice < cfg.minimumJobPrice

  if (resolved.status === "score_only") warnings.push("Score only -- no machine fold available")

  return {
    baseCost: priceResult.base,
    setupCost: priceResult.setupCost + priceResult.longFee,
    sellPrice: finalPrice,
    isMinApplied: isMin, isLongSheet: isLong,
    warnings, suggestion: null,
    foldedDimensions: { w: foldedW, h: foldedH },
    matchedSize: sizeKey, paperCategory: paperLabel,
    resolution: resolved.status,
    autoLevel: priceResult.level, alternatives: [],
  }
}

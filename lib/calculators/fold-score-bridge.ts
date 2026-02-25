// ============================================================
// Fold / Score & Fold Calculator Bridge
// ============================================================
// Reads the FINAL HTML calculator from calculators/fold-score-calculator.html
// Extracts the <script> block and executes it to get the real
// FOLD, SF, SIZE_MAP, FIN, FS, matchSz, foldM, priceIt functions.
// ============================================================

import fs from "fs"
import path from "path"
import vm from "vm"

// ── Types matching the original HTML data structures ──
export interface OriginalFoldEntry {
  l: number | "na" | "hand"
  b?: number
  s?: number
  long?: boolean
  alt?: string
  so?: number // score-only flag (1 = score only available, fold N/A)
}

export interface OriginalSizeEntry {
  lbl: string
  isLong?: boolean
  [finishName: string]: OriginalFoldEntry | string | boolean | undefined
}

export interface OriginalPaperEntry {
  label: string
  thick: number
  min: string // e.g. "7×4", "7.5×5"
  sizes: Record<string, OriginalSizeEntry>
}

export interface OriginalPriceResult {
  lv: number
  sm: number
  sc: number
  longFee: number
  rm: number
  rc: number
  base: number
  retail: number
  broker: number
  pp: number
  bp: number
  b: number
  s: number
}

export interface OriginalFoldMathResult {
  fw: number
  fh: number
  panels: number
  divW: boolean
}

export interface SizeMapEntry {
  key: string
  label: string
  minW: number
  maxW?: number
  minH: number
  maxH?: number
}

// ── Sandbox context to hold the extracted functions ──
interface CalcContext {
  FOLD: Record<string, OriginalPaperEntry>
  SF: Record<string, OriginalPaperEntry>
  FIN: { folding: string[]; sf: string[] }
  FS: Record<string, string>
  SIZE_MAP: SizeMapEntry[]
  matchSz: (w: number, h: number, cat: string, db: Record<string, OriginalPaperEntry>, paper: string) => string | null
  foldM: (w: number, h: number, finish: string, ori: string) => OriginalFoldMathResult
  priceIt: (opt: OriginalFoldEntry, qty: number, isLong: boolean) => OriginalPriceResult | null
  S: { labor: number; run: number; markup: number; bdisc: number; broker: boolean; upgrade: boolean; longSetup: number; lv: Record<number, number> }
}

let _ctx: CalcContext | null = null
let _loadError: string | null = null
let _lastLoadTime = 0
const CACHE_TTL_MS = 5000

function loadCalculator(): CalcContext | null {
  const now = Date.now()
  if (_ctx && (now - _lastLoadTime) < CACHE_TTL_MS) return _ctx
  _ctx = null
  _loadError = null

  try {
    const possiblePaths = [
      path.join(process.cwd(), "calculators", "fold-score-calculator.html"),
      path.join(__dirname, "..", "..", "calculators", "fold-score-calculator.html"),
    ]

    let htmlContent: string | null = null
    for (const p of possiblePaths) {
      try {
        htmlContent = fs.readFileSync(p, "utf-8")
        break
      } catch {
        continue
      }
    }

    if (!htmlContent) {
      _loadError = "fold-score-calculator.html not found in calculators/ folder"
      console.warn("[fold-score-bridge]", _loadError)
      return null
    }

    const scriptMatch = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
    if (!scriptMatch || !scriptMatch[1]) {
      _loadError = "No <script> block found in fold-score-calculator.html"
      console.warn("[fold-score-bridge]", _loadError)
      return null
    }

    const scriptCode = scriptMatch[1]

    // Extract data blocks
    const foldMatch = scriptCode.match(/const\s+FOLD\s*=\s*(\{[\s\S]*?\});/)
    const sfMatch = scriptCode.match(/const\s+SF\s*=\s*(\{[\s\S]*?\});/)
    const sizeMapMatch = scriptCode.match(/const\s+SIZE_MAP\s*=\s*(\[[\s\S]*?\]);/)
    const finMatch = scriptCode.match(/const\s+FIN\s*=\s*(\{[\s\S]*?\});/)
    const fsMatch = scriptCode.match(/const\s+FS\s*=\s*(\{[\s\S]*?\});/)
    const sMatch = scriptCode.match(/let\s+S\s*=\s*(\{[^}]+\})\s*;/)

    // Extract pure functions
    function extractFunction(code: string, name: string): string | null {
      const startRegex = new RegExp(`function\\s+${name}\\s*\\(`)
      const match = startRegex.exec(code)
      if (!match) return null
      const start = match.index
      let depth = 0
      let inStr: string | null = null
      for (let i = start; i < code.length; i++) {
        const ch = code[i]
        if (inStr) { if (ch === inStr && code[i - 1] !== "\\") inStr = null; continue }
        if (ch === "'" || ch === '"' || ch === "`") { inStr = ch; continue }
        if (ch === "{") depth++
        if (ch === "}") { depth--; if (depth === 0) return code.slice(start, i + 1) }
      }
      return null
    }

    const matchSzFn = extractFunction(scriptCode, "matchSz")
    const foldMFn = extractFunction(scriptCode, "foldM")
    const priceItFn = extractFunction(scriptCode, "priceIt")

    if (!foldMatch || !sfMatch || !matchSzFn || !foldMFn || !priceItFn) {
      _loadError = `Could not extract required code. FOLD:${!!foldMatch} SF:${!!sfMatch} matchSz:${!!matchSzFn} foldM:${!!foldMFn} priceIt:${!!priceItFn}`
      console.warn("[fold-score-bridge]", _loadError)
      return null
    }

    // Build clean script
    const cleanScript = [
      `var FOLD = ${foldMatch[1]};`,
      `var SF = ${sfMatch[1]};`,
      sizeMapMatch ? `var SIZE_MAP = ${sizeMapMatch[1]};` : `var SIZE_MAP = [];`,
      finMatch ? `var FIN = ${finMatch[1]};` : `var FIN = {folding:[],sf:[]};`,
      fsMatch ? `var FS = ${fsMatch[1]};` : `var FS = {};`,
      sMatch ? `var S = ${sMatch[1]};` : `var S = {labor:60,run:30,markup:300,bdisc:30,broker:false,upgrade:true,longSetup:35,lv:{1:5,2:7,3:10,4:12,5:15}};`,
      matchSzFn,
      foldMFn,
      priceItFn,
    ].join("\n\n")

    const sandbox: Record<string, unknown> = {
      console: { log: () => {}, warn: () => {}, error: () => {} },
      parseInt,
      parseFloat,
      Math,
      isNaN,
    }

    const context = vm.createContext(sandbox)
    vm.runInContext(cleanScript, context, { timeout: 2000 })

    _ctx = {
      FOLD: sandbox.FOLD as CalcContext["FOLD"],
      SF: sandbox.SF as CalcContext["SF"],
      FIN: sandbox.FIN as CalcContext["FIN"],
      FS: sandbox.FS as CalcContext["FS"],
      SIZE_MAP: sandbox.SIZE_MAP as CalcContext["SIZE_MAP"],
      matchSz: sandbox.matchSz as CalcContext["matchSz"],
      foldM: sandbox.foldM as CalcContext["foldM"],
      priceIt: sandbox.priceIt as CalcContext["priceIt"],
      S: sandbox.S as CalcContext["S"],
    }

    _lastLoadTime = Date.now()
    console.log("[fold-score-bridge] Successfully loaded FINAL fold-score-calculator.html")
    console.log("[fold-score-bridge] FOLD keys:", Object.keys(_ctx.FOLD))
    console.log("[fold-score-bridge] SF keys:", Object.keys(_ctx.SF))
    return _ctx
  } catch (err) {
    _loadError = `Failed to load calculator: ${err instanceof Error ? err.message : String(err)}`
    console.error("[fold-score-bridge]", _loadError)
    return null
  }
}

// ── Public API ──

export function isCalculatorLoaded(): boolean {
  return loadCalculator() !== null
}

export function getLoadError(): string | null {
  loadCalculator()
  return _loadError
}

export function getFOLD(): Record<string, OriginalPaperEntry> {
  const ctx = loadCalculator()
  return ctx?.FOLD || {}
}

export function getSF(): Record<string, OriginalPaperEntry> {
  const ctx = loadCalculator()
  return ctx?.SF || {}
}

export function getFIN(): { folding: string[]; sf: string[] } {
  const ctx = loadCalculator()
  return ctx?.FIN || { folding: [], sf: [] }
}

export function getFS(): Record<string, string> {
  const ctx = loadCalculator()
  return ctx?.FS || {}
}

export function getSIZE_MAP(): SizeMapEntry[] {
  const ctx = loadCalculator()
  return ctx?.SIZE_MAP || []
}

export function getSettings(): CalcContext["S"] {
  const ctx = loadCalculator()
  return ctx?.S || { labor: 60, run: 30, markup: 300, bdisc: 30, broker: false, upgrade: true, longSetup: 35, lv: { 1: 5, 2: 7, 3: 10, 4: 12, 5: 15 } }
}

export function updateSettings(newSettings: Partial<CalcContext["S"]>): void {
  const ctx = loadCalculator()
  if (ctx) {
    Object.assign(ctx.S, newSettings)
  }
}

/**
 * Call the original matchSz(w, h, cat, db, paper) function.
 * Returns the size tier key or null if sheet is too small.
 */
export function bridgeMatchSize(w: number, h: number, cat: string, paperKey: string): string | null {
  const ctx = loadCalculator()
  if (!ctx) return "8.5x5.5" // safe fallback
  const db = cat === "folding" ? ctx.FOLD : ctx.SF
  return ctx.matchSz(w, h, cat, db, paperKey)
}

/**
 * Call the original foldM(w, h, finish, ori) function.
 */
export function bridgeFoldMath(w: number, h: number, finish: string, ori: "w" | "h" = "w"): OriginalFoldMathResult {
  const ctx = loadCalculator()
  if (!ctx) return { fw: w, fh: h, panels: 1, divW: true }
  return ctx.foldM(w, h, finish, ori)
}

/**
 * Call the original priceIt(opt, qty, isLong) with custom settings.
 */
export function bridgePriceIt(
  opt: OriginalFoldEntry,
  qty: number,
  isLong: boolean,
  settingsOverride?: Partial<CalcContext["S"]>
): OriginalPriceResult | null {
  const ctx = loadCalculator()
  if (!ctx) return null
  const origS = { ...ctx.S }
  if (settingsOverride) Object.assign(ctx.S, settingsOverride)
  try {
    return ctx.priceIt(opt, qty, isLong)
  } finally {
    Object.assign(ctx.S, origS)
  }
}

// Keep old name export for backward compat
export function getFINISHES(): { folding: string[]; sf: string[] } {
  return getFIN()
}

// ============================================================
// Fold / Score & Fold Calculator Bridge
// ============================================================
// Reads the ORIGINAL HTML calculator from calculators/fold-score-calculator.html
// Extracts the <script> block and executes it to get the real
// FOLD, SF, matchSize, foldMath, priceIt functions.
// This file is imported by finishing-fold-engine.ts instead of
// the old rewritten data/logic.
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
  so?: 1
}

export interface OriginalSizeEntry {
  lbl: string
  isLong?: boolean
  [finishName: string]: OriginalFoldEntry | string | boolean | undefined
}

export interface OriginalPaperEntry {
  label: string
  thick: number
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
  isLong: boolean
}

export interface OriginalFoldMathResult {
  fw: number
  fh: number
  panels: number
  lines: number[]
  divW: boolean
}

// ── Sandbox context to hold the extracted functions ──
interface CalcContext {
  FOLD: Record<string, OriginalPaperEntry>
  SF: Record<string, OriginalPaperEntry>
  FINISHES: { folding: string[]; sf: string[] }
  SIZE_MAP: Array<{ key: string; w: number; h: number; label: string; minW?: number; maxW?: number; minH?: number; maxH?: number }>
  matchSize: (w: number, h: number, cat: string) => string
  foldMath: (w: number, h: number, finish: string) => OriginalFoldMathResult
  priceIt: (opt: OriginalFoldEntry, qty: number, isLong: boolean) => OriginalPriceResult | null
  S: { labor: number; run: number; markup: number; bdisc: number; longSetup: number; lv: Record<number, number> }
  foldAxis: string
}

let _ctx: CalcContext | null = null
let _loadError: string | null = null
let _lastLoadTime = 0
const CACHE_TTL_MS = 5000 // Re-read HTML file every 5 seconds at most

function loadCalculator(): CalcContext | null {
  // Re-read the HTML file periodically so GitHub changes are picked up
  const now = Date.now()
  if (_ctx && (now - _lastLoadTime) < CACHE_TTL_MS) return _ctx
  // Reset for fresh load
  _ctx = null
  _loadError = null

  try {
    // Try multiple possible paths (dev vs build)
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

    // Extract <script> block content
    const scriptMatch = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
    if (!scriptMatch || !scriptMatch[1]) {
      _loadError = "No <script> block found in fold-score-calculator.html"
      console.warn("[fold-score-bridge]", _loadError)
      return null
    }

    const scriptCode = scriptMatch[1]

    // Instead of stripping DOM functions (fragile with nested braces),
    // extract ONLY the data and pure functions we need via targeted regex.
    // We need: FOLD, SF, SIZE_MAP, FINISHES, S, foldMath, matchSize, priceIt

    // 1. Extract FOLD data block: "const FOLD={...};"
    const foldMatch = scriptCode.match(/const\s+FOLD\s*=\s*(\{[\s\S]*?\n\};)/m)
    // 2. Extract SF data block: "const SF={...};"
    const sfMatch = scriptCode.match(/const\s+SF\s*=\s*(\{[\s\S]*?\n\};)/m)
    // 3. Extract SIZE_MAP
    const sizeMapMatch = scriptCode.match(/const\s+SIZE_MAP\s*=\s*(\[[\s\S]*?\];)/m)
    // 4. Extract FINISHES
    const finishesMatch = scriptCode.match(/const\s+FINISHES\s*=\s*(\{[\s\S]*?\};)/m)
    // 5. Extract S (settings defaults)
    const sMatch = scriptCode.match(/let\s+S\s*=\s*(\{[^}]+\})\s*;/)
    // 6. Extract foldAxis
    const foldAxisMatch = scriptCode.match(/let\s+foldAxis\s*=\s*'(\w)'\s*;/)

    // 7. Extract pure functions by finding "function name(" to the matching closing "}"
    function extractFunction(code: string, name: string): string | null {
      const startRegex = new RegExp(`function\\s+${name}\\s*\\(`)
      const match = startRegex.exec(code)
      if (!match) return null
      const start = match.index
      // Find matching closing brace
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

    const foldMathFn = extractFunction(scriptCode, "foldMath")
    const matchSizeFn = extractFunction(scriptCode, "matchSize")
    const priceItFn = extractFunction(scriptCode, "priceIt")

    if (!foldMatch || !sfMatch || !foldMathFn || !matchSizeFn || !priceItFn) {
      _loadError = `Could not extract required code. FOLD:${!!foldMatch} SF:${!!sfMatch} foldMath:${!!foldMathFn} matchSize:${!!matchSizeFn} priceIt:${!!priceItFn}`
      console.warn("[fold-score-bridge]", _loadError)
      return null
    }

    // Build a clean script with only what we need
    const cleanScript = [
      `var FOLD = ${foldMatch[1]}`,
      `var SF = ${sfMatch[1]}`,
      sizeMapMatch ? `var SIZE_MAP = ${sizeMapMatch[1]}` : `var SIZE_MAP = [];`,
      finishesMatch ? `var FINISHES = ${finishesMatch[1]}` : `var FINISHES = {folding:[],sf:[]};`,
      sMatch ? `var S = ${sMatch[1]};` : `var S = {labor:60,run:30,markup:300,bdisc:30,longSetup:35,lv:{1:5,2:7,3:10,4:12,5:15}};`,
      `var foldAxis = '${foldAxisMatch ? foldAxisMatch[1] : "w"}';`,
      foldMathFn,
      matchSizeFn,
      priceItFn,
    ].join("\n\n")

    // Create sandbox context with only what the pure functions need
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
      FINISHES: sandbox.FINISHES as CalcContext["FINISHES"],
      SIZE_MAP: sandbox.SIZE_MAP as CalcContext["SIZE_MAP"],
      matchSize: sandbox.matchSize as CalcContext["matchSize"],
      foldMath: sandbox.foldMath as CalcContext["foldMath"],
      priceIt: sandbox.priceIt as CalcContext["priceIt"],
      S: sandbox.S as CalcContext["S"],
      foldAxis: (sandbox.foldAxis as string) || "w",
    }

    _lastLoadTime = Date.now()
    console.log("[fold-score-bridge] Successfully loaded fold-score-calculator.html")
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
  loadCalculator() // attempt load
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

export function getFINISHES(): { folding: string[]; sf: string[] } {
  const ctx = loadCalculator()
  return ctx?.FINISHES || { folding: [], sf: [] }
}

export function getSettings(): CalcContext["S"] {
  const ctx = loadCalculator()
  return ctx?.S || { labor: 60, run: 30, markup: 300, bdisc: 30, longSetup: 35, lv: { 1: 5, 2: 7, 3: 10, 4: 12, 5: 15 } }
}

/** Update the settings object inside the sandbox (mirrors the S object) */
export function updateSettings(newSettings: Partial<CalcContext["S"]>): void {
  const ctx = loadCalculator()
  if (ctx) {
    Object.assign(ctx.S, newSettings)
  }
}

/** Call the original matchSize(w, h, cat) function */
export function bridgeMatchSize(w: number, h: number, cat: string): string {
  const ctx = loadCalculator()
  if (!ctx) return "8.5x5.5" // safe fallback
  return ctx.matchSize(w, h, cat)
}

/** Call the original foldMath(w, h, finish) with axis control */
export function bridgeFoldMath(w: number, h: number, finish: string, axis: "w" | "h" = "w"): OriginalFoldMathResult {
  const ctx = loadCalculator()
  if (!ctx) return { fw: w, fh: h, panels: 1, lines: [], divW: true }
  // The original uses a global foldAxis variable
  ctx.foldAxis = axis
  // We need to call it in the sandbox context
  const sandbox = vm.createContext({
    ...ctx,
    foldAxis: axis,
    Math,
  })
  // Re-run foldMath in context with the updated axis
  const code = `
    var foldAxis = "${axis}";
    var result = (${ctx.foldMath.toString()})(${w}, ${h}, ${JSON.stringify(finish)});
    result;
  `
  try {
    return vm.runInContext(code, sandbox, { timeout: 500 }) as OriginalFoldMathResult
  } catch {
    // Fallback: call directly (foldAxis may not be correct)
    return ctx.foldMath(w, h, finish)
  }
}

/** Call the original priceIt(opt, qty, isLong) with custom settings */
export function bridgePriceIt(
  opt: OriginalFoldEntry,
  qty: number,
  isLong: boolean,
  settingsOverride?: Partial<CalcContext["S"]>
): OriginalPriceResult | null {
  const ctx = loadCalculator()
  if (!ctx) return null
  // Apply settings override temporarily
  const origS = { ...ctx.S }
  if (settingsOverride) Object.assign(ctx.S, settingsOverride)
  try {
    return ctx.priceIt(opt, qty, isLong)
  } finally {
    // Restore original settings
    Object.assign(ctx.S, origS)
  }
}

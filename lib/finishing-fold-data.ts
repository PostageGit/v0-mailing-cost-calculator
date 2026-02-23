// ============================================================
// Finishing Fold Data — ported exactly from HTML calculator
// ============================================================

/** Entry for a single finish type at a given paper + size combo */
export interface FoldFinishEntry {
  /** Setup level 1-5, or "na" if not available, or "hand" if manual */
  l: number | "na" | "hand"
  /** Batch size — how many pieces per run batch */
  b?: number
  /** Seconds per batch */
  s?: number
  /** If true, this is a "long sheet" combo */
  long?: boolean
  /** Alternative suggestion text when l === "na" */
  alt?: string
  /** 1 = score-only fallback available */
  so?: 1
}

/** One paper type entry */
export interface FoldPaperEntry {
  label: string
  /** 0 = thinner, 1 = thicker — used for auto-upgrade comparisons */
  thick: number
  sizes: Record<string, FoldSizeEntry>
}

/** One size entry — keyed by size tier, maps finish names to entries */
export interface FoldSizeEntry {
  lbl: string
  isLong?: boolean
  [finishName: string]: FoldFinishEntry | string | boolean | undefined
}

// ── FOLD DATA (80 text, 100 text) ──
export const FOLD_DATA: Record<string, FoldPaperEntry> = {
  "80text_60_70": {
    label: "80 Text / 60lb / 70lb",
    thick: 0,
    sizes: {
      "11x17+": {
        lbl: "11\u00d717+",
        "Fold in Half": { l: 3, b: 100, s: 40 },
        "Fold in 3": { l: 3, b: 100, s: 45 },
        "Fold in 4": { l: 5, b: 100, s: 120 },
        "Gate Fold": { l: "na", alt: "Bigger size (8.5\u00d711+) & cardstock" },
      },
      "8.5x11": {
        lbl: "8.5\u00d711",
        "Fold in Half": { l: 3, b: 100, s: 30 },
        "Fold in 3": { l: 3, b: 10, s: 35 },
        "Fold in 4": { l: "na", alt: "Thicker paper (100 text+) or bigger size" },
        "Gate Fold": { l: "na", alt: "Bigger size (8.5\u00d711+) & cardstock" },
      },
      "8.5x5.5": {
        lbl: "8.5\u00d75.5",
        "Fold in Half": { l: 3, b: 100, s: 25 },
        "Fold in 3": { l: "na", alt: "Change to 100 text or 80 cover" },
        "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" },
        "Gate Fold": { l: "na", alt: "Bigger size & cardstock" },
      },
      "7x4": {
        lbl: "7\u00d74",
        "Fold in Half": { l: 4, b: 100, s: 40 },
        "Fold in 3": { l: "na", alt: "Change to 100 text or 80 cover" },
        "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" },
        "Gate Fold": { l: "na", alt: "Bigger size & cardstock" },
      },
    },
  },
  "100text": {
    label: "100 Text",
    thick: 1,
    sizes: {
      "11x17+": {
        lbl: "11\u00d717+",
        "Fold in Half": { l: 2, b: 100, s: 40 },
        "Fold in 3": { l: 3, b: 100, s: 45 },
        "Fold in 4": { l: 5, b: 100, s: 120 },
        "Gate Fold": { l: "na", alt: "Bigger size & cardstock" },
      },
      "8.5x11": {
        lbl: "8.5\u00d711",
        "Fold in Half": { l: 2, b: 100, s: 30 },
        "Fold in 3": { l: 3, b: 10, s: 35 },
        "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" },
        "Gate Fold": { l: "na", alt: "Bigger size & cardstock" },
      },
      "8.5x5.5": {
        lbl: "8.5\u00d75.5",
        "Fold in Half": { l: 2, b: 100, s: 25 },
        "Fold in 3": { l: "na", alt: "Change to 100 text/80 cover or size to 8.5\u00d711+" },
        "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" },
        "Gate Fold": { l: "na", alt: "Bigger size & cardstock" },
      },
      "7.5x5": {
        lbl: "7.5\u00d75",
        "Fold in Half": { l: 4, b: 100, s: 40 },
        "Fold in 3": { l: "na", alt: "Change to 100 text/80 cover or size to 8.5\u00d711+" },
        "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" },
        "Gate Fold": { l: "na", alt: "Bigger size & cardstock" },
      },
    },
  },
}

// ── SCORE & FOLD DATA (100 text/80 cover, cardstock) ──
export const SF_DATA: Record<string, FoldPaperEntry> = {
  "100text_80cover": {
    label: "100 Text / 80 Cover",
    thick: 0,
    sizes: {
      long: {
        lbl: "Long (13\u00d726+)",
        isLong: true,
        "Score & Fold in Half": { l: 2, b: 100, s: 215, long: true },
        "Score & Fold in 3": { l: 3, b: 100, s: 225, long: true },
        "Score & Fold in 4": { l: "hand", long: true },
        "Score & Gate Fold": { l: "na", alt: "Use Card Stock", long: true },
      },
      "11x17+": {
        lbl: "11\u00d717+",
        "Score & Fold in Half": { l: 2, b: 100, s: 215 },
        "Score & Fold in 3": { l: 3, b: 100, s: 225 },
        "Score & Fold in 4": { l: "hand" },
        "Score & Gate Fold": { l: "na", alt: "Use Card Stock" },
      },
      "8.5x11": {
        lbl: "8.5\u00d711",
        "Score & Fold in Half": { l: 2, b: 100, s: 260 },
        "Score & Fold in 3": { l: 3, b: 100, s: 260 },
        "Score & Fold in 4": { l: "hand" },
        "Score & Gate Fold": { l: "na", alt: "Use Card Stock" },
      },
      "8.5x5.5": {
        lbl: "8.5\u00d75.5",
        "Score & Fold in Half": { l: 3, b: 100, s: 120 },
        "Score & Fold in 3": { l: 4, b: 100, s: 140, so: 1 },
        "Score & Fold in 4": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
        "Score & Gate Fold": { l: "na", alt: "Use Card Stock" },
      },
      "7.5x5": {
        lbl: "7.5\u00d75",
        "Score & Fold in Half": { l: 5, b: 100, s: 180 },
        "Score & Fold in 3": { l: 5, b: 100, s: 180, so: 1 },
        "Score & Fold in 4": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
        "Score & Gate Fold": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
      },
    },
  },
  cardstock: {
    label: "Card Stock (Any)",
    thick: 1,
    sizes: {
      long: {
        lbl: "Long (13\u00d726+)",
        isLong: true,
        "Score & Fold in Half": { l: 1, b: 100, s: 155, long: true },
        "Score & Fold in 3": { l: 2, b: 100, s: 225, long: true },
        "Score & Fold in 4": { l: 3, b: 100, s: 240, long: true },
        "Score & Gate Fold": { l: 3, b: 100, s: 240, long: true },
      },
      "11x17+": {
        lbl: "11\u00d717+",
        "Score & Fold in Half": { l: 1, b: 100, s: 155 },
        "Score & Fold in 3": { l: 2, b: 100, s: 225 },
        "Score & Fold in 4": { l: "hand" },
        "Score & Gate Fold": { l: "na", b: 100, s: 240 },
      },
      "8.5x11": {
        lbl: "8.5\u00d711",
        "Score & Fold in Half": { l: 1, b: 100, s: 140 },
        "Score & Fold in 3": { l: 4, b: 100, s: 200 },
        "Score & Fold in 4": { l: 4, b: 100, s: 200, so: 1 },
        "Score & Gate Fold": { l: 4, b: 100, s: 200, so: 1 },
      },
      "8.5x5.5": {
        lbl: "8.5\u00d75.5",
        "Score & Fold in Half": { l: 2, b: 100, s: 120 },
        "Score & Fold in 3": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
        "Score & Fold in 4": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
        "Score & Gate Fold": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
      },
      "7.5x5": {
        lbl: "7.5\u00d75",
        "Score & Fold in Half": { l: 4, b: 100, s: 180 },
        "Score & Fold in 3": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
        "Score & Fold in 4": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
        "Score & Gate Fold": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" },
      },
    },
  },
}

// ── FINISH TYPES BY CATEGORY ──
export const FINISH_TYPES = {
  folding: ["Fold in Half", "Fold in 3", "Fold in 4", "Gate Fold"] as const,
  sf: ["Score & Fold in Half", "Score & Fold in 3", "Score & Fold in 4", "Score & Gate Fold"] as const,
}
export type FoldCategory = "folding" | "sf"

// ── UI-friendly finish type / fold type arrays for components ──
export type FoldTypeId = "half" | "tri" | "z" | "gate" | "double_parallel" | "accordion" | "roll"

export const FOLD_TYPES: { id: FoldTypeId; label: string; dataKey: string; panels: number }[] = [
  { id: "half", label: "Fold in Half", dataKey: "Fold in Half", panels: 2 },
  { id: "tri", label: "Tri-Fold", dataKey: "Fold in 3", panels: 3 },
  { id: "z", label: "Z-Fold", dataKey: "Fold in 3", panels: 3 },
  { id: "gate", label: "Gate Fold", dataKey: "Gate Fold", panels: 4 },
  { id: "double_parallel", label: "Double Parallel", dataKey: "Fold in 4", panels: 4 },
  { id: "accordion", label: "Accordion", dataKey: "Fold in 4", panels: 4 },
  { id: "roll", label: "Roll Fold", dataKey: "Fold in 3", panels: 3 },
]

export const FINISH_TYPE_OPTIONS: { id: string; label: string; category: FoldCategory }[] = [
  { id: "fold", label: "Fold", category: "folding" },
  { id: "score_and_fold", label: "Score & Fold", category: "sf" },
  { id: "score_only", label: "Score Only", category: "sf" },
]

// ── SIZE MATCHING ──
// Maps open/flat sheet dimensions to a pricing tier key.
// Exact port of matchSize() from the original HTML calculator.
// Minimum size for Score & Fold / 100 Text fold: 7.5x5
// Minimum size for 80 Text fold: 7x4
export function matchFoldSize(w: number, h: number, cat: FoldCategory): string {
  // Normalize: nw = shorter side, nh = longer side
  const nw = Math.min(w, h)
  const nh = Math.max(w, h)

  // Long sheet: any dimension > 17 or width > 13 (Score & Fold only)
  if (cat === "sf" && (nh > 17 || nw > 13)) return "long"

  // Sequential bracket matching (same order as original HTML calculator)
  if (nw >= 11 || nh >= 17) return "11x17+"
  if (nw >= 8 && nw <= 11 && nh >= 11 && nh < 17) return "8.5x11"
  if (nw >= 5 && nw <= 8.5 && nh >= 5.5 && nh < 11) return "8.5x5.5"
  // 7.5x5 bracket: short side up to 8, long side up to 5.49
  if (nw >= 0 && nw <= 8 && nh >= 0 && nh <= 5.49) return "7.5x5"
  // 7x4 bracket: short side up to 7.49, long side up to 5.49 (only used by 80text fold data)
  if (nw < 7.5 && nh < 5.5) return "7x4"

  // Fallback: go up to nearest valid tier
  if (nh >= 11) return "11x17+"
  if (nh >= 5.5) return "8.5x11"
  return "8.5x5.5"
}

// ── FOLD MATH ──
export interface FoldMathResult {
  /** Folded width */
  fw: number
  /** Folded height */
  fh: number
  /** Number of panels */
  panels: number
  /** Fold line positions as fractions (0..1) */
  lines: number[]
  /** true = folding along width (vertical lines), false = along height */
  divW: boolean
}

export function foldMath(
  w: number,
  h: number,
  finish: string,
  axis: "w" | "h" = "w"
): FoldMathResult {
  // Strip "Score & " prefix for fold type detection
  const f = finish.replace("Score & ", "")
  const divW = axis === "w"
  const foldDim = divW ? w : h

  let panels: number
  if (f === "Fold in Half") panels = 2
  else if (f === "Fold in 3") panels = 3
  else if (f === "Fold in 4" || f === "Gate Fold") panels = 4
  else panels = 1

  const divided = panels > 1 ? foldDim / panels : foldDim
  const lines: number[] = []
  for (let i = 1; i < panels; i++) lines.push(i / panels)

  const fw = divW ? Math.round(divided * 100) / 100 : w
  const fh = divW ? h : Math.round(divided * 100) / 100

  return { fw, fh, panels, lines, divW }
}

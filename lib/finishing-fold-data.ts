// ============================================================
// Finishing Fold Data
// ============================================================
// ALL PRICING DATA AND CALCULATION LOGIC NOW COMES FROM:
//   calculators/fold-score-calculator.html
// via the bridge at lib/calculators/fold-score-bridge.ts
//
// The data tables that were here have been COMMENTED OUT.
// They are preserved below for reference only.
// ============================================================

/** Entry for a single finish type at a given paper + size combo */
export interface FoldFinishEntry {
  l: number | "na" | "hand"
  b?: number
  s?: number
  long?: boolean
  alt?: string
  so?: 1
}

/** One paper type entry */
export interface FoldPaperEntry {
  label: string
  thick: number
  sizes: Record<string, FoldSizeEntry>
}

/** One size entry */
export interface FoldSizeEntry {
  lbl: string
  isLong?: boolean
  [finishName: string]: FoldFinishEntry | string | boolean | undefined
}

// ── FINISH TYPES BY CATEGORY (display-only, used by UI components) ──
export const FINISH_TYPES = {
  folding: ["Fold in Half", "Fold in 3", "Fold in 4", "Gate Fold"] as const,
  sf: ["Score & Fold in Half", "Score & Fold in 3", "Score & Fold in 4", "Score & Gate Fold"] as const,
}
export type FoldCategory = "folding" | "sf"

// ── UI-friendly fold type arrays (display-only, used by components) ──
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

// ============================================================
// COMMENTED OUT: All data tables and calculation functions below
// are no longer used. The HTML calculator is the sole source of
// truth for fold/score pricing.
// ============================================================

/*
// ── FOLD DATA (was used as fallback) ──
export const FOLD_DATA: Record<string, FoldPaperEntry> = {
  "80text_60_70": {
    label: "80 Text / 60lb / 70lb",
    thick: 0,
    sizes: {
      "11x17+": { lbl: "11×17+", "Fold in Half": { l: 3, b: 100, s: 40 }, "Fold in 3": { l: 3, b: 100, s: 45 }, "Fold in 4": { l: 5, b: 100, s: 120 }, "Gate Fold": { l: "na", alt: "Bigger size (8.5×11+) & cardstock" } },
      "8.5x11": { lbl: "8.5×11", "Fold in Half": { l: 3, b: 100, s: 30 }, "Fold in 3": { l: 3, b: 10, s: 35 }, "Fold in 4": { l: "na", alt: "Thicker paper (100 text+) or bigger size" }, "Gate Fold": { l: "na", alt: "Bigger size (8.5×11+) & cardstock" } },
      "8.5x5.5": { lbl: "8.5×5.5", "Fold in Half": { l: 3, b: 100, s: 25 }, "Fold in 3": { l: "na", alt: "Change to 100 text or 80 cover" }, "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" }, "Gate Fold": { l: "na", alt: "Bigger size & cardstock" } },
      "7x4": { lbl: "7×4", "Fold in Half": { l: 4, b: 100, s: 40 }, "Fold in 3": { l: "na", alt: "Change to 100 text or 80 cover" }, "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" }, "Gate Fold": { l: "na", alt: "Bigger size & cardstock" } },
    },
  },
  "100text": {
    label: "100 Text",
    thick: 1,
    sizes: {
      "11x17+": { lbl: "11×17+", "Fold in Half": { l: 2, b: 100, s: 40 }, "Fold in 3": { l: 3, b: 100, s: 45 }, "Fold in 4": { l: 5, b: 100, s: 120 }, "Gate Fold": { l: "na", alt: "Bigger size & cardstock" } },
      "8.5x11": { lbl: "8.5×11", "Fold in Half": { l: 2, b: 100, s: 30 }, "Fold in 3": { l: 3, b: 10, s: 35 }, "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" }, "Gate Fold": { l: "na", alt: "Bigger size & cardstock" } },
      "8.5x5.5": { lbl: "8.5×5.5", "Fold in Half": { l: 2, b: 100, s: 25 }, "Fold in 3": { l: "na", alt: "Change to 100 text/80 cover or size to 8.5×11+" }, "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" }, "Gate Fold": { l: "na", alt: "Bigger size & cardstock" } },
      "7.5x5": { lbl: "7.5×5", "Fold in Half": { l: 4, b: 100, s: 40 }, "Fold in 3": { l: "na", alt: "Change to 100 text/80 cover or size to 8.5×11+" }, "Fold in 4": { l: "na", alt: "Bigger size & thicker, both required" }, "Gate Fold": { l: "na", alt: "Bigger size & cardstock" } },
    },
  },
}

// ── SCORE & FOLD DATA (was used as fallback) ──
export const SF_DATA: Record<string, FoldPaperEntry> = {
  "100text_80cover": {
    label: "100 Text / 80 Cover",
    thick: 0,
    sizes: {
      long: { lbl: "Long (13×26+)", isLong: true, "Score & Fold in Half": { l: 2, b: 100, s: 215, long: true }, "Score & Fold in 3": { l: 3, b: 100, s: 225, long: true }, "Score & Fold in 4": { l: "hand", long: true }, "Score & Gate Fold": { l: "na", alt: "Use Card Stock", long: true } },
      "11x17+": { lbl: "11×17+", "Score & Fold in Half": { l: 2, b: 100, s: 215 }, "Score & Fold in 3": { l: 3, b: 100, s: 225 }, "Score & Fold in 4": { l: "hand" }, "Score & Gate Fold": { l: "na", alt: "Use Card Stock" } },
      "8.5x11": { lbl: "8.5×11", "Score & Fold in Half": { l: 2, b: 100, s: 260 }, "Score & Fold in 3": { l: 3, b: 100, s: 260 }, "Score & Fold in 4": { l: "hand" }, "Score & Gate Fold": { l: "na", alt: "Use Card Stock" } },
      "8.5x5.5": { lbl: "8.5×5.5", "Score & Fold in Half": { l: 3, b: 100, s: 120 }, "Score & Fold in 3": { l: 4, b: 100, s: 140, so: 1 }, "Score & Fold in 4": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" }, "Score & Gate Fold": { l: "na", alt: "Use Card Stock" } },
      "7.5x5": { lbl: "7.5×5", "Score & Fold in Half": { l: 5, b: 100, s: 180 }, "Score & Fold in 3": { l: 5, b: 100, s: 180, so: 1 }, "Score & Fold in 4": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" }, "Score & Gate Fold": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" } },
    },
  },
  cardstock: {
    label: "Card Stock (Any)",
    thick: 1,
    sizes: {
      long: { lbl: "Long (13×26+)", isLong: true, "Score & Fold in Half": { l: 1, b: 100, s: 155, long: true }, "Score & Fold in 3": { l: 2, b: 100, s: 225, long: true }, "Score & Fold in 4": { l: 3, b: 100, s: 240, long: true }, "Score & Gate Fold": { l: 3, b: 100, s: 240, long: true } },
      "11x17+": { lbl: "11×17+", "Score & Fold in Half": { l: 1, b: 100, s: 155 }, "Score & Fold in 3": { l: 2, b: 100, s: 225 }, "Score & Fold in 4": { l: "hand" }, "Score & Gate Fold": { l: "na", b: 100, s: 240 } },
      "8.5x11": { lbl: "8.5×11", "Score & Fold in Half": { l: 1, b: 100, s: 140 }, "Score & Fold in 3": { l: 4, b: 100, s: 200 }, "Score & Fold in 4": { l: 4, b: 100, s: 200, so: 1 }, "Score & Gate Fold": { l: 4, b: 100, s: 200, so: 1 } },
      "8.5x5.5": { lbl: "8.5×5.5", "Score & Fold in Half": { l: 2, b: 100, s: 120 }, "Score & Fold in 3": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" }, "Score & Fold in 4": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" }, "Score & Gate Fold": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" } },
      "7.5x5": { lbl: "7.5×5", "Score & Fold in Half": { l: 4, b: 100, s: 180 }, "Score & Fold in 3": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" }, "Score & Fold in 4": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" }, "Score & Gate Fold": { l: "na", b: 100, s: 140, so: 1, alt: "Score Only available" } },
    },
  },
}

// ── SIZE MATCHING (was used as fallback) ──
export function matchFoldSize(w: number, h: number, cat: FoldCategory): string {
  const nw = Math.min(w, h)
  const nh = Math.max(w, h)
  if (cat === "sf" && (nh > 17 || nw > 13)) return "long"
  if (nw >= 11 || nh >= 17) return "11x17+"
  if (nw >= 8 && nw <= 11 && nh >= 11 && nh < 17) return "8.5x11"
  if (nw >= 5 && nw <= 8.5 && nh >= 5.5 && nh < 11) return "8.5x5.5"
  if (nw >= 4 && nw <= 7.5 && nh >= 4 && nh <= 5.5) return "7.5x5"
  if (nw < 7.5 && nh < 5.5) return "7x4"
  if (nh >= 11) return "11x17+"
  if (nh >= 5.5) return "8.5x11"
  return "8.5x5.5"
}

// ── FOLD MATH (was used as fallback) ──
export function foldMath(w: number, h: number, finish: string, axis: "w" | "h" = "w") {
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
*/

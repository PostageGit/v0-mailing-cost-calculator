"use client"

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react"
import type { USPSShape } from "./usps-rates"

// ─── Piece types & their calculator targets ──────────────
export type PieceType =
  | "postcard"       // flat printing calc
  | "flat_card"      // flat printing calc
  | "folded_card"    // flat printing calc (prints flat, then folds)
  | "booklet"        // booklet / saddle stitch calc
  | "envelope"       // envelope pricing step
  | "self_mailer"    // flat printing calc
  | "letter"         // flat printing calc
  | "other"          // manual / OHP

export const PIECE_TYPE_META: Record<PieceType, { label: string; short: string; calc: string; color: string }> = {
  postcard:    { label: "Postcard",     short: "PC",   calc: "flat",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  flat_card:   { label: "Flat Card",    short: "FLT",  calc: "flat",     color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  folded_card: { label: "Folded Card",  short: "FLD",  calc: "flat",     color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  booklet:     { label: "Booklet",      short: "BKL",  calc: "booklet",  color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  envelope:    { label: "Envelope",     short: "ENV",  calc: "envelope", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  self_mailer: { label: "Self-Mailer",  short: "SM",   calc: "flat",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  letter:      { label: "Letter",       short: "LTR",  calc: "flat",     color: "bg-secondary text-foreground" },
  other:       { label: "Other",        short: "OTH",  calc: "ohp",      color: "bg-secondary text-foreground" },
}

// ─── Production routing ──────────────────────────────────
export type ProductionRoute = "inhouse" | "ohp" | "both"

// ─── Fold types (simplified) ─────────────────────────────
// Finished size = what fits in the envelope (after folding)
// Fold multiplier computes the FLAT print sheet size
export type FoldType = "none" | "x2w" | "x2h" | "x3w" | "x3h" | "custom"
export const FOLD_OPTIONS: { id: FoldType; label: string; desc: string; multW: number; multH: number }[] = [
  { id: "none", label: "Flat",    desc: "No fold",                                   multW: 1, multH: 1 },
  { id: "x2w",  label: "x2 (W)", desc: "Half fold along width (greeting card style)", multW: 2, multH: 1 },
  { id: "x2h",  label: "x2 (H)", desc: "Half fold along height (landscape open)",     multW: 1, multH: 2 },
  { id: "x3w",  label: "x3 (W)", desc: "Tri-fold / Z-fold along width",               multW: 3, multH: 1 },
  { id: "x3h",  label: "x3 (H)", desc: "Tri-fold / Z-fold along height",              multW: 1, multH: 3 },
  { id: "custom", label: "Custom", desc: "Enter flat size manually",                   multW: 1, multH: 1 },
]

/** Compute the flat (print) sheet size from finished size + fold type */
export function getFlatSize(piece: MailPiece): { w: number | null; h: number | null } {
  if (piece.foldType === "custom") {
    return { w: piece.flatWidth ?? null, h: piece.flatHeight ?? null }
  }
  const fold = FOLD_OPTIONS.find((f) => f.id === piece.foldType) || FOLD_OPTIONS[0]
  return {
    w: piece.width  ? Math.round(piece.width  * fold.multW * 1000) / 1000 : null,
    h: piece.height ? Math.round(piece.height * fold.multH * 1000) / 1000 : null,
  }
}

// ─── Mail piece (one per physical piece) ─────────────────
export interface MailPiece {
  id: string
  position: number           // 1 = outermost, 2+ = inner
  type: PieceType
  label: string              // user-editable short label
  width: number | null       // FINISHED size (after folding / as mailed)
  height: number | null
  foldType: FoldType         // fold style -- determines flat print size
  flatWidth?: number | null  // only used when foldType === "custom"
  flatHeight?: number | null // only used when foldType === "custom"
  production: ProductionRoute // how this piece will be produced
  envelopeId?: string        // if type=envelope, which standard size
  envelopeKind?: "paper" | "plastic" | ""
  _suggested?: boolean       // true if size was auto-suggested and needs user verification
}

// ─── Standard envelope sizes ─────────────────────────────
export interface EnvelopeSize { id: string; name: string; width: number; height: number; description: string }
export const STANDARD_ENVELOPES: EnvelopeSize[] = [
  { id: "a2",      name: "A2",           width: 4.375, height: 5.75,  description: "RSVP / Note" },
  { id: "a6",      name: "A6",           width: 4.75,  height: 6.5,   description: "4x6 card" },
  { id: "a7",      name: "A7",           width: 5.25,  height: 7.25,  description: "5x7 card" },
  { id: "a9",      name: "A9",           width: 5.75,  height: 8.75,  description: "Invitation" },
  { id: "a10",     name: "A10",          width: 6,     height: 9.5,   description: "6x9 card" },
  { id: "6x9",     name: "6 x 9",       width: 6,     height: 9,     description: "Booklet" },
  { id: "no10",    name: "#10 Std",      width: 4.125, height: 9.5,   description: "Business" },
  { id: "no10win", name: "#10 Win",      width: 4.125, height: 9.5,   description: "Window" },
  { id: "6.5",     name: "#6 3/4",       width: 3.625, height: 6.5,   description: "Remit" },
  { id: "9x12",    name: "9 x 12",      width: 9,     height: 12,    description: "Flat" },
  { id: "10x13",   name: "10 x 13",     width: 10,    height: 13,    description: "Large flat" },
  { id: "custom",  name: "Custom",       width: 0,     height: 0,     description: "Manual" },
]

// ─── Context ─────────────────────────────────────────────
interface MailingState {
  quantity: number; setQuantity: (n: number) => void
  shape: string; className: string; suggestedShapes: USPSShape[]
  setShape: (s: string) => void; setClassName: (n: string) => void

  // All pieces in the mailing
  pieces: MailPiece[]
  setPieces: (p: MailPiece[]) => void
  addPiece: (type: PieceType) => void
  removePiece: (id: string) => void
  updatePiece: (id: string, patch: Partial<Omit<MailPiece, "id">>) => void

  // Toggles
  customerProvidesPrinting: boolean; setCustomerProvidesPrinting: (v: boolean) => void

  // === DERIVED ===
  /** The outermost piece (position 1) -- determines USPS mail piece size */
  outerPiece: MailPiece | null
  /** USPS mail piece dimensions (from outer piece) */
  mailerWidth: number | null; mailerHeight: number | null
  /** Which calculator steps are needed based on pieces */
  needsEnvelope: boolean
  needsPrinting: boolean
  needsBooklet: boolean
  needsOHP: boolean
  /** For backward compat */
  outerWidth: number | null; outerHeight: number | null
  setOuterWidth: (w: number | null) => void; setOuterHeight: (h: number | null) => void
}

const Ctx = createContext<MailingState | null>(null)

function computeSuggestedShapes(w: number | null, h: number | null): USPSShape[] {
  if (!w || !h) return ["POSTCARD", "LETTER", "FLAT"]
  const s = Math.min(w, h); const l = Math.max(w, h)
  const shapes: USPSShape[] = []
  if (s >= 3.5 && s <= 6 && l >= 5 && l <= 9) shapes.push("POSTCARD")
  if (s >= 3.5 && s <= 6.125 && l >= 5 && l <= 11.5) shapes.push("LETTER")
  if (s <= 12 && l <= 15 && (s > 6.125 || l > 11.5)) shapes.push("FLAT")
  return shapes
}

let _counter = 0

export function MailingProvider({ children }: { children: ReactNode }) {
  const [quantity, setQuantity] = useState(5000)
  const [shape, setShape] = useState("LETTER")
  const [className, setClassName] = useState("Letter")
  const [pieces, setPieces] = useState<MailPiece[]>([])
  const [customerProvidesPrinting, setCustomerProvidesPrinting] = useState(false)

  const addPiece = useCallback((type: PieceType) => {
    _counter++
    setPieces((prev) => {
      const pos = prev.length + 1
      // Auto-suggest size for inner pieces: 0.5" less per side than the piece above
      let sugW: number | null = null
      let sugH: number | null = null
      if (pos > 1) {
        const above = prev[prev.length - 1] // the piece just above this one
        if (above?.width && above.width > 1) sugW = Math.round((above.width - 1) * 1000) / 1000   // 0.5" each side = 1" total
        if (above?.height && above.height > 1) sugH = Math.round((above.height - 1) * 1000) / 1000
        if (sugW && sugW < 1) sugW = null
        if (sugH && sugH < 1) sugH = null
      }
      // Default fold: folded_card and self_mailer start with half fold, others none
      const defaultFold: FoldType = (type === "folded_card" || type === "self_mailer") ? "x2w" : "none"
      return [...prev, {
        id: `p-${_counter}`, position: pos, type,
        label: PIECE_TYPE_META[type].label,
        width: sugW, height: sugH,
        foldType: defaultFold,
        production: "inhouse",
        _suggested: sugW && sugH ? true : undefined,
      } as MailPiece]
    })
  }, [])

  const removePiece = useCallback((id: string) => {
    setPieces((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, position: i + 1 })))
  }, [])

  const updatePiece = useCallback((id: string, patch: Partial<Omit<MailPiece, "id">>) => {
    setPieces((prev) => prev.map((p) => {
      if (p.id !== id) return p
      const updated = { ...p, ...patch }
      // If envelope and standard size selected, auto-set dims
      if (updated.type === "envelope" && patch.envelopeId && patch.envelopeId !== "custom") {
        const env = STANDARD_ENVELOPES.find((e) => e.id === patch.envelopeId)
        if (env) { updated.width = env.width; updated.height = env.height }
      }
      return updated
    }))
  }, [])

  // Outer = position 1 (first added)
  const outerPiece = pieces.find((p) => p.position === 1) || null
  const mailerWidth = outerPiece?.width || null
  const mailerHeight = outerPiece?.height || null
  const suggestedShapes = useMemo(() => computeSuggestedShapes(mailerWidth, mailerHeight), [mailerWidth, mailerHeight])

  // Derived step visibility based on piece types AND production routing
  const inhouseOrBoth = pieces.filter((p) => p.production === "inhouse" || p.production === "both")
  const ohpOrBoth = pieces.filter((p) => p.production === "ohp" || p.production === "both")

  const needsEnvelope = inhouseOrBoth.some((p) => p.type === "envelope")
  const needsPrinting = !customerProvidesPrinting && inhouseOrBoth.some((p) => ["postcard", "flat_card", "folded_card", "self_mailer", "letter"].includes(p.type))
  const needsBooklet = inhouseOrBoth.some((p) => p.type === "booklet")
  const needsOHP = ohpOrBoth.length > 0

  // Backward compat setters for outer dims
  const setOuterWidth = useCallback((w: number | null) => {
    if (outerPiece) { setPieces((prev) => prev.map((p) => p.id === outerPiece.id ? { ...p, width: w } : p)) }
  }, [outerPiece])
  const setOuterHeight = useCallback((h: number | null) => {
    if (outerPiece) { setPieces((prev) => prev.map((p) => p.id === outerPiece.id ? { ...p, height: h } : p)) }
  }, [outerPiece])

  return (
    <Ctx.Provider value={{
      quantity, setQuantity, shape, className, suggestedShapes, setShape, setClassName,
      pieces, setPieces, addPiece, removePiece, updatePiece,
      customerProvidesPrinting, setCustomerProvidesPrinting,
      outerPiece, mailerWidth, mailerHeight,
      needsEnvelope, needsPrinting, needsBooklet, needsOHP,
      outerWidth: mailerWidth, outerHeight: mailerHeight, setOuterWidth, setOuterHeight,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useMailing() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useMailing must be inside MailingProvider")
  return ctx
}

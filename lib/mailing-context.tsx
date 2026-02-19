"use client"

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react"
import type { USPSShape } from "./usps-rates"

// ─── Piece types & their calculator targets ──────────────
export type PieceType =
  | "postcard"       // flat printing calc
  | "flat_card"      // flat printing calc
  | "folded_card"    // flat printing calc (prints flat, then folds)
  | "booklet"        // booklet / saddle stitch calc
  | "spiral_book"    // spiral binding calc
  | "perfect_bound"  // perfect (glue) binding calc
  | "envelope"       // envelope pricing step
  | "self_mailer"    // flat printing calc
  | "letter"         // flat printing calc
  | "other"          // manual / OHP

export const PIECE_TYPE_META: Record<PieceType, { label: string; short: string; calc: string; color: string }> = {
  postcard:     { label: "Postcard",      short: "PC",   calc: "flat",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  flat_card:    { label: "Flat Card",     short: "FLT",  calc: "flat",     color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  folded_card:  { label: "Folded Card",   short: "FLD",  calc: "flat",     color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  booklet:      { label: "Booklet",       short: "BKL",  calc: "booklet",  color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  spiral_book:  { label: "Spiral Book",   short: "SPR",  calc: "spiral",   color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  perfect_bound:{ label: "Perfect Bound", short: "PB",   calc: "perfect",  color: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  envelope:     { label: "Envelope",      short: "ENV",  calc: "envelope", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  self_mailer:  { label: "Self-Mailer",   short: "SM",   calc: "flat",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  letter:       { label: "Letter",        short: "LTR",  calc: "flat",     color: "bg-secondary text-foreground" },
  other:        { label: "Other",         short: "OTH",  calc: "ohp",      color: "bg-secondary text-foreground" },
}

// ─── Production routing ──────────────────────────────────
export type ProductionRoute = "inhouse" | "ohp" | "both" | "customer"

// ─── Fold types (simplified) ─────────────────────────────
// Finished size = what fits in the envelope (after folding)
// Fold multiplier computes the FLAT print sheet size
// Convention: fold "along width" = crease runs horizontally = HEIGHT expands
//             fold "along height" = crease runs vertically = WIDTH expands
export type FoldType = "none" | "x2h" | "x2w" | "x3h" | "x3w" | "custom"
export const FOLD_OPTIONS: { id: FoldType; label: string; desc: string; multW: number; multH: number }[] = [
  { id: "none",   label: "Flat",    desc: "No fold",                                        multW: 1, multH: 1 },
  { id: "x2h",    label: "x2 (H)", desc: "Half fold -- height doubles, width stays",        multW: 1, multH: 2 },
  { id: "x2w",    label: "x2 (W)", desc: "Half fold -- width doubles, height stays",        multW: 2, multH: 1 },
  { id: "x3h",    label: "x3 (H)", desc: "Tri-fold -- height triples, width stays",         multW: 1, multH: 3 },
  { id: "x3w",    label: "x3 (W)", desc: "Tri-fold -- width triples, height stays",         multW: 3, multH: 1 },
  { id: "custom",  label: "Custom", desc: "Enter flat size manually",                        multW: 1, multH: 1 },
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
  customerProvidesPrinting?: boolean  // per-piece: if true, skip printing calc for this item
  customerProvidedVendor?: string     // vendor name or custom text (when production === "customer")
  customerProvidedDate?: string       // ISO date string (when production === "customer")
  _suggested?: boolean       // true if size was auto-suggested and needs user verification
}

// ─── Standard envelope sizes ─────────────────────────────
export interface EnvelopeSize {
  id: string
  name: string
  width: number          // actual outer width
  height: number         // actual outer height
  kind: "paper" | "plastic"
  description: string
  sku?: string           // supplier item number
  fitsWidth?: number     // what insert fits inside (plastic)
  fitsHeight?: number
}

export const STANDARD_ENVELOPES: EnvelopeSize[] = [
  // ── Paper envelopes ──
  { id: "a2",      name: "A2",       width: 4.375, height: 5.75,  kind: "paper", description: "RSVP / Note" },
  { id: "a6",      name: "A6",       width: 4.75,  height: 6.5,   kind: "paper", description: "4x6 card" },
  { id: "a7",      name: "A7",       width: 5.25,  height: 7.25,  kind: "paper", description: "5x7 card" },
  { id: "a9",      name: "A9",       width: 5.75,  height: 8.75,  kind: "paper", description: "Invitation" },
  { id: "a10",     name: "A10",      width: 6,     height: 9.5,   kind: "paper", description: "6x9 card" },
  { id: "6x9",     name: "6 x 9",   width: 6,     height: 9,     kind: "paper", description: "Booklet" },
  { id: "no10",    name: "#10 Std",  width: 4.125, height: 9.5,   kind: "paper", description: "Business" },
  { id: "no10win", name: "#10 Win",  width: 4.125, height: 9.5,   kind: "paper", description: "Window" },
  { id: "6.5",     name: "#6 3/4",   width: 3.625, height: 6.5,   kind: "paper", description: "Remit" },
  { id: "9x12",    name: "9 x 12",  width: 9,     height: 12,    kind: "paper", description: "Flat" },
  { id: "10x13",   name: "10 x 13", width: 10,    height: 13,    kind: "paper", description: "Large flat" },
  { id: "custom",  name: "Custom",   width: 0,     height: 0,     kind: "paper", description: "Manual" },
  // ── Plastic envelopes (Clear Plastics / clearplastics.com) ──
  // name = fits size (what the user thinks of), width/height = actual outer dims for USPS
  { id: "p-5.5x8.5", name: '5.5 x 8.5',  width: 5.9375, height: 8.75,   kind: "plastic", description: "Clear Plastics", sku: "B59",   fitsWidth: 5.5,   fitsHeight: 8.5 },
  { id: "p-6x9",     name: '6 x 9',      width: 6.4375, height: 9,      kind: "plastic", description: "Clear Plastics", sku: "B6x9",  fitsWidth: 6,     fitsHeight: 9 },
  { id: "p-4x11",    name: '4 x 11',     width: 4.4375, height: 11.125, kind: "plastic", description: "Clear Plastics", sku: "BX411", fitsWidth: 4,     fitsHeight: 11 },
  { id: "p-8.5x11",  name: '8.5 x 11',   width: 8.9375, height: 11.25,  kind: "plastic", description: "Clear Plastics", sku: "B811",  fitsWidth: 8.5,   fitsHeight: 11 },
  { id: "p-8x8",     name: '8 x 8',      width: 8.4375, height: 8.25,   kind: "plastic", description: "Clear Plastics", sku: "B8x8",  fitsWidth: 8,     fitsHeight: 8 },
  { id: "p-9x9",     name: '9 x 9',      width: 9.4375, height: 9.25,   kind: "plastic", description: "Clear Plastics", sku: "B99",   fitsWidth: 9,     fitsHeight: 9 },
  { id: "p-custom",  name: 'Custom',      width: 0,      height: 0,      kind: "plastic", description: "Manual entry",   fitsWidth: 0, fitsHeight: 0 },
]

// ─── Context ─────────────────────────────────────────────
interface MailingState {
  quantity: number; setQuantity: (n: number) => void
  shape: string; className: string; suggestedShapes: USPSShape[]
  setShape: (s: string) => void; setClassName: (n: string) => void
  /** USPS service code from Tab 1/2 e.g. "FCM_COMM","MKT_COMM","MKT_NP","FCM_RETAIL","PS","MM","LM","BPM" */
  mailService: string; setMailService: (s: string) => void

  // All pieces in the mailing
  pieces: MailPiece[]
  setPieces: (p: MailPiece[]) => void
  addPiece: (type: PieceType) => void
  removePiece: (id: string) => void
  updatePiece: (id: string, patch: Partial<Omit<MailPiece, "id">>) => void

  // === DERIVED ===
  /** The outermost piece (position 1) -- determines USPS mail piece size */
  outerPiece: MailPiece | null
  /** USPS mail piece dimensions (from outer piece) */
  mailerWidth: number | null; mailerHeight: number | null
  /** Which calculator steps are needed based on pieces */
  needsEnvelope: boolean
  needsPrinting: boolean
  needsBooklet: boolean
  needsSpiral: boolean
  needsPerfect: boolean
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
  // Parcel: anything that exceeds Flat limits but fits within USPS parcel max (L+W+H <= 108")
  // For a flat piece, thickness is minimal so L+W is the main constraint
  if (shapes.length === 0 && (l + s) <= 108) shapes.push("PARCEL")
  // Also suggest Parcel alongside Flat for pieces near the Flat boundary
  if (shapes.includes("FLAT") && (s > 10 || l > 13)) shapes.push("PARCEL")
  return shapes
}

let _counter = 0

export function MailingProvider({ children }: { children: ReactNode }) {
  const [quantity, setQuantity] = useState(0)
  const [shape, setShape] = useState("LETTER")
  const [className, setClassName] = useState("Letter")
  const [mailService, setMailService] = useState("")
  const [pieces, setPieces] = useState<MailPiece[]>([])

  const addPiece = useCallback((type: PieceType) => {
    _counter++
    setPieces((prev) => {
      const pos = prev.length + 1
      // Auto-suggest size for inner pieces: 0.25" total clearance from the piece above
      let sugW: number | null = null
      let sugH: number | null = null
      if (pos > 1) {
        const above = prev[prev.length - 1] // the piece just above this one
        if (above?.width && above.width > 0.5) sugW = Math.round((above.width - 0.25) * 1000) / 1000
        if (above?.height && above.height > 0.5) sugH = Math.round((above.height - 0.25) * 1000) / 1000
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
  // If envelope and standard size selected, auto-set dims + kind
  if (updated.type === "envelope" && patch.envelopeId && patch.envelopeId !== "custom" && patch.envelopeId !== "p-custom") {
  const env = STANDARD_ENVELOPES.find((e) => e.id === patch.envelopeId)
  if (env) {
    updated.width = env.width
    updated.height = env.height
    updated.envelopeKind = env.kind
  }
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
  const inhouseOrBoth = pieces.filter((p) => (p.production === "inhouse" || p.production === "both") && p.production !== "customer")
  const ohpOrBoth = pieces.filter((p) => (p.production === "ohp" || p.production === "both") && p.production !== "customer")

  const needsEnvelope = inhouseOrBoth.some((p) => p.type === "envelope")
  const needsPrinting = inhouseOrBoth.some((p) => !p.customerProvidesPrinting && ["postcard", "flat_card", "folded_card", "self_mailer", "letter"].includes(p.type))
  const needsBooklet = inhouseOrBoth.some((p) => p.type === "booklet")
  const needsSpiral = inhouseOrBoth.some((p) => p.type === "spiral_book")
  const needsPerfect = inhouseOrBoth.some((p) => p.type === "perfect_bound")
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
      quantity, setQuantity, shape, className, suggestedShapes, setShape, setClassName, mailService, setMailService,
      pieces, setPieces, addPiece, removePiece, updatePiece,
      outerPiece, mailerWidth, mailerHeight,
      needsEnvelope, needsPrinting, needsBooklet, needsSpiral, needsPerfect, needsOHP,
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

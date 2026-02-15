"use client"

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react"
import type { USPSShape } from "./usps-rates"

// ─── Types ───────────────────────────────────────────────
/** Single-piece types (the piece IS the mail) */
export type SinglePieceType = "postcard" | "flat_card" | "folded_card" | "self_mailer" | "booklet"

/** When multi-piece, the outer is always an envelope */
export type EnvelopeKind = "paper" | "plastic" | ""

/** Each insert inside an envelope */
export type InsertType = "flat_card" | "folded_card" | "booklet" | "letter" | "small_envelope"

export interface MailInsert {
  id: string
  type: InsertType
  description: string
  width: number | null
  height: number | null
}

// ─── Standard envelope sizes (for outer) ─────────────────
export interface EnvelopeSize {
  id: string; name: string; width: number; height: number; description: string
}

export const STANDARD_ENVELOPES: EnvelopeSize[] = [
  { id: "a2",      name: "A2",           width: 4.375, height: 5.75,  description: "RSVP / Note card" },
  { id: "a6",      name: "A6",           width: 4.75,  height: 6.5,   description: "4x6 card" },
  { id: "a7",      name: "A7",           width: 5.25,  height: 7.25,  description: "5x7 card" },
  { id: "a9",      name: "A9",           width: 5.75,  height: 8.75,  description: "Invitation" },
  { id: "a10",     name: "A10",          width: 6,     height: 9.5,   description: "6x9 card" },
  { id: "6x9",     name: "6 x 9",       width: 6,     height: 9,     description: "Booklet / catalog" },
  { id: "no10",    name: "#10 Standard", width: 4.125, height: 9.5,   description: "Business letter" },
  { id: "no10win", name: "#10 Window",   width: 4.125, height: 9.5,   description: "Letter w/ window" },
  { id: "6.5",     name: "#6 3/4",       width: 3.625, height: 6.5,   description: "Personal / remit" },
  { id: "9x12",    name: "9 x 12",      width: 9,     height: 12,    description: "Flat / catalog" },
  { id: "10x13",   name: "10 x 13",     width: 10,    height: 13,    description: "Large flat" },
  { id: "custom",  name: "Custom",       width: 0,     height: 0,     description: "Enter dimensions" },
]

// ─── Context shape ───────────────────────────────────────
interface MailingState {
  // Quantity
  quantity: number
  setQuantity: (qty: number) => void

  // USPS shape tracking
  shape: string; className: string; suggestedShapes: USPSShape[]
  setShape: (s: string) => void; setClassName: (n: string) => void

  // === MAIL PIECE DEFINITION ===
  /** How many physical pieces in this mailing (1 = standalone, 2+ = envelope + inserts) */
  pieceCount: number
  setPieceCount: (n: number) => void

  /** For single-piece: what type is it */
  singlePieceType: SinglePieceType | ""
  setSinglePieceType: (t: SinglePieceType | "") => void

  /** For multi-piece: envelope kind */
  envelopeKind: EnvelopeKind
  setEnvelopeKind: (k: EnvelopeKind) => void

  /** Outer dimensions (= the mail piece for USPS) */
  outerWidth: number | null
  outerHeight: number | null
  setOuterWidth: (w: number | null) => void
  setOuterHeight: (h: number | null) => void

  /** Selected standard envelope ID (or "custom") */
  outerEnvelopeId: string
  setOuterEnvelopeId: (id: string) => void

  /** Inner inserts (only when pieceCount > 1) */
  inserts: MailInsert[]
  setInserts: (items: MailInsert[]) => void
  addInsert: (type: InsertType) => void
  removeInsert: (id: string) => void
  updateInsert: (id: string, patch: Partial<Omit<MailInsert, "id">>) => void

  /** Toggles */
  customerProvidesPrinting: boolean
  setCustomerProvidesPrinting: (v: boolean) => void

  // === DERIVED ===
  /** Is the outer piece an envelope (multi-piece)? */
  isMultiPiece: boolean
  /** Does this job need the Envelope calculator step? */
  needsEnvelope: boolean
  /** Does this job need the Printing calculator? */
  needsPrinting: boolean
  /** Does this job need the Booklet calculator? */
  needsBooklet: boolean
  /** Overall outer width/height (same as outerWidth/outerHeight but guaranteed for USPS) */
  mailerWidth: number | null
  mailerHeight: number | null
}

const MailingContext = createContext<MailingState | null>(null)

function computeSuggestedShapes(w: number | null, h: number | null): USPSShape[] {
  if (!w || !h) return ["POSTCARD", "LETTER", "FLAT"]
  const short = Math.min(w, h); const long = Math.max(w, h)
  const shapes: USPSShape[] = []
  if (short >= 3.5 && short <= 6 && long >= 5 && long <= 9) shapes.push("POSTCARD")
  if (short >= 3.5 && short <= 6.125 && long >= 5 && long <= 11.5) shapes.push("LETTER")
  if (short <= 12 && long <= 15 && (short > 6.125 || long > 11.5)) shapes.push("FLAT")
  return shapes
}

let insertCounter = 0

export function MailingProvider({ children }: { children: ReactNode }) {
  const [quantity, setQuantity] = useState(5000)
  const [shape, setShape] = useState("LETTER")
  const [className, setClassName] = useState("Letter")

  const [pieceCount, setPieceCount] = useState(1)
  const [singlePieceType, setSinglePieceType] = useState<SinglePieceType | "">("")
  const [envelopeKind, setEnvelopeKind] = useState<EnvelopeKind>("")
  const [outerWidth, setOuterWidth] = useState<number | null>(null)
  const [outerHeight, setOuterHeight] = useState<number | null>(null)
  const [outerEnvelopeId, setOuterEnvelopeId] = useState("")
  const [inserts, setInserts] = useState<MailInsert[]>([])
  const [customerProvidesPrinting, setCustomerProvidesPrinting] = useState(false)

  const isMultiPiece = pieceCount > 1
  const mailerWidth = outerWidth
  const mailerHeight = outerHeight
  const suggestedShapes = useMemo(() => computeSuggestedShapes(mailerWidth, mailerHeight), [mailerWidth, mailerHeight])

  // When user selects a standard envelope, auto-set outer dims
  const handleSetOuterEnvelopeId = useCallback((id: string) => {
    setOuterEnvelopeId(id)
    const env = STANDARD_ENVELOPES.find((e) => e.id === id)
    if (env && id !== "custom") {
      setOuterWidth(env.width)
      setOuterHeight(env.height)
    }
  }, [])

  const addInsert = useCallback((type: InsertType) => {
    insertCounter++
    setInserts((prev) => [...prev, { id: `ins-${insertCounter}`, type, description: "", width: null, height: null }])
  }, [])

  const removeInsert = useCallback((id: string) => {
    setInserts((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const updateInsert = useCallback((id: string, patch: Partial<Omit<MailInsert, "id">>) => {
    setInserts((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i))
  }, [])

  // Derived step visibility
  const needsEnvelope = isMultiPiece
  const needsPrinting = !customerProvidesPrinting
  const needsBooklet = (!isMultiPiece && singlePieceType === "booklet") || inserts.some((i) => i.type === "booklet")

  return (
    <MailingContext.Provider
      value={{
        quantity, setQuantity,
        shape, className, suggestedShapes, setShape, setClassName,
        pieceCount, setPieceCount,
        singlePieceType, setSinglePieceType,
        envelopeKind, setEnvelopeKind,
        outerWidth, outerHeight, setOuterWidth, setOuterHeight,
        outerEnvelopeId, setOuterEnvelopeId: handleSetOuterEnvelopeId,
        inserts, setInserts, addInsert, removeInsert, updateInsert,
        customerProvidesPrinting, setCustomerProvidesPrinting,
        isMultiPiece, needsEnvelope, needsPrinting, needsBooklet,
        mailerWidth, mailerHeight,
      }}
    >
      {children}
    </MailingContext.Provider>
  )
}

export function useMailing() {
  const ctx = useContext(MailingContext)
  if (!ctx) throw new Error("useMailing must be inside MailingProvider")
  return ctx
}

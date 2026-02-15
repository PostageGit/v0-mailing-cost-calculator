"use client"

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react"
import type { USPSShape } from "./usps-rates"

// ─── Mail piece types ────────────────────────────────────
export type PieceType = "flat_card" | "folded_card" | "envelope" | "self_mailer" | "booklet" | "postcard"
export type EnvelopeKind = "paper" | "plastic" | ""
export type InsertType = "flat" | "folded" | "booklet" | "card"

export interface InsertItem {
  id: string
  type: InsertType
  description: string
}

// ─── Context shape ───────────────────────────────────────
interface MailingState {
  // quantities & USPS
  quantity: number
  shape: string
  className: string
  suggestedShapes: USPSShape[]
  setQuantity: (qty: number) => void
  setShape: (shape: string) => void
  setClassName: (name: string) => void

  // Mail piece definition
  pieceType: PieceType | ""
  envelopeKind: EnvelopeKind
  mailerWidth: number | null
  mailerHeight: number | null
  inserts: InsertItem[]
  customerProvidesInserts: boolean
  customerProvidesPrinting: boolean
  contactName: string

  setPieceType: (t: PieceType | "") => void
  setEnvelopeKind: (k: EnvelopeKind) => void
  setMailerWidth: (w: number | null) => void
  setMailerHeight: (h: number | null) => void
  setInserts: (items: InsertItem[]) => void
  addInsert: (type: InsertType, desc?: string) => void
  removeInsert: (id: string) => void
  setCustomerProvidesInserts: (v: boolean) => void
  setCustomerProvidesPrinting: (v: boolean) => void
  setContactName: (name: string) => void

  // Derived: which calculator steps are relevant
  needsEnvelope: boolean
  needsPrinting: boolean
  needsBooklet: boolean
}

const MailingContext = createContext<MailingState | null>(null)

function computeSuggestedShapes(w: number | null, h: number | null): USPSShape[] {
  if (!w || !h) return ["POSTCARD", "LETTER", "FLAT"]
  const short = Math.min(w, h)
  const long = Math.max(w, h)
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
  const [pieceType, setPieceType] = useState<PieceType | "">("")
  const [envelopeKind, setEnvelopeKind] = useState<EnvelopeKind>("")
  const [mailerWidth, setMailerWidth] = useState<number | null>(null)
  const [mailerHeight, setMailerHeight] = useState<number | null>(null)
  const [inserts, setInserts] = useState<InsertItem[]>([])
  const [customerProvidesInserts, setCustomerProvidesInserts] = useState(false)
  const [customerProvidesPrinting, setCustomerProvidesPrinting] = useState(false)
  const [contactName, setContactName] = useState("")

  const suggestedShapes = useMemo(() => computeSuggestedShapes(mailerWidth, mailerHeight), [mailerWidth, mailerHeight])

  const addInsert = useCallback((type: InsertType, desc?: string) => {
    insertCounter++
    setInserts((prev) => [...prev, { id: `ins-${insertCounter}`, type, description: desc || "" }])
  }, [])

  const removeInsert = useCallback((id: string) => {
    setInserts((prev) => prev.filter((i) => i.id !== id))
  }, [])

  // Derived: what steps are needed
  const needsEnvelope = pieceType === "envelope"
  const needsPrinting = !customerProvidesPrinting
  const needsBooklet = pieceType === "booklet" || inserts.some((i) => i.type === "booklet")

  return (
    <MailingContext.Provider
      value={{
        quantity, shape, className, suggestedShapes,
        setQuantity, setShape, setClassName,
        pieceType, envelopeKind, mailerWidth, mailerHeight,
        inserts, customerProvidesInserts, customerProvidesPrinting, contactName,
        setPieceType, setEnvelopeKind, setMailerWidth, setMailerHeight,
        setInserts, addInsert, removeInsert,
        setCustomerProvidesInserts, setCustomerProvidesPrinting, setContactName,
        needsEnvelope, needsPrinting, needsBooklet,
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

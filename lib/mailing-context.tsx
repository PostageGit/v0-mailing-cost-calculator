"use client"

import { createContext, useContext, useState, useMemo, type ReactNode } from "react"
import type { USPSShape } from "./usps-rates"

/** Shared state that flows from the Job Setup / USPS calculator to other tabs */
interface MailingState {
  /** Total pieces from the USPS calc (quantity + saturation) */
  quantity: number
  /** USPS shape chosen: POSTCARD | LETTER | FLAT */
  shape: string
  /** Resolved class name matching mail_class_settings (e.g. "Postcard", "Letter", "Flat") */
  className: string
  /** Mailer width in inches (entered in Job Setup) */
  mailerWidth: number | null
  /** Mailer height in inches (entered in Job Setup) */
  mailerHeight: number | null
  /** Number of inserts */
  inserts: number
  /** Contact name for this job */
  contactName: string
  /** Suggested USPS shapes based on mailer dimensions */
  suggestedShapes: USPSShape[]
  setQuantity: (qty: number) => void
  setShape: (shape: string) => void
  setClassName: (name: string) => void
  setMailerWidth: (w: number | null) => void
  setMailerHeight: (h: number | null) => void
  setInserts: (n: number) => void
  setContactName: (name: string) => void
}

const MailingContext = createContext<MailingState | null>(null)

/**
 * Determine which USPS shapes the piece qualifies for based on dimensions.
 * USPS size thresholds (width x height):
 *   POSTCARD: 3.5x5 to 6x9 (max thickness 0.016")
 *   LETTER:   3.5x5 to 6.125x11.5 (max thickness 0.25")
 *   FLAT:     over letter limits, up to 12x15 (max thickness 0.75")
 */
function computeSuggestedShapes(w: number | null, h: number | null): USPSShape[] {
  if (!w || !h) return ["POSTCARD", "LETTER", "FLAT"]
  // Ensure width <= height for comparison
  const short = Math.min(w, h)
  const long = Math.max(w, h)

  const shapes: USPSShape[] = []

  // Postcard: short 3.5-6, long 5-9
  if (short >= 3.5 && short <= 6 && long >= 5 && long <= 9) {
    shapes.push("POSTCARD")
  }
  // Letter: short 3.5-6.125, long 5-11.5
  if (short >= 3.5 && short <= 6.125 && long >= 5 && long <= 11.5) {
    shapes.push("LETTER")
  }
  // Flat: exceeds letter max or fits in flat range, up to 12x15
  if (short <= 12 && long <= 15) {
    if (short > 6.125 || long > 11.5) {
      shapes.push("FLAT")
    }
  }

  // If nothing matches (too small or too big), return all as selectable with override
  return shapes.length > 0 ? shapes : ["POSTCARD", "LETTER", "FLAT"]
}

export function MailingProvider({ children }: { children: ReactNode }) {
  const [quantity, setQuantity] = useState(5000)
  const [shape, setShape] = useState("LETTER")
  const [className, setClassName] = useState("Letter")
  const [mailerWidth, setMailerWidth] = useState<number | null>(null)
  const [mailerHeight, setMailerHeight] = useState<number | null>(null)
  const [inserts, setInserts] = useState(0)
  const [contactName, setContactName] = useState("")

  const suggestedShapes = useMemo(
    () => computeSuggestedShapes(mailerWidth, mailerHeight),
    [mailerWidth, mailerHeight]
  )

  return (
    <MailingContext.Provider
      value={{
        quantity, shape, className,
        mailerWidth, mailerHeight, inserts, contactName,
        suggestedShapes,
        setQuantity, setShape, setClassName,
        setMailerWidth, setMailerHeight, setInserts, setContactName,
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

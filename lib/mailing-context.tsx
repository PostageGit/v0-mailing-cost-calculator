"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

/** Shared state that flows from the USPS Postage calculator to the Labor calculator */
interface MailingState {
  /** Total pieces from the USPS calc (quantity + saturation) */
  quantity: number
  /** USPS shape chosen: POSTCARD | LETTER | FLAT */
  shape: string
  /** Resolved class name matching mail_class_settings (e.g. "Postcard", "Letter", "Flat") */
  className: string
  setQuantity: (qty: number) => void
  setShape: (shape: string) => void
  setClassName: (name: string) => void
}

const MailingContext = createContext<MailingState | null>(null)

export function MailingProvider({ children }: { children: ReactNode }) {
  const [quantity, setQuantity] = useState(5000)
  const [shape, setShape] = useState("LETTER")
  const [className, setClassName] = useState("Letter")

  return (
    <MailingContext.Provider
      value={{ quantity, shape, className, setQuantity, setShape, setClassName }}
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

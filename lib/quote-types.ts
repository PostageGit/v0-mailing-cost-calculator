// Types for the unified Quote Builder

export type QuoteCategory = "flat" | "booklet" | "spiral" | "perfect" | "pad" | "postage" | "listwork" | "item" | "ohp" | "envelope"

export interface QuoteLineItem {
  id: number
  category: QuoteCategory
  label: string            // e.g. "19,880 - 4x6 Flat Prints" or "Postage - 1st Class"
  description: string      // additional details lines
  amount: number           // the dollar total for this line
  /** Optional metadata that travels with the item through the job lifecycle */
  metadata?: {
    // Planner piece context
    pieceType?: string           // e.g. "postcard", "envelope", "booklet"
    pieceLabel?: string          // user label from planner
    pieceDimensions?: string     // e.g. "4.375x5.75"
    foldType?: string            // e.g. "half_fold", "tri_fold"
    production?: string          // "inhouse" | "ohp" | "both" | "customer" | "no_print"
    piecePosition?: number       // 1 = outer, 2+ = inserts

    // Postage / mailing
    mailingClass?: string        // "First Class", "Marketing", "Non-Profit"
    mailShape?: string           // "letter", "flat", "postcard"
    tierName?: string            // "Mixed ADC", "5-Digit", etc.
    entryPoint?: string          // "DNDC", "DSCF", "DDU", etc.
    mailType?: string            // "Auto" | "CR" for MKT/NP
    dropOff?: string             // alias for entry in Tab 2

    // Printing details
    paperName?: string           // "20lb Offset", "100lb Gloss Text"
    sides?: string               // "S/S", "D/S"
    hasBleed?: boolean
    pageCount?: number           // for booklets/spiral/perfect

    // Envelope
    envelopeSize?: string        // "A2", "#10 Std", etc.
    envelopeKind?: string        // "paper" | "plastic"

    // Customer provided
    customerProvided?: boolean
    providerVendor?: string
    providerExpectedDate?: string

    [key: string]: unknown
  }
}

export interface QuoteState {
  items: QuoteLineItem[]
  projectName: string
}

export function getCategoryLabel(cat: QuoteCategory): string {
  switch (cat) {
    case "flat":
      return "Flat Printing"
    case "booklet":
      return "Fold & Staple"
    case "spiral":
      return "Spiral Binding"
    case "perfect":
      return "Perfect Binding"
    case "pad":
      return "Pad Finishing"
    case "postage":
      return "Postage / USPS"
    case "listwork":
      return "List Work & Mailing Labor"
    case "item":
      return "Items & Supplies"
    case "ohp":
      return "Out of House"
    case "envelope":
      return "Envelopes"
  }
}

export function getCategoryColor(cat: QuoteCategory): string {
  switch (cat) {
    case "flat":
      return "bg-foreground/5 text-foreground"
    case "booklet":
      return "bg-foreground/5 text-foreground"
    case "spiral":
      return "bg-foreground/5 text-foreground"
    case "perfect":
      return "bg-foreground/5 text-foreground"
    case "pad":
      return "bg-foreground/5 text-foreground"
    case "postage":
      return "bg-foreground/5 text-foreground"
    case "listwork":
      return "bg-foreground/5 text-foreground"
    case "item":
      return "bg-foreground/5 text-foreground"
    case "ohp":
      return "bg-foreground/5 text-foreground"
    case "envelope":
      return "bg-foreground/5 text-foreground"
  }
}

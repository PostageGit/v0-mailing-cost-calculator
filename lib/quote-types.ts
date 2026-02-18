// Types for the unified Quote Builder

export type QuoteCategory = "flat" | "booklet" | "spiral" | "perfect" | "postage" | "listwork" | "item" | "ohp" | "envelope"

export interface QuoteLineItem {
  id: number
  category: QuoteCategory
  label: string            // e.g. "19,880 - 4x6 Flat Prints" or "Postage - 1st Class"
  description: string      // additional details lines
  amount: number           // the dollar total for this line
  /** Optional metadata that travels with the item through the job lifecycle */
  metadata?: {
    customerProvided?: boolean
    providerVendor?: string      // vendor name or custom text
    providerExpectedDate?: string // ISO date string
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

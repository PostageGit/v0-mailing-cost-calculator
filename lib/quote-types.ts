// Types for the unified Quote Builder

export type QuoteCategory = "flat" | "booklet" | "postage" | "listwork" | "item" | "ohp"

export interface QuoteLineItem {
  id: number
  category: QuoteCategory
  label: string            // e.g. "19,880 - 4x6 Flat Prints" or "Postage - 1st Class"
  description: string      // additional details lines
  amount: number           // the dollar total for this line
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
    case "postage":
      return "Postage / USPS"
    case "listwork":
      return "List Work & Mailing Labor"
    case "item":
      return "Items & Supplies"
    case "ohp":
      return "Out of House"
  }
}

export function getCategoryColor(cat: QuoteCategory): string {
  switch (cat) {
    case "flat":
      return "bg-foreground/5 text-foreground"
    case "booklet":
      return "bg-foreground/5 text-foreground"
    case "postage":
      return "bg-foreground/5 text-foreground"
    case "listwork":
      return "bg-foreground/5 text-foreground"
    case "item":
      return "bg-foreground/5 text-foreground"
    case "ohp":
      return "bg-foreground/5 text-foreground"
  }
}

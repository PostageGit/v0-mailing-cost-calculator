"use client"

import useSWR from "swr"

export interface Paper {
  id: string
  name: string
  category: "text" | "cover" | "specialty"
  is_cardstock: boolean
  thickness: number
  weight_gsm: number | null
  active: boolean
  prices: Record<string, number>
  available_sizes: string[]
  // Printing context usage flags
  use_in_flat_printing: boolean
  use_in_book_cover: boolean
  use_in_book_inside: boolean
  notes: string | null
  sort_order: number
}

export type PaperUseFor = "flat_printing" | "book_cover" | "book_inside"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Hook to fetch papers from the database
 * @param useFor - Filter by usage type: 'flat_printing', 'book_cover', 'book_inside'
 * @param category - Filter by category: 'text', 'cover', 'specialty'
 * @param includeInactive - Include inactive papers (default: false)
 */
export function usePapers(options?: {
  useFor?: PaperUseFor
  category?: "text" | "cover" | "specialty"
  includeInactive?: boolean
}) {
  const params = new URLSearchParams()
  if (options?.useFor) params.set("use_for", options.useFor)
  if (options?.category) params.set("category", options.category)
  if (!options?.includeInactive) params.set("active", "true")

  const url = `/api/papers${params.toString() ? `?${params.toString()}` : ""}`
  const { data, error, isLoading, mutate } = useSWR<Paper[]>(url, fetcher)

  return {
    papers: data || [],
    isLoading,
    error,
    refresh: mutate,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pre-configured hooks for each printing context
// ═══════════════════════════════════════════════════════════════════════════

/** Get papers for flat printing (sheets, flats, self-mailers) */
export function useFlatPrintingPapers() {
  return usePapers({ useFor: "flat_printing" })
}

/** Get papers for book covers (booklet, saddle stitch, perfect bind) */
export function useBookCoverPapers() {
  return usePapers({ useFor: "book_cover" })
}

/** Get papers for book inside pages (booklet, saddle stitch, perfect bind) */
export function useBookInsidePapers() {
  return usePapers({ useFor: "book_inside" })
}

/**
 * Convert papers to the format expected by existing calculators
 * { name: string, isCardstock: boolean, availableSizes: string[], thickness: number }
 */
export function papersToOptions(papers: Paper[]) {
  return papers.map((p) => ({
    name: p.name,
    isCardstock: p.is_cardstock,
    thickness: p.thickness,
    availableSizes: p.available_sizes,
  }))
}

/**
 * Convert papers to price lookup format
 * { [paperName]: { [size]: price } }
 */
export function papersToPrices(papers: Paper[]) {
  return papers.reduce((acc, p) => {
    acc[p.name] = p.prices
    return acc
  }, {} as Record<string, Record<string, number>>)
}

/**
 * Get price for a specific paper and size
 */
export function getPaperPrice(papers: Paper[], paperName: string, size: string): number {
  const paper = papers.find((p) => p.name === paperName)
  return paper?.prices?.[size] ?? 0
}

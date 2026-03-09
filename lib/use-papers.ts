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
  use_for_printing: boolean
  use_for_booklet_cover: boolean
  use_for_booklet_inside: boolean
  use_for_flat: boolean
  notes: string | null
  sort_order: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Hook to fetch papers from the database
 * @param useFor - Filter by usage type: 'printing', 'booklet_cover', 'booklet_inside', 'flat'
 * @param category - Filter by category: 'text', 'cover', 'specialty'
 * @param includeInactive - Include inactive papers (default: false)
 */
export function usePapers(options?: {
  useFor?: "printing" | "booklet_cover" | "booklet_inside" | "flat"
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

/**
 * Get all papers for printing (flat sheets, digital print)
 */
export function usePrintingPapers() {
  return usePapers({ useFor: "printing" })
}

/**
 * Get papers suitable for booklet covers
 */
export function useBookletCoverPapers() {
  return usePapers({ useFor: "booklet_cover" })
}

/**
 * Get papers suitable for booklet inside pages
 */
export function useBookletInsidePapers() {
  return usePapers({ useFor: "booklet_inside" })
}

/**
 * Get papers suitable for flats/self-mailers
 */
export function useFlatPapers() {
  return usePapers({ useFor: "flat" })
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

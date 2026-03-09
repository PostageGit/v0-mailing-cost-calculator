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
  // Granular per-calculator usage flags
  use_in_postcard: boolean
  use_in_letter: boolean
  use_in_flat: boolean
  use_in_envelope: boolean
  use_in_booklet_cover: boolean
  use_in_booklet_inside: boolean
  use_in_perfect_bind_cover: boolean
  use_in_perfect_bind_inside: boolean
  use_in_saddle_stitch_cover: boolean
  use_in_saddle_stitch_inside: boolean
  notes: string | null
  sort_order: number
}

export type PaperUseFor = 
  | "postcard" | "letter" | "flat" | "envelope"
  | "booklet_cover" | "booklet_inside"
  | "perfect_bind_cover" | "perfect_bind_inside"
  | "saddle_stitch_cover" | "saddle_stitch_inside"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Hook to fetch papers from the database
 * @param useFor - Filter by usage type: 'postcard', 'letter', 'flat', 'envelope', 'booklet_cover', etc.
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
// Pre-configured hooks for each calculator type
// ═══════════════════════════════════════════════════════════════════════════

/** Get papers for postcard printing */
export function usePostcardPapers() {
  return usePapers({ useFor: "postcard" })
}

/** Get papers for letter printing */
export function useLetterPapers() {
  return usePapers({ useFor: "letter" })
}

/** Get papers for flat / self-mailer printing */
export function useFlatPapers() {
  return usePapers({ useFor: "flat" })
}

/** Get papers for envelope printing */
export function useEnvelopePapers() {
  return usePapers({ useFor: "envelope" })
}

/** Get papers for booklet covers */
export function useBookletCoverPapers() {
  return usePapers({ useFor: "booklet_cover" })
}

/** Get papers for booklet inside pages */
export function useBookletInsidePapers() {
  return usePapers({ useFor: "booklet_inside" })
}

/** Get papers for saddle stitch covers */
export function useSaddleStitchCoverPapers() {
  return usePapers({ useFor: "saddle_stitch_cover" })
}

/** Get papers for saddle stitch inside pages */
export function useSaddleStitchInsidePapers() {
  return usePapers({ useFor: "saddle_stitch_inside" })
}

/** Get papers for perfect bind covers */
export function usePerfectBindCoverPapers() {
  return usePapers({ useFor: "perfect_bind_cover" })
}

/** Get papers for perfect bind inside pages */
export function usePerfectBindInsidePapers() {
  return usePapers({ useFor: "perfect_bind_inside" })
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

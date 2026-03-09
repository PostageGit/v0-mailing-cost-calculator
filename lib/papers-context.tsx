"use client"

import { createContext, useContext, ReactNode, useEffect } from "react"
import useSWR from "swr"
import type { Paper } from "./use-papers"
import { setDynamicPaperPrices } from "./pricing-config"

type PaperUseFor = "flat_printing" | "book_cover" | "book_inside" | "coil_cover" | "coil_inside" | "spiral_cover" | "spiral_inside" | "pad"

interface PapersContextValue {
  papers: Paper[]
  flatPrintingPapers: Paper[]
  bookCoverPapers: Paper[]
  bookInsidePapers: Paper[]
  coilCoverPapers: Paper[]
  coilInsidePapers: Paper[]
  spiralCoverPapers: Paper[]
  spiralInsidePapers: Paper[]
  padPapers: Paper[]
  isLoading: boolean
  error: unknown
  refresh: () => void
  // Helper functions
  getPaperOptions: (useFor: PaperUseFor) => { name: string; isCardstock: boolean; thickness: number; availableSizes: string[] }[]
  getPaperPrices: (useFor?: PaperUseFor) => Record<string, Record<string, number>>
  getPaperPrice: (paperName: string, size: string) => number
}

const PapersContext = createContext<PapersContextValue | null>(null)

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function PapersProvider({ children }: { children: ReactNode }) {
  // Fetch all active papers
  const { data: papers, error, isLoading, mutate } = useSWR<Paper[]>("/api/papers?active=true", fetcher)
  
  const allPapers = papers || []
  
  // Sync paper prices to the global pricing config when papers load
  useEffect(() => {
    if (allPapers.length > 0) {
      const pricesMap = allPapers.reduce((acc, p) => {
        acc[p.name] = p.prices
        return acc
      }, {} as Record<string, Record<string, number>>)
      setDynamicPaperPrices(pricesMap)
    }
  }, [allPapers])
  
  // Filter papers by usage
  const flatPrintingPapers = allPapers.filter((p) => p.use_in_flat_printing)
  const bookCoverPapers = allPapers.filter((p) => p.use_in_book_cover)
  const bookInsidePapers = allPapers.filter((p) => p.use_in_book_inside)
  const coilCoverPapers = allPapers.filter((p) => p.use_in_coil_cover)
  const coilInsidePapers = allPapers.filter((p) => p.use_in_coil_inside)
  const spiralCoverPapers = allPapers.filter((p) => p.use_in_spiral_cover)
  const spiralInsidePapers = allPapers.filter((p) => p.use_in_spiral_inside)
  const padPapers = allPapers.filter((p) => p.use_in_pad)

  // Helper to get papers by usage type
  const getPapersByUseFor = (useFor: PaperUseFor) => {
    switch (useFor) {
      case "flat_printing": return flatPrintingPapers
      case "book_cover": return bookCoverPapers
      case "book_inside": return bookInsidePapers
      case "coil_cover": return coilCoverPapers
      case "coil_inside": return coilInsidePapers
      case "spiral_cover": return spiralCoverPapers
      case "spiral_inside": return spiralInsidePapers
      case "pad": return padPapers
      default: return allPapers
    }
  }
  
  // Convert to options format for dropdowns
  const getPaperOptions = (useFor: PaperUseFor) => {
    return getPapersByUseFor(useFor).map((p) => ({
      name: p.name,
      isCardstock: p.is_cardstock,
      thickness: p.thickness,
      availableSizes: p.available_sizes,
    }))
  }
  
  // Convert to prices lookup format
  const getPaperPrices = (useFor?: PaperUseFor) => {
    const filtered = useFor ? getPapersByUseFor(useFor) : allPapers
    return filtered.reduce((acc, p) => {
      acc[p.name] = p.prices
      return acc
    }, {} as Record<string, Record<string, number>>)
  }
  
  // Get price for a specific paper and size
  const getPaperPrice = (paperName: string, size: string): number => {
    const paper = allPapers.find((p) => p.name === paperName)
    return paper?.prices?.[size] ?? 0
  }
  
  return (
    <PapersContext.Provider value={{
      papers: allPapers,
      flatPrintingPapers,
      bookCoverPapers,
      bookInsidePapers,
      coilCoverPapers,
      coilInsidePapers,
      spiralCoverPapers,
      spiralInsidePapers,
      padPapers,
      isLoading,
      error,
      refresh: mutate,
      getPaperOptions,
      getPaperPrices,
      getPaperPrice,
    }}>
      {children}
    </PapersContext.Provider>
  )
}

export function usePapersContext() {
  const ctx = useContext(PapersContext)
  if (!ctx) {
    // Return default values if not in provider (for SSR or outside provider)
    return {
      papers: [],
      flatPrintingPapers: [],
      bookCoverPapers: [],
      bookInsidePapers: [],
      coilCoverPapers: [],
      coilInsidePapers: [],
      spiralCoverPapers: [],
      spiralInsidePapers: [],
      padPapers: [],
      isLoading: true,
      error: null,
      refresh: () => {},
      getPaperOptions: () => [],
      getPaperPrices: () => ({}),
      getPaperPrice: () => 0,
    }
  }
  return ctx
}

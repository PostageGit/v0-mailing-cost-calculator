import { useState, useCallback } from "react"
import type { QuoteLineItem } from "@/lib/quote-types"

export interface CustomerProvidedState {
  enabled: boolean
  setEnabled: (v: boolean) => void
  vendor: string
  setVendor: (v: string) => void
  customVendor: string
  setCustomVendor: (v: string) => void
  date: string
  setDate: (v: string) => void
  resolvedVendor: string
  reset: () => void
  /** Wraps the description with customer-provided info */
  buildDescription: (baseDesc: string, itemLabel: string) => string
  /** Returns metadata to spread into addItem, or empty object */
  buildMetadata: () => Partial<Pick<QuoteLineItem, "metadata">>
}

/**
 * Shared hook for "Customer Provided" state across all calculators.
 * @param vendors - The list of vendor objects from SWR (optional, for resolving names)
 */
export function useCustomerProvided(
  vendors?: Array<{ id: string; company_name: string }> | null
): CustomerProvidedState {
  const [enabled, setEnabled] = useState(false)
  const [vendor, setVendor] = useState("")
  const [customVendor, setCustomVendor] = useState("")
  const [date, setDate] = useState("")

  const resolvedVendor =
    vendor === "__custom__"
      ? customVendor
      : vendors?.find((v) => v.id === vendor)?.company_name || ""

  const reset = useCallback(() => {
    setEnabled(false)
    setVendor("")
    setCustomVendor("")
    setDate("")
  }, [])

  const buildDescription = useCallback(
    (baseDesc: string, itemLabel: string) => {
      if (!enabled) return baseDesc
      const parts = [baseDesc, `Customer Provides ${itemLabel}`]
      if (resolvedVendor) parts.push(`From: ${resolvedVendor}`)
      if (date)
        parts.push(
          `Expected: ${new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`
        )
      return parts.join(" | ")
    },
    [enabled, resolvedVendor, date]
  )

  const buildMetadata = useCallback((): Partial<Pick<QuoteLineItem, "metadata">> => {
    if (!enabled) return {}
    return {
      metadata: {
        customerProvided: true,
        providerVendor: resolvedVendor || undefined,
        providerExpectedDate: date || undefined,
      },
    }
  }, [enabled, resolvedVendor, date])

  return {
    enabled,
    setEnabled,
    vendor,
    setVendor,
    customVendor,
    setCustomVendor,
    date,
    setDate,
    resolvedVendor,
    reset,
    buildDescription,
    buildMetadata,
  }
}

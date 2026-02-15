"use client"

import { useQuote } from "@/lib/quote-context"
import { VendorBidPanel } from "./vendor-bid-panel"
import { Send, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

export function VendorBidTab() {
  const { savedId, ensureSaved, items } = useQuote()
  const [resolvedId, setResolvedId] = useState<string | null>(savedId)
  const [ensuring, setEnsuring] = useState(false)

  // Auto-save when OHP tab is opened and quote has items but no savedId
  useEffect(() => {
    if (savedId) {
      setResolvedId(savedId)
      return
    }
    if (items.length === 0) return

    let cancelled = false
    setEnsuring(true)
    ensureSaved().then((id) => {
      if (!cancelled && id) setResolvedId(id)
    }).finally(() => {
      if (!cancelled) setEnsuring(false)
    })
    return () => { cancelled = true }
  }, [savedId, items.length, ensureSaved])

  // Keep in sync if savedId changes later
  useEffect(() => {
    if (savedId) setResolvedId(savedId)
  }, [savedId])

  if (ensuring) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm font-medium">Saving quote...</p>
        <p className="text-xs text-center">Auto-saving your quote so you can create OHP bid requests.</p>
      </div>
    )
  }

  if (!resolvedId || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted/60 mb-3">
          <Send className="h-5 w-5 opacity-50" />
        </div>
        <p className="text-sm font-medium">No line items yet</p>
        <p className="text-xs mt-1 max-w-xs text-center text-pretty">
          Add items from the calculators first, then come here to request vendor bids for out-of-house production (OHP).
        </p>
      </div>
    )
  }

  return <VendorBidPanel quoteId={resolvedId} inline />
}

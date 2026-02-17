"use client"

import { useQuote } from "@/lib/quote-context"
import { VendorBidPanel } from "./vendor-bid-panel"
import { Send, Loader2, Plus } from "lucide-react"
import { useState, useEffect } from "react"

export function VendorBidTab() {
  const { savedId, ensureSaved, items } = useQuote()
  const [resolvedId, setResolvedId] = useState<string | null>(savedId)
  const [ensuring, setEnsuring] = useState(false)

  // Auto-save the quote when OHP tab opens
  useEffect(() => {
    console.log("[v0] VendorBidTab useEffect - savedId:", savedId, "resolvedId:", resolvedId)
    if (savedId) { setResolvedId(savedId); return }
    let cancelled = false
    setEnsuring(true)
    ensureSaved().then((id) => {
      console.log("[v0] VendorBidTab ensureSaved resolved:", id, "cancelled:", cancelled)
      if (!cancelled && id) setResolvedId(id)
    }).catch((err) => {
      console.log("[v0] VendorBidTab ensureSaved error:", err)
    }).finally(() => { if (!cancelled) setEnsuring(false) })
    return () => { cancelled = true }
  }, [savedId, ensureSaved])

  useEffect(() => { if (savedId) setResolvedId(savedId) }, [savedId])

  if (ensuring) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Saving quote...</p>
      </div>
    )
  }

  if (!resolvedId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-2xl bg-secondary p-5 mb-5">
          <Send className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground">Out of House Production</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm leading-relaxed">
          Build job descriptions and get vendor prices. Start by creating a bid request.
        </p>
      </div>
    )
  }

  return <VendorBidPanel quoteId={resolvedId} inline />
}

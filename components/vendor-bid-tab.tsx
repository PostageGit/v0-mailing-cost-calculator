"use client"

import { useQuote } from "@/lib/quote-context"
import { VendorBidPanel } from "./vendor-bid-panel"
import { Send, Save } from "lucide-react"

export function VendorBidTab() {
  const { savedId } = useQuote()

  if (!savedId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted/60 mb-3">
          <Send className="h-5 w-5 opacity-50" />
        </div>
        <p className="text-sm font-medium">No quote saved yet</p>
        <p className="text-xs mt-1 max-w-xs text-center text-pretty">
          Save your current quote first using the <Save className="inline h-3 w-3 mx-0.5" /> button in the sidebar, then you can create vendor bid requests for line items.
        </p>
      </div>
    )
  }

  return <VendorBidPanel quoteId={savedId} inline />
}

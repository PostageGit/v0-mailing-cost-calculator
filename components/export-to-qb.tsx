"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/pricing"
import { FinalizeQuoteModal, type StandaloneQuoteData } from "@/components/finalize-quote-modal"
import type { Customer } from "@/lib/customer-types"
import type { QuoteLineItem } from "@/lib/quote-types"
import {
  Search, Receipt, FileCheck, Loader2, ArrowRight,
  CheckCircle2, FileText, Download, ExternalLink,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ExportToQBProps {
  /** Called when the user wants to open/activate a quote in the pricing panel */
  onOpenQuote?: (quoteId: string) => void
}

interface Quote {
  id: string
  quote_number: number | null
  project_name: string
  customer_id: string | null
  contact_name: string
  reference_number: string
  status: string
  items: QuoteLineItem[]
  total: number
  invoice_id: string | null
  finalized_at: string | null
  column_id: string | null
  updated_at: string
  created_at: string
}

type Tab = "ready" | "exported"

export function ExportToQB({ onOpenQuote }: ExportToQBProps) {
  const { data: quotes, isLoading: quotesLoading, mutate: mutateQuotes } = useSWR<Quote[]>("/api/quotes", fetcher)
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("ready")
  const [convertingQuote, setConvertingQuote] = useState<StandaloneQuoteData | null>(null)

  // Resolve customer name by ID
  const customerMap = useMemo(() => {
    const map = new Map<string, string>()
    if (customers) {
      for (const c of customers) {
        map.set(c.id, c.company_name)
      }
    }
    return map
  }, [customers])

  // Split quotes into ready vs. already exported
  const { readyQuotes, exportedQuotes } = useMemo(() => {
    if (!quotes) return { readyQuotes: [], exportedQuotes: [] }

    const ready: Quote[] = []
    const exported: Quote[] = []

    for (const q of quotes) {
      // Must have at least 1 item to be exportable
      if (!q.items || q.items.length === 0) continue

      if (q.invoice_id || q.finalized_at) {
        exported.push(q)
      } else {
        ready.push(q)
      }
    }

    return { readyQuotes: ready, exportedQuotes: exported }
  }, [quotes])

  // Apply search filter
  const filteredQuotes = useMemo(() => {
    const source = activeTab === "ready" ? readyQuotes : exportedQuotes
    if (!search) return source
    const q = search.toLowerCase()
    return source.filter((quote) => {
      const customerName = quote.customer_id ? customerMap.get(quote.customer_id) || "" : ""
      return (
        quote.project_name.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q) ||
        String(quote.quote_number).includes(q) ||
        (quote.reference_number?.toLowerCase().includes(q) ?? false) ||
        (quote.contact_name?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [activeTab, readyQuotes, exportedQuotes, search, customerMap])

  const handleConvert = (quote: Quote) => {
    const customerName = quote.customer_id ? customerMap.get(quote.customer_id) || "Customer" : "Customer"
    setConvertingQuote({
      savedId: quote.id,
      quoteNumber: quote.quote_number,
      customerId: quote.customer_id,
      customerName,
      contactName: quote.contact_name || "",
      projectName: quote.project_name || "",
      referenceNumber: quote.reference_number || "",
      items: quote.items,
      total: quote.total,
    })
  }

  const handleConverted = () => {
    mutateQuotes()
  }

  const handleModalClose = () => {
    setConvertingQuote(null)
  }

  const totalReady = readyQuotes.reduce((s, q) => s + q.total, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Export to QB</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Convert quotes to invoices for QuickBooks export.
          </p>
        </div>
        {readyQuotes.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{readyQuotes.length} ready</span>
            <span className="font-mono font-bold text-foreground">{formatCurrency(totalReady)}</span>
          </div>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("ready")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "ready"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileCheck className="h-3 w-3" />
            Ready ({readyQuotes.length})
          </button>
          <button
            onClick={() => setActiveTab("exported")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "exported"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            Exported ({exportedQuotes.length})
          </button>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, quote #, project..."
            className="h-9 text-sm pl-9 rounded-xl"
          />
        </div>
      </div>

      {/* List */}
      {quotesLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading quotes...</span>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-16">
          {activeTab === "ready" ? (
            <>
              <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-foreground/80">No quotes ready to convert</p>
              <p className="text-xs text-muted-foreground mt-1">
                {readyQuotes.length === 0 && exportedQuotes.length === 0
                  ? "Create a quote first, then come here to convert it to an invoice."
                  : "All quotes with items have been exported."}
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-foreground/80">No exported quotes yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Quotes you convert to invoices will appear here.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="px-3 py-1.5 text-xs text-muted-foreground/60">
            {filteredQuotes.length} quote{filteredQuotes.length !== 1 ? "s" : ""}
          </div>
          {filteredQuotes.map((quote) => {
            const customerName = quote.customer_id ? customerMap.get(quote.customer_id) || "No customer" : "No customer"
            const isExported = activeTab === "exported"
            return (
              <Card
                key={quote.id}
                className="rounded-xl border border-border transition-all hover:border-foreground/20"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Icon */}
                  <div className={`shrink-0 rounded-lg p-2 ${isExported ? "bg-emerald-500/10" : "bg-secondary/60"}`}>
                    {isExported ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Quote info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground font-mono">
                        Q-{quote.quote_number || "draft"}
                      </span>
                      {isExported && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300">
                          Invoiced
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{customerName}</span>
                      {quote.project_name && quote.project_name !== "Untitled Quote" && (
                        <>
                          <span className="text-muted-foreground/30">|</span>
                          <span className="truncate">{quote.project_name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/60">
                      <span>{quote.items.length} item{quote.items.length !== 1 ? "s" : ""}</span>
                      <span className="text-muted-foreground/30">|</span>
                      <span>
                        {new Date(quote.updated_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Amount + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                      {formatCurrency(quote.total)}
                    </span>
                    {onOpenQuote && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenQuote(quote.id)}
                        className="h-8 gap-1.5 text-xs rounded-lg font-semibold"
                      >
                        <ExternalLink className="h-3 w-3" /> Open
                      </Button>
                    )}
                    {!isExported && (
                      <Button
                        size="sm"
                        onClick={() => handleConvert(quote)}
                        className="h-8 gap-1.5 text-xs rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold"
                      >
                        <ArrowRight className="h-3 w-3" /> Convert
                      </Button>
                    )}
                    {isExported && quote.finalized_at && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(quote.finalized_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Finalize Modal */}
      {convertingQuote && (
        <FinalizeQuoteModal
          open={true}
          onClose={handleModalClose}
          standaloneData={convertingQuote}
          onConverted={handleConverted}
        />
      )}
    </div>
  )
}

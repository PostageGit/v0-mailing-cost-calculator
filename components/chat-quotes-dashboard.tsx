"use client"

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Search, RefreshCw, Loader2, MessageSquare, ChevronUp, ChevronDown,
} from "lucide-react"

interface ChatQuote {
  id: string; ref_number: number; customer_name: string;
  customer_email: string; customer_phone: string;
  project_name: string; product_type: string; total: number; per_unit: number;
  specs: Record<string, unknown>; cost_breakdown: Record<string, unknown>;
  notes: string; created_at: string;
}

const PRODUCT_COLORS: Record<string, string> = {
  flat: "bg-blue-500/15 text-blue-700",
  booklet: "bg-green-500/15 text-green-700",
  perfect: "bg-purple-500/15 text-purple-700",
  spiral: "bg-orange-500/15 text-orange-700",
  pad: "bg-yellow-500/15 text-yellow-700",
  envelope: "bg-pink-500/15 text-pink-700",
}

const formatKey = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()).trim()

export function formatChatQuoteRef(refNumber: number) {
  return `CQ-${refNumber}`
}

export function ChatQuotesDashboard() {
  const [quotes, setQuotes] = useState<ChatQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/chat-quotes")
      if (res.ok) {
        const data = await res.json()
        setQuotes(data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useState(() => { loadQuotes() })

  const filtered = quotes.filter((q) => {
    const term = searchTerm.toLowerCase()
    if (!term) return true
    return (
      q.customer_name?.toLowerCase().includes(term) ||
      q.customer_email?.toLowerCase().includes(term) ||
      q.customer_phone?.includes(term) ||
      q.project_name?.toLowerCase().includes(term) ||
      q.product_type?.toLowerCase().includes(term) ||
      String(q.ref_number).includes(term) ||
      formatChatQuoteRef(q.ref_number).toLowerCase().includes(term)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 sm:px-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Chat Quotes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quotes saved by customers from the AI chat assistant
        </p>
      </div>

      {/* Search & refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, project, CQ-number, or product type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 pl-10 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-11 px-4 min-w-[44px]" onClick={loadQuotes}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Quotes</p>
          <p className="text-2xl font-bold text-foreground mt-1">{quotes.length}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            ${quotes.reduce((sum, q) => sum + Number(q.total || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {quotes.filter((q) => {
              const d = new Date(q.created_at)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Avg Quote</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            ${quotes.length > 0
              ? (quotes.reduce((sum, q) => sum + Number(q.total || 0), 0) / quotes.length).toFixed(2)
              : "0.00"}
          </p>
        </div>
      </div>

      {/* Quote list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchTerm ? "No quotes match your search." : "No chat quotes saved yet. Quotes will appear here when customers save them from the chat."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((q) => {
            const isExpanded = expandedId === q.id
            const specs = q.specs || {}
            const breakdown = q.cost_breakdown || {}
            const productColor = PRODUCT_COLORS[q.product_type] || "bg-muted text-muted-foreground"
            return (
              <div key={q.id} className="rounded-xl border border-border overflow-hidden">
                {/* Header row */}
                <button
                  className={cn(
                    "w-full flex items-center justify-between px-4 sm:px-5 py-4 text-left transition-colors min-h-[64px]",
                    isExpanded ? "bg-muted/40" : "hover:bg-muted/20"
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="flex items-center justify-center h-11 min-w-[60px] rounded-lg bg-foreground shrink-0 px-2">
                      <span className="text-xs font-bold text-background">{formatChatQuoteRef(q.ref_number)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{q.project_name}</p>
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0", productColor)}>
                          {q.product_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {q.customer_name || "No name"}
                        {q.customer_phone && <> &middot; {q.customer_phone}</>}
                        {" "}&middot; {new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" "}{new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-bold text-foreground">${Number(q.total).toFixed(2)}</span>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/5">
                    {/* Specs section */}
                    <div className="px-4 sm:px-5 py-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Job Specifications</h4>
                      {Object.keys(specs).length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                          {Object.entries(specs).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-[11px] text-muted-foreground">{formatKey(key)}</p>
                              <p className="text-sm font-medium text-foreground">
                                {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No specs recorded.</p>
                      )}
                    </div>

                    {/* Cost breakdown section */}
                    {Object.keys(breakdown).length > 0 && (
                      <div className="px-4 sm:px-5 py-4 border-t border-border">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Cost Breakdown</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                          {Object.entries(breakdown).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-[11px] text-muted-foreground">{formatKey(key)}</p>
                              <p className="text-sm font-bold text-foreground">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Customer contact info */}
                    <div className="px-4 sm:px-5 py-4 border-t border-border">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Customer Info</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Name</p>
                          <p className="text-sm font-semibold text-foreground">{q.customer_name || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Email</p>
                          <p className="text-sm font-semibold text-foreground">
                            {q.customer_email ? (
                              <a href={`mailto:${q.customer_email}`} className="underline underline-offset-2">{q.customer_email}</a>
                            ) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Phone</p>
                          <p className="text-sm font-semibold text-foreground">
                            {q.customer_phone ? (
                              <a href={`tel:${q.customer_phone}`} className="underline underline-offset-2">{q.customer_phone}</a>
                            ) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Date & Time</p>
                          <p className="text-sm font-semibold text-foreground">
                            {new Date(q.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            {" "}at {new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Summary footer */}
                    <div className="px-4 sm:px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                        {q.per_unit > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Per Unit</p>
                            <p className="text-sm font-semibold text-foreground">${Number(q.per_unit).toFixed(4)}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                        <p className="text-xl font-bold text-foreground">${Number(q.total).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

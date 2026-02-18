"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pricing"
import {
  Search, Send, ExternalLink, CheckCircle2, Clock,
  Award, Inbox, Tag, ArrowUpDown,
} from "lucide-react"

/* ── Types ── */
interface BidPrice {
  id: string
  vendor_id: string
  price: number | null
  status: "pending" | "received" | "declined"
  vendors?: { company_name: string } | null
}
interface QuoteRef {
  id: string
  project_name: string
  contact_name: string | null
  customer_id: string | null
  quote_number: number | null
  job_number: number | null
  is_job: boolean | null
  archived: boolean | null
  mailing_date: string | null
}
interface DashboardBid {
  id: string
  quote_id: string | null
  item_label: string
  item_description: string | null
  item_category: string
  status: "open" | "closed" | "awarded"
  winning_vendor_id: string | null
  winning_price: number | null
  created_at: string
  vendor_bid_prices: BidPrice[]
  quotes: QuoteRef | null
}

type StatusFilter = "all" | "open" | "awarded" | "closed"
type SortField = "job" | "item" | "status" | "prices"

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error("Fetch failed")
  return r.json()
}

export function OhpBidsDashboard({ onOpenQuote }: { onOpenQuote?: (quoteId: string, step?: string) => void }) {
  const { data: bids } = useSWR<DashboardBid[]>("/api/vendor-bids/dashboard", fetcher, { refreshInterval: 15000 })

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [sortField, setSortField] = useState<SortField>("status")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const counts = useMemo(() => {
    if (!bids) return { open: 0, awarded: 0, closed: 0, total: 0 }
    return {
      open: bids.filter((b) => b.status === "open").length,
      awarded: bids.filter((b) => b.status === "awarded").length,
      closed: bids.filter((b) => b.status === "closed").length,
      total: bids.length,
    }
  }, [bids])

  const categories = useMemo(() => {
    if (!bids) return []
    return [...new Set(bids.map((b) => b.item_category))].sort()
  }, [bids])

  // Flatten bids into rows with job context
  const rows = useMemo(() => {
    if (!bids) return []

    let list = [...bids]

    if (statusFilter !== "all") list = list.filter((b) => b.status === statusFilter)
    if (categoryFilter) list = list.filter((b) => b.item_category === categoryFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((b) => {
        const qNum = b.quotes?.quote_number ? `Q-${b.quotes.quote_number}` : ""
        const jNum = b.quotes?.job_number ? `J-${b.quotes.job_number}` : ""
        const vendorNames = (b.vendor_bid_prices || [])
          .map((p: any) => p.vendors?.company_name || "")
          .join(" ")
          .toLowerCase()
        return (
          b.item_label.toLowerCase().includes(q) ||
          b.item_description?.toLowerCase().includes(q) ||
          b.quotes?.project_name.toLowerCase().includes(q) ||
          b.quotes?.contact_name?.toLowerCase().includes(q) ||
          qNum.toLowerCase().includes(q) ||
          jNum.toLowerCase().includes(q) ||
          vendorNames.includes(q)
        )
      })
    }

    // Sort
    const statusOrder = { open: 0, awarded: 1, closed: 2 }
    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "job":
          cmp = (a.quotes?.project_name || "").localeCompare(b.quotes?.project_name || "")
          break
        case "item":
          cmp = a.item_label.localeCompare(b.item_label)
          break
        case "status":
          cmp = statusOrder[a.status] - statusOrder[b.status]
          break
        case "prices": {
          const aR = a.vendor_bid_prices.filter((p) => p.status === "received").length
          const bR = b.vendor_bid_prices.filter((p) => p.status === "received").length
          cmp = aR - bR
          break
        }
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return list
  }, [bids, search, statusFilter, categoryFilter, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  if (!bids) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="animate-pulse text-sm text-muted-foreground">Loading bids...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-border/40 bg-background">
        {/* Title + stats inline */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
            <Send className="h-3.5 w-3.5 text-sky-700 dark:text-sky-400" />
          </div>
          <h1 className="text-base font-bold text-foreground">OHP Bids</h1>
          {/* Inline stat pills */}
          <div className="flex items-center gap-1.5 ml-auto">
            {([
              { key: "open" as StatusFilter, label: "Open", count: counts.open, color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/30", border: "border-sky-200/60 dark:border-sky-800/40" },
              { key: "awarded" as StatusFilter, label: "Awarded", count: counts.awarded, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200/60 dark:border-emerald-800/40" },
              { key: "closed" as StatusFilter, label: "Closed", count: counts.closed, color: "text-muted-foreground", bg: "bg-secondary/40", border: "border-border" },
            ]).map(({ key, label, count, color, bg, border }) => {
              const active = statusFilter === key
              return (
                <button key={key} onClick={() => setStatusFilter(active ? "all" : key)}
                  className={cn(
                    "h-7 px-2.5 rounded-md border text-[10px] font-bold tabular-nums flex items-center gap-1.5 transition-all",
                    active ? cn(bg, border, color, "ring-1 ring-ring/10") : "border-border bg-card text-muted-foreground/60 hover:bg-secondary/30"
                  )}
                >
                  <span>{count}</span>
                  <span className="font-semibold">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search + category */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search job name, customer, Q-number, bid item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[11px] bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring/30 transition-all"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 text-[11px] font-medium bg-background border border-border rounded-lg px-2 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
            <option value="">All Types</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
            <Inbox className="h-8 w-8 mb-2" />
            <p className="text-sm font-medium">No bids found</p>
            <p className="text-[11px] mt-0.5">
              {statusFilter !== "all" || categoryFilter || search ? "Try adjusting your filters" : "Create bids from the OHP tab in a quote"}
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-secondary/60 backdrop-blur-sm border-b border-border/40">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                <th className="px-3 sm:px-4 py-2 w-8"></th>
                <th className="px-2 py-2 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("job")}>
                  <span className="flex items-center gap-1">Job / Quote <ArrowUpDown className="h-2.5 w-2.5" /></span>
                </th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("item")}>
                  <span className="flex items-center gap-1">Bid Item <ArrowUpDown className="h-2.5 w-2.5" /></span>
                </th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("prices")}>
                  <span className="flex items-center gap-1">Prices <ArrowUpDown className="h-2.5 w-2.5" /></span>
                </th>
                <th className="px-2 py-2">Best</th>
                <th className="px-2 py-2 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Status <ArrowUpDown className="h-2.5 w-2.5" /></span>
                </th>
                <th className="px-2 py-2 w-14"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((bid) => {
                const received = bid.vendor_bid_prices.filter((p) => p.status === "received")
                const pending = bid.vendor_bid_prices.filter((p) => p.status === "pending")
                const bestPrice = received.length > 0 ? Math.min(...received.map((p) => p.price!)) : null
                const winnerName = bid.status === "awarded"
                  ? bid.vendor_bid_prices.find((p) => p.vendor_id === bid.winning_vendor_id)?.vendors?.company_name
                  : null
                const isJob = bid.quotes?.is_job
                const num = isJob ? bid.quotes?.job_number : bid.quotes?.quote_number
                const prefix = isJob ? "J" : "Q"

                return (
                  <tr key={bid.id} className={cn(
                    "hover:bg-secondary/20 transition-colors text-[11px]",
                    bid.status === "open" && "bg-sky-50/30 dark:bg-sky-950/5"
                  )}>
                    {/* Status dot */}
                    <td className="px-3 sm:px-4 py-2">
                      <div className={cn("h-2 w-2 rounded-full mx-auto",
                        bid.status === "open" ? "bg-sky-500"
                        : bid.status === "awarded" ? "bg-emerald-500"
                        : "bg-muted-foreground/25"
                      )} />
                    </td>
                    {/* Job/Quote */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-foreground truncate max-w-[140px]">{bid.quotes?.project_name || "No Quote"}</span>
                        {num && (
                          <span className={cn(
                            "text-[8px] font-bold px-1 py-px rounded shrink-0",
                            isJob ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" : "bg-secondary text-muted-foreground"
                          )}>{prefix}-{num}</span>
                        )}
                      </div>
                    </td>
                    {/* Customer */}
                    <td className="px-2 py-2 text-muted-foreground truncate max-w-[120px]">
                      {bid.quotes?.contact_name || "-"}
                    </td>
                    {/* Bid item */}
                    <td className="px-2 py-2">
                      <span className="font-semibold text-foreground truncate block max-w-[160px]">{bid.item_label}</span>
                      {bid.item_description && (
                        <span className="text-[9px] text-muted-foreground/50 truncate block max-w-[160px]">{bid.item_description}</span>
                      )}
                    </td>
                    {/* Category */}
                    <td className="px-2 py-2">
                      <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground inline-flex items-center gap-0.5">
                        <Tag className="h-2 w-2" />{bid.item_category}
                      </span>
                    </td>
                    {/* Prices */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        {received.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="h-3 w-3" />{received.length}
                          </span>
                        )}
                        {pending.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                            <Clock className="h-3 w-3" />{pending.length}
                          </span>
                        )}
                        {received.length === 0 && pending.length === 0 && (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </div>
                    </td>
                    {/* Best price */}
                    <td className="px-2 py-2 font-mono font-bold tabular-nums text-foreground">
                      {bid.status === "awarded" && bid.winning_price != null
                        ? formatCurrency(bid.winning_price)
                        : bestPrice != null
                        ? formatCurrency(bestPrice)
                        : <span className="text-muted-foreground/25">-</span>
                      }
                    </td>
                    {/* Status */}
                    <td className="px-2 py-2">
                      {bid.status === "awarded" ? (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-800/40">
                          <Award className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-[80px]">
                            {winnerName || "Awarded"}
                          </span>
                        </div>
                      ) : bid.status === "open" ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40">
                          Open
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                          Closed
                        </span>
                      )}
                    </td>
                    {/* Open button */}
                    <td className="px-2 py-2">
                      {onOpenQuote && bid.quote_id && (
                        <button
                          onClick={() => onOpenQuote(bid.quote_id!, "ohp")}
                          className="h-6 px-2 rounded bg-foreground text-background text-[9px] font-bold flex items-center gap-1 hover:opacity-80 transition-opacity"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Open
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

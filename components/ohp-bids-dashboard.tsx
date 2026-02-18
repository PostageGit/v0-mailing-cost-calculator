"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pricing"
import {
  Search, Send, ExternalLink, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronRight, Award, Inbox, Tag,
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

/* ── Grouped row ── */
interface GroupedJob {
  quoteId: string
  name: string
  customer: string
  isJob: boolean
  jobNumber: number | null
  quoteNumber: number | null
  bids: DashboardBid[]
  openCount: number
  awardedCount: number
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error("Fetch failed")
  return r.json()
}

const STATUS_CARDS: { key: StatusFilter; label: string; color: string; bg: string; border: string; Icon: typeof Inbox }[] = [
  { key: "open",    label: "Open Bids",  color: "text-sky-700 dark:text-sky-400",     bg: "bg-sky-50 dark:bg-sky-950/20",     border: "border-sky-200 dark:border-sky-800/40",     Icon: Inbox },
  { key: "awarded", label: "Awarded",    color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-800/40", Icon: Award },
  { key: "closed",  label: "Closed",     color: "text-muted-foreground",              bg: "bg-secondary/40",                  border: "border-border",                              Icon: XCircle },
]

export function OhpBidsDashboard({ onOpenQuote }: { onOpenQuote?: (quoteId: string, step?: string) => void }) {
  const { data: bids } = useSWR<DashboardBid[]>("/api/vendor-bids/dashboard", fetcher, { refreshInterval: 15000 })

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())

  // Counts for summary cards
  const counts = useMemo(() => {
    if (!bids) return { open: 0, awarded: 0, closed: 0, total: 0 }
    return {
      open: bids.filter((b) => b.status === "open").length,
      awarded: bids.filter((b) => b.status === "awarded").length,
      closed: bids.filter((b) => b.status === "closed").length,
      total: bids.length,
    }
  }, [bids])

  // Unique categories
  const categories = useMemo(() => {
    if (!bids) return []
    return [...new Set(bids.map((b) => b.item_category))].sort()
  }, [bids])

  // Group bids by quote
  const grouped = useMemo(() => {
    if (!bids) return []

    let filtered = [...bids]

    // Status filter
    if (statusFilter !== "all") filtered = filtered.filter((b) => b.status === statusFilter)

    // Category filter
    if (categoryFilter) filtered = filtered.filter((b) => b.item_category === categoryFilter)

    // Search
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((b) =>
        b.item_label.toLowerCase().includes(q) ||
        b.item_description?.toLowerCase().includes(q) ||
        b.quotes?.project_name.toLowerCase().includes(q) ||
        b.quotes?.contact_name?.toLowerCase().includes(q)
      )
    }

    // Group by quote_id
    const map = new Map<string, GroupedJob>()
    for (const bid of filtered) {
      const qid = bid.quote_id || "no-quote"
      if (!map.has(qid)) {
        map.set(qid, {
          quoteId: qid,
          name: bid.quotes?.project_name || "No Quote",
          customer: bid.quotes?.contact_name || "-",
          isJob: !!bid.quotes?.is_job,
          jobNumber: bid.quotes?.job_number ?? null,
          quoteNumber: bid.quotes?.quote_number ?? null,
          bids: [],
          openCount: 0,
          awardedCount: 0,
        })
      }
      const g = map.get(qid)!
      g.bids.push(bid)
      if (bid.status === "open") g.openCount++
      if (bid.status === "awarded") g.awardedCount++
    }

    // Sort: jobs with open bids first, then by open count desc
    return [...map.values()].sort((a, b) => {
      if (a.openCount > 0 && b.openCount === 0) return -1
      if (a.openCount === 0 && b.openCount > 0) return 1
      return b.openCount - a.openCount
    })
  }, [bids, search, statusFilter, categoryFilter])

  const toggleExpand = (qid: string) =>
    setExpandedJobs((prev) => {
      const next = new Set(prev)
      next.has(qid) ? next.delete(qid) : next.add(qid)
      return next
    })

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
      <div className="shrink-0 px-4 sm:px-6 pt-5 pb-4 border-b border-border/40 bg-background">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
            <Send className="h-4 w-4 text-sky-700 dark:text-sky-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">OHP Bids</h1>
            <p className="text-[11px] text-muted-foreground">{counts.total} total bids across {grouped.length} jobs</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {STATUS_CARDS.map(({ key, label, color, bg, border, Icon }) => {
            const count = counts[key as keyof typeof counts] || 0
            const active = statusFilter === key
            return (
              <button key={key}
                onClick={() => setStatusFilter(active ? "all" : key)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-all",
                  active ? cn(bg, border, "ring-1 ring-offset-1 ring-ring/20") : "border-border bg-card hover:bg-secondary/30"
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={cn("h-3 w-3", active ? color : "text-muted-foreground/50")} />
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider", active ? color : "text-muted-foreground/60")}>{label}</span>
                </div>
                <span className={cn("text-xl font-black tabular-nums", active ? color : "text-foreground")}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search job, customer, bid..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[11px] bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring/30 transition-all"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 text-[11px] font-medium bg-background border border-border rounded-lg px-2 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Job groups list */}
      <div className="flex-1 overflow-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
            <Inbox className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No bids found</p>
            <p className="text-xs mt-1">
              {statusFilter !== "all" || categoryFilter || search ? "Try adjusting your filters" : "Create bids from the OHP tab in a quote"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {grouped.map((group) => {
              const expanded = expandedJobs.has(group.quoteId)
              const pricesReceived = group.bids.reduce(
                (sum, b) => sum + b.vendor_bid_prices.filter((p) => p.status === "received").length, 0
              )
              const pricesTotal = group.bids.reduce((sum, b) => sum + b.vendor_bid_prices.length, 0)

              return (
                <div key={group.quoteId}>
                  {/* Job header row */}
                  <button
                    onClick={() => toggleExpand(group.quoteId)}
                    className="w-full px-4 sm:px-6 py-3 flex items-center gap-3 hover:bg-secondary/20 transition-colors text-left"
                  >
                    {/* Expand icon */}
                    <div className="shrink-0 text-muted-foreground/40">
                      {expanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground truncate">{group.name}</span>
                        {group.isJob && group.jobNumber && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                            J-{group.jobNumber}
                          </span>
                        )}
                        {!group.isJob && group.quoteNumber && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                            Q-{group.quoteNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{group.customer}</p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 shrink-0">
                      {group.openCount > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400">{group.openCount} open</span>
                        </div>
                      )}
                      {group.awardedCount > 0 && (
                        <div className="flex items-center gap-1">
                          <Award className="h-3 w-3 text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{group.awardedCount}</span>
                        </div>
                      )}
                      {pricesTotal > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {pricesReceived}/{pricesTotal} prices
                        </span>
                      )}
                    </div>

                    {/* Open button */}
                    {onOpenQuote && group.quoteId !== "no-quote" && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onOpenQuote(group.quoteId, "ohp") }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onOpenQuote(group.quoteId, "ohp") } }}
                        className="shrink-0 h-7 px-2.5 rounded-md bg-foreground text-background text-[10px] font-bold flex items-center gap-1 hover:opacity-80 transition-opacity"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </div>
                    )}
                  </button>

                  {/* Expanded bid rows */}
                  {expanded && (
                    <div className="bg-muted/15 border-t border-border/30">
                      {group.bids.map((bid) => {
                        const received = bid.vendor_bid_prices.filter((p) => p.status === "received")
                        const pending = bid.vendor_bid_prices.filter((p) => p.status === "pending")
                        const winnerName = bid.status === "awarded"
                          ? bid.vendor_bid_prices.find((p) => p.vendor_id === bid.winning_vendor_id)?.vendors?.company_name
                          : null

                        return (
                          <div key={bid.id} className="px-4 sm:px-6 py-2.5 flex items-center gap-3 ml-7 border-b border-border/20 last:border-b-0">
                            {/* Status dot */}
                            <div className={cn("h-2 w-2 rounded-full shrink-0",
                              bid.status === "open" ? "bg-sky-500"
                              : bid.status === "awarded" ? "bg-emerald-500"
                              : "bg-muted-foreground/30"
                            )} />

                            {/* Bid info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-foreground truncate">{bid.item_label}</span>
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                                  <Tag className="h-2 w-2 inline mr-0.5" />{bid.item_category}
                                </span>
                              </div>
                              {bid.item_description && (
                                <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{bid.item_description}</p>
                              )}
                            </div>

                            {/* Vendor prices summary */}
                            <div className="flex items-center gap-2 shrink-0">
                              {received.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  <span className="text-[10px] font-medium text-foreground">{received.length} received</span>
                                </div>
                              )}
                              {pending.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-amber-500" />
                                  <span className="text-[10px] font-medium text-muted-foreground">{pending.length} pending</span>
                                </div>
                              )}
                            </div>

                            {/* Status badge / Winner */}
                            <div className="shrink-0">
                              {bid.status === "awarded" ? (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/40">
                                  <Award className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                                    {winnerName || "Awarded"}{bid.winning_price != null ? ` - ${formatCurrency(bid.winning_price)}` : ""}
                                  </span>
                                </div>
                              ) : bid.status === "open" ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40">
                                  Open
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                                  Closed
                                </span>
                              )}
                            </div>

                            {/* Best price indicator for open bids */}
                            {bid.status === "open" && received.length > 0 && (
                              <div className="shrink-0 text-right">
                                <span className="text-[9px] text-muted-foreground/50">Best</span>
                                <p className="text-[11px] font-bold font-mono text-foreground tabular-nums">
                                  {formatCurrency(Math.min(...received.map((p) => p.price!)))}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

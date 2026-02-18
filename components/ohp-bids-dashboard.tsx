"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pricing"
import {
  Search, Send, ExternalLink, CheckCircle2, Clock,
  Award, Inbox, Tag, ArrowUpDown, ChevronRight,
  Star, Plus, X, Loader2, RotateCcw, Trophy,
} from "lucide-react"

/* ── Types ── */
interface BidPrice {
  id: string
  vendor_id: string
  price: number | null
  status: "pending" | "received" | "declined"
  notes: string | null
  vendors?: { company_name: string; pickup_cost?: number } | null
}
interface QuoteItem {
  label: string
  category: string
  amount: number
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
  items: QuoteItem[] | null
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
interface Vendor {
  id: string
  company_name: string
  is_internal: boolean
  pickup_cost: number | null
}

type StatusFilter = "all" | "open" | "awarded" | "closed"
type SortField = "job" | "item" | "status" | "prices"

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error("Fetch failed")
  return r.json()
}

/** Match a bid item back to its in-house quote line item to get the in-house price */
function getInhousePrice(bid: DashboardBid): number | null {
  const items = bid.quotes?.items
  if (!items || items.length === 0) return null
  const cat = bid.item_category?.toLowerCase()
  const label = bid.item_label?.toLowerCase() ?? ""
  // Try exact category + size match via label substring
  const match = items.find((item) => {
    const iCat = item.category?.toLowerCase()
    const iLabel = item.label?.toLowerCase() ?? ""
    // Category match: bid category matches item category (or flat/booklet/spiral/perfect/envelope)
    const catMatch = iCat === cat ||
      (cat === "ohp" && ["flat", "booklet", "spiral", "perfect", "envelope"].includes(iCat))
    if (!catMatch) return false
    // Size match: extract dimensions from both labels and compare
    const dims = label.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i)
    if (dims) {
      const w = dims[1], h = dims[2]
      return iLabel.includes(`${w}x${h}`) || iLabel.includes(`${h}x${w}`) ||
        iLabel.includes(`${w}" x ${h}"`) || iLabel.includes(`${h}" x ${w}"`)
    }
    return false
  })
  // Fallback: match by category only if single match
  if (match) return match.amount
  const catMatches = items.filter((item) => item.category?.toLowerCase() === cat)
  if (catMatches.length === 1) return catMatches[0].amount
  return null
}

export function OhpBidsDashboard({ onOpenQuote }: { onOpenQuote?: (quoteId: string, step?: string) => void }) {
  const { data: bids, mutate: mutateBids } = useSWR<DashboardBid[]>("/api/vendor-bids/dashboard", fetcher, { refreshInterval: 15000 })
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [sortField, setSortField] = useState<SortField>("status")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
        const vendorNames = (b.vendor_bid_prices || []).map((p) => p.vendors?.company_name || "").join(" ").toLowerCase()
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
    const statusOrder = { open: 0, awarded: 1, closed: 2 }
    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "job": cmp = (a.quotes?.project_name || "").localeCompare(b.quotes?.project_name || ""); break
        case "item": cmp = a.item_label.localeCompare(b.item_label); break
        case "status": cmp = statusOrder[a.status] - statusOrder[b.status]; break
        case "prices": {
          const aR = a.vendor_bid_prices.filter((p) => p.status === "received").length
          const bR = b.vendor_bid_prices.filter((p) => p.status === "received").length
          cmp = aR - bR; break
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
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
            <Send className="h-3.5 w-3.5 text-sky-700 dark:text-sky-400" />
          </div>
          <h1 className="text-base font-bold text-foreground">OHP Bids</h1>
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
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input type="text" placeholder="Search job, customer, vendor, Q-number..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[11px] bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring/30 transition-all" />
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
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-secondary/60 backdrop-blur-sm border-b border-border/40">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                <th className="pl-4 pr-1 py-2 w-6"></th>
                <th className="px-2 py-2 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("job")}>
                  <span className="flex items-center gap-1">Job <ArrowUpDown className="h-2.5 w-2.5" /></span>
                </th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("item")}>
                  <span className="flex items-center gap-1">Bid Item <ArrowUpDown className="h-2.5 w-2.5" /></span>
                </th>
                <th className="px-2 py-2">Vendors</th>
                <th className="px-2 py-2">Best OHP</th>
                <th className="px-2 py-2">In-House</th>
                <th className="px-2 py-2 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Status <ArrowUpDown className="h-2.5 w-2.5" /></span>
                </th>
                <th className="px-2 py-2 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((bid) => {
                const received = bid.vendor_bid_prices.filter((p) => p.status === "received")
                const pending = bid.vendor_bid_prices.filter((p) => p.status === "pending")
                const bestPrice = received.length > 0 ? Math.min(...received.map((p) => p.price!)) : null
                const inhousePrice = getInhousePrice(bid)
                const winnerName = bid.status === "awarded"
                  ? bid.vendor_bid_prices.find((p) => p.vendor_id === bid.winning_vendor_id)?.vendors?.company_name
                  : null
                const isJob = bid.quotes?.is_job
                const num = isJob ? bid.quotes?.job_number : bid.quotes?.quote_number
                const prefix = isJob ? "J" : "Q"
                const isExpanded = expandedId === bid.id

                return (
                  <BidRowWithPanel
                    key={bid.id}
                    bid={bid}
                    received={received}
                    pending={pending}
                    bestPrice={bestPrice}
                    inhousePrice={inhousePrice}
                    winnerName={winnerName}
                    isJob={!!isJob}
                    num={num ?? null}
                    prefix={prefix}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : bid.id)}
                    onOpenQuote={onOpenQuote}
                    vendors={vendors || []}
                    mutateBids={mutateBids}
                  />
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   BidRowWithPanel -- table row + expandable panel
   ═══════════════════════════════════════════════ */
function BidRowWithPanel({ bid, received, pending, bestPrice, inhousePrice, winnerName, isJob, num, prefix, isExpanded, onToggle, onOpenQuote, vendors, mutateBids }: {
  bid: DashboardBid
  received: BidPrice[]
  pending: BidPrice[]
  bestPrice: number | null
  inhousePrice: number | null
  winnerName: string | null | undefined
  isJob: boolean
  num: number | null
  prefix: string
  isExpanded: boolean
  onToggle: () => void
  onOpenQuote?: (quoteId: string, step?: string) => void
  vendors: Vendor[]
  mutateBids: () => void
}) {
  return (
    <>
      {/* Summary row */}
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-colors text-[11px] border-b border-border/30",
          isExpanded ? "bg-sky-50/50 dark:bg-sky-950/10" : "hover:bg-secondary/20",
          bid.status === "open" && !isExpanded && "bg-sky-50/20 dark:bg-sky-950/5"
        )}
      >
        {/* Expand chevron */}
        <td className="pl-4 pr-1 py-2.5">
          <ChevronRight className={cn("h-3 w-3 text-muted-foreground/40 transition-transform", isExpanded && "rotate-90")} />
        </td>
        {/* Job */}
        <td className="px-2 py-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-foreground truncate max-w-[140px]">{bid.quotes?.project_name || "No Quote"}</span>
            {num && (
              <span className={cn("text-[8px] font-bold px-1 py-px rounded shrink-0",
                isJob ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" : "bg-secondary text-muted-foreground"
              )}>{prefix}-{num}</span>
            )}
          </div>
        </td>
        {/* Customer */}
        <td className="px-2 py-2.5 text-muted-foreground truncate max-w-[120px]">{bid.quotes?.contact_name || "-"}</td>
        {/* Bid item */}
        <td className="px-2 py-2.5">
          <span className="font-semibold text-foreground truncate block max-w-[180px]">{bid.item_label}</span>
        </td>
        {/* Vendors */}
        <td className="px-2 py-2.5">
          <div className="flex items-center gap-1">
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
            {received.length === 0 && pending.length === 0 && <span className="text-muted-foreground/30">-</span>}
          </div>
        </td>
        {/* Best OHP price */}
        <td className="px-2 py-2.5 font-mono font-bold tabular-nums">
          {bid.status === "awarded" && bid.winning_price != null ? (
            <span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(bid.winning_price)}</span>
          ) : bestPrice != null ? (
            <span className={cn(inhousePrice != null && bestPrice < inhousePrice ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>{formatCurrency(bestPrice)}</span>
          ) : (
            <span className="text-muted-foreground/25">-</span>
          )}
        </td>
        {/* In-House price */}
        <td className="px-2 py-2.5 font-mono font-bold tabular-nums">
          {inhousePrice != null ? (
            <span className={cn(bestPrice != null && inhousePrice <= bestPrice ? "text-emerald-700 dark:text-emerald-400" : "text-foreground/70")}>{formatCurrency(inhousePrice)}</span>
          ) : (
            <span className="text-muted-foreground/25">-</span>
          )}
        </td>
        {/* Status */}
        <td className="px-2 py-2.5">
          {bid.status === "awarded" ? (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-800/40">
              <Trophy className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-[70px]">{winnerName || "Awarded"}</span>
            </div>
          ) : bid.status === "open" ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40">Open</span>
          ) : (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">Closed</span>
          )}
        </td>
        {/* Open in quote */}
        <td className="px-2 py-2.5">
          {onOpenQuote && bid.quote_id && (
            <button onClick={(e) => { e.stopPropagation(); onOpenQuote(bid.quote_id!, "ohp") }}
              className="h-6 px-2 rounded bg-foreground text-background text-[9px] font-bold flex items-center gap-1 hover:opacity-80 transition-opacity">
              <ExternalLink className="h-2.5 w-2.5" />
            </button>
          )}
        </td>
      </tr>

      {/* Expanded price panel */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <BidPricePanel bid={bid} vendors={vendors} mutateBids={mutateBids} inhousePrice={inhousePrice} />
          </td>
        </tr>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════
   BidPricePanel -- inline expandable price comparison
   ═══════════════════════════════════════════════ */
function BidPricePanel({ bid, vendors, mutateBids, inhousePrice }: {
  bid: DashboardBid
  vendors: Vendor[]
  mutateBids: () => void
  inhousePrice: number | null
}) {
  const { data: prices, mutate: mutatePrices, isLoading } = useSWR<BidPrice[]>(
    `/api/vendor-bids/${bid.id}/prices`, fetcher
  )
  const [addingVendor, setAddingVendor] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [reopening, setReopening] = useState(false)

  const externalVendors = vendors.filter((v) => !v.is_internal)
  const addedVendorIds = new Set(prices?.map((p) => p.vendor_id) ?? [])
  const availableVendors = externalVendors.filter((v) => !addedVendorIds.has(v.id))

  const receivedPrices = prices?.filter((p) => p.price != null) ?? []
  const bestPrice = receivedPrices.length > 0 ? Math.min(...receivedPrices.map((p) => Number(p.price))) : null

  const addVendor = async (vendorId: string) => {
    setAddingVendor(true)
    await fetch(`/api/vendor-bids/${bid.id}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id: vendorId }),
    })
    mutatePrices(); mutateBids()
    setAddingVendor(false)
  }

  const updatePrice = async (priceId: string, price: number | null, notes?: string) => {
    mutatePrices(
      (prev) => prev?.map((p) => p.id === priceId ? { ...p, price: price as number, notes: notes ?? p.notes, status: price != null ? "received" as const : "pending" as const } : p),
      { revalidate: false }
    )
    await fetch(`/api/bid-prices/${priceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price, notes: notes || null, status: price != null ? "received" : "pending", responded_at: price != null ? new Date().toISOString() : null }),
    })
    mutatePrices(); mutateBids()
  }

  const removePrice = async (priceId: string) => {
    await fetch(`/api/bid-prices/${priceId}`, { method: "DELETE" })
    mutatePrices(); mutateBids()
  }

  const awardBid = async (vendorId: string, price: number) => {
    setAwarding(true)
    await fetch(`/api/vendor-bids/${bid.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "awarded", winning_vendor_id: vendorId, winning_price: price }),
    })
    mutatePrices(); mutateBids()
    setAwarding(false)
  }

  const reopenBid = async () => {
    setReopening(true)
    await fetch(`/api/vendor-bids/${bid.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open", winning_vendor_id: null, winning_price: null }),
    })
    mutatePrices(); mutateBids()
    setReopening(false)
  }

  if (isLoading) {
    return (
      <div className="px-6 py-4 bg-muted/10 border-b border-border/40">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
      </div>
    )
  }

  return (
    <div className="bg-muted/10 border-b-2 border-sky-200/60 dark:border-sky-800/30">
      {/* Bid description */}
      {bid.item_description && (
        <div className="px-6 pt-3 pb-0">
          <p className="text-[10px] text-muted-foreground">{bid.item_description}</p>
        </div>
      )}

      {/* In-House vs OHP comparison bar */}
      {inhousePrice != null && (
        <div className="mx-4 mt-3 rounded-lg border overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className={cn("px-4 py-2.5 text-center", inhousePrice <= (bestPrice ?? Infinity) ? "bg-emerald-50 dark:bg-emerald-950/15" : "bg-card")}>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">In-House</p>
              <p className={cn("text-xl font-black font-mono tabular-nums mt-0.5", inhousePrice <= (bestPrice ?? Infinity) ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{formatCurrency(inhousePrice)}</p>
              {inhousePrice <= (bestPrice ?? Infinity) && <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">CHEAPER</p>}
            </div>
            <div className={cn("px-4 py-2.5 text-center", bestPrice != null && bestPrice < inhousePrice ? "bg-emerald-50 dark:bg-emerald-950/15" : "bg-card")}>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Best OHP</p>
              <p className={cn("text-xl font-black font-mono tabular-nums mt-0.5", bestPrice != null && bestPrice < inhousePrice ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{bestPrice != null ? formatCurrency(bestPrice) : "---"}</p>
              {bestPrice != null && bestPrice < inhousePrice && <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">CHEAPER</p>}
              {bestPrice != null && inhousePrice != null && bestPrice !== inhousePrice && (
                <p className="text-[8px] text-muted-foreground mt-0.5">
                  {bestPrice < inhousePrice ? `Save ${formatCurrency(inhousePrice - bestPrice)}` : `${formatCurrency(bestPrice - inhousePrice)} more`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Price comparison table */}
      {prices && prices.length > 0 ? (
        <div className="px-4 pt-3 pb-1">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-2 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
            <span className="w-[140px] shrink-0">Vendor</span>
            <span className="w-[80px] shrink-0">Ref #</span>
            <span className="w-[90px] shrink-0 text-right">Price</span>
            <span className="w-[90px] shrink-0 text-right">+ Pickup</span>
            <span className="ml-auto"></span>
          </div>
          {/* Vendor price rows */}
          <div className="divide-y divide-border/30 rounded-lg border border-border/40 bg-card overflow-hidden">
            {prices.map((p) => {
              const vendor = vendors.find((v) => v.id === p.vendor_id)
              const pickupCost = vendor?.pickup_cost ?? 0
              const price = p.price != null ? Number(p.price) : null
              const isBest = price != null && price === bestPrice
              const isWinner = bid.winning_vendor_id === p.vendor_id && bid.status === "awarded"
              const totalWithPickup = price != null ? price + pickupCost : null

              return (
                <PriceRow
                  key={p.id}
                  entry={p}
                  vendorName={vendor?.company_name ?? "Unknown"}
                  pickupCost={pickupCost}
                  isBest={isBest}
                  isWinner={isWinner}
                  bidStatus={bid.status}
                  totalWithPickup={totalWithPickup}
                  onUpdate={(pr, notes) => updatePrice(p.id, pr, notes)}
                  onRemove={() => removePrice(p.id)}
                  onAward={() => price != null && vendor && awardBid(vendor.id, price)}
                  awarding={awarding}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div className="px-6 py-4 text-center text-[11px] text-muted-foreground/40">
          No vendors added yet. Add a vendor below to start collecting prices.
        </div>
      )}

      {/* Footer: Add vendor + Reopen */}
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
        {/* Add vendor */}
        {availableVendors.length > 0 && (
          <div className="flex items-center gap-1.5">
            <select
              onChange={(e) => { if (e.target.value) addVendor(e.target.value); e.target.value = "" }}
              disabled={addingVendor}
              className="h-7 text-[10px] font-medium bg-background border border-border rounded-md px-2 pr-6 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
            >
              <option value="">+ Add Vendor</option>
              {availableVendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </select>
            {addingVendor && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        )}

        <div className="flex-1" />

        {/* Reopen */}
        {bid.status === "awarded" && (
          <button onClick={reopenBid} disabled={reopening}
            className="h-7 px-3 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-1 disabled:opacity-50">
            <RotateCcw className="h-3 w-3" />
            Reopen Bid
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   PriceRow -- single editable vendor price
   ═══════════════════════════════════════════════ */
function PriceRow({ entry, vendorName, pickupCost, isBest, isWinner, bidStatus, totalWithPickup, onUpdate, onRemove, onAward, awarding }: {
  entry: BidPrice
  vendorName: string
  pickupCost: number
  isBest: boolean
  isWinner: boolean
  bidStatus: string
  totalWithPickup: number | null
  onUpdate: (price: number | null, notes?: string) => void
  onRemove: () => void
  onAward: () => void
  awarding: boolean
}) {
  const [editPrice, setEditPrice] = useState(entry.price != null ? String(entry.price) : "")
  const [refNum, setRefNum] = useState(entry.notes ?? "")
  const priceRef = useRef(editPrice)
  const refRef = useRef(refNum)
  priceRef.current = editPrice
  refRef.current = refNum

  const handleSave = useCallback(async () => {
    const num = parseFloat(priceRef.current)
    if (!isNaN(num) && num >= 0) {
      await onUpdate(num, refRef.current)
    }
  }, [onUpdate])

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-2 transition-colors",
      isWinner ? "bg-emerald-50/80 dark:bg-emerald-950/15" : isBest ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""
    )}>
      {/* Vendor name */}
      <div className="w-[140px] shrink-0 min-w-0">
        <div className="flex items-center gap-1">
          {isWinner ? (
            <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400 shrink-0" />
          ) : isBest ? (
            <Star className="h-3 w-3 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400 shrink-0" />
          ) : null}
          <span className={cn("text-[11px] font-bold truncate", isWinner ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
            {vendorName}
          </span>
        </div>
        {pickupCost > 0 && <p className="text-[9px] text-muted-foreground/50 ml-4">+{formatCurrency(pickupCost)} pickup</p>}
      </div>

      {/* Ref # */}
      <div className="w-[80px] shrink-0">
        <input
          type="text"
          value={refNum}
          onChange={(e) => setRefNum(e.target.value)}
          onBlur={handleSave}
          placeholder="Ref #"
          className="h-7 w-full text-[10px] rounded border border-border bg-background px-1.5 font-mono placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-ring/30"
        />
      </div>

      {/* Price input */}
      <div className="w-[90px] shrink-0">
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">$</span>
          <input
            type="number"
            step="0.01"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="0.00"
            className={cn(
              "h-7 w-full text-[11px] text-right rounded border bg-background pl-4 pr-1.5 font-mono font-bold tabular-nums outline-none focus:ring-1 focus:ring-ring/30",
              isWinner ? "border-emerald-300 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-950/20" : isBest ? "border-emerald-200 dark:border-emerald-800/40" : "border-border"
            )}
          />
        </div>
      </div>

      {/* Total w/ pickup */}
      <div className="w-[90px] shrink-0 text-right">
        <span className={cn("text-[11px] font-bold font-mono tabular-nums", isWinner || isBest ? "text-emerald-700 dark:text-emerald-400" : "text-foreground/70")}>
          {totalWithPickup != null ? formatCurrency(totalWithPickup) : "-"}
        </span>
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-1">
        {/* Best badge */}
        {isBest && !isWinner && bidStatus === "open" && (
          <span className="text-[8px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Best</span>
        )}
        {/* Winner badge */}
        {isWinner && (
          <span className="text-[8px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Winner</span>
        )}
        {/* Award button -- only on best price row when bid is open */}
        {isBest && !isWinner && bidStatus === "open" && entry.price != null && (
          <button onClick={onAward} disabled={awarding}
            className="h-6 px-2 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/40 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-colors flex items-center gap-1 disabled:opacity-50">
            <Award className="h-3 w-3" />
            Award
          </button>
        )}
        {/* Remove */}
        {!isWinner && (
          <button onClick={onRemove}
            className="p-1 rounded text-muted-foreground/25 hover:text-destructive hover:bg-destructive/5 transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pricing"
import {
  Search, Send, ExternalLink, CheckCircle2, Clock,
  Award, Inbox, ArrowUpDown, ChevronRight,
  Star, X, Loader2, RotateCcw, Trophy,
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
interface QuoteItem { label: string; category: string; amount: number }
interface QuoteRef {
  id: string; project_name: string; contact_name: string | null
  customer_id: string | null; quote_number: number | null; job_number: number | null
  is_job: boolean | null; archived: boolean | null; mailing_date: string | null
  items: QuoteItem[] | null
}
interface DashboardBid {
  id: string; quote_id: string | null; item_label: string
  item_description: string | null; item_category: string
  status: "open" | "closed" | "awarded"
  winning_vendor_id: string | null; winning_price: number | null
  created_at: string; vendor_bid_prices: BidPrice[]; quotes: QuoteRef | null
}
interface Vendor { id: string; company_name: string; is_internal: boolean; pickup_cost: number | null }

type StatusFilter = "all" | "open" | "awarded" | "closed"
type SortField = "job" | "item" | "status" | "prices"

const CATEGORY_LABELS: Record<string, string> = {
  flat: "Flat / Card",
  booklet: "Booklet",
  spiral: "Spiral Bound",
  perfect: "Perfect Bound",
  envelope: "Envelope",
  ohp: "OHP",
}
function categoryLabel(cat: string) { return CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1) }

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error("Fetch failed")
  return r.json()
}

/* ── In-house price matching ── */
function getInhousePrice(bid: DashboardBid): number | null {
  const items = bid.quotes?.items
  if (!items || items.length === 0) return null
  const bidCat = bid.item_category?.toLowerCase() ?? ""
  const bidLabel = bid.item_label ?? ""
  const extractDims = (s: string): string[] => {
    const results: string[] = []
    const re = /(\d+\.?\d*)"?\s*x\s*(\d+\.?\d*)"?/gi
    let m
    while ((m = re.exec(s)) !== null) {
      const a = parseFloat(m[1]), b = parseFloat(m[2])
      if (a >= 100) continue
      results.push(`${a}x${b}`)
      results.push(`${b}x${a}`)
    }
    return results
  }
  const bidDims = extractDims(bidLabel)
  const printCats = ["flat", "booklet", "spiral", "perfect", "envelope"]
  const matchCat = printCats.includes(bidCat) ? bidCat : null
  if (matchCat && bidDims.length > 0) {
    const match = items.find((i) => i.category?.toLowerCase() === matchCat && bidDims.some((d) => extractDims(i.label).includes(d)))
    if (match) return match.amount
  }
  if (matchCat) {
    const m = items.filter((i) => i.category?.toLowerCase() === matchCat)
    if (m.length === 1) return m[0].amount
  }
  if (bidDims.length > 0) {
    const match = items.find((i) => printCats.includes(i.category?.toLowerCase() ?? "") && bidDims.some((d) => extractDims(i.label).includes(d)))
    if (match) return match.amount
  }
  return null
}

/* ══════════════════════════════════════════════════
   Main Dashboard
   ══════════════════════════════════════════════════ */
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
    if (!bids) return { open: 0, awarded: 0, closed: 0 }
    return {
      open: bids.filter((b) => b.status === "open").length,
      awarded: bids.filter((b) => b.status === "awarded").length,
      closed: bids.filter((b) => b.status === "closed").length,
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
      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
            <Send className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">OHP Bids</h1>

          {/* Status pills */}
          <div className="flex items-center gap-2 ml-auto">
            {([
              { key: "open" as StatusFilter, label: "Open", count: counts.open, active: "bg-sky-500 text-white", idle: "text-sky-600" },
              { key: "awarded" as StatusFilter, label: "Awarded", count: counts.awarded, active: "bg-emerald-500 text-white", idle: "text-emerald-600" },
              { key: "closed" as StatusFilter, label: "Closed", count: counts.closed, active: "bg-secondary text-foreground", idle: "text-muted-foreground" },
            ]).map(({ key, label, count, active, idle }) => {
              const on = statusFilter === key
              return (
                <button key={key} onClick={() => setStatusFilter(on ? "all" : key)}
                  className={cn(
                    "h-8 px-3 rounded-full text-xs font-semibold tabular-nums flex items-center gap-2 transition-all",
                    on ? active : "bg-secondary/50 hover:bg-secondary/80 " + idle,
                  )}
                >
                  <span className="font-bold">{count}</span>
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search + type filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <input type="text" placeholder="Search job, customer, vendor, Q-number..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-secondary/30 border border-border/50 rounded-lg outline-none focus:ring-2 focus:ring-ring/30 focus:bg-background transition-all placeholder:text-muted-foreground/40" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 text-sm font-medium bg-secondary/30 border border-border/50 rounded-lg px-3 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
            <option value="">All Types</option>
            {categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
            <Inbox className="h-10 w-10 mb-3" />
            <p className="text-base font-medium">No bids found</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-secondary/70 backdrop-blur-sm border-b border-border/50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                <th className="pl-6 pr-1 py-3 w-7"></th>
                <th className="px-3 py-3 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("job")}>
                  <span className="flex items-center gap-1">Job <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                </th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("item")}>
                  <span className="flex items-center gap-1">Bid Item <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                </th>
                <th className="px-3 py-3 w-28">Vendors</th>
                <th className="px-3 py-3 w-28 text-right">Best + Delivery</th>
                <th className="px-3 py-3 w-24 text-right">In-House</th>
                <th className="px-3 py-3 w-28 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                </th>
                <th className="px-3 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((bid) => {
                const received = bid.vendor_bid_prices.filter((p) => p.status === "received")
                const pending = bid.vendor_bid_prices.filter((p) => p.status === "pending")
                // Best OHP = price + vendor pickup cost (total delivered cost)
                const bestPrice = received.length > 0
                  ? Math.min(...received.map((p) => Number(p.price!) + Number(p.vendors?.pickup_cost ?? 0)))
                  : null
                const inhousePrice = getInhousePrice(bid)
                const winnerName = bid.status === "awarded"
                  ? bid.vendor_bid_prices.find((p) => p.vendor_id === bid.winning_vendor_id)?.vendors?.company_name
                  : null
                const isJob = bid.quotes?.is_job
                const num = isJob ? bid.quotes?.job_number : bid.quotes?.quote_number
                const prefix = isJob ? "J" : "Q"
                const isExpanded = expandedId === bid.id

                return (
                  <BidRowWithPanel key={bid.id} bid={bid} received={received} pending={pending}
                    bestPrice={bestPrice} inhousePrice={inhousePrice} winnerName={winnerName}
                    isJob={!!isJob} num={num ?? null} prefix={prefix} isExpanded={isExpanded}
                    dimmed={expandedId != null && !isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : bid.id)}
                    onOpenQuote={onOpenQuote} vendors={vendors || []} mutateBids={mutateBids}
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

/* ══════════════════════════════════════════════════
   BidRowWithPanel
   ══════════════════════════════════════════════════ */
function BidRowWithPanel({ bid, received, pending, bestPrice, inhousePrice, winnerName, isJob, num, prefix, isExpanded, dimmed, onToggle, onOpenQuote, vendors, mutateBids }: {
  bid: DashboardBid; received: BidPrice[]; pending: BidPrice[]; bestPrice: number | null
  inhousePrice: number | null; winnerName: string | null | undefined; isJob: boolean
  num: number | null; prefix: string; isExpanded: boolean; dimmed: boolean; onToggle: () => void
  onOpenQuote?: (quoteId: string, step?: string) => void; vendors: Vendor[]; mutateBids: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-all text-[13px]",
          isExpanded
            ? "bg-sky-50 dark:bg-sky-950/20 border-l-[3px] border-l-sky-500 border-b-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] relative z-10"
            : "border-l-[3px] border-l-transparent border-b border-border/30 hover:bg-secondary/30",
          dimmed && "opacity-40",
        )}
      >
        {/* Chevron */}
        <td className="pl-5 pr-1 py-3">
          <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isExpanded ? "rotate-90 text-sky-500" : "text-muted-foreground/30")} />
        </td>

        {/* Job */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-foreground truncate max-w-[160px]">{bid.quotes?.project_name || "No Quote"}</span>
            {num && (
              <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0",
                isJob ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" : "bg-secondary text-muted-foreground"
              )}>{prefix}-{num}</span>
            )}
          </div>
        </td>

        {/* Customer */}
        <td className="px-3 py-3 text-muted-foreground truncate max-w-[140px]">{bid.quotes?.contact_name || "-"}</td>

        {/* Bid item */}
        <td className="px-3 py-3">
          <span className="font-medium text-foreground truncate block max-w-[200px]">{bid.item_label}</span>
        </td>

        {/* Vendors */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {received.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />{received.length}
              </span>
            )}
            {pending.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400 font-medium">
                <Clock className="h-3.5 w-3.5" />{pending.length}
              </span>
            )}
            {received.length === 0 && pending.length === 0 && <span className="text-muted-foreground/30 text-xs">--</span>}
          </div>
        </td>

        {/* Best + Delivery */}
        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">
          {bid.status === "awarded" && bid.winning_price != null ? (() => {
            const winnerPickup = Number(bid.vendor_bid_prices.find((p) => p.vendor_id === bid.winning_vendor_id)?.vendors?.pickup_cost ?? 0)
            return <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(bid.winning_price + winnerPickup)}</span>
          })() : bestPrice != null ? (
            <span className={cn(inhousePrice != null && bestPrice < inhousePrice ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{formatCurrency(bestPrice)}</span>
          ) : (
            <span className="text-muted-foreground/25">--</span>
          )}
        </td>

        {/* In-House */}
        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">
          {inhousePrice != null ? (
            <span className={cn(bestPrice != null && inhousePrice <= bestPrice ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/60")}>{formatCurrency(inhousePrice)}</span>
          ) : (
            <span className="text-muted-foreground/25">--</span>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-3">
          {bid.status === "awarded" ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate max-w-[80px]">{winnerName || "Awarded"}</span>
            </div>
          ) : bid.status === "open" ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">Open</span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">Closed</span>
          )}
        </td>

        {/* Open button */}
        <td className="px-3 py-3">
          {onOpenQuote && bid.quote_id && (
            <button onClick={(e) => { e.stopPropagation(); onOpenQuote(bid.quote_id!, "ohp") }}
              className="h-7 w-7 rounded-lg bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors">
              <ExternalLink className="h-3.5 w-3.5 text-foreground/50" />
            </button>
          )}
        </td>
      </tr>

      {/* Expanded panel */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="p-0 border-l-[3px] border-l-sky-500">
            <BidPricePanel bid={bid} vendors={vendors} mutateBids={mutateBids} inhousePrice={inhousePrice} />
          </td>
        </tr>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════
   BidPricePanel -- expanded inline price comparison
   ══════════════════════════════════════════════════ */
function BidPricePanel({ bid, vendors, mutateBids, inhousePrice }: {
  bid: DashboardBid; vendors: Vendor[]; mutateBids: () => void; inhousePrice: number | null
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
  // Best price = vendor price + that vendor's pickup/delivery cost
  const bestPrice = receivedPrices.length > 0
    ? Math.min(...receivedPrices.map((p) => {
        const v = vendors.find((v) => v.id === p.vendor_id)
        return Number(p.price) + Number(v?.pickup_cost ?? 0)
      }))
    : null

  const addVendor = async (vendorId: string) => {
    setAddingVendor(true)
    await fetch(`/api/vendor-bids/${bid.id}/prices`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id: vendorId }),
    })
    mutatePrices(); mutateBids(); setAddingVendor(false)
  }

  const updatePrice = async (priceId: string, price: number | null, notes?: string) => {
    mutatePrices(
      (prev) => prev?.map((p) => p.id === priceId ? { ...p, price: price as number, notes: notes ?? p.notes, status: price != null ? "received" as const : "pending" as const } : p),
      { revalidate: false }
    )
    await fetch(`/api/bid-prices/${priceId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
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
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "awarded", winning_vendor_id: vendorId, winning_price: price }),
    })
    mutatePrices(); mutateBids(); setAwarding(false)
  }

  const reopenBid = async () => {
    setReopening(true)
    await fetch(`/api/vendor-bids/${bid.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open", winning_vendor_id: null, winning_price: null }),
    })
    mutatePrices(); mutateBids(); setReopening(false)
  }

  if (isLoading) {
    return (
      <div className="px-8 py-5 bg-sky-50/80 dark:bg-sky-950/15 border-b-2 border-sky-300/50 dark:border-sky-700/30">
        <Loader2 className="h-5 w-5 animate-spin text-sky-500 mx-auto" />
      </div>
    )
  }

  const savings = bestPrice != null && inhousePrice != null ? inhousePrice - bestPrice : null

  return (
    <div className="bg-sky-50/60 dark:bg-sky-950/15 border-b-2 border-sky-300/50 dark:border-sky-700/30">
      <div className="px-8 pt-5 pb-4">

        {/* ── In-House vs OHP comparison ── */}
        {inhousePrice != null && (
          <div className="flex items-center gap-4 mb-4 px-4 py-3 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">In-House</span>
              <span className={cn("text-lg font-bold font-mono tabular-nums", !bestPrice || inhousePrice <= bestPrice ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                {formatCurrency(inhousePrice)}
              </span>
            </div>
            <div className="w-px h-6 bg-border/60" />
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Best + Delivery</span>
              <span className={cn("text-lg font-bold font-mono tabular-nums", bestPrice != null && bestPrice < inhousePrice ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                {bestPrice != null ? formatCurrency(bestPrice) : "---"}
              </span>
            </div>
            {savings != null && savings !== 0 && (
              <>
                <div className="w-px h-6 bg-border/60" />
                <span className={cn("text-xs font-bold px-3 py-1 rounded-full",
                  savings > 0 ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30" : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20"
                )}>
                  {savings > 0 ? `OHP saves ${formatCurrency(savings)}` : `In-house saves ${formatCurrency(-savings)}`}
                </span>
              </>
            )}
            {bid.item_description && (
              <>
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground/60 truncate max-w-[220px]">{bid.item_description}</span>
              </>
            )}
          </div>
        )}

        {/* ── Vendor price table ── */}
        {prices && prices.length > 0 ? (
          <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/50 border-b border-border/40 bg-secondary/30">
                  <th className="pl-4 pr-2 py-2.5 w-6"></th>
                  <th className="px-3 py-2.5">Vendor</th>
                  <th className="px-3 py-2.5 w-24">Ref #</th>
                  <th className="px-3 py-2.5 w-28 text-right">Price</th>
                  <th className="px-3 py-2.5 w-20 text-right">Pickup</th>
                  <th className="px-3 py-2.5 w-28 text-right">Total</th>
                  <th className="px-3 py-2.5 w-28 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {prices.map((p) => {
                  const vendor = vendors.find((v) => v.id === p.vendor_id)
                  const pickupCost = vendor?.pickup_cost ?? 0
                  const price = p.price != null ? Number(p.price) : null
                  const totalWithPickup = price != null ? price + pickupCost : null
                  const isBest = totalWithPickup != null && totalWithPickup === bestPrice
                  const isWinner = bid.winning_vendor_id === p.vendor_id && bid.status === "awarded"

                  return (
                    <PriceRow key={p.id} entry={p}
                      vendorName={vendor?.company_name ?? "Unknown"} pickupCost={pickupCost}
                      isBest={isBest} isWinner={isWinner} bidStatus={bid.status}
                      totalWithPickup={totalWithPickup}
                      onUpdate={(pr, notes) => updatePrice(p.id, pr, notes)}
                      onRemove={() => removePrice(p.id)}
                      onAward={() => price != null && vendor && awardBid(vendor.id, price)}
                      awarding={awarding}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 py-5 text-center text-sm text-muted-foreground/40">
            No vendors added yet. Add a vendor below to start collecting prices.
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-8 pb-4 flex items-center gap-3">
        {availableVendors.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => { if (e.target.value) addVendor(e.target.value); e.target.value = "" }}
              disabled={addingVendor}
              className="h-8 text-sm font-medium bg-background border border-border/50 rounded-lg px-3 pr-7 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
            >
              <option value="">+ Add Vendor</option>
              {availableVendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </select>
            {addingVendor && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}
        <div className="flex-1" />
        {bid.status === "awarded" && (
          <button onClick={reopenBid} disabled={reopening}
            className="h-8 px-4 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen Bid
          </button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   PriceRow
   ══════════════════════════════════════════════════ */
function PriceRow({ entry, vendorName, pickupCost, isBest, isWinner, bidStatus, totalWithPickup, onUpdate, onRemove, onAward, awarding }: {
  entry: BidPrice; vendorName: string; pickupCost: number; isBest: boolean; isWinner: boolean
  bidStatus: string; totalWithPickup: number | null
  onUpdate: (price: number | null, notes?: string) => void
  onRemove: () => void; onAward: () => void; awarding: boolean
}) {
  const [editPrice, setEditPrice] = useState(entry.price != null ? String(entry.price) : "")
  const [refNum, setRefNum] = useState(entry.notes ?? "")
  const priceRef = useRef(editPrice)
  const refRef = useRef(refNum)
  priceRef.current = editPrice
  refRef.current = refNum

  const handleSave = useCallback(async () => {
    const num = parseFloat(priceRef.current)
    if (!isNaN(num) && num >= 0) await onUpdate(num, refRef.current)
  }, [onUpdate])

  return (
    <tr className={cn(
      "text-sm transition-colors",
      isWinner ? "bg-emerald-50/80 dark:bg-emerald-950/15" : isBest ? "bg-emerald-50/40 dark:bg-emerald-950/10" : "",
    )}>
      {/* Icon */}
      <td className="pl-4 pr-2 py-2.5">
        {isWinner ? (
          <Trophy className="h-4 w-4 text-emerald-500 fill-emerald-500" />
        ) : isBest ? (
          <Star className="h-4 w-4 text-emerald-500 fill-emerald-500" />
        ) : <span className="block w-4" />}
      </td>

      {/* Vendor */}
      <td className="px-3 py-2.5">
        <span className={cn("font-semibold", isWinner ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>{vendorName}</span>
      </td>

      {/* Ref */}
      <td className="px-3 py-2.5">
        <input type="text" value={refNum} onChange={(e) => setRefNum(e.target.value)} onBlur={handleSave}
          placeholder="--"
          className="h-8 w-full text-sm rounded-lg border border-border/50 bg-background px-2.5 font-mono placeholder:text-muted-foreground/25 outline-none focus:ring-2 focus:ring-ring/30 transition-all" />
      </td>

      {/* Price */}
      <td className="px-3 py-2.5">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/40">$</span>
          <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
            onBlur={handleSave} onKeyDown={(e) => e.key === "Enter" && handleSave()} placeholder="0.00"
            className={cn(
              "h-8 w-full text-sm text-right rounded-lg border bg-background pl-6 pr-2.5 font-mono font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring/30 transition-all",
              isWinner ? "border-emerald-300 dark:border-emerald-700/50" : isBest ? "border-emerald-200 dark:border-emerald-800/40" : "border-border/50"
            )} />
        </div>
      </td>

      {/* Pickup */}
      <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground/50 tabular-nums">
        {pickupCost > 0 ? formatCurrency(pickupCost) : "--"}
      </td>

      {/* Total */}
      <td className="px-3 py-2.5 text-right">
        <span className={cn("font-bold font-mono tabular-nums", isWinner || isBest ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/60")}>
          {totalWithPickup != null ? formatCurrency(totalWithPickup) : "--"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {isBest && !isWinner && bidStatus === "open" && entry.price != null && (
            <button onClick={onAward} disabled={awarding}
              className="h-7 px-3 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm">
              <Award className="h-3.5 w-3.5" />Award
            </button>
          )}
          {isWinner && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Winner</span>}
          {!isWinner && (
            <button onClick={onRemove} className="p-1.5 rounded-lg text-muted-foreground/25 hover:text-destructive hover:bg-destructive/5 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

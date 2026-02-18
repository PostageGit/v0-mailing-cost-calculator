"use client"

import { useState, useMemo } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pricing"
import type { Vendor } from "@/lib/vendor-types"
import {
  Package, Search, Truck, Clock, CheckCircle2, AlertTriangle,
  ChevronDown, MapPin, Info, X, Calendar, Filter,
} from "lucide-react"

/* ── Types ── */
interface QuoteItem { id: number; category: string; label: string; description: string; amount: number }
interface PieceMeta { vendor?: string; expected_date?: string; expected_time?: string; prints_arrived?: boolean }
interface JobMeta { piece_meta?: PieceMeta[]; assignee?: string; mailing_class?: string; drop_off?: string; [k: string]: unknown }
interface Quote {
  id: string; project_name: string; quote_number: number | null; total: number
  items: QuoteItem[]; job_meta?: JobMeta; is_job?: boolean; archived?: boolean
  contact_name?: string | null; mailing_date?: string | null
}

interface Delivery {
  jobId: string; jobName: string; quoteNumber: number | null; total: number
  contactName: string; mailingDate: string | null
  pieceIndex: number; pieceLabel: string; pieceDesc: string
  vendor: string; expectedDate: string; expectedTime: string
  arrived: boolean; assignee: string; mailingClass: string; dropOff: string
}

const fetcher = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("Fetch failed"); return r.json() }

function getRelativeDay(dateStr: string) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff < -1) return { label: `${Math.abs(diff)}d overdue`, diff, key: "overdue" as const }
  if (diff === -1) return { label: "Yesterday", diff, key: "overdue" as const }
  if (diff === 0) return { label: "Today", diff, key: "today" as const }
  if (diff === 1) return { label: "Tomorrow", diff, key: "tomorrow" as const }
  return { label: `In ${diff}d`, diff, key: "future" as const }
}

const colorMap = {
  overdue: { badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200", card: "border-red-200/60 dark:border-red-800/40", bg: "bg-red-50/50 dark:bg-red-950/10", header: "text-red-700 dark:text-red-400" },
  today: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200", card: "border-amber-200/60 dark:border-amber-800/40", bg: "bg-amber-50/50 dark:bg-amber-950/10", header: "text-amber-700 dark:text-amber-400" },
  tomorrow: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200", card: "border-emerald-200/60 dark:border-emerald-800/40", bg: "bg-emerald-50/50 dark:bg-emerald-950/10", header: "text-emerald-700 dark:text-emerald-400" },
  future: { badge: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400 border-teal-200", card: "border-teal-200/60 dark:border-teal-800/40", bg: "bg-teal-50/30 dark:bg-teal-950/10", header: "text-teal-700 dark:text-teal-400" },
  arrived: { badge: "bg-secondary text-muted-foreground border-border", card: "border-border opacity-60", bg: "", header: "text-muted-foreground" },
}

export function DeliveriesDashboard() {
  const { data: jobs } = useSWR<Quote[]>("/api/quotes?is_job=true&archived=false", fetcher, { refreshInterval: 15000 })
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState<"today" | "tomorrow" | "week" | "all">("all")
  const [vendorFilter, setVendorFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "arrived">("all")
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  // Extract all deliveries from active jobs
  const deliveries = useMemo(() => {
    if (!jobs) return []
    const result: Delivery[] = []
    for (const job of jobs) {
      const meta = job.job_meta || {}
      const pms = meta.piece_meta || []
      const items = job.items || []
      pms.forEach((pm, i) => {
        if (!pm.expected_date && !pm.vendor) return // skip empty
        const item = items[i]
        result.push({
          jobId: job.id,
          jobName: job.project_name || "Untitled",
          quoteNumber: job.quote_number,
          total: job.total,
          contactName: job.contact_name || "",
          mailingDate: job.mailing_date || null,
          pieceIndex: i,
          pieceLabel: item?.label || `Piece ${i + 1}`,
          pieceDesc: item?.description || "",
          vendor: pm.vendor || "Unassigned",
          expectedDate: pm.expected_date || "",
          expectedTime: pm.expected_time || "",
          arrived: !!pm.prints_arrived,
          assignee: (meta.assignee as string) || "",
          mailingClass: (meta.mailing_class as string) || "",
          dropOff: (meta.drop_off as string) || "",
        })
      })
    }
    return result
  }, [jobs])

  // Apply filters
  const filtered = useMemo(() => {
    let list = deliveries
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((d) =>
        d.jobName.toLowerCase().includes(s) || d.vendor.toLowerCase().includes(s) ||
        d.pieceLabel.toLowerCase().includes(s) || d.pieceDesc.toLowerCase().includes(s) ||
        d.contactName.toLowerCase().includes(s) || (d.quoteNumber ? `${d.quoteNumber}`.includes(s) : false)
      )
    }
    if (vendorFilter) list = list.filter((d) => d.vendor === vendorFilter)
    if (statusFilter === "pending") list = list.filter((d) => !d.arrived)
    if (statusFilter === "arrived") list = list.filter((d) => d.arrived)
    if (dateFilter !== "all") {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      list = list.filter((d) => {
        if (!d.expectedDate) return false
        const dd = new Date(d.expectedDate + "T00:00:00"); dd.setHours(0, 0, 0, 0)
        const diff = Math.round((dd.getTime() - today.getTime()) / 86400000)
        if (dateFilter === "today") return diff === 0
        if (dateFilter === "tomorrow") return diff === 1
        if (dateFilter === "week") return diff >= 0 && diff <= 7
        return true
      })
    }
    // Sort: overdue first, then today, then tomorrow, then future, arrived last
    list.sort((a, b) => {
      if (a.arrived !== b.arrived) return a.arrived ? 1 : -1
      const ra = getRelativeDay(a.expectedDate), rb = getRelativeDay(b.expectedDate)
      return (ra?.diff ?? 999) - (rb?.diff ?? 999)
    })
    return list
  }, [deliveries, search, vendorFilter, statusFilter, dateFilter])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Delivery[]>()
    for (const d of filtered) {
      const key = d.expectedDate || "__none__"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(d)
    }
    return Array.from(map.entries())
  }, [filtered])

  // Summary counts
  const counts = useMemo(() => {
    const overdue = deliveries.filter((d) => !d.arrived && (getRelativeDay(d.expectedDate)?.diff ?? 0) < 0).length
    const today = deliveries.filter((d) => !d.arrived && getRelativeDay(d.expectedDate)?.diff === 0).length
    const tomorrow = deliveries.filter((d) => !d.arrived && getRelativeDay(d.expectedDate)?.diff === 1).length
    const arrived = deliveries.filter((d) => d.arrived).length
    return { overdue, today, tomorrow, arrived, total: deliveries.length }
  }, [deliveries])

  // Unique vendors for filter
  const vendorNames = useMemo(() => {
    const set = new Set(deliveries.map((d) => d.vendor).filter(Boolean))
    return Array.from(set).sort()
  }, [deliveries])

  // Toggle arrived
  const toggleArrived = async (d: Delivery) => {
    const job = jobs?.find((j) => j.id === d.jobId)
    if (!job) return
    const meta = { ...(job.job_meta || {}) }
    const pms = [...(meta.piece_meta || [])]
    pms[d.pieceIndex] = { ...pms[d.pieceIndex], prints_arrived: !d.arrived }
    meta.piece_meta = pms
    await fetch(`/api/quotes/${d.jobId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_meta: meta }) })
    globalMutate("/api/quotes?is_job=true&archived=false")
  }

  const loading = !jobs

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-bold text-foreground">Expected Deliveries</h2>
          <span className="text-[10px] font-mono text-muted-foreground/60">{filtered.length} of {counts.total}</span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <button onClick={() => setDateFilter(dateFilter === "all" ? "all" : "all")}
            className={cn("flex flex-col items-center p-2 rounded-lg border transition-all text-center",
              counts.overdue > 0 ? "border-red-200 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40" : "border-border bg-card"
            )}>
            <AlertTriangle className={cn("h-3.5 w-3.5 mb-0.5", counts.overdue > 0 ? "text-red-500" : "text-muted-foreground/30")} />
            <span className={cn("text-lg font-bold leading-none", counts.overdue > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground/40")}>{counts.overdue}</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">Overdue</span>
          </button>
          <button onClick={() => setDateFilter(dateFilter === "today" ? "all" : "today")}
            className={cn("flex flex-col items-center p-2 rounded-lg border transition-all text-center",
              dateFilter === "today" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-300/30" : "border-border bg-card hover:bg-secondary/30"
            )}>
            <Clock className={cn("h-3.5 w-3.5 mb-0.5", counts.today > 0 ? "text-amber-600" : "text-muted-foreground/30")} />
            <span className={cn("text-lg font-bold leading-none", counts.today > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground/40")}>{counts.today}</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">Today</span>
          </button>
          <button onClick={() => setDateFilter(dateFilter === "tomorrow" ? "all" : "tomorrow")}
            className={cn("flex flex-col items-center p-2 rounded-lg border transition-all text-center",
              dateFilter === "tomorrow" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 ring-1 ring-emerald-300/30" : "border-border bg-card hover:bg-secondary/30"
            )}>
            <Calendar className={cn("h-3.5 w-3.5 mb-0.5", counts.tomorrow > 0 ? "text-emerald-600" : "text-muted-foreground/30")} />
            <span className={cn("text-lg font-bold leading-none", counts.tomorrow > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/40")}>{counts.tomorrow}</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">Tomorrow</span>
          </button>
          <button onClick={() => setStatusFilter(statusFilter === "arrived" ? "all" : "arrived")}
            className={cn("flex flex-col items-center p-2 rounded-lg border transition-all text-center",
              statusFilter === "arrived" ? "border-teal-300 bg-teal-50 dark:bg-teal-950/20 ring-1 ring-teal-300/30" : "border-border bg-card hover:bg-secondary/30"
            )}>
            <CheckCircle2 className={cn("h-3.5 w-3.5 mb-0.5", counts.arrived > 0 ? "text-teal-600" : "text-muted-foreground/30")} />
            <span className={cn("text-lg font-bold leading-none", counts.arrived > 0 ? "text-teal-700 dark:text-teal-400" : "text-muted-foreground/40")}>{counts.arrived}</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">Arrived</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, vendors, pieces..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-secondary/40 border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/20 placeholder:text-muted-foreground/30"
            />
          </div>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
            className="h-8 text-[11px] font-medium bg-background border border-border rounded-lg px-2 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
            <option value="">All Vendors</option>
            {vendorNames.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
            className="h-8 text-[11px] font-medium bg-background border border-border rounded-lg px-2 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="week">This Week</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-8 text-[11px] font-medium bg-background border border-border rounded-lg px-2 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="arrived">Arrived</option>
          </select>
        </div>
      </div>

      {/* Deliveries list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-1">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-5 w-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground/50">No deliveries found</p>
            <p className="text-xs text-muted-foreground/30 mt-1">
              {deliveries.length === 0 ? "Set expected dates on job pieces to track deliveries" : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([dateKey, items]) => {
              const rel = dateKey === "__none__" ? null : getRelativeDay(dateKey)
              const colorKey = items[0]?.arrived ? "arrived" : (rel?.key || "future")
              const colors = colorMap[colorKey]
              const dateLabel = dateKey === "__none__"
                ? "No Date Set"
                : new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

              return (
                <div key={dateKey}>
                  {/* Date group header */}
                  <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-1">
                    <span className={cn("text-[11px] font-bold", colors.header)}>{dateLabel}</span>
                    {rel && rel.label && (
                      <span className={cn("text-[9px] font-semibold px-1.5 py-0 rounded border leading-relaxed", colors.badge)}>
                        {rel.label}
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-muted-foreground/40">{items.length} deliver{items.length !== 1 ? "ies" : "y"}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  {/* Delivery cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {items.map((d, idx) => {
                      const isVendorInternal = vendors?.find((v) => v.company_name === d.vendor)?.is_internal
                      const isExpanded = expandedJob === `${d.jobId}-${d.pieceIndex}`

                      return (
                        <div
                          key={`${d.jobId}-${d.pieceIndex}-${idx}`}
                          className={cn(
                            "rounded-lg border bg-card p-3 transition-all cursor-pointer hover:shadow-sm",
                            d.arrived ? colorMap.arrived.card : colors.card
                          )}
                          onClick={() => setExpandedJob(isExpanded ? null : `${d.jobId}-${d.pieceIndex}`)}
                        >
                          {/* Top row: job name + time badge */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0 flex-1">
                              <p className={cn("text-xs font-bold truncate", d.arrived ? "text-muted-foreground line-through" : "text-foreground")}>
                                {d.jobName}
                              </p>
                              {d.quoteNumber && <span className="text-[9px] font-mono text-muted-foreground/50">#{d.quoteNumber}</span>}
                            </div>
                            {d.expectedTime && (
                              <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0", d.arrived ? "bg-secondary text-muted-foreground" : "bg-foreground/[0.06] text-foreground/70")}>
                                {d.expectedTime}
                              </span>
                            )}
                          </div>

                          {/* Piece info */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Package className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            <span className={cn("text-[11px] font-medium truncate", d.arrived ? "text-muted-foreground" : "text-foreground/80")}>{d.pieceLabel}</span>
                          </div>

                          {/* Vendor badge */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <Truck className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                              d.vendor === "Unassigned"
                                ? "bg-secondary/50 text-muted-foreground/50 border-border"
                                : isVendorInternal
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200/50"
                                  : "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border-sky-200/50"
                            )}>
                              {d.vendor}
                            </span>
                          </div>

                          {/* Arrived toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleArrived(d) }}
                            className={cn(
                              "flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md border transition-all w-full justify-center",
                              d.arrived
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                : "bg-background text-muted-foreground border-border hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                            )}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {d.arrived ? "Arrived" : "Mark Arrived"}
                          </button>

                          {/* Expanded info */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-border space-y-1 text-[10px]">
                              {d.pieceDesc && <p className="text-muted-foreground"><span className="font-medium text-foreground">Desc:</span> {d.pieceDesc}</p>}
                              {d.contactName && <p className="text-muted-foreground"><span className="font-medium text-foreground">Contact:</span> {d.contactName}</p>}
                              {d.mailingClass && <p className="text-muted-foreground"><span className="font-medium text-foreground">Mail Class:</span> {d.mailingClass}</p>}
                              {d.dropOff && <p className="text-muted-foreground"><span className="font-medium text-foreground">Drop Off:</span> {d.dropOff}</p>}
                              {d.assignee && <p className="text-muted-foreground"><span className="font-medium text-foreground">Assigned:</span> {d.assignee}</p>}
                              {d.mailingDate && <p className="text-muted-foreground"><span className="font-medium text-foreground">Mail Date:</span> {new Date(d.mailingDate).toLocaleDateString()}</p>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pricing"
import type { Customer } from "@/lib/customer-types"
import {
  Receipt, Search, AlertTriangle, Clock, CheckCircle2, DollarSign,
  Mail, FileText, CreditCard, ChevronDown, ChevronUp, Filter,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

/* ── Types ── */
interface QuoteItem { id: number; category: string; label: string; description: string; amount: number }
interface JobMeta {
  assignee?: string; due_date?: string; mailing_class?: string
  job_mailed?: boolean; invoice_updated?: boolean; invoice_emailed?: boolean
  paid_postage?: boolean; paid_full?: boolean
  [k: string]: unknown
}
interface Quote {
  id: string; project_name: string; quote_number: number | null; job_number?: number | null
  total: number; items: QuoteItem[]; job_meta?: JobMeta; is_job?: boolean; archived?: boolean
  contact_name?: string | null; customer_id?: string | null; mailing_date?: string | null
}

type BillingStatus = "mailed_unpaid" | "invoice_pending" | "postage_paid" | "fully_paid" | "in_progress"

interface BillingRow {
  job: Quote
  meta: JobMeta
  mailDate: string | null
  assignee: string
  terms: string
  status: BillingStatus
  daysSinceMailed: number | null
}

const fetcher = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("Fetch failed"); return r.json() }

function getDaysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

function getStatus(meta: JobMeta): BillingStatus {
  if (meta.paid_full) return "fully_paid"
  if (meta.paid_postage && !meta.paid_full) return "postage_paid"
  if (meta.job_mailed && !meta.paid_full) return "mailed_unpaid"
  if (!meta.invoice_updated || !meta.invoice_emailed) return "invoice_pending"
  return "in_progress"
}

const STATUS_CONFIG: Record<BillingStatus, { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  mailed_unpaid:   { label: "Mailed Unpaid",   color: "text-red-700 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-950/20",         border: "border-red-200 dark:border-red-800/40",     icon: AlertTriangle },
  invoice_pending: { label: "Invoice Pending",  color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20",     border: "border-amber-200 dark:border-amber-800/40", icon: FileText },
  postage_paid:    { label: "Postage Paid",     color: "text-teal-700 dark:text-teal-400",   bg: "bg-teal-50 dark:bg-teal-950/20",       border: "border-teal-200 dark:border-teal-800/40",   icon: CreditCard },
  fully_paid:      { label: "Fully Paid",       color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-800/40", icon: CheckCircle2 },
  in_progress:     { label: "In Progress",      color: "text-foreground/60",                 bg: "bg-secondary/40",                      border: "border-border",                              icon: Clock },
}

export function BillingDashboard() {
  const { data: jobs } = useSWR<Quote[]>("/api/quotes?is_job=true&archived=false", fetcher, { refreshInterval: 15000 })
  const { data: customers } = useSWR<Customer[]>("/api/customers", fetcher)
  const { data: teamMembers } = useSWR<Array<{ id: string; name: string; color: string; is_active: boolean }>>("/api/team", fetcher)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<BillingStatus | "all">("all")
  const [assigneeFilter, setAssigneeFilter] = useState("")
  const [termsFilter, setTermsFilter] = useState("")
  const [sortField, setSortField] = useState<"mailDate" | "total" | "status" | "terms">("mailDate")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  // Checkbox column filters: null = show all, true = only checked, false = only unchecked
  const [filterInvUpdated, setFilterInvUpdated] = useState<boolean | null>(null)
  const [filterInvEmailed, setFilterInvEmailed] = useState<boolean | null>(null)
  const [filterPaidPostage, setFilterPaidPostage] = useState<boolean | null>(null)
  const [filterPaidFull, setFilterPaidFull] = useState<boolean | null>(null)

  // Build customer lookup map
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>()
    if (customers) customers.forEach((c) => map.set(c.id, c))
    return map
  }, [customers])

  // Build billing rows
  const rows = useMemo(() => {
    if (!jobs) return []
    return jobs.map((job): BillingRow => {
      const meta = (job.job_meta || {}) as JobMeta
      const customer = job.customer_id ? customerMap.get(job.customer_id) : null
      const mailDate = (meta.due_date as string) || job.mailing_date || null
      const status = getStatus(meta)
      const daysSinceMailed = meta.job_mailed ? getDaysSince(mailDate) : null

      return {
        job,
        meta,
        mailDate,
        assignee: (meta.assignee as string) || "",
        terms: customer?.terms || "N/A",
        status,
        daysSinceMailed,
      }
    })
  }, [jobs, customerMap])

  // Filter
  const filtered = useMemo(() => {
    let list = rows
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((r) =>
        (r.job.project_name || "").toLowerCase().includes(s) ||
        (r.job.contact_name || "").toLowerCase().includes(s) ||
        (r.job.job_number ? `${r.job.job_number}`.includes(s) : false) ||
        (r.job.quote_number ? `${r.job.quote_number}`.includes(s) : false) ||
        r.assignee.toLowerCase().includes(s) ||
        r.terms.toLowerCase().includes(s)
      )
    }
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter)
    if (assigneeFilter) list = list.filter((r) => r.assignee === assigneeFilter)
    if (termsFilter) list = list.filter((r) => r.terms === termsFilter)
    if (filterInvUpdated !== null) list = list.filter((r) => !!r.meta.invoice_updated === filterInvUpdated)
    if (filterInvEmailed !== null) list = list.filter((r) => !!r.meta.invoice_emailed === filterInvEmailed)
    if (filterPaidPostage !== null) list = list.filter((r) => !!r.meta.paid_postage === filterPaidPostage)
    if (filterPaidFull !== null) list = list.filter((r) => !!r.meta.paid_full === filterPaidFull)
    return list
  }, [rows, search, statusFilter, assigneeFilter, termsFilter, filterInvUpdated, filterInvEmailed, filterPaidPostage, filterPaidFull])

  // Sort
  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sortDir === "asc" ? 1 : -1
    list.sort((a, b) => {
      // Always push fully_paid to bottom
      if (a.status === "fully_paid" && b.status !== "fully_paid") return 1
      if (b.status === "fully_paid" && a.status !== "fully_paid") return -1

      if (sortField === "mailDate") {
        const da = a.mailDate || "9999", db = b.mailDate || "9999"
        return da < db ? -dir : da > db ? dir : 0
      }
      if (sortField === "total") return (a.job.total - b.job.total) * dir
      if (sortField === "terms") return a.terms.localeCompare(b.terms) * dir
      if (sortField === "status") {
        const order: Record<BillingStatus, number> = { mailed_unpaid: 0, invoice_pending: 1, in_progress: 2, postage_paid: 3, fully_paid: 4 }
        return (order[a.status] - order[b.status]) * dir
      }
      return 0
    })
    return list
  }, [filtered, sortField, sortDir])

  // Summary counts
  const counts = useMemo(() => ({
    mailed_unpaid: rows.filter((r) => r.status === "mailed_unpaid").length,
    invoice_pending: rows.filter((r) => r.status === "invoice_pending").length,
    postage_paid: rows.filter((r) => r.status === "postage_paid").length,
    fully_paid: rows.filter((r) => r.status === "fully_paid").length,
    total: rows.length,
    unpaidTotal: rows.filter((r) => r.status === "mailed_unpaid").reduce((s, r) => s + r.job.total, 0),
  }), [rows])

  // Unique values for filters
  const uniqueAssignees = useMemo(() => Array.from(new Set(rows.map((r) => r.assignee).filter(Boolean))).sort(), [rows])
  const uniqueTerms = useMemo(() => Array.from(new Set(rows.map((r) => r.terms).filter((t) => t !== "N/A"))).sort(), [rows])

  // Toggle billing meta
  const toggleMeta = async (row: BillingRow, field: keyof JobMeta) => {
    const job = row.job
    const meta = { ...(job.job_meta || {}) }
    meta[field] = !meta[field]
    await fetch(`/api/quotes/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_meta: meta }),
    })
    globalMutate("/api/quotes?is_job=true&archived=false")
  }

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 text-muted-foreground/20" />
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const loading = !jobs

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4 text-foreground/70" />
          <h2 className="text-sm font-bold text-foreground">Billing</h2>
          <span className="text-[10px] font-mono text-muted-foreground/60">{sorted.length} of {counts.total} jobs</span>
          {counts.unpaidTotal > 0 && (
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-auto">
              {formatCurrency(counts.unpaidTotal)} unpaid
            </span>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {([
            { key: "mailed_unpaid" as const, count: counts.mailed_unpaid, Icon: AlertTriangle, label: "Mailed Unpaid", activeColor: "border-red-300 bg-red-50 dark:bg-red-950/20 ring-1 ring-red-300/30", iconColor: "text-red-500", countColor: "text-red-700 dark:text-red-400" },
            { key: "invoice_pending" as const, count: counts.invoice_pending, Icon: FileText, label: "Invoice Pending", activeColor: "border-amber-300 bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-300/30", iconColor: "text-amber-500", countColor: "text-amber-700 dark:text-amber-400" },
            { key: "postage_paid" as const, count: counts.postage_paid, Icon: CreditCard, label: "Postage Paid", activeColor: "border-teal-300 bg-teal-50 dark:bg-teal-950/20 ring-1 ring-teal-300/30", iconColor: "text-teal-600", countColor: "text-teal-700 dark:text-teal-400" },
            { key: "fully_paid" as const, count: counts.fully_paid, Icon: CheckCircle2, label: "Fully Paid", activeColor: "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 ring-1 ring-emerald-300/30", iconColor: "text-emerald-600", countColor: "text-emerald-700 dark:text-emerald-400" },
          ]).map(({ key, count, Icon, label, activeColor, iconColor, countColor }) => (
            <button key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
              className={cn(
                "flex flex-col items-center p-2 rounded-lg border transition-all text-center",
                statusFilter === key ? activeColor : "border-border bg-card hover:bg-secondary/30"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 mb-0.5", count > 0 ? iconColor : "text-muted-foreground/30")} />
              <span className={cn("text-lg font-bold leading-none", count > 0 ? countColor : "text-muted-foreground/40")}>{count}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, contacts, terms..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-secondary/40 border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/20 placeholder:text-muted-foreground/30"
            />
          </div>
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-8 text-[11px] font-medium bg-background border border-border rounded-lg px-2 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
            <option value="">All Assignees</option>
            {uniqueAssignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={termsFilter} onChange={(e) => setTermsFilter(e.target.value)}
            className="h-8 text-[11px] font-medium bg-background border border-border rounded-lg px-2 outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer">
            <option value="">All Terms</option>
            {uniqueTerms.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {(filterInvUpdated !== null || filterInvEmailed !== null || filterPaidPostage !== null || filterPaidFull !== null) && (
            <button
              onClick={() => { setFilterInvUpdated(null); setFilterInvEmailed(null); setFilterPaidPostage(null); setFilterPaidFull(null) }}
              className="h-8 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg px-2.5 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"
            >
              <Filter className="h-3 w-3" />
              Clear field filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-1">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-5 w-5 border-2 border-foreground/30 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground/50">No jobs found</p>
            <p className="text-xs text-muted-foreground/30 mt-1">
              {rows.length === 0 ? "Activate jobs to track billing" : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_80px_80px_44px_44px_44px_44px] gap-0 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="px-3 py-2">Job</div>
              <button onClick={() => handleSort("mailDate")} className="px-2 py-2 flex items-center gap-1 hover:text-foreground transition-colors">
                Mail Date <SortIcon field="mailDate" />
              </button>
              <button onClick={() => handleSort("terms")} className="px-2 py-2 flex items-center gap-1 hover:text-foreground transition-colors">
                Terms <SortIcon field="terms" />
              </button>
              <button onClick={() => handleSort("total")} className="px-2 py-2 flex items-center gap-1 hover:text-foreground transition-colors text-right justify-end">
                Total <SortIcon field="total" />
              </button>
              <button onClick={() => handleSort("status")} className="px-2 py-2 flex items-center gap-1 hover:text-foreground transition-colors">
                Status <SortIcon field="status" />
              </button>
              {([
                { Icon: FileText, label: "Invoice Updated", filter: filterInvUpdated, setFilter: setFilterInvUpdated },
                { Icon: Mail, label: "Invoice Emailed", filter: filterInvEmailed, setFilter: setFilterInvEmailed },
                { Icon: CreditCard, label: "Paid Postage", filter: filterPaidPostage, setFilter: setFilterPaidPostage },
                { Icon: DollarSign, label: "Paid Full", filter: filterPaidFull, setFilter: setFilterPaidFull },
              ] as const).map(({ Icon, label, filter, setFilter }) => (
                <button
                  key={label}
                  onClick={() => setFilter(filter === null ? true : filter === true ? false : null)}
                  className={cn(
                    "px-1 py-2 flex flex-col items-center gap-0.5 transition-colors relative",
                    filter !== null ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
                  )}
                  title={`${label}: ${filter === null ? "All" : filter ? "Checked only" : "Unchecked only"}`}
                >
                  <Icon className="h-3 w-3" />
                  {filter !== null && (
                    <span className={cn(
                      "text-[7px] font-bold leading-none px-1 rounded",
                      filter ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30"
                        : "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
                    )}>
                      {filter ? "YES" : "NO"}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Table body */}
            <div className="divide-y divide-border/60">
              {sorted.map((row) => {
                const sc = STATUS_CONFIG[row.status]
                const assignedMember = teamMembers?.find((m) => m.name === row.assignee)
                const assigneeColor = assignedMember?.color || "#6b7280"
                const isMailedUnpaid = row.status === "mailed_unpaid"
                const isFullyPaid = row.status === "fully_paid"
                const mailDateFormatted = row.mailDate
                  ? new Date(row.mailDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : null

                return (
                  <div key={row.job.id} className={cn(
                    "grid grid-cols-[1fr_100px_100px_80px_80px_44px_44px_44px_44px] gap-0 items-center transition-colors",
                    isMailedUnpaid ? "bg-red-50/40 dark:bg-red-950/10" : isFullyPaid ? "opacity-50" : "bg-card hover:bg-secondary/20"
                  )}>
                    {/* Job info */}
                    <div className="px-3 py-2.5 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {isMailedUnpaid && <div className="w-0.5 h-8 bg-red-500 rounded-full shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {row.job.job_number && (
                              <span className="text-[10px] font-bold font-mono text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-px rounded shrink-0">
                                J-{row.job.job_number}
                              </span>
                            )}
                            <span className="text-xs font-bold text-foreground truncate">{row.job.project_name || "Untitled"}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground truncate">{row.job.contact_name || "No contact"}</span>
                            {row.assignee && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1 py-px rounded shrink-0"
                                style={{ backgroundColor: assigneeColor + "15", color: assigneeColor }}>
                                <span className="h-3 w-3 rounded-full text-white text-[7px] font-bold flex items-center justify-center"
                                  style={{ backgroundColor: assigneeColor }}>
                                  {row.assignee.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                                </span>
                                {row.assignee.split(" ")[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mail Date */}
                    <div className="px-2 py-2.5">
                      {mailDateFormatted ? (
                        <span className="text-[11px] font-medium text-foreground">{mailDateFormatted}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/30">No date</span>
                      )}
                      {row.daysSinceMailed !== null && row.daysSinceMailed > 0 && !isFullyPaid && (
                        <span className="block text-[9px] font-semibold text-red-600 dark:text-red-400">{row.daysSinceMailed}d ago</span>
                      )}
                    </div>

                    {/* Terms */}
                    <div className="px-2 py-2.5">
                      <span className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                        row.terms === "COD" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40"
                        : row.terms === "CCOF" ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800/40"
                        : row.terms.includes("30") ? "bg-foreground/5 text-foreground/70 border-border"
                        : row.terms === "N/A" ? "bg-secondary/50 text-muted-foreground/40 border-border/50"
                        : "bg-secondary text-foreground/70 border-border"
                      )}>
                        {row.terms}
                      </span>
                    </div>

                    {/* Total */}
                    <div className="px-2 py-2.5 text-right">
                      <span className="text-xs font-bold font-mono text-foreground tabular-nums">{formatCurrency(row.job.total)}</span>
                    </div>

                    {/* Status badge */}
                    <div className="px-2 py-2.5">
                      <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap", sc.bg, sc.color, sc.border)}>
                        {sc.label.split(" ")[0]}
                      </span>
                    </div>

                    {/* Invoice Updated */}
                    <div className="flex items-center justify-center py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!row.meta.invoice_updated}
                        onCheckedChange={() => toggleMeta(row, "invoice_updated")}
                        className={cn("h-4 w-4 rounded", row.meta.invoice_updated && "data-[state=checked]:bg-foreground data-[state=checked]:border-foreground")}
                      />
                    </div>

                    {/* Invoice Emailed */}
                    <div className="flex items-center justify-center py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!row.meta.invoice_emailed}
                        onCheckedChange={() => toggleMeta(row, "invoice_emailed")}
                        className={cn("h-4 w-4 rounded", row.meta.invoice_emailed && "data-[state=checked]:bg-foreground data-[state=checked]:border-foreground")}
                      />
                    </div>

                    {/* Paid Postage */}
                    <div className="flex items-center justify-center py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!row.meta.paid_postage}
                        onCheckedChange={() => toggleMeta(row, "paid_postage")}
                        className={cn("h-4 w-4 rounded", row.meta.paid_postage && "data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600")}
                      />
                    </div>

                    {/* Paid Full */}
                    <div className="flex items-center justify-center py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!row.meta.paid_full}
                        onCheckedChange={() => toggleMeta(row, "paid_full")}
                        className={cn("h-4 w-4 rounded", row.meta.paid_full && "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600")}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

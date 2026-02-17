"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Printer, Truck, Check, Clock, AlertTriangle, ArrowRight, Package } from "lucide-react"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface DeliverySchedule {
  date?: string
  time?: string
  period?: "AM" | "PM"
  arrived?: boolean
}

interface JobMeta {
  printed_by?: string
  inhouse_location?: string
  vendor_name?: string
  vendor_job?: string
  inhouse_delivery?: DeliverySchedule
  ohp_delivery?: DeliverySchedule
  piece_desc?: string
  assignee?: string
}

interface Job {
  id: string
  project_name: string
  quantity?: number
  customer_id?: string | null
  contact_name?: string | null
  job_meta?: JobMeta
  quote_number?: number | null
}

interface DeliveryRow {
  job: Job
  source: "PrintOut" | "OHP"
  location?: string
  vendor?: string
  vendorJob?: string
  schedule: DeliverySchedule
  status: { label: string; urgency: "overdue" | "today" | "tomorrow" | "upcoming" | "arrived" | "none" }
}

function getStatus(d?: DeliverySchedule) {
  if (!d?.date) return { label: "Not scheduled", urgency: "none" as const }
  if (d.arrived) return { label: "Arrived", urgency: "arrived" as const }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.date + "T00:00:00")
  const diffDays = Math.floor((target.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return { label: `Overdue (${Math.abs(diffDays)}d)`, urgency: "overdue" as const }
  if (diffDays === 0) return { label: "Today", urgency: "today" as const }
  if (diffDays === 1) return { label: "Tomorrow", urgency: "tomorrow" as const }
  const dateStr = target.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return { label: dateStr, urgency: "upcoming" as const }
}

function formatTime(d?: DeliverySchedule) {
  if (!d?.time) return ""
  const [h, m] = d.time.split(":").map(Number)
  const period = d.period || (h >= 12 ? "PM" : "AM")
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

export function DeliveryReportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: jobs } = useSWR<Job[]>(open ? "/api/quotes?is_job=true&archived=false" : null, fetcher)

  const rows = useMemo<DeliveryRow[]>(() => {
    if (!jobs) return []
    const result: DeliveryRow[] = []

    for (const job of jobs) {
      const meta = job.job_meta
      if (!meta?.printed_by) continue

      if ((meta.printed_by === "PrintOut" || meta.printed_by === "Both") && meta.inhouse_delivery?.date) {
        result.push({
          job,
          source: "PrintOut",
          location: meta.inhouse_location || "RSH",
          schedule: meta.inhouse_delivery,
          status: getStatus(meta.inhouse_delivery),
        })
      }

      if ((meta.printed_by === "OHP" || meta.printed_by === "Both") && meta.ohp_delivery?.date) {
        result.push({
          job,
          source: "OHP",
          vendor: meta.vendor_name,
          vendorJob: meta.vendor_job,
          schedule: meta.ohp_delivery,
          status: getStatus(meta.ohp_delivery),
        })
      }
    }

    // Sort: overdue first, then today, tomorrow, upcoming, arrived last
    const ORDER = { overdue: 0, today: 1, tomorrow: 2, upcoming: 3, none: 4, arrived: 5 }
    result.sort((a, b) => {
      const oa = ORDER[a.status.urgency]; const ob = ORDER[b.status.urgency]
      if (oa !== ob) return oa - ob
      return (a.schedule.date || "").localeCompare(b.schedule.date || "")
    })
    return result
  }, [jobs])

  const overdueCount = rows.filter((r) => r.status.urgency === "overdue").length
  const todayCount = rows.filter((r) => r.status.urgency === "today").length
  const tomorrowCount = rows.filter((r) => r.status.urgency === "tomorrow").length

  // Group by urgency
  const groups = [
    { key: "overdue", label: "Overdue", rows: rows.filter((r) => r.status.urgency === "overdue"), color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20", borderColor: "border-red-200 dark:border-red-800" },
    { key: "today", label: "Today", rows: rows.filter((r) => r.status.urgency === "today"), color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", borderColor: "border-amber-200 dark:border-amber-800" },
    { key: "tomorrow", label: "Tomorrow", rows: rows.filter((r) => r.status.urgency === "tomorrow"), color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20", borderColor: "border-blue-200 dark:border-blue-800" },
    { key: "upcoming", label: "Upcoming", rows: rows.filter((r) => r.status.urgency === "upcoming"), color: "text-foreground", bg: "bg-secondary/30", borderColor: "border-border" },
    { key: "arrived", label: "Arrived", rows: rows.filter((r) => r.status.urgency === "arrived"), color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20", borderColor: "border-emerald-200 dark:border-emerald-800" },
  ].filter((g) => g.rows.length > 0)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-card z-10">
          <SheetTitle className="text-base font-bold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Delivery Report
          </SheetTitle>
          {/* Summary badges */}
          <div className="flex items-center gap-2 mt-1">
            {overdueCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 bg-red-50 dark:bg-red-950/30 dark:border-red-800 font-bold gap-1">
                <AlertTriangle className="h-3 w-3" /> {overdueCount} overdue
              </Badge>
            )}
            {todayCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 font-bold gap-1">
                <Clock className="h-3 w-3" /> {todayCount} today
              </Badge>
            )}
            {tomorrowCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 font-bold gap-1">
                <ArrowRight className="h-3 w-3" /> {tomorrowCount} tomorrow
              </Badge>
            )}
            {rows.length === 0 && (
              <span className="text-xs text-muted-foreground">No scheduled deliveries</span>
            )}
          </div>
        </SheetHeader>

        <div className="p-3 flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-[11px] font-bold uppercase tracking-wider", group.color)}>{group.label}</span>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", group.bg, group.color)}>
                  {group.rows.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {group.rows.map((row, i) => (
                  <div
                    key={`${row.job.id}-${row.source}-${i}`}
                    className={cn(
                      "rounded-lg border p-2.5 transition-all",
                      group.borderColor,
                      group.key === "overdue" && "animate-pulse",
                      group.bg,
                    )}
                  >
                    {/* Top: job name + quantity */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground truncate flex-1">
                        {row.job.quote_number ? `#${row.job.quote_number} ` : ""}{row.job.project_name}
                      </span>
                      {row.job.quantity ? (
                        <span className="text-[10px] font-mono text-muted-foreground tabular-nums ml-2 shrink-0">
                          {row.job.quantity.toLocaleString()} pcs
                        </span>
                      ) : null}
                    </div>

                    {/* Source + vendor/location */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1">
                        {row.source === "PrintOut" ? (
                          <Printer className="h-3 w-3 text-foreground/60" />
                        ) : (
                          <Truck className="h-3 w-3 text-foreground/60" />
                        )}
                        <span className="text-[11px] font-semibold text-foreground">
                          {row.source === "PrintOut"
                            ? `PrintOut (${row.location || "RSH"})`
                            : `OHP${row.vendor ? ` - ${row.vendor}` : ""}`}
                        </span>
                      </div>
                      {row.vendorJob && (
                        <span className="text-[10px] text-muted-foreground font-mono">{row.vendorJob}</span>
                      )}
                    </div>

                    {/* Piece description */}
                    {row.job.job_meta?.piece_desc && (
                      <p className="text-[10px] text-muted-foreground mb-1">{row.job.job_meta.piece_desc}</p>
                    )}

                    {/* Delivery time */}
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[11px] font-bold", group.color)}>
                        {row.status.label}
                        {formatTime(row.schedule) && ` @ ${formatTime(row.schedule)}`}
                      </span>
                      {row.schedule.arrived && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <Check className="h-3 w-3" /> Received
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

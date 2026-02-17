"use client"

import { useState, useMemo } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Package, Send, CheckCircle2, Clock, Factory, Printer,
  AlertTriangle, ChevronDown, ChevronUp, Filter,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface PO {
  id: string; job_id: string
  po_number: string; ohp_job_number: string; ohp_location: string
  urgency: string; needed_date: string | null; needed_time: string
  status: string; cost: number; notes: string; ohp_email: string
  sent_at: string | null; confirmed_at: string | null
  in_production_at: string | null; received_at: string | null
  created_by: string; created_at: string; updated_at: string
  quotes?: { project_name: string; company_name: string }
}

const STATUS_FLOW = ["draft", "sent", "confirmed", "in_production", "received"] as const
const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", dotColor: "bg-muted-foreground/40", icon: <Clock className="h-3 w-3" /> },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", dotColor: "bg-blue-500", icon: <Send className="h-3 w-3" /> },
  confirmed: { label: "Confirmed", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dotColor: "bg-amber-500", icon: <CheckCircle2 className="h-3 w-3" /> },
  in_production: { label: "In Production", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", dotColor: "bg-purple-500", icon: <Factory className="h-3 w-3" /> },
  received: { label: "Received", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dotColor: "bg-emerald-500", icon: <Package className="h-3 w-3" /> },
}

function getUrgencyFromDate(dateStr: string | null) {
  if (!dateStr) return "standard"
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return "past_due"
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  return "upcoming"
}

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  past_due: { label: "PAST DUE", color: "bg-red-600 text-white" },
  today: { label: "TODAY", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold" },
  tomorrow: { label: "Tomorrow", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  standard: { label: "Standard", color: "bg-muted text-muted-foreground" },
  upcoming: { label: "Upcoming", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  custom: { label: "Custom", color: "bg-muted text-muted-foreground" },
}

type FilterStatus = "all" | "active" | "received"

export function PrintOrdersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: pos } = useSWR<PO[]>(open ? "/api/purchase-orders" : null, fetcher, { refreshInterval: 0 })
  const [filter, setFilter] = useState<FilterStatus>("active")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!pos) return []
    if (filter === "active") return pos.filter((p) => p.status !== "received")
    if (filter === "received") return pos.filter((p) => p.status === "received")
    return pos
  }, [pos, filter])

  // Sort: past_due first, then today, tomorrow, then by date
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const urgA = getUrgencyFromDate(a.needed_date)
      const urgB = getUrgencyFromDate(b.needed_date)
      const urgOrder = ["past_due", "today", "tomorrow", "standard", "upcoming", "custom"]
      const diff = urgOrder.indexOf(urgA) - urgOrder.indexOf(urgB)
      if (diff !== 0) return diff
      return (a.needed_date || "9999").localeCompare(b.needed_date || "9999")
    })
  }, [filtered])

  // Summary counts
  const counts = useMemo(() => {
    if (!pos) return { total: 0, draft: 0, sent: 0, confirmed: 0, in_production: 0, received: 0, overdue: 0, today: 0 }
    const c = { total: pos.length, draft: 0, sent: 0, confirmed: 0, in_production: 0, received: 0, overdue: 0, today: 0 }
    for (const p of pos) {
      if (p.status in c) (c as Record<string, number>)[p.status]++
      const urg = getUrgencyFromDate(p.needed_date)
      if (urg === "past_due" && p.status !== "received") c.overdue++
      if (urg === "today" && p.status !== "received") c.today++
    }
    return c
  }, [pos])

  const advanceStatus = async (po: PO) => {
    const idx = STATUS_FLOW.indexOf(po.status as typeof STATUS_FLOW[number])
    const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
    if (!next) return
    if (po.status === "draft") {
      await fetch(`/api/purchase-orders/${po.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: po.ohp_email }),
      })
    } else {
      await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
    }
    globalMutate("/api/purchase-orders")
  }

  const handlePrint = (po: PO) => {
    const w = window.open("", "_blank", "width=700,height=900")
    if (!w) return
    const urgLabel = URGENCY_CONFIG[getUrgencyFromDate(po.needed_date)]?.label || "Standard"
    const statusLabel = STATUS_CONFIG[po.status]?.label || po.status
    const jobName = po.quotes?.project_name || "—"
    const company = po.quotes?.company_name || "—"
    w.document.write(`<!DOCTYPE html><html><head><title>PO ${po.po_number || po.ohp_job_number}</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}
    h1{font-size:22px;margin-bottom:2px}h2{font-size:13px;color:#666;margin:0 0 20px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .field{border:1px solid #ddd;border-radius:8px;padding:8px 10px}
    .field label{font-size:9px;text-transform:uppercase;color:#888;letter-spacing:0.5px;display:block}
    .field span{font-size:13px;font-weight:600}
    @media print{body{padding:20px}}</style></head><body>
    <h1>PO: ${po.po_number || "N/A"} ${po.ohp_job_number ? `/ OHP: ${po.ohp_job_number}` : ""}</h1>
    <h2>${jobName} - ${company}</h2>
    <div class="grid">
      <div class="field"><label>Location</label><span>${po.ohp_location}</span></div>
      <div class="field"><label>Status</label><span>${statusLabel}</span></div>
      <div class="field"><label>Urgency</label><span>${urgLabel}</span></div>
      <div class="field"><label>Needed By</label><span>${po.needed_date || "—"} ${po.needed_time}</span></div>
      <div class="field"><label>Cost</label><span>${po.cost ? "$" + Number(po.cost).toFixed(2) : "—"}</span></div>
      <div class="field"><label>Email</label><span>${po.ohp_email || "—"}</span></div>
    </div>
    ${po.notes ? `<div style="margin-top:16px;padding:10px;background:#f9f9f9;border-radius:8px;font-size:12px"><strong>Notes:</strong> ${po.notes}</div>` : ""}
    </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-background">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-base font-bold flex items-center gap-2">
            <Package className="h-4 w-4" /> Print Orders
            {counts.total > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{counts.total}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Summary bar */}
        {counts.total > 0 && (
          <div className="px-4 py-2.5 border-b border-border flex flex-wrap gap-1.5 shrink-0">
            {counts.overdue > 0 && (
              <Badge className="bg-red-600 text-white border-0 text-[9px] gap-1 animate-pulse">
                <AlertTriangle className="h-2.5 w-2.5" /> {counts.overdue} Overdue
              </Badge>
            )}
            {counts.today > 0 && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[9px]">
                {counts.today} Due Today
              </Badge>
            )}
            {STATUS_FLOW.filter((s) => s !== "received").map((s) => {
              const c = (counts as Record<string, number>)[s]
              if (!c) return null
              const cfg = STATUS_CONFIG[s]
              return (
                <Badge key={s} className={`${cfg.color} border-0 text-[9px] gap-1`}>
                  {cfg.icon} {c} {cfg.label}
                </Badge>
              )
            })}
            {counts.received > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[9px] gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" /> {counts.received} Received
              </Badge>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div className="px-4 py-2 border-b border-border flex gap-1.5 shrink-0">
          {([["active", "Active"], ["all", "All"], ["received", "Received"]] as [FilterStatus, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                filter === val ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* PO List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {sorted.length === 0 ? (
            <div className="text-center py-10">
              <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No purchase orders{filter !== "all" ? ` (${filter})` : ""}</p>
            </div>
          ) : (
            sorted.map((po) => {
              const expanded = expandedId === po.id
              const cfg = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft
              const liveUrg = getUrgencyFromDate(po.needed_date)
              const urgCfg = URGENCY_CONFIG[liveUrg] || URGENCY_CONFIG.standard
              const nextIdx = STATUS_FLOW.indexOf(po.status as typeof STATUS_FLOW[number])
              const nextStatus = nextIdx >= 0 && nextIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[nextIdx + 1] : null

              return (
                <div key={po.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : po.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground truncate">
                          {po.po_number || po.ohp_job_number}
                        </span>
                        <Badge className={`text-[8px] px-1 py-0 ${cfg.color} border-0`}>{cfg.label}</Badge>
                        {liveUrg !== "standard" && liveUrg !== "upcoming" && po.status !== "received" && (
                          <Badge className={`text-[8px] px-1 py-0 ${urgCfg.color} border-0`}>{urgCfg.label}</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {po.quotes?.project_name || "—"} {po.quotes?.company_name ? `- ${po.quotes.company_name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[9px] text-muted-foreground">{po.ohp_location}</span>
                      {po.needed_date && (
                        <span className="text-[9px] text-muted-foreground tabular-nums">{po.needed_date}</span>
                      )}
                    </div>
                    {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </button>

                  {expanded && (
                    <div className="border-t border-border px-3 py-2.5 space-y-2.5">
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div><span className="text-muted-foreground">PO #:</span> <span className="font-semibold">{po.po_number || "—"}</span></div>
                        <div><span className="text-muted-foreground">OHP #:</span> <span className="font-semibold">{po.ohp_job_number || "—"}</span></div>
                        <div><span className="text-muted-foreground">Needed:</span> <span className="font-semibold">{po.needed_date || "—"} {po.needed_time}</span></div>
                        <div><span className="text-muted-foreground">Cost:</span> <span className="font-semibold">{po.cost ? `$${Number(po.cost).toFixed(2)}` : "—"}</span></div>
                      </div>

                      {po.notes && <p className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5">{po.notes}</p>}

                      {/* Timeline dots */}
                      <div className="flex items-center gap-0.5 px-1">
                        {STATUS_FLOW.map((s, i) => {
                          const reached = STATUS_FLOW.indexOf(po.status as typeof STATUS_FLOW[number]) >= i
                          return (
                            <div key={s} className="flex items-center flex-1">
                              <div className="flex flex-col items-center flex-1">
                                <div className={`w-2 h-2 rounded-full ${reached ? "bg-emerald-500" : "bg-muted-foreground/20"}`} />
                                <span className="text-[7px] text-muted-foreground mt-0.5">{STATUS_CONFIG[s]?.label.split(" ")[0]}</span>
                              </div>
                              {i < STATUS_FLOW.length - 1 && (
                                <div className={`h-px flex-1 ${reached ? "bg-emerald-500" : "bg-muted-foreground/20"}`} />
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <Separator />
                      <div className="flex items-center gap-1.5">
                        {nextStatus && (
                          <Button size="sm" variant={po.status === "draft" ? "default" : "outline"} className="h-6 text-[9px] gap-1" onClick={() => advanceStatus(po)}>
                            {po.status === "draft" ? <Send className="h-2.5 w-2.5" /> : STATUS_CONFIG[nextStatus]?.icon}
                            {po.status === "draft" ? "Send" : `Mark ${STATUS_CONFIG[nextStatus]?.label}`}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1" onClick={() => handlePrint(po)}>
                          <Printer className="h-2.5 w-2.5" /> Print
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

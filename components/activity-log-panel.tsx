"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import { X, Pulse, ChevronDown, Filter } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ActivityEntry {
  id: string
  quote_id: string | null
  entity_type: string
  entity_id: string | null
  event: string
  detail: string
  user_name: string
  created_at: string
}

const EVENT_COLORS: Record<string, string> = {
  quote_converted: "bg-emerald-500",
  customer_created: "bg-emerald-500",
  customers_imported: "bg-emerald-500",
  job_column_moved: "bg-blue-500",
  job_meta_updated: "bg-blue-500",
  archived: "bg-amber-500",
  unarchived: "bg-amber-500",
  customer_exported: "bg-violet-500",
  quote_saved: "bg-sky-500",
}

const ENTITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "quote", label: "Quotes" },
  { value: "job", label: "Jobs" },
  { value: "customer", label: "Customers" },
  { value: "system", label: "System" },
]

export function ActivityLogPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = 40

  const fetchEntries = useCallback(async (pageNum: number, entityFilter: string, append = false) => {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      let query = supabase
        .from("quote_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter)
      }

      const { data } = await query
      const rows = (data || []) as ActivityEntry[]
      setHasMore(rows.length === PAGE_SIZE)
      setEntries((prev) => append ? [...prev, ...rows] : rows)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load and filter change
  useEffect(() => {
    if (open) {
      setPage(0)
      fetchEntries(0, filter)
    }
  }, [open, filter, fetchEntries])

  // Realtime subscription for live updates
  useEffect(() => {
    if (!open) return
    const supabase = createBrowserClient()
    const channel = supabase
      .channel("activity-log-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quote_activity_log" }, (payload) => {
        const row = payload.new as ActivityEntry
        if (filter === "all" || row.entity_type === filter) {
          setEntries((prev) => [row, ...prev])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [open, filter])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchEntries(next, filter, true)
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "just now"
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDays = Math.floor(diffHr / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  const groupByDate = (items: ActivityEntry[]) => {
    const groups: { label: string; entries: ActivityEntry[] }[] = []
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()

    for (const entry of items) {
      const ds = new Date(entry.created_at).toDateString()
      const label = ds === today ? "Today" : ds === yesterday ? "Yesterday" : new Date(entry.created_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
      const existing = groups.find((g) => g.label === label)
      if (existing) existing.entries.push(entry)
      else groups.push({ label, entries: [entry] })
    }
    return groups
  }

  if (!open) return null

  const groups = groupByDate(entries)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-card border-l border-border flex flex-col animate-in slide-in-from-right-2 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Pulse className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-bold text-foreground">Activity Log</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border overflow-x-auto">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
          {ENTITY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors whitespace-nowrap min-h-[32px]",
                filter === f.value
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Activity list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Pulse className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Events will appear here as you work</p>
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <div key={group.label}>
                  {/* Date header */}
                  <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-4 py-1.5 border-b border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                  </div>

                  {group.entries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-muted/30 transition-colors">
                      {/* Dot */}
                      <div className="mt-1.5 shrink-0">
                        <div className={cn("w-2 h-2 rounded-full", EVENT_COLORS[entry.event] || "bg-muted-foreground/40")} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">
                            {entry.event.replace(/_/g, " ")}
                          </span>
                          {entry.user_name && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                              {entry.user_name}
                            </span>
                          )}
                          {entry.entity_type && entry.entity_type !== "quote" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground/80">
                              {entry.entity_type}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{entry.detail}</p>
                      </div>

                      {/* Time */}
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                        {formatTime(entry.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="px-4 py-3 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={loadMore} disabled={loading} className="text-xs gap-1.5">
                    <ChevronDown className="h-3.5 w-3.5" />
                    {loading ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

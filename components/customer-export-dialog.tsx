"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Download,
  FileSpreadsheet,
  Filter,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ShieldCheck,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type ExportFormat = "qbo" | "full"
type ExportFilter = "all" | "new_only" | "since"

interface SyncStats {
  total: number
  synced: number
  unsynced: number
}

export function CustomerExportDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [format, setFormat] = useState<ExportFormat>("qbo")
  const [filter, setFilter] = useState<ExportFilter>("new_only")
  const [sinceDate, setSinceDate] = useState("")
  const [markSynced, setMarkSynced] = useState(true)
  const [exporting, setExporting] = useState(false)

  const { data: stats, mutate: refreshStats } = useSWR<SyncStats>(
    open ? "/api/customers/sync" : null,
    fetcher
  )

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        format,
        filter,
        mark_synced: markSynced ? "true" : "false",
      })
      if (filter === "since" && sinceDate) params.set("since", sinceDate)

      const res = await fetch(`/api/customers/export?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Export failed")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] || "customers.csv"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Refresh sync stats after export
      if (markSynced) refreshStats()
    } finally {
      setExporting(false)
    }
  }

  const handleResetSync = async () => {
    if (!confirm("Reset all customers to unsynced? This cannot be undone.")) return
    const allRes = await fetch("/api/customers")
    const all = await allRes.json()
    const ids = all.map((c: { id: string }) => c.id)
    await fetch("/api/customers/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, synced: false }),
    })
    refreshStats()
  }

  const exportCount =
    filter === "all"
      ? stats?.total || 0
      : filter === "new_only"
        ? stats?.unsynced || 0
        : "?"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-bold">Export Customers</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Download a CSV for QuickBooks Online or your own records.
          </DialogDescription>
        </DialogHeader>

        {/* Sync Stats Bar */}
        <div className="mx-5 rounded-lg border border-border bg-secondary/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-semibold text-foreground">{stats?.synced ?? "-"}</span>
              <span className="text-muted-foreground">synced</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-xs">
              <CircleDashed className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-semibold text-foreground">{stats?.unsynced ?? "-"}</span>
              <span className="text-muted-foreground">new</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">{stats?.total ?? "-"} total</span>
            </div>
          </div>
          <button
            onClick={handleResetSync}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
          >
            Reset
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* FORMAT */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Format
            </p>
            <div className="grid grid-cols-2 gap-2">
              <FormatOption
                selected={format === "qbo"}
                onClick={() => setFormat("qbo")}
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title="QBO Ready"
                desc="Exact QBO import columns"
              />
              <FormatOption
                selected={format === "full"}
                onClick={() => setFormat("full")}
                icon={<Download className="h-4 w-4" />}
                title="Full Export"
                desc="All fields + billing info"
              />
            </div>
          </div>

          {/* FILTER */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Which customers?
            </p>
            <div className="flex flex-col gap-1.5">
              <FilterOption
                selected={filter === "new_only"}
                onClick={() => setFilter("new_only")}
                icon={<CircleDashed className="h-3.5 w-3.5 text-amber-500" />}
                title="New only (not yet synced)"
                badge={stats?.unsynced}
              />
              <FilterOption
                selected={filter === "all"}
                onClick={() => setFilter("all")}
                icon={<Filter className="h-3.5 w-3.5 text-muted-foreground" />}
                title="All customers"
                badge={stats?.total}
              />
              <FilterOption
                selected={filter === "since"}
                onClick={() => setFilter("since")}
                icon={<CalendarDays className="h-3.5 w-3.5 text-blue-500" />}
                title="Created since date..."
              />
              {filter === "since" && (
                <div className="pl-7">
                  <Input
                    type="date"
                    value={sinceDate}
                    onChange={(e) => setSinceDate(e.target.value)}
                    className="h-8 text-xs w-44"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>

          {/* MARK SYNCED */}
          <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-border p-2.5 hover:bg-secondary/40 transition-colors">
            <input
              type="checkbox"
              checked={markSynced}
              onChange={(e) => setMarkSynced(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-emerald-500"
            />
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Mark as synced after export</p>
              <p className="text-[10px] text-muted-foreground">
                {"So next time you can export \"new only\" to avoid duplicates"}
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-secondary/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{exportCount}</span> customer{exportCount !== 1 ? "s" : ""} will be exported
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting || (filter === "since" && !sinceDate)}
              className="h-8 text-xs gap-1.5"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export CSV
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FormatOption({
  selected, onClick, icon, title, desc,
}: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all text-center",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/30 hover:bg-secondary/40"
      )}
    >
      <div className={cn("transition-colors", selected ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
    </button>
  )
}

function FilterOption({
  selected, onClick, icon, title, badge,
}: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all text-left w-full min-h-[44px]",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/30 hover:bg-secondary/40"
      )}
    >
      {icon}
      <span className="text-xs font-medium text-foreground flex-1">{title}</span>
      {badge !== undefined && (
        <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0">{badge}</Badge>
      )}
    </button>
  )
}

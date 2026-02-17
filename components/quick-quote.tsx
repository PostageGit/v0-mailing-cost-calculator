"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import type { QuoteCategory } from "@/lib/quote-types"
import { QuoteSidebar } from "@/components/quote-sidebar"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { SpiralCalculator } from "@/components/spiral/spiral-calculator"
import { PerfectCalculator } from "@/components/perfect/perfect-calculator"
import { USPSPostageCalculator } from "@/components/usps-postage-calculator"
import { LaborCalculator } from "@/components/labor-calculator"
import { EnvelopeTab } from "@/components/envelope-tab"
import { ItemsTab } from "@/components/items-tab"
import { cn } from "@/lib/utils"
import {
  Mail, Stamp, Wrench, Printer, BookOpen, Disc3,
  Send, Package, Search, Plus, Layers, PanelRightOpen,
  Zap, ChevronRight, Check, X,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type CalcTab = "templates" | "printing" | "booklet" | "spiral" | "perfect" | "envelope" | "usps" | "labor" | "items"

const CALC_TABS: { id: CalcTab; label: string; icon: React.ReactNode }[] = [
  { id: "templates", label: "Templates", icon: <Layers className="h-3.5 w-3.5" /> },
  { id: "printing",  label: "Printing",  icon: <Printer className="h-3.5 w-3.5" /> },
  { id: "booklet",   label: "Booklet",   icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "spiral",    label: "Spiral",    icon: <Disc3 className="h-3.5 w-3.5" /> },
  { id: "perfect",   label: "Perfect",   icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "envelope",  label: "Envelope",  icon: <Mail className="h-3.5 w-3.5" /> },
  { id: "usps",      label: "Postage",   icon: <Stamp className="h-3.5 w-3.5" /> },
  { id: "labor",     label: "Labor",     icon: <Wrench className="h-3.5 w-3.5" /> },
  { id: "items",     label: "Items",     icon: <Package className="h-3.5 w-3.5" /> },
]

const CAT_MAP: Record<string, string> = {
  flat: "Flat Print", booklet: "Booklet", spiral: "Spiral Bind",
  perfect: "Perfect Bind", envelope: "Envelope", postage: "Postage",
  labor: "Labor", item: "Custom Item", ohp: "OHP",
}

// ── Template Browser (inline in Quick Quote) ──
function TemplateBrowser() {
  const { addItem } = useQuote()
  const { data: templates } = useSWR<Array<{
    id: string; name: string; group_name: string; category: string
    description: string; specs: Record<string, unknown>; amount: number; is_active: boolean
  }>>("/api/item-templates", fetcher)
  const { data: settings } = useSWR<Record<string, unknown>>("/api/app-settings", fetcher)
  const groups = (settings?.template_groups ?? []) as string[]
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const activeTemplates = useMemo(() =>
    (templates ?? []).filter((t) => t.is_active),
    [templates]
  )

  const filtered = useMemo(() => {
    let list = activeTemplates
    if (selectedGroup) list = list.filter((t) => t.group_name === selectedGroup)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    }
    return list
  }, [activeTemplates, selectedGroup, search])

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of activeTemplates) {
      counts[t.group_name] = (counts[t.group_name] ?? 0) + 1
    }
    return counts
  }, [activeTemplates])

  const handleAdd = (tpl: typeof activeTemplates[0]) => {
    const specSummary = Object.entries(tpl.specs).map(([k, v]) => `${k}: ${v}`).join(" | ")
    addItem({
      category: (tpl.category || "item") as QuoteCategory,
      label: tpl.name,
      description: [tpl.description, specSummary].filter(Boolean).join(" -- "),
      amount: tpl.amount,
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-base font-bold text-foreground mb-3">Saved Templates</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 h-9 text-sm rounded-xl border-border"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Group chips */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedGroup(null)}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
            !selectedGroup ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          All ({activeTemplates.length})
        </button>
        {groups.filter((g) => groupCounts[g]).map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
              selectedGroup === g ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {g} ({groupCounts[g]})
          </button>
        ))}
      </div>

      <Separator />

      {/* Template cards grid */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No templates found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Save items from any calculator to create templates
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((tpl) => (
              <div key={tpl.id} className="group relative rounded-xl border border-border bg-card p-3 hover:border-foreground/20 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{tpl.description}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {CAT_MAP[tpl.category] ?? tpl.category}
                  </Badge>
                </div>

                {/* Spec chips */}
                {tpl.specs && Object.keys(tpl.specs).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.entries(tpl.specs).slice(0, 4).map(([k, v]) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{formatCurrency(tpl.amount)}</span>
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-[11px] rounded-lg bg-foreground text-background hover:bg-foreground/90"
                    onClick={() => handleAdd(tpl)}
                  >
                    <Plus className="h-3 w-3" /> Add to Quote
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Quick Quote Screen ──
export function QuickQuoteScreen() {
  const [activeTab, setActiveTab] = useState<CalcTab>("templates")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { items, getTotal, newQuote } = useQuote()

  const renderCalc = () => {
    switch (activeTab) {
      case "templates": return <TemplateBrowser />
      case "printing":  return <PrintingCalculator />
      case "booklet":   return <BookletCalculator />
      case "spiral":    return <SpiralCalculator />
      case "perfect":   return <PerfectCalculator />
      case "envelope":  return <EnvelopeTab />
      case "usps":      return <USPSPostageCalculator />
      case "labor":     return <LaborCalculator />
      case "items":     return <ItemsTab />
      default:          return null
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Top bar with tabs */}
      <div className="shrink-0 bg-background border-b border-border/40">
        <div className="px-4 sm:px-6">
          <div className="flex items-center gap-1 py-1.5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 mr-2 pr-2 border-r border-border shrink-0">
              <Zap className="h-4 w-4 text-foreground" />
              <span className="text-xs font-bold text-foreground whitespace-nowrap">Quick Quote</span>
            </div>
            {CALC_TABS.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 min-h-[40px]",
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
            {items.length > 0 && (
              <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground shrink-0 pl-2">
                <span className="font-semibold text-foreground">{items.length} items</span>
                <span className="font-bold text-foreground">{formatCurrency(getTotal())}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content + Sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Calculator content -- uses block layout so calculators use natural height and scroll works */}
        <div className="flex-1 min-w-0 overflow-y-auto [&>div]:block">
          <div className="px-4 sm:px-6 pt-4 pb-24">
            <div className="max-w-4xl">
              {renderCalc()}
            </div>
          </div>
        </div>

        {/* Quote sidebar */}
        {sidebarOpen ? (
          <aside className="hidden lg:block w-[22rem] shrink-0 border-l border-border overflow-y-auto">
            <QuoteSidebar />
          </aside>
        ) : (
          <aside className="hidden lg:flex flex-col items-center pt-2 px-1 shrink-0 border-l border-border">
            <button
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-sm transition-all"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>
            {items.length > 0 && (
              <div className="mt-2 text-center">
                <p className="text-[10px] font-bold text-foreground">{items.length}</p>
                <p className="text-[9px] text-muted-foreground">items</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

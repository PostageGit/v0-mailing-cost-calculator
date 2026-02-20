"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import useSWR from "swr"
import type { SuppliersConfig } from "@/lib/suppliers"
import { DEFAULT_SUPPLIERS_CONFIG } from "@/lib/suppliers"
import { useMailing } from "@/lib/mailing-context"
import { useQuote } from "@/lib/quote-context"
import {
  SERVICE_CATALOG,
  CATEGORY_ORDER,
  CATEGORY_META,
  filterByShape,
  groupByCategory,
  getAddressingTierId,
  calculateItemAmount,
  getAutoQuantity,
  formatPriceUnit,
  inferRequiredItems,
  type ServiceItem,
  type ServiceCategory,
} from "@/lib/service-catalog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronDown,
  Plus,
  Check,
  Printer,
  List,
  AtSign,
  Cpu,
  Inbox,
  Tag,
  Truck,
  MoreHorizontal,
  Search,
  Stamp,
  BookOpen,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Icon map ────────────────────────────────────────────
const ICONS: Record<string, React.ElementType> = {
  printer: Printer,
  list: List,
  "book-open": BookOpen,
  "at-sign": AtSign,
  cpu: Cpu,
  inbox: Inbox,
  tag: Tag,
  stamp: Stamp,
  truck: Truck,
  more: MoreHorizontal,
}

// ─── Category pill colors ────────────────────────────────
const PILL_COLORS: Record<ServiceCategory, { active: string; badge: string }> = {
  PRINTING:      { active: "border-sky-400 bg-sky-50 dark:bg-sky-950/20",             badge: "bg-sky-500" },
  LIST_WORK:     { active: "border-violet-400 bg-violet-50 dark:bg-violet-950/20",    badge: "bg-violet-500" },
  LIST_RENTAL:   { active: "border-purple-400 bg-purple-50 dark:bg-purple-950/20",    badge: "bg-purple-500" },
  ADDRESSING:    { active: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20", badge: "bg-emerald-500" },
  COMPUTER_WORK: { active: "border-amber-400 bg-amber-50 dark:bg-amber-950/20",      badge: "bg-amber-500" },
  INSERTING:     { active: "border-rose-400 bg-rose-50 dark:bg-rose-950/20",          badge: "bg-rose-500" },
  LABELING:      { active: "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20",    badge: "bg-indigo-500" },
  POSTAGE:       { active: "border-teal-400 bg-teal-50 dark:bg-teal-950/20",          badge: "bg-teal-500" },
  DELIVERY:      { active: "border-orange-400 bg-orange-50 dark:bg-orange-950/20",    badge: "bg-orange-500" },
  MISC:          { active: "border-neutral-400 bg-neutral-50 dark:bg-neutral-950/20", badge: "bg-neutral-500" },
}

// ─── Added Items Tracker ─────────────────────────────────
interface AddedEntry {
  serviceId: string
  qty: number
  price: number
  total: number
}

// ─── Service code mappings ───────────────────────────────
const SERVICE_LABELS: Record<string, string> = {
  FCM_COMM: "1st Class",
  FCM_RETAIL: "1st Retail",
  MKT_COMM: "Marketing",
  MKT_NP: "Non-Profit",
  PS: "Parcel Select",
  MM: "Media Mail",
  LM: "Library Mail",
  BPM: "BPM",
}

const SERVICE_TO_POSTAGE: Record<string, string> = {
  FCM_COMM: "postage-1st",
  FCM_RETAIL: "postage-single",
  MKT_COMM: "postage-mkt",
  MKT_NP: "postage-np",
}

// ─── Main Component ──────────────────────────────────────

export function ServiceBuilder() {
  const mailing = useMailing()
  const quote = useQuote()
  const shape = mailing.shape || "LETTER"
  const mailingQty = mailing.quantity || 0
  const mailService = mailing.mailService || ""
  const activePostageId = SERVICE_TO_POSTAGE[mailService] || ""
  const isPlasticOuter = mailing.outerPiece?.envelopeKind === "plastic"

  const [addedItems, setAddedItems] = useState<Map<string, AddedEntry>>(new Map())
  const [customPrices, setCustomPrices] = useState<Map<string, number>>(new Map())
  const [customQtys, setCustomQtys] = useState<Map<string, number>>(new Map())
  const [search, setSearch] = useState("")
  const [expandedCat, setExpandedCat] = useState<ServiceCategory | null>(null)

  // ── Fetch supplier sell prices for list rentals ──
  const { data: appSettings } = useSWR("/api/app-settings", (url: string) => fetch(url).then((r) => r.json()))
  const supplierPriceMap = useMemo(() => {
    const cfg: SuppliersConfig = appSettings?.suppliers_config || DEFAULT_SUPPLIERS_CONFIG
    const m = new Map<string, number>()
    for (const item of cfg.supplyItems) {
      if (item.sellPrice > 0) m.set(item.id, item.sellPrice)
    }
    return m
  }, [appSettings])

  // ── Smart inference ──
  const inferred = useMemo(() => {
    const pieces = mailing.pieces || []
    const outerPiece = mailing.outerPiece
    const innerPieces = pieces.filter((p) => p.position > 1)
    return inferRequiredItems({
      shape,
      quantity: mailingQty,
      mailService,
      outerPieceType: outerPiece?.type || "",
      outerEnvelopeKind: outerPiece?.envelopeKind || "",
      innerPieceCount: innerPieces.length,
      hasInhousePrinting: pieces.some((p) => p.production === "inhouse"),
      hasFoldedPiece: pieces.some((p) => p.foldType && p.foldType !== "none"),
    })
  }, [shape, mailingQty, mailService, mailing.pieces, mailing.outerPiece])

  const inferredMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of inferred) m.set(i.id, i.reason)
    return m
  }, [inferred])

  // Filter by shape + search
  const filteredItems = useMemo(() => {
    let items = filterByShape(SERVICE_CATALOG, shape)
    const isFlat = shape.toUpperCase() === "FLAT" || shape.toUpperCase() === "PARCEL"
    const correctTierId = getAddressingTierId(mailingQty, isFlat)
    items = items.filter((item) => {
      if (item.category === "ADDRESSING") return item.id === correctTierId
      return true
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      )
    }
    return items
  }, [shape, mailingQty, search])

  const grouped = useMemo(() => groupByCategory(filteredItems), [filteredItems])

  // Price/qty helpers
  const getPrice = useCallback(
    (item: ServiceItem): number | null => {
      if (item.referToPostage) return null
      // Custom price always wins
      const custom = customPrices.get(item.id)
      if (custom !== undefined) return custom
      // Check if linked to a supplier item with a sell price set
      if (item.linkedSupplierId) {
        const supplierPrice = supplierPriceMap.get(item.linkedSupplierId)
        if (supplierPrice && supplierPrice > 0) return supplierPrice
      }
      if (item.defaultPrice !== null) return item.defaultPrice
      return null
    },
    [customPrices, supplierPriceMap]
  )

  const getQty = useCallback(
    (item: ServiceItem): number => customQtys.get(item.id) ?? getAutoQuantity(item, mailingQty),
    [customQtys, mailingQty]
  )

  const getTotal = useCallback(
    (item: ServiceItem): number | null => {
      const price = getPrice(item)
      if (price === null) return null
      return calculateItemAmount(item, price, mailingQty, getQty(item))
    },
    [getPrice, getQty, mailingQty]
  )

  const addToQuote = useCallback(
    (item: ServiceItem) => {
      const price = getPrice(item)
      if (price === null && !item.referToPostage) return
      const qty = getQty(item)
      const total = item.referToPostage ? 0 : calculateItemAmount(item, price!, mailingQty, qty)
      quote.addItem({
        category: "item",
        label: item.name,
        description: `${item.description}${item.referToPostage ? " (see postage tab)" : ""}`,
        amount: total,
        metadata: { serviceId: item.id, priceUnit: item.priceUnit, unitPrice: price ?? undefined, qty, mailingQty, shape },
      })
      setAddedItems((prev) => new Map(prev).set(item.id, { serviceId: item.id, qty, price: price ?? 0, total }))
    },
    [getPrice, getQty, mailingQty, quote, shape]
  )

  const addAllInferred = useCallback(() => {
    for (const inf of inferred) {
      if (addedItems.has(inf.id)) continue
      const catalogItem = SERVICE_CATALOG.find((s) => s.id === inf.id)
      if (!catalogItem || catalogItem.referToPostage) continue
      const price = getPrice(catalogItem)
      if (price === null) continue
      addToQuote(catalogItem)
    }
  }, [inferred, addedItems, getPrice, addToQuote])

  const inferredNotAdded = inferred.filter(
    (i) => !addedItems.has(i.id) && !SERVICE_CATALOG.find((s) => s.id === i.id)?.referToPostage
  ).length

  const runningTotal = useMemo(() => {
    let t = 0
    addedItems.forEach((entry) => { t += entry.total })
    return t
  }, [addedItems])

  // Needed items that are not yet added (for top strip)
  const neededNotAdded = useMemo(() => {
    return inferred
      .filter((inf) => !addedItems.has(inf.id))
      .map((inf) => {
        const item = SERVICE_CATALOG.find((s) => s.id === inf.id)
        return item ? { ...inf, item } : null
      })
      .filter(Boolean) as { id: string; reason: string; item: ServiceItem }[]
  }, [inferred, addedItems])

  // Auto-open first category with inferred items
  useEffect(() => {
    if (inferred.length === 0 || expandedCat) return
    for (const inf of inferred) {
      const item = SERVICE_CATALOG.find((s) => s.id === inf.id)
      if (item && !addedItems.has(item.id)) {
        setExpandedCat(item.category)
        break
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferred])

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-foreground">Services</h3>
          <span className="text-xs text-muted-foreground">
            {shape} {mailingQty > 0 && `${mailingQty.toLocaleString()} pcs`}
          </span>
          {mailService && SERVICE_LABELS[mailService] && (
            <span className="rounded-md bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2 py-0.5 text-xs font-semibold">
              {SERVICE_LABELS[mailService]}
            </span>
          )}
          {isPlasticOuter && (
            <span className="rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 text-xs font-semibold">
              Plastic
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {inferredNotAdded > 0 && (
            <Button variant="default" size="sm" onClick={addAllInferred} className="h-8 text-xs px-3 rounded-lg">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add All ({inferredNotAdded})
            </Button>
          )}
          {addedItems.size > 0 && (
            <span className="text-sm font-bold text-foreground bg-foreground/5 rounded-lg px-3 py-1">
              ${runningTotal.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* ── Detected items strip ── */}
      {neededNotAdded.length > 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground tracking-tight">
              Detected for this job
            </p>
            <span className="text-xs font-medium text-muted-foreground">
              {neededNotAdded.length} {neededNotAdded.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {neededNotAdded.map(({ id, reason, item }) => {
              const price = getPrice(item)
              const canAdd = price !== null && !item.referToPostage
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => canAdd ? addToQuote(item) : setExpandedCat(item.category)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all",
                    canAdd
                      ? "border-border bg-background text-foreground hover:bg-muted/60 hover:shadow-sm hover:-translate-y-px active:translate-y-0"
                      : "border-border/50 bg-muted/30 text-muted-foreground"
                  )}
                  title={reason}
                >
                  {canAdd && <Plus className="h-4 w-4 text-muted-foreground" />}
                  <span>{item.name}</span>
                  {canAdd && price !== null && (
                    <span className="text-muted-foreground font-bold text-xs bg-muted rounded-md px-1.5 py-0.5">
                      ${calculateItemAmount(item, price, mailingQty, getQty(item)).toFixed(2)}
                    </span>
                  )}
                  {item.referToPostage && <span className="text-muted-foreground text-xs italic">see rate</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9 text-sm"
        />
      </div>

      {/* ── Category Pills ── */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat]
          if (items.length === 0) return null
          const meta = CATEGORY_META[cat]
          const Icon = ICONS[meta.icon] || MoreHorizontal
          const addedInCat = items.filter((i) => addedItems.has(i.id)).length
          const neededInCat = items.filter((i) => inferredMap.has(i.id) && !addedItems.has(i.id)).length
          const isExpanded = expandedCat === cat

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setExpandedCat(isExpanded ? null : cat)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                isExpanded
                  ? cn("border-2 shadow-sm", PILL_COLORS[cat].active)
                  : "border-border bg-background hover:bg-accent/50",
                neededInCat > 0 && !isExpanded && "ring-2 ring-blue-300 dark:ring-blue-700"
              )}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{meta.label}</span>
              {neededInCat > 0 && (
                <span className="rounded-full bg-blue-500 text-white px-1.5 min-w-[18px] text-center text-[10px] font-bold leading-[18px]">
                  {neededInCat}
                </span>
              )}
              {addedInCat > 0 && (
                <span className={cn("rounded-full text-white px-1.5 min-w-[18px] text-center text-[10px] font-bold leading-[18px]", PILL_COLORS[cat].badge)}>
                  {addedInCat}
                </span>
              )}
              {isExpanded && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          )
        })}
      </div>

      {/* ── Expanded Category Panel ── */}
      {expandedCat && grouped[expandedCat] && grouped[expandedCat].length > 0 && (
        <div className={cn("rounded-xl border-2 overflow-hidden", PILL_COLORS[expandedCat].active.split(" ")[0])}>
          <div className={cn("px-4 py-2 flex items-center justify-between", PILL_COLORS[expandedCat].active.split(" ").slice(1).join(" "))}>
            <div className="flex items-center gap-2">
              {(() => { const I = ICONS[CATEGORY_META[expandedCat].icon] || MoreHorizontal; return <I className="h-4 w-4 text-muted-foreground" /> })()}
              <span className="text-sm font-bold text-foreground">
                {CATEGORY_META[expandedCat].label}
              </span>
              <span className="text-xs text-muted-foreground">
                {grouped[expandedCat].length} item{grouped[expandedCat].length !== 1 ? "s" : ""}
              </span>
            </div>
            <button type="button" onClick={() => setExpandedCat(null)} className="p-1 rounded-md hover:bg-background/50">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="divide-y divide-border/50 bg-background">
            {grouped[expandedCat].map((item) => (
              <ServiceRow
                key={item.id}
                item={item}
                mailingQty={mailingQty}
                isAdded={addedItems.has(item.id)}
                inferredReason={inferredMap.get(item.id) || null}
  customPrice={customPrices.get(item.id)}
  customQty={customQtys.get(item.id)}
  resolvedPrice={getPrice(item)}
  total={getTotal(item)}
                onSetPrice={(p) => setCustomPrices((prev) => new Map(prev).set(item.id, p))}
                onSetQty={(q) => setCustomQtys((prev) => new Map(prev).set(item.id, q))}
                onAdd={() => addToQuote(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Added items summary ── */}
      {addedItems.size > 0 && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/40 dark:bg-emerald-950/10 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Added ({addedItems.size})
            </span>
            <span className="text-sm font-bold text-foreground">${runningTotal.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(addedItems.entries()).map(([id, entry]) => {
              const item = SERVICE_CATALOG.find((s) => s.id === id)
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 px-2 py-1 text-xs font-medium"
                >
                  <Check className="h-3 w-3" />
                  {item?.name || id}
                  {entry.total > 0 && <span className="font-semibold text-emerald-600">${entry.total.toFixed(2)}</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Item Row ────────────────────────────────────────────

interface ServiceRowProps {
  item: ServiceItem
  mailingQty: number
  isAdded: boolean
  inferredReason: string | null
  customPrice: number | undefined
  customQty: number | undefined
  resolvedPrice: number | null
  total: number | null
  onSetPrice: (p: number) => void
  onSetQty: (q: number) => void
  onAdd: () => void
}

function ServiceRow({
  item,
  mailingQty,
  isAdded,
  inferredReason,
  customPrice,
  customQty,
  resolvedPrice,
  total,
  onSetPrice,
  onSetQty,
  onAdd,
}: ServiceRowProps) {
  const isInferred = !!inferredReason
  const effectivePrice = item.referToPostage ? null : resolvedPrice
  const needsCustomPrice = !item.referToPostage && effectivePrice === null
  const effectiveQty = customQty ?? getAutoQuantity(item, mailingQty)

  const displayTotal = item.referToPostage
    ? null
    : effectivePrice !== null
    ? calculateItemAmount(item, effectivePrice, mailingQty, effectiveQty)
    : null

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 transition-colors",
        isAdded
          ? "bg-emerald-50/50 dark:bg-emerald-950/10"
          : isInferred
          ? "bg-blue-50/60 dark:bg-blue-950/10"
          : "hover:bg-accent/30"
      )}
    >
      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-sm font-medium truncate",
            isAdded && "text-emerald-700 dark:text-emerald-400",
            isInferred && !isAdded && "text-blue-700 dark:text-blue-400"
          )}>
            {item.name}
          </span>
          {isInferred && !isAdded && (
            <span className="shrink-0 text-[10px] font-bold rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 cursor-help" title={inferredReason || ""}>
              NEEDED
            </span>
          )}
          {isAdded && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
        </div>
      </div>

      {/* Price */}
      <div className="w-20 shrink-0">
        {item.referToPostage ? (
          <span className="text-xs text-teal-600 dark:text-teal-400 font-semibold">See Rate</span>
        ) : (
          <Input
            type="number"
            step="0.01"
            placeholder="Price"
            className="h-8 text-sm text-right px-2 w-full"
            value={effectivePrice ?? ""}
            onChange={(e) => onSetPrice(parseFloat(e.target.value) || 0)}
          />
        )}
      </div>

      {/* Unit */}
      <span className="w-16 shrink-0 text-xs text-muted-foreground text-center">
        {formatPriceUnit(item.priceUnit)}
      </span>

      {/* Qty */}
      <div className="w-14 shrink-0">
        {item.priceUnit === "job" || item.priceUnit === "list" || item.priceUnit === "delivery" ? (
          <Input
            type="number"
            min={1}
            className="h-8 text-sm text-center px-1 w-full"
            value={effectiveQty}
            onChange={(e) => onSetQty(parseInt(e.target.value) || 1)}
          />
        ) : (
          <span className="block text-center text-xs text-muted-foreground">
            {item.priceUnit === "1000"
              ? `x${Math.ceil(mailingQty / 1000)}`
              : `x${mailingQty > 0 ? mailingQty.toLocaleString() : "--"}`}
          </span>
        )}
      </div>

      {/* Total */}
      <div className="w-20 shrink-0 text-right">
        {displayTotal !== null ? (
          <span className="text-sm font-bold">${displayTotal.toFixed(2)}</span>
        ) : item.referToPostage ? (
          <span className="text-xs text-muted-foreground">--</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">{item.linkedSupplierId ? "set in Supplies" : "set price"}</span>
        )}
      </div>

      {/* Add */}
      <div className="w-8 shrink-0 flex justify-center">
        {isAdded ? (
          <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Check className="h-4 w-4 text-emerald-600" />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={needsCustomPrice || item.referToPostage}
            onClick={onAdd}
            title={needsCustomPrice ? "Enter a price first" : "Add to quote"}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

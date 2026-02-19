"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
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
  ChevronRight,
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
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Icon map ────────────────────────────────────────────
const ICONS: Record<string, React.ElementType> = {
  printer: Printer,
  list: List,
  "at-sign": AtSign,
  cpu: Cpu,
  inbox: Inbox,
  tag: Tag,
  stamp: Stamp,
  truck: Truck,
  more: MoreHorizontal,
}

// ─── Category colors ─────────────────────────────────────
const CAT_COLORS: Record<ServiceCategory, string> = {
  PRINTING:      "border-l-sky-500",
  LIST_WORK:     "border-l-violet-500",
  ADDRESSING:    "border-l-emerald-500",
  COMPUTER_WORK: "border-l-amber-500",
  INSERTING:     "border-l-rose-500",
  LABELING:      "border-l-indigo-500",
  POSTAGE:       "border-l-teal-500",
  DELIVERY:      "border-l-orange-500",
  MISC:          "border-l-neutral-500",
}

const CAT_BG: Record<ServiceCategory, string> = {
  PRINTING:      "bg-sky-50 dark:bg-sky-950/20",
  LIST_WORK:     "bg-violet-50 dark:bg-violet-950/20",
  ADDRESSING:    "bg-emerald-50 dark:bg-emerald-950/20",
  COMPUTER_WORK: "bg-amber-50 dark:bg-amber-950/20",
  INSERTING:     "bg-rose-50 dark:bg-rose-950/20",
  LABELING:      "bg-indigo-50 dark:bg-indigo-950/20",
  POSTAGE:       "bg-teal-50 dark:bg-teal-950/20",
  DELIVERY:      "bg-orange-50 dark:bg-orange-950/20",
  MISC:          "bg-neutral-50 dark:bg-neutral-950/20",
}

// ─── Added Items Tracker ─────────────────────────────────
interface AddedEntry {
  serviceId: string
  qty: number
  price: number
  total: number
}

// ─── Main Component ──────────────────────────────────────

// Map USPS service codes to catalog postage item IDs
const SERVICE_TO_POSTAGE: Record<string, string> = {
  FCM_COMM: "postage-1st",
  FCM_RETAIL: "postage-single",
  MKT_COMM: "postage-mkt",
  MKT_NP: "postage-np",
}

const SERVICE_LABELS: Record<string, string> = {
  FCM_COMM: "First Class Presort",
  FCM_RETAIL: "First Class Retail",
  MKT_COMM: "Marketing Mail",
  MKT_NP: "Non-Profit",
  PS: "Parcel Select",
  MM: "Media Mail",
  LM: "Library Mail",
  BPM: "Bound Printed Matter",
}

export function ServiceBuilder() {
  const mailing = useMailing()
  const quote = useQuote()
  const shape = mailing.shape || "LETTER"
  const mailingQty = mailing.quantity || 0
  const mailService = mailing.mailService || ""
  const activePostageId = SERVICE_TO_POSTAGE[mailService] || ""
  const isPlasticOuter = mailing.outerPiece?.envelopeKind === "plastic"

  // Track which items have been added (by service catalog ID)
  const [addedItems, setAddedItems] = useState<Map<string, AddedEntry>>(new Map())
  // Track open/closed sections
  const [openSections, setOpenSections] = useState<Set<ServiceCategory>>(() => {
    const initial = new Set<ServiceCategory>()
    CATEGORY_ORDER.forEach((cat) => {
      if (CATEGORY_META[cat].defaultOpen) initial.add(cat)
    })
    return initial
  })
  // Custom prices for items with null defaultPrice
  const [customPrices, setCustomPrices] = useState<Map<string, number>>(new Map())
  // Custom quantities
  const [customQtys, setCustomQtys] = useState<Map<string, number>>(new Map())
  // Search
  const [search, setSearch] = useState("")

  // ── Smart inference: detect which items are definitely needed ──
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

  // Map for quick lookup: itemId -> reason
  const inferredMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of inferred) m.set(i.id, i.reason)
    return m
  }, [inferred])

  // Auto-expand sections that have inferred items
  useEffect(() => {
    if (inferred.length === 0) return
    const catsNeeded = new Set<ServiceCategory>()
    for (const inf of inferred) {
      const item = SERVICE_CATALOG.find((s) => s.id === inf.id)
      if (item) catsNeeded.add(item.category)
    }
    setOpenSections((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const cat of catsNeeded) {
        if (!next.has(cat)) { next.add(cat); changed = true }
      }
      return changed ? next : prev
    })
  }, [inferred])

  // (Section auto-expansion is handled by the inferred items useEffect above)

  // Filter by shape and search
  const filteredItems = useMemo(() => {
    let items = filterByShape(SERVICE_CATALOG, shape)

    // For addressing, only show the correct tier
    const isFlat = shape.toUpperCase() === "FLAT" || shape.toUpperCase() === "PARCEL"
    const correctTierId = getAddressingTierId(mailingQty, isFlat)
    items = items.filter((item) => {
      if (item.category === "ADDRESSING") {
        return item.id === correctTierId
      }
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

  // Toggle section
  const toggleSection = useCallback((cat: ServiceCategory) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // Get effective price for an item
  const getPrice = useCallback(
    (item: ServiceItem): number | null => {
      if (item.referToPostage) return null
      if (item.defaultPrice !== null) return customPrices.get(item.id) ?? item.defaultPrice
      return customPrices.get(item.id) ?? null
    },
    [customPrices]
  )

  // Get effective quantity
  const getQty = useCallback(
    (item: ServiceItem): number => {
      return customQtys.get(item.id) ?? getAutoQuantity(item, mailingQty)
    },
    [customQtys, mailingQty]
  )

  // Calculate total for display
  const getTotal = useCallback(
    (item: ServiceItem): number | null => {
      const price = getPrice(item)
      if (price === null) return null
      const qty = getQty(item)
      return calculateItemAmount(item, price, mailingQty, qty)
    },
    [getPrice, getQty, mailingQty]
  )

  // Add item to quote
  const addToQuote = useCallback(
    (item: ServiceItem) => {
      const price = getPrice(item)
      if (price === null && !item.referToPostage) return // need custom price
      const qty = getQty(item)
      const total = item.referToPostage ? 0 : calculateItemAmount(item, price!, mailingQty, qty)

      quote.addItem({
        category: "item",
        label: item.name,
        description: `${item.description}${item.referToPostage ? " (see postage tab)" : ""}`,
        amount: total,
        metadata: {
          serviceId: item.id,
          priceUnit: item.priceUnit,
          unitPrice: price ?? undefined,
          qty,
          mailingQty,
          shape,
        },
      })

      setAddedItems((prev) => {
        const next = new Map(prev)
        next.set(item.id, { serviceId: item.id, qty, price: price ?? 0, total })
        return next
      })
    },
    [getPrice, getQty, mailingQty, quote, shape]
  )

  // Add all inferred items at once
  const addAllInferred = useCallback(() => {
    for (const inf of inferred) {
      if (addedItems.has(inf.id)) continue
      const catalogItem = SERVICE_CATALOG.find((s) => s.id === inf.id)
      if (!catalogItem) continue
      if (catalogItem.referToPostage) continue // postage gets its price from calculator
      const price = getPrice(catalogItem)
      if (price === null) continue
      addToQuote(catalogItem)
    }
  }, [inferred, addedItems, getPrice, addToQuote])

  const inferredNotAdded = inferred.filter(
    (i) => !addedItems.has(i.id) && !SERVICE_CATALOG.find((s) => s.id === i.id)?.referToPostage
  ).length

  // Running total of added items
  const runningTotal = useMemo(() => {
    let t = 0
    addedItems.forEach((entry) => { t += entry.total })
    return t
  }, [addedItems])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Services & Labor</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{shape} mail -- {mailingQty > 0 ? `${mailingQty.toLocaleString()} pcs` : "set qty in planner"}</span>
            {mailService && SERVICE_LABELS[mailService] && (
              <span className="inline-flex items-center rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2 py-0.5 text-[10px] font-semibold">
                {SERVICE_LABELS[mailService]}
              </span>
            )}
            {isPlasticOuter && (
              <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 text-[10px] font-semibold">
                Plastic Outer
              </span>
            )}
            {inferred.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[10px] font-semibold">
                {inferred.length} items detected
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inferredNotAdded > 0 && (
            <Button variant="default" size="sm" onClick={addAllInferred} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add All Needed ({inferredNotAdded})
            </Button>
          )}
          {addedItems.size > 0 && (
            <span className="text-xs font-medium text-foreground bg-foreground/5 rounded-md px-2 py-1">
              {addedItems.size} added -- ${runningTotal.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Category Sections */}
      <div className="space-y-1">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat]
          if (items.length === 0) return null
          const meta = CATEGORY_META[cat]
          const isOpen = openSections.has(cat)
          const Icon = ICONS[meta.icon] || MoreHorizontal
          const addedInCategory = items.filter((i) => addedItems.has(i.id)).length

          return (
            <div key={cat} className={cn("border rounded-lg overflow-hidden", CAT_COLORS[cat], "border-l-[3px]")}>
              {/* Section Header */}
              <button
                type="button"
                onClick={() => toggleSection(cat)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
                  isOpen ? CAT_BG[cat] : "hover:bg-accent/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">{meta.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </span>
                  {(() => {
                    const inferredInCat = items.filter((i) => inferredMap.has(i.id) && !addedItems.has(i.id)).length
                    if (inferredInCat > 0) return (
                      <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                        {inferredInCat} needed
                      </span>
                    )
                    return null
                  })()}
                  {addedInCategory > 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      {addedInCategory} added
                    </span>
                  )}
                </div>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {/* Items */}
              {isOpen && (
                <div className="divide-y divide-border/50">
                  {items.map((item) => (
                    <ServiceRow
                      key={item.id}
                      item={item}
                      mailingQty={mailingQty}
                      isAdded={addedItems.has(item.id)}
                      isActivePostage={item.id === activePostageId}
                      isFlaggedClearBag={isPlasticOuter && (item.id === "insert-clear-bags" || item.id === "clear-bags-item")}
                      inferredReason={inferredMap.get(item.id) || null}
                      customPrice={customPrices.get(item.id)}
                      customQty={customQtys.get(item.id)}
                      total={getTotal(item)}
                      onSetPrice={(p) =>
                        setCustomPrices((prev) => new Map(prev).set(item.id, p))
                      }
                      onSetQty={(q) =>
                        setCustomQtys((prev) => new Map(prev).set(item.id, q))
                      }
                      onAdd={() => addToQuote(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Item Row ────────────────────────────────────────────

interface ServiceRowProps {
  item: ServiceItem
  mailingQty: number
  isAdded: boolean
  isActivePostage: boolean
  isFlaggedClearBag: boolean
  inferredReason: string | null
  customPrice: number | undefined
  customQty: number | undefined
  total: number | null
  onSetPrice: (p: number) => void
  onSetQty: (q: number) => void
  onAdd: () => void
}

function ServiceRow({
  item,
  mailingQty,
  isAdded,
  isActivePostage,
  isFlaggedClearBag,
  inferredReason,
  customPrice,
  customQty,
  total,
  onSetPrice,
  onSetQty,
  onAdd,
}: ServiceRowProps) {
  const isInferred = !!inferredReason
  const effectivePrice = item.referToPostage
    ? null
    : item.defaultPrice !== null
    ? customPrice ?? item.defaultPrice
    : customPrice ?? null
  const needsCustomPrice = !item.referToPostage && item.defaultPrice === null && customPrice === undefined
  const effectiveQty = customQty ?? getAutoQuantity(item, mailingQty)

  // Show computed total inline
  const displayTotal = item.referToPostage
    ? null
    : effectivePrice !== null
    ? calculateItemAmount(item, effectivePrice, mailingQty, effectiveQty)
    : null

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-xs transition-colors",
        isAdded
          ? "bg-emerald-50/50 dark:bg-emerald-950/10"
          : isInferred
          ? "bg-blue-50/80 dark:bg-blue-950/20 border-l-2 border-l-blue-500"
          : "hover:bg-accent/30"
      )}
    >
      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "font-medium truncate",
            isAdded && "text-emerald-700 dark:text-emerald-400",
            isInferred && !isAdded && "text-blue-700 dark:text-blue-400"
          )}>
            {item.name}
          </span>
          {isInferred && !isAdded && (
            <span
              className="shrink-0 text-[9px] font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 cursor-help"
              title={inferredReason || ""}
            >
              NEEDED
            </span>
          )}
          {isAdded && (
            <span className="shrink-0 text-[9px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5">
              ADDED
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          {isInferred && !isAdded ? (
            <span className="text-blue-600 dark:text-blue-400">{inferredReason}</span>
          ) : (
            item.description
          )}
        </p>
      </div>

      {/* Price */}
      <div className="w-20 shrink-0">
        {item.referToPostage ? (
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">See Postage</span>
        ) : item.defaultPrice !== null ? (
          <Input
            type="number"
            step="0.01"
            className="h-6 text-xs text-right px-1.5 w-full"
            value={effectivePrice ?? ""}
            onChange={(e) => onSetPrice(parseFloat(e.target.value) || 0)}
          />
        ) : (
          <Input
            type="number"
            step="0.01"
            placeholder="Price"
            className="h-6 text-xs text-right px-1.5 w-full"
            value={customPrice ?? ""}
            onChange={(e) => onSetPrice(parseFloat(e.target.value) || 0)}
          />
        )}
      </div>

      {/* Unit */}
      <span className="w-16 shrink-0 text-[10px] text-muted-foreground text-center">
        {formatPriceUnit(item.priceUnit)}
      </span>

      {/* Qty */}
      <div className="w-14 shrink-0">
        {item.priceUnit === "job" || item.priceUnit === "list" || item.priceUnit === "delivery" ? (
          <Input
            type="number"
            min={1}
            className="h-6 text-xs text-center px-1 w-full"
            value={effectiveQty}
            onChange={(e) => onSetQty(parseInt(e.target.value) || 1)}
          />
        ) : (
          <span className="block text-center text-[10px] text-muted-foreground">
            {item.priceUnit === "1000"
              ? `x${Math.ceil(mailingQty / 1000)}`
              : `x${mailingQty > 0 ? mailingQty.toLocaleString() : "--"}`}
          </span>
        )}
      </div>

      {/* Total */}
      <div className="w-16 shrink-0 text-right">
        {displayTotal !== null ? (
          <span className="text-xs font-semibold">${displayTotal.toFixed(2)}</span>
        ) : item.referToPostage ? (
          <span className="text-[10px] text-muted-foreground">--</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Enter price</span>
        )}
      </div>

      {/* Add button */}
      <div className="w-8 shrink-0 flex justify-center">
        {isAdded ? (
          <div className="h-6 w-6 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Check className="h-3 w-3 text-emerald-600" />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={needsCustomPrice || item.referToPostage}
            onClick={onAdd}
            title={needsCustomPrice ? "Enter a price first" : "Add to quote"}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

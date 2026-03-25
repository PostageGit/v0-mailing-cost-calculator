"use client"

import { useMemo, useCallback, useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { formatCurrency } from "@/lib/pricing"
import type { LaborItem, MailClassSetting } from "@/components/mail-class-settings"
import { perUnitLabel } from "@/components/mail-class-settings"
import { Input } from "@/components/ui/input"
import {
  Plus,
  AlertCircle,
  Loader2,
  Settings,
  Lock,
  Hash,
  DollarSign,
  Check,
  Package,
  ShoppingCart,
} from "lucide-react"

const SWR_KEY = "/api/mail-class-settings"
const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** Calculate cost for a single labor item given a quantity */
function calcItemCost(item: LaborItem, qty: number): number {
  const rate = item.rate
  switch (item.per_unit) {
    case "per_piece":
      return rate * qty
    case "per_1000":
      return rate * (qty / 1000)
    case "per_500":
      return rate * (qty / 500)
    case "per_job":
      return rate
    default:
      return rate
  }
}

export function LaborCalculator({ standalone = false }: { standalone?: boolean } = {}) {
  const mailing = useMailing()
  const quote = useQuote()
  const { data: allSettings, isLoading } = useSWR<MailClassSetting[]>(
    SWR_KEY,
    fetcher
  )

  // Find settings matching the current USPS class
  const classSetting = useMemo(() => {
    if (!allSettings) return null
    return (
      allSettings.find(
        (s) => s.class_name.toLowerCase() === mailing.className.toLowerCase()
      ) ?? null
    )
  }, [allSettings, mailing.className])

  // Track which optional items the user has toggled on
  const [optionalToggles, setOptionalToggles] = useState<
    Record<string, boolean>
  >({})

  const isItemActive = (item: LaborItem) => {
    if (!item.enabled) return false
    if (item.required) return true
    return optionalToggles[item.name] ?? false
  }

  const toggleOptional = (name: string) => {
    setOptionalToggles((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  // Calculate all costs
  const breakdown = useMemo(() => {
    if (!classSetting) return []
    return classSetting.items
      .filter((item) => item.enabled)
      .map((item) => ({
        ...item,
        active: isItemActive(item),
        cost: isItemActive(item) ? calcItemCost(item, mailing.quantity) : 0,
      }))
  }, [classSetting, mailing.quantity, optionalToggles])

  const totalLabor = useMemo(
    () => breakdown.reduce((sum, b) => sum + b.cost, 0),
    [breakdown]
  )

  const [addedToQuote, setAddedToQuote] = useState(false)

  const handleAddToQuote = useCallback(() => {
    if (!classSetting || totalLabor === 0) return

    const activeItems = breakdown.filter((b) => b.active && b.cost > 0)
    const parts = activeItems.map((b) => b.name).join(", ")
    const desc = `${mailing.className} - ${mailing.quantity.toLocaleString()} pcs - ${parts}`

    quote.addItem({
      category: "listwork",
      label: `Labor: ${mailing.className} Class`,
      description: desc,
      amount: Math.round(totalLabor * 100) / 100,
    })

    setAddedToQuote(true)
    setTimeout(() => setAddedToQuote(false), 2000)
  }, [classSetting, breakdown, totalLabor, mailing, quote])

  // ---------- Related items for this labor class ----------
  interface DbItem {
    id: string; name: string; description: string; sku: string
    unit_cost: number; unit_label: string; category: string; labor_class_id: string | null
  }
  const classId = classSetting?.id
  const { data: relatedItems } = useSWR<DbItem[]>(
    classId ? `/api/items?labor_class_id=${classId}` : null,
    fetcher
  )
  const [itemQtys, setItemQtys] = useState<Record<string, number>>({})
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set())

  const getItemQty = (id: string) => itemQtys[id] ?? 1
  const setItemQty = (id: string, v: number) => setItemQtys((prev) => ({ ...prev, [id]: Math.max(1, v) }))

  const computeItemCost = (item: DbItem, qty: number) => {
    const cost = Number(item.unit_cost)
    switch (item.unit_label) {
      case "per 1000": return cost * (qty / 1000)
      case "per 500": return cost * (qty / 500)
      case "flat": return cost
      default: return cost * qty
    }
  }

  const handleAddItem = useCallback((item: DbItem) => {
    const qty = itemQtys[item.id] ?? 1
    const amount = computeItemCost(item, qty)
    const qtyLabel = item.unit_label === "flat" ? "" : ` x ${qty.toLocaleString()}`
    quote.addItem({
      category: "item",
      label: `${item.name}${qtyLabel}`,
      description: [
        item.sku ? `SKU: ${item.sku}` : "",
        `${formatCurrency(Number(item.unit_cost))} / ${item.unit_label}`,
        item.description || "",
      ].filter(Boolean).join(" | "),
      amount,
    })
    setAddedItems((prev) => new Set(prev).add(item.id))
    setTimeout(() => setAddedItems((prev) => { const n = new Set(prev); n.delete(item.id); return n }), 1500)
  }, [itemQtys, quote])

  // All available classes for the badge list
  const availableClasses = allSettings?.map((s) => s.class_name) ?? []

  return (
    <div className="flex flex-col gap-5">
      {/* Header card with class selection info */}
      <Card className="border-border rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">Labor & List Work</CardTitle>
          <CardDescription className="text-sm text-muted-foreground text-pretty">
            Based on the mail class and quantity from USPS Postage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Current context from USPS calc */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 rounded-lg">
            <div className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {mailing.quantity.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">pieces</span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs font-semibold">
                {mailing.className}
              </Badge>
              <span className="text-xs text-muted-foreground">
                mail class
              </span>
            </div>
            {availableClasses.length > 0 && (
              <>
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {availableClasses.length} class
                    {availableClasses.length !== 1 ? "es" : ""} configured
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading labor settings...</span>
        </div>
      )}

      {/* No matching class */}
      {!isLoading && !classSetting && (
        <Card className="border-dashed border-amber-500/50">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
            <AlertCircle className="h-8 w-8 text-amber-500 opacity-60" />
            <p className="text-sm font-medium text-foreground text-center text-balance">
              No labor settings found for{" "}
              <span className="font-bold">{mailing.className}</span>
            </p>
            <p className="text-xs text-muted-foreground text-center text-pretty max-w-md">
              Open the Settings panel (gear icon in the header) and add a mail
              class named &quot;{mailing.className}&quot; with your labor rates.
              Available classes:{" "}
              {availableClasses.length > 0
                ? availableClasses.join(", ")
                : "none"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Labor breakdown */}
      {classSetting && !isLoading && (
        <Card className="border-border rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">
              {classSetting.class_name} Labor Breakdown
            </CardTitle>
            {classSetting.notes && (
              <CardDescription className="text-xs italic">
                {classSetting.notes}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* Items */}
            {breakdown.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  item.active
                    ? "bg-card border-border"
                    : "bg-muted/20 border-transparent opacity-60"
                }`}
              >
                {/* Toggle for optional items */}
                <div className="w-9 flex-shrink-0 flex justify-center">
                  {item.required ? (
                    <Lock className="h-4 w-4 text-primary" />
                  ) : (
                    <Switch
                      checked={item.active}
                      onCheckedChange={() => toggleOptional(item.name)}
                      className="scale-90"
                    />
                  )}
                </div>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {item.name}
                    </span>
                    {item.required && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary"
                      >
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      {formatCurrency(item.rate)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {perUnitLabel(item.per_unit)}
                    </span>
                    {item.note && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        - {item.note}
                      </span>
                    )}
                  </div>
                </div>

                {/* Calculated cost */}
                <div className="flex-shrink-0 text-right">
                  <span
                    className={`text-sm font-mono font-semibold tabular-nums ${
                      item.active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item.active ? formatCurrency(item.cost) : "--"}
                  </span>
                </div>
              </div>
            ))}

            <Separator />

            {/* Total */}
            <div className="flex items-center justify-between px-1">
              <span className="text-base font-semibold text-foreground">
                Labor Total
              </span>
              <span className="text-xl font-bold font-mono text-foreground tabular-nums">
                {formatCurrency(totalLabor)}
              </span>
            </div>

            {/* Per piece */}
            {mailing.quantity > 0 && totalLabor > 0 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  Per piece labor
                </span>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {formatCurrency(totalLabor / mailing.quantity)}
                </span>
              </div>
            )}

            {/* Add to quote */}
            <Button
              className="gap-2 mt-1 rounded-full bg-foreground text-background hover:bg-foreground/90"
              onClick={handleAddToQuote}
              disabled={totalLabor === 0 || addedToQuote}
            >
              {addedToQuote ? (
                <>
                  <Check className="h-4 w-4" />
                  Added
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Labor to Quote
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Related Items for this labor class */}
      {relatedItems && relatedItems.length > 0 && (
        <Card className="border-border rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Related Items
            </CardTitle>
            <CardDescription className="text-xs">
              Items linked to the {classSetting?.class_name} labor class. Add them individually to your quote.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {relatedItems.map((item) => {
              const qty = getItemQty(item.id)
              const total = computeItemCost(item, qty)
              const wasAdded = addedItems.has(item.id)
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">{item.category}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatCurrency(Number(item.unit_cost))} / {item.unit_label}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.unit_label !== "flat" && (
                      <Input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => setItemQty(item.id, parseInt(e.target.value) || 1)}
                        className="h-7 text-xs w-20 text-right"
                      />
                    )}
                    <span className="text-xs font-semibold text-foreground w-16 text-right">
                      {formatCurrency(total)}
                    </span>
                    <Button
                      size="sm"
                      className={`h-7 text-xs gap-1 min-w-[60px] transition-colors ${
                        wasAdded
                          ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                      onClick={() => handleAddItem(item)}
                    >
                      {wasAdded ? (
                        <><Check className="h-3 w-3" /> Added</>
                      ) : (
                        <><ShoppingCart className="h-3 w-3" /> Add</>
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

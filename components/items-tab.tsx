"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuote } from "@/lib/quote-context"
import { formatCurrency } from "@/lib/pricing"
import { Package, Plus, Search, Check, Loader2, ShoppingCart } from "lucide-react"

interface DbItem {
  id: string
  name: string
  description: string
  sku: string
  unit_cost: number
  unit_label: string
  category: string
  labor_class_id: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function ItemsTab() {
  const { data: items, isLoading } = useSWR<DbItem[]>("/api/items", fetcher)
  const quote = useQuote()

  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  // Track quantities per item id
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  // Track which items were just added (for feedback)
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set())

  const categories = useMemo(() => {
    if (!items) return []
    return Array.from(new Set(items.map((i) => i.category))).sort()
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return []
    return items.filter((item) => {
      if (filterCategory !== "all" && item.category !== filterCategory) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, filterCategory, search])

  const getQty = (id: string) => quantities[id] ?? 1
  const setQty = (id: string, v: number) => setQuantities((prev) => ({ ...prev, [id]: Math.max(1, v) }))

  const computeCost = (item: DbItem, qty: number) => {
    const cost = Number(item.unit_cost)
    switch (item.unit_label) {
      case "per 1000": return cost * (qty / 1000)
      case "per 500": return cost * (qty / 500)
      case "flat": return cost
      default: return cost * qty
    }
  }

  const addToQuote = (item: DbItem) => {
    const qty = getQty(item.id)
    const amount = computeCost(item, qty)
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
    setJustAdded((prev) => new Set(prev).add(item.id))
    setTimeout(() => setJustAdded((prev) => { const n = new Set(prev); n.delete(item.id); return n }), 1500)
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-chart-5/10">
            <Package className="h-4 w-4 text-chart-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Items & Supplies</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Browse your item catalog and add to the current quote.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Search + filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by name, SKU..."
              className="h-8 text-xs pl-8"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 text-xs w-[150px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading items...</span>
          </div>
        )}

        {/* Items grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {filtered.map((item) => {
              const qty = getQty(item.id)
              const total = computeCost(item, qty)
              const wasAdded = justAdded.has(item.id)
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">{item.category}</Badge>
                      {item.sku && <span className="text-[9px] text-muted-foreground shrink-0">SKU: {item.sku}</span>}
                    </div>
                    {item.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatCurrency(Number(item.unit_cost))} / {item.unit_label}
                    </p>
                  </div>

                  {/* Qty + total */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.unit_label !== "flat" && (
                      <Input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => setQty(item.id, parseInt(e.target.value) || 1)}
                        className="h-7 text-xs w-20 text-right"
                      />
                    )}
                    <span className="text-xs font-semibold text-foreground w-20 text-right">
                      {formatCurrency(total)}
                    </span>
                    <Button
                      size="sm"
                      className={`h-7 text-xs gap-1 min-w-[70px] transition-colors ${
                        wasAdded
                          ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                      onClick={() => addToQuote(item)}
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
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No items found</p>
            <p className="text-xs mt-1">
              {items && items.length > 0
                ? "Try adjusting your search or filter."
                : "Go to Settings > Items to build your catalog."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

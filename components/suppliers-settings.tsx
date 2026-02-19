"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, ExternalLink, Save, Package } from "lucide-react"
import {
  type Supplier,
  type SupplyItem,
  type SupplyCategory,
  type SuppliersConfig,
  SUPPLY_CATEGORY_LABELS,
  DEFAULT_SUPPLIERS_CONFIG,
  computeSellPrice,
} from "@/lib/suppliers"

export function SuppliersSettings() {
  const [config, setConfig] = useState<SuppliersConfig>(DEFAULT_SUPPLIERS_CONFIG)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load from app_settings
  useEffect(() => {
    fetch("/api/app-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.suppliers_config) {
          setConfig(data.suppliers_config as SuppliersConfig)
        }
      })
      .catch(() => {})
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppliers_config: config }),
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [config])

  const update = useCallback((fn: (c: SuppliersConfig) => SuppliersConfig) => {
    setConfig((prev) => fn(prev))
    setDirty(true)
  }, [])

  // ── Supplier CRUD ──
  const addSupplier = () => {
    const id = `sup-${Date.now()}`
    update((c) => ({
      ...c,
      suppliers: [...c.suppliers, { id, name: "", website: "" }],
    }))
  }

  const updateSupplier = (id: string, patch: Partial<Supplier>) => {
    update((c) => ({
      ...c,
      suppliers: c.suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }

  const deleteSupplier = (id: string) => {
    update((c) => ({
      ...c,
      suppliers: c.suppliers.filter((s) => s.id !== id),
      supplyItems: c.supplyItems.filter((i) => i.supplierId !== id),
    }))
  }

  // ── Supply Item CRUD ──
  const addItem = (supplierId: string) => {
    const id = `item-${Date.now()}`
    update((c) => ({
      ...c,
      supplyItems: [
        ...c.supplyItems,
        {
          id,
          supplierId,
          sku: "",
          name: "",
          category: "other" as SupplyCategory,
          costPerUnit: 0,
          markupPercent: 0,
          sellPrice: 0,
        },
      ],
    }))
  }

  const updateItem = (id: string, patch: Partial<SupplyItem>) => {
    update((c) => ({
      ...c,
      supplyItems: c.supplyItems.map((item) => {
        if (item.id !== id) return item
        const merged = { ...item, ...patch }
        // Auto-compute sell price when cost or markup changes
        if ("costPerUnit" in patch || "markupPercent" in patch) {
          merged.sellPrice = computeSellPrice(merged.costPerUnit, merged.markupPercent)
        }
        return merged
      }),
    }))
  }

  const deleteItem = (id: string) => {
    update((c) => ({
      ...c,
      supplyItems: c.supplyItems.filter((i) => i.id !== id),
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Suppliers & Supplies</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage suppliers, track costs, and set markup for supply items.
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {/* Suppliers */}
      {config.suppliers.map((supplier) => {
        const items = config.supplyItems.filter((i) => i.supplierId === supplier.id)
        return (
          <div key={supplier.id} className="rounded-xl border bg-card">
            {/* Supplier Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={supplier.name}
                onChange={(e) => updateSupplier(supplier.id, { name: e.target.value })}
                placeholder="Supplier name..."
                className="h-7 text-sm font-semibold border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 flex-1"
              />
              <Input
                value={supplier.website || ""}
                onChange={(e) => updateSupplier(supplier.id, { website: e.target.value })}
                placeholder="Website..."
                className="h-7 text-xs border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 w-[160px] text-muted-foreground"
              />
              {supplier.website && (
                <a
                  href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => deleteSupplier(supplier.id)}
                className="text-muted-foreground hover:text-destructive ml-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Items Table */}
            <div className="divide-y divide-border/50">
              {/* Table header */}
              <div className="grid grid-cols-[80px_1fr_110px_70px_70px_70px_28px] gap-2 px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/20">
                <span>SKU</span>
                <span>Name</span>
                <span>Category</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Markup%</span>
                <span className="text-right">Sell</span>
                <span />
              </div>

              {/* Item rows */}
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[80px_1fr_110px_70px_70px_70px_28px] gap-2 px-4 py-1 items-center"
                >
                  <Input
                    value={item.sku}
                    onChange={(e) => updateItem(item.id, { sku: e.target.value })}
                    className="h-7 text-xs px-1.5"
                    placeholder="SKU"
                  />
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    className="h-7 text-xs px-1.5"
                    placeholder="Item name..."
                  />
                  <Select
                    value={item.category}
                    onValueChange={(v) => updateItem(item.id, { category: v as SupplyCategory })}
                  >
                    <SelectTrigger className="h-7 text-[10px] px-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUPPLY_CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={item.costPerUnit || ""}
                    onChange={(e) =>
                      updateItem(item.id, { costPerUnit: parseFloat(e.target.value) || 0 })
                    }
                    className="h-7 text-xs px-1.5 text-right"
                    placeholder="0.00"
                    step="0.01"
                  />
                  <Input
                    type="number"
                    value={item.markupPercent || ""}
                    onChange={(e) =>
                      updateItem(item.id, { markupPercent: parseFloat(e.target.value) || 0 })
                    }
                    className="h-7 text-xs px-1.5 text-right"
                    placeholder="0"
                    step="1"
                  />
                  <div className="text-xs font-semibold text-right text-foreground">
                    {item.sellPrice > 0 ? `$${item.sellPrice.toFixed(4)}` : "--"}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add item */}
              <div className="px-4 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addItem(supplier.id)}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Supply Item
                </Button>
              </div>
            </div>

            {/* Dimensions hint for envelope items */}
            {items.some((i) => i.fitsWidth) && (
              <div className="px-4 py-2 border-t bg-muted/10">
                <p className="text-[10px] text-muted-foreground">
                  Envelope items: name = fits size, actual outer dims used for USPS shape qualification.
                </p>
              </div>
            )}
          </div>
        )
      })}

      {/* Add Supplier */}
      <Button
        variant="outline"
        size="sm"
        onClick={addSupplier}
        className="h-8 text-xs gap-1.5"
      >
        <Plus className="h-3 w-3" />
        Add Supplier
      </Button>
    </div>
  )
}

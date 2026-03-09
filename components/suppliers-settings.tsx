"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus, Trash2, ExternalLink, Save, Package, Phone, Mail,
  User, Upload, Download, Eye, EyeOff, FileText, CalendarDays,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type Supplier,
  type SupplyItem,
  type SupplyCategory,
  type SuppliersConfig,
  SUPPLY_CATEGORY_LABELS,
  DEFAULT_SUPPLIERS_CONFIG,
  computeSellPrice,
} from "@/lib/suppliers"

type FilterMode = "all" | "supplies" | "list_rental"

export function SuppliersSettings() {
  const [config, setConfig] = useState<SuppliersConfig>(DEFAULT_SUPPLIERS_CONFIG)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<FilterMode>("all")
  const [uploading, setUploading] = useState<string | null>(null)

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
      suppliers: [...c.suppliers, { id, name: "", website: "", phone: "", contactName: "", email: "" }],
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
  const addItem = (supplierId: string, category?: SupplyCategory) => {
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
          category: category || "other",
          costPerUnit: 0,
          markupPercent: 0,
          sellPrice: 0,
          nameCount: 0,
          countUpdatedAt: null,
          fileUrl: null,
          filePassword: null,
          fileName: null,
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
        if ("costPerUnit" in patch || "markupPercent" in patch) {
          merged.sellPrice = computeSellPrice(merged.costPerUnit, merged.markupPercent)
        }
        // Auto-set countUpdatedAt when nameCount changes
        if ("nameCount" in patch && patch.nameCount !== item.nameCount) {
          merged.countUpdatedAt = new Date().toISOString()
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

  // ── File Upload ──
  const uploadFile = async (item: SupplyItem, file: File) => {
    setUploading(item.id)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("supplierId", item.supplierId)
      formData.append("itemId", item.id)

      const res = await fetch("/api/supplier-files", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()

      updateItem(item.id, {
        fileUrl: data.url,
        fileName: data.fileName,
      })
    } catch {
      // silently fail, user can retry
    } finally {
      setUploading(null)
    }
  }

  // ── Filter logic ──
  const filteredSuppliers = config.suppliers.filter((sup) => {
    if (filter === "all") return true
    const items = config.supplyItems.filter((i) => i.supplierId === sup.id)
    if (filter === "list_rental") return items.some((i) => i.category === "list_rental")
    return items.some((i) => i.category !== "list_rental")
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Suppliers & Supplies</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage suppliers, track costs, markup, and list rentals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs gap-1">
              <Save className="h-3 w-3" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1">
        {([
          { key: "all", label: "All" },
          { key: "supplies", label: "Supplies" },
          { key: "list_rental", label: "List Rentals" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-lg transition-all",
              filter === key
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            <span className="ml-1 text-[10px] opacity-70">
              {key === "all"
                ? config.suppliers.length
                : key === "list_rental"
                ? config.supplyItems.filter((i) => i.category === "list_rental").length
                : config.supplyItems.filter((i) => i.category !== "list_rental").length}
            </span>
          </button>
        ))}
      </div>

      {/* Supplier cards */}
      {filteredSuppliers.map((supplier) => {
        const allItems = config.supplyItems.filter((i) => i.supplierId === supplier.id)
        const items = filter === "list_rental"
          ? allItems.filter((i) => i.category === "list_rental")
          : filter === "supplies"
          ? allItems.filter((i) => i.category !== "list_rental")
          : allItems
        const hasListRentals = allItems.some((i) => i.category === "list_rental")

        return (
          <div key={supplier.id} className="rounded-xl border bg-card overflow-hidden">
            {/* ── Supplier Header ── */}
            <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
              {/* Name row */}
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={supplier.name}
                  onChange={(e) => updateSupplier(supplier.id, { name: e.target.value })}
                  placeholder="Supplier name..."
                  className="h-7 text-sm font-semibold border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 flex-1"
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
              {/* Contact row */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-3 w-3" />
                  <Input
                    value={supplier.contactName || ""}
                    onChange={(e) => updateSupplier(supplier.id, { contactName: e.target.value })}
                    placeholder="Contact..."
                    className="h-6 text-[11px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 w-[100px]"
                  />
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <Input
                    value={supplier.phone || ""}
                    onChange={(e) => updateSupplier(supplier.id, { phone: e.target.value })}
                    placeholder="Phone..."
                    className="h-6 text-[11px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 w-[110px]"
                  />
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <Input
                    value={supplier.email || ""}
                    onChange={(e) => updateSupplier(supplier.id, { email: e.target.value })}
                    placeholder="Email..."
                    className="h-6 text-[11px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 w-[140px]"
                  />
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <Input
                    value={supplier.website || ""}
                    onChange={(e) => updateSupplier(supplier.id, { website: e.target.value })}
                    placeholder="Website..."
                    className="h-6 text-[11px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 w-[140px]"
                  />
                </div>
              </div>
            </div>

            {/* ── Items ── */}
            {hasListRentals && items.some((i) => i.category === "list_rental") ? (
              // List Rental layout
              <ListRentalTable
                items={items.filter((i) => i.category === "list_rental")}
                onUpdate={updateItem}
                onDelete={deleteItem}
                onUpload={uploadFile}
                uploading={uploading}
              />
            ) : null}

            {items.some((i) => i.category !== "list_rental") ? (
              // Supply items layout
              <SupplyItemsTable
                items={items.filter((i) => i.category !== "list_rental")}
                onUpdate={updateItem}
                onDelete={deleteItem}
              />
            ) : null}

            {/* Add item */}
            <div className="px-4 py-2 border-t bg-muted/10 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addItem(supplier.id)}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1"
              >
                <Plus className="h-3 w-3" />
                Add Supply Item
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addItem(supplier.id, "list_rental")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1"
              >
                <Plus className="h-3 w-3" />
                Add List Rental
              </Button>
            </div>
          </div>
        )
      })}

      {/* Add Supplier */}
      <Button variant="outline" size="sm" onClick={addSupplier} className="h-8 text-xs gap-1.5">
        <Plus className="h-3 w-3" />
        Add Supplier
      </Button>
    </div>
  )
}

// ── Supply Items Table (non-list-rental items) ──────────────────
function SupplyItemsTable({
  items,
  onUpdate,
  onDelete,
}: {
  items: SupplyItem[]
  onUpdate: (id: string, patch: Partial<SupplyItem>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="divide-y divide-border/50">
      <div className="grid grid-cols-[70px_1fr_100px_65px_55px_65px_24px] gap-1.5 px-4 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/20">
        <span>SKU</span>
        <span>Name</span>
        <span>Category</span>
        <span className="text-right">Cost</span>
        <span className="text-right">Mkup%</span>
        <span className="text-right">Sell</span>
        <span />
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-[70px_1fr_100px_65px_55px_65px_24px] gap-1.5 px-4 py-0.5 items-center"
        >
          <Input
            value={item.sku}
            onChange={(e) => onUpdate(item.id, { sku: e.target.value })}
            className="h-6 text-[11px] px-1"
            placeholder="SKU"
          />
          <Input
            value={item.name}
            onChange={(e) => onUpdate(item.id, { name: e.target.value })}
            className="h-6 text-[11px] px-1"
            placeholder="Name..."
          />
          <Select
            value={item.category}
            onValueChange={(v) => onUpdate(item.id, { category: v as SupplyCategory })}
          >
            <SelectTrigger className="h-6 text-[10px] px-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SUPPLY_CATEGORY_LABELS)
                .filter(([k]) => k !== "list_rental")
                .map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={item.costPerUnit || ""}
            onChange={(e) => onUpdate(item.id, { costPerUnit: parseFloat(e.target.value) || 0 })}
            className="h-6 text-[11px] px-1 text-right"
            placeholder="0.00"
            step="0.01"
          />
          <Input
            type="number"
            value={item.markupPercent || ""}
            onChange={(e) => onUpdate(item.id, { markupPercent: parseFloat(e.target.value) || 0 })}
            className="h-6 text-[11px] px-1 text-right"
            placeholder="0"
            step="1"
          />
          <div className="text-[11px] font-semibold text-right text-foreground">
            {item.sellPrice > 0 ? `$${item.sellPrice.toFixed(4)}` : "--"}
          </div>
          <button type="button" onClick={() => onDelete(item.id)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── List Rental Table ──────────────────────
function ListRentalTable({
  items,
  onUpdate,
  onDelete,
  onUpload,
  uploading,
}: {
  items: SupplyItem[]
  onUpdate: (id: string, patch: Partial<SupplyItem>) => void
  onDelete: (id: string) => void
  onUpload: (item: SupplyItem, file: File) => void
  uploading: string | null
}) {
  return (
    <div className="divide-y divide-border/50">
      <div className="grid grid-cols-[1fr_70px_55px_70px_70px_80px_60px_24px] gap-1.5 px-4 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wide bg-purple-50/50 dark:bg-purple-950/10">
        <span>List Name</span>
        <span className="text-right">Rate/M</span>
        <span className="text-right">Mkup%</span>
        <span className="text-right">Cost/M</span>
        <span className="text-right">Sell/M</span>
        <span className="text-right">Count</span>
        <span>File</span>
        <span />
      </div>
      {items.map((item) => (
        <ListRentalRow
          key={item.id}
          item={item}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onUpload={onUpload}
          isUploading={uploading === item.id}
        />
      ))}
    </div>
  )
}

function ListRentalRow({
  item,
  onUpdate,
  onDelete,
  onUpload,
  isUploading,
}: {
  item: SupplyItem
  onUpdate: (id: string, patch: Partial<SupplyItem>) => void
  onDelete: (id: string) => void
  onUpload: (item: SupplyItem, file: File) => void
  isUploading: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [showPw, setShowPw] = useState(false)

  const updatedAgo = item.countUpdatedAt
    ? formatTimeAgo(new Date(item.countUpdatedAt))
    : null

  return (
    <div className="px-4 py-1.5 space-y-1">
      {/* Main row */}
      <div className="grid grid-cols-[1fr_70px_55px_70px_70px_80px_60px_24px] gap-1.5 items-center">
        <div className="flex items-center gap-1">
          <Input
            value={item.name}
            onChange={(e) => onUpdate(item.id, { name: e.target.value })}
            className="h-6 text-[11px] px-1 font-medium"
            placeholder="List name..."
          />
        </div>
        <Input
          type="number"
          value={item.costPerUnit ? (item.costPerUnit * 1000).toFixed(2) : ""}
          onChange={(e) => onUpdate(item.id, { costPerUnit: (parseFloat(e.target.value) || 0) / 1000 })}
          className="h-6 text-[11px] px-1 text-right"
          placeholder="$/1000"
          step="1"
        />
        <Input
          type="number"
          value={item.markupPercent || ""}
          onChange={(e) => onUpdate(item.id, { markupPercent: parseFloat(e.target.value) || 0 })}
          className="h-6 text-[11px] px-1 text-right"
          placeholder="0"
          step="1"
        />
        <div className="text-[11px] text-right text-muted-foreground">
          {item.costPerUnit > 0 ? `$${(item.costPerUnit * 1000).toFixed(2)}` : "--"}
        </div>
        <div className="text-[11px] font-semibold text-right text-foreground">
          {item.sellPrice > 0 ? `$${(item.sellPrice * 1000).toFixed(2)}` : "--"}
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={item.nameCount || ""}
            onChange={(e) => onUpdate(item.id, { nameCount: parseInt(e.target.value) || 0 })}
            className="h-6 text-[11px] px-1 text-right"
            placeholder="0"
          />
        </div>
        <div className="flex items-center gap-1">
          {item.fileUrl ? (
            <a
              href={item.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title={item.fileName || "Download file"}
            >
              <Download className="h-3 w-3" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              isUploading && "animate-pulse"
            )}
            title="Upload list file"
          >
            <Upload className="h-3 w-3" />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(item, f)
              e.target.value = ""
            }}
          />
        </div>
        <button type="button" onClick={() => onDelete(item.id)} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Detail row: updated date, file name, password */}
      <div className="flex items-center gap-3 pl-1 text-[10px] text-muted-foreground">
        {updatedAgo && (
          <span className="flex items-center gap-0.5">
            <CalendarDays className="h-2.5 w-2.5" />
            Count updated {updatedAgo}
          </span>
        )}
        {item.fileName && (
          <span className="flex items-center gap-0.5">
            <FileText className="h-2.5 w-2.5" />
            {item.fileName}
          </span>
        )}
        <div className="flex items-center gap-0.5">
          <span className="text-[10px]">PW:</span>
          <Input
            type={showPw ? "text" : "password"}
            value={item.filePassword || ""}
            onChange={(e) => onUpdate(item.id, { filePassword: e.target.value })}
            className="h-5 text-[10px] px-1 w-[80px] border-dashed"
            placeholder="none"
          />
          <button type="button" onClick={() => setShowPw(!showPw)} className="text-muted-foreground">
            {showPw ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helper ──
function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

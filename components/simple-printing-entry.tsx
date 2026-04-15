"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Calculator, Plus, Trophy, Check, Building2, Trash2, Package, RefreshCw, FileText, ChevronRight
} from "lucide-react"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { SpiralCalculator } from "@/components/spiral/spiral-calculator"
import { PerfectCalculator } from "@/components/perfect/perfect-calculator"
import { PadCalculator } from "@/components/pad/pad-calculator"
import { EnvelopeTab } from "@/components/envelope-tab"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import type { Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PAPER_OPTIONS = [
  "100# Gloss Text", "100# Gloss Cover", "80# Gloss Text", "80# Gloss Cover",
  "70# Uncoated Text", "80# Uncoated Cover", "100# Uncoated Cover", 
  "60# Offset Text", "24# Bond", "28# Bond"
]

const COLOR_OPTIONS = [
  { value: "4/4", label: "4/4 Full Color Both" },
  { value: "4/0", label: "4/0 Full Color Front" },
  { value: "4/1", label: "4/1 Color/Black" },
  { value: "1/1", label: "1/1 Black Both" },
  { value: "1/0", label: "1/0 Black Front" },
]

const FOLD_TYPE_OPTIONS = [
  { value: "none", label: "Flat (No Fold)" },
  { value: "half", label: "Half Fold" },
  { value: "tri", label: "Tri-Fold" },
  { value: "z", label: "Z-Fold" },
  { value: "gate", label: "Gate Fold" },
]

const LAM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "gloss_one", label: "Gloss 1-Side" },
  { value: "gloss_both", label: "Gloss 2-Side" },
  { value: "matte_one", label: "Matte 1-Side" },
  { value: "matte_both", label: "Matte 2-Side" },
  { value: "soft_touch", label: "Soft Touch" },
]

interface PieceSpecs {
  quantity: number
  width: number
  height: number
  pages?: number
  paper: string
  colors: string
  hasBleed: boolean
  fold: string
  lamination: string
  coverPaper?: string
  coverColors?: string
  notes: string
}

interface VendorQuote {
  vendorId: string
  vendorName: string
  isInternal: boolean
  cost: number
  shipping: number
  markupPercent: number
  price: number
  priceOverride: boolean
  calcState?: any
}

interface PrintItem {
  id: string
  pieceId: string
  pieceLabel: string
  calcType: string
  specs: PieceSpecs
  vendorQuotes: VendorQuote[]
  selectedVendorId: string | null
  addedToQuote: boolean
}

function getCalcType(piece: MailPiece): string | null {
  if (piece.type === "envelope") return "envelope"
  const meta = PIECE_TYPE_META[piece.type]
  return meta?.calc || null
}

function buildSpecsText(specs: PieceSpecs): string {
  const parts: string[] = []
  parts.push(`${specs.quantity.toLocaleString()} pcs`)
  if (specs.width && specs.height) parts.push(`${specs.width}" x ${specs.height}"${specs.hasBleed ? " +bleed" : ""}`)
  if (specs.pages) parts.push(`${specs.pages}pp`)
  if (specs.paper) parts.push(specs.paper)
  if (specs.colors) parts.push(specs.colors)
  if (specs.fold && specs.fold !== "none") parts.push(FOLD_TYPE_OPTIONS.find(f => f.value === specs.fold)?.label || specs.fold)
  if (specs.lamination && specs.lamination !== "none") parts.push(LAM_OPTIONS.find(l => l.value === specs.lamination)?.label || specs.lamination)
  if (specs.notes) parts.push(specs.notes)
  return parts.join(" | ")
}

export function SimplePrintingEntry() {
  const { addItem } = useQuote()
  const { pieces, printQty } = useMailing()
  const { data: vendors, isLoading: vendorsLoading } = useSWR<Vendor[]>("/api/vendors", fetcher)
  
  const [printItems, setPrintItems] = useState<PrintItem[]>([])
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [showCalc, setShowCalc] = useState(false)
  const [calcVendorId, setCalcVendorId] = useState<string | null>(null)
  
  const printablePieces = useMemo(() => {
    return pieces.filter(piece => {
      if (piece.type === "envelope" && piece.envelopeKind === "plastic") return false
      return getCalcType(piece) !== null
    })
  }, [pieces])
  
  useEffect(() => {
    if (printablePieces.length > 0 && printItems.length === 0) {
      const items: PrintItem[] = printablePieces.map((piece) => {
        const meta = PIECE_TYPE_META[piece.type]
        const flatSize = getFlatSize(piece)
        return {
          id: crypto.randomUUID(),
          pieceId: piece.id,
          pieceLabel: meta?.label || piece.type,
          calcType: getCalcType(piece) || "flat",
          specs: {
            quantity: printQty,
            width: piece.width || 0,
            height: piece.height || 0,
            pages: piece.pageCount,
            paper: "",
            colors: "4/4",
            hasBleed: false,
            fold: piece.foldType || "none",
            lamination: "none",
            notes: ""
          },
          vendorQuotes: [],
          selectedVendorId: null,
          addedToQuote: false
        }
      })
      setPrintItems(items)
      if (items.length > 0) setActiveItemId(items[0].id)
    }
  }, [printablePieces, printItems.length, printQty])
  
  const activeItem = printItems.find(i => i.id === activeItemId)
  
  const updateSpecs = (updates: Partial<PieceSpecs>) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => 
      item.id === activeItemId ? { ...item, specs: { ...item.specs, ...updates } } : item
    ))
  }
  
  const updateVendorQuote = (vendorId: string, field: "cost" | "shipping" | "markupPercent" | "price", value: number) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== vendorId) return vq
          const updated = { ...vq, [field]: value }
          if (field === "price") updated.priceOverride = true
          if (!updated.priceOverride && ["cost", "shipping", "markupPercent"].includes(field)) {
            updated.price = Math.round((updated.cost + updated.shipping) * (1 + updated.markupPercent / 100) * 100) / 100
          }
          return updated
        })
      }
    }))
  }
  
  const recalculatePrice = (vendorId: string) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== vendorId) return vq
          return { ...vq, price: Math.round((vq.cost + vq.shipping) * (1 + vq.markupPercent / 100) * 100) / 100, priceOverride: false }
        })
      }
    }))
  }
  
  const addVendor = (vendorId: string) => {
    if (!activeItemId) return
    const vendor = vendors?.find(v => v.id === vendorId)
    if (!vendor) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId || item.vendorQuotes.some(vq => vq.vendorId === vendorId)) return item
      return {
        ...item,
        vendorQuotes: [...item.vendorQuotes, {
          vendorId: vendor.id,
          vendorName: vendor.company_name,
          isInternal: vendor.is_internal,
          cost: 0,
          shipping: vendor.pickup_cost || 0, // Auto-populate from vendor's pickup cost
          markupPercent: 30,
          price: 0,
          priceOverride: false
        }]
      }
    }))
  }
  
  const removeVendor = (vendorId: string) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.filter(vq => vq.vendorId !== vendorId),
        selectedVendorId: item.selectedVendorId === vendorId ? null : item.selectedVendorId
      }
    }))
  }
  
  const selectVendor = (vendorId: string) => {
    if (!activeItemId) return
    setPrintItems(prev => prev.map(item => 
      item.id === activeItemId ? { ...item, selectedVendorId: vendorId } : item
    ))
  }
  
  const openCalculator = (vendorId: string) => {
    setCalcVendorId(vendorId)
    setShowCalc(true)
  }
  
  const handleAddToQuote = () => {
    if (!activeItem || !activeItem.selectedVendorId) return
    const selected = activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)
    if (!selected || selected.price <= 0) return
    
    addItem({
      id: crypto.randomUUID(),
      category: "printing",
      description: buildSpecsText(activeItem.specs),
      quantity: activeItem.specs.quantity,
      unitCost: (selected.cost + selected.shipping) / activeItem.specs.quantity,
      unitPrice: selected.price / activeItem.specs.quantity,
      vendor: selected.vendorName,
      vendorId: selected.vendorId,
      metadata: { ...activeItem.specs, baseCost: selected.cost, shipping: selected.shipping, markupPercent: selected.markupPercent, isInternal: selected.isInternal }
    })
    setPrintItems(prev => prev.map(i => i.id === activeItemId ? { ...i, addedToQuote: true } : i))
  }
  
  const getCheapestId = (item: PrintItem) => {
    const withPrices = item.vendorQuotes.filter(vq => vq.price > 0)
    if (withPrices.length === 0) return null
    return withPrices.reduce((min, vq) => vq.price < min.price ? vq : min).vendorId
  }
  
  const isBooklet = activeItem && ["booklet", "spiral", "perfect"].includes(activeItem.calcType)

  if (printablePieces.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">No Printable Pieces</p>
          <p className="text-sm text-muted-foreground">Add pieces to your mailer first</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[400px] gap-3">
      {/* LEFT SIDEBAR - Pieces List */}
      <div className="w-48 shrink-0 flex flex-col border rounded-lg bg-card overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Pieces</h3>
          <Badge variant="outline" className="text-[10px]">{printItems.filter(i => i.addedToQuote).length}/{printItems.length}</Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {printItems.map((item, idx) => {
              const isActive = item.id === activeItemId
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveItemId(item.id)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded transition-all flex items-center gap-2",
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    item.addedToQuote && !isActive && "bg-green-100 dark:bg-green-900/30"
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                    item.addedToQuote ? "bg-green-600 text-white" : isActive ? "bg-primary-foreground text-primary" : "bg-muted-foreground/20"
                  )}>
                    {item.addedToQuote ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">{item.pieceLabel}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* MAIN CONTENT */}
      {activeItem && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden">
            {/* Compact Header */}
            <div className={cn(
              "px-3 py-2 border-b flex items-center justify-between shrink-0",
              activeItem.addedToQuote && "bg-green-100 dark:bg-green-900/30"
            )}>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-7 h-7 rounded flex items-center justify-center text-sm font-bold",
                  activeItem.addedToQuote ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
                )}>
                  {activeItem.addedToQuote ? <Check className="h-4 w-4" /> : printItems.findIndex(i => i.id === activeItemId) + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-base leading-tight">{activeItem.pieceLabel}</h3>
                  <p className="text-xs text-muted-foreground">{activeItem.calcType}</p>
                </div>
              </div>
              {activeItem.addedToQuote && <Badge className="bg-green-600 text-xs">Quoted</Badge>}
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {/* SPECS - Compact 2-row layout */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Specifications</h4>
                  </div>
                  {/* All specs in 2 rows */}
                  <div className="grid grid-cols-8 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Qty</Label>
                      <Input type="number" value={activeItem.specs.quantity} onChange={(e) => updateSpecs({ quantity: parseInt(e.target.value) || 0 })} disabled={activeItem.addedToQuote} className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Width</Label>
                      <Input type="number" step={0.125} value={activeItem.specs.width || ""} onChange={(e) => updateSpecs({ width: parseFloat(e.target.value) || 0 })} disabled={activeItem.addedToQuote} className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Height</Label>
                      <Input type="number" step={0.125} value={activeItem.specs.height || ""} onChange={(e) => updateSpecs({ height: parseFloat(e.target.value) || 0 })} disabled={activeItem.addedToQuote} className="h-7 text-xs" />
                    </div>
                    {isBooklet && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Pages</Label>
                        <Input type="number" step={4} min={4} value={activeItem.specs.pages || ""} onChange={(e) => updateSpecs({ pages: parseInt(e.target.value) || 0 })} disabled={activeItem.addedToQuote} className="h-7 text-xs" />
                      </div>
                    )}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Colors</Label>
                      <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Paper</Label>
                      <Select value={activeItem.specs.paper} onValueChange={(v) => updateSpecs({ paper: v })} disabled={activeItem.addedToQuote}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {!isBooklet && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Fold</Label>
                        <Select value={activeItem.specs.fold} onValueChange={(v) => updateSpecs({ fold: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FOLD_TYPE_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Lam</Label>
                      <Select value={activeItem.specs.lamination} onValueChange={(v) => updateSpecs({ lamination: v })} disabled={activeItem.addedToQuote}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{LAM_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Notes + Bleed in one row */}
                  <div className="flex gap-2 items-center">
                    <Input value={activeItem.specs.notes} onChange={(e) => updateSpecs({ notes: e.target.value })} placeholder="Notes / special instructions..." disabled={activeItem.addedToQuote} className="h-7 text-xs flex-1" />
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0 text-xs">
                      <Checkbox checked={activeItem.specs.hasBleed} onCheckedChange={(c) => updateSpecs({ hasBleed: !!c })} disabled={activeItem.addedToQuote} className="h-4 w-4" />
                      Bleed
                    </label>
                  </div>
                  {/* Specs Summary */}
                  <div className="px-2 py-1 bg-muted/50 rounded text-[11px] text-muted-foreground font-mono truncate">
                    {buildSpecsText(activeItem.specs) || "Fill in specs..."}
                  </div>
                </div>

                {/* VENDOR PRICING SECTION */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm">Vendor Pricing</h4>
                    </div>
                    <Select onValueChange={addVendor} disabled={activeItem.addedToQuote || vendorsLoading}>
                      <SelectTrigger className="w-44 h-8 text-xs bg-primary text-primary-foreground">
                        <Plus className="h-3 w-3 mr-1" />
                        <SelectValue placeholder="Add Vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors?.filter(v => !activeItem.vendorQuotes.some(vq => vq.vendorId === v.id)).map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {activeItem.vendorQuotes.length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground border-2 border-dashed rounded">
                      <p className="text-sm">Click "Add Vendor" to compare prices</p>
                    </div>
                  ) : (
                    <div className="border rounded overflow-hidden">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-1 px-2 py-1.5 bg-muted/50 text-[10px] uppercase text-muted-foreground font-medium">
                        <div className="col-span-3">Vendor</div>
                        <div className="col-span-2 text-right">Cost</div>
                        <div className="col-span-2 text-right">Pickup</div>
                        <div className="col-span-1 text-right">%</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2"></div>
                      </div>
                      {/* Table Rows */}
                      {activeItem.vendorQuotes.map((vq) => {
                        const isCheapest = getCheapestId(activeItem) === vq.vendorId
                        const isSelected = activeItem.selectedVendorId === vq.vendorId
                        return (
                          <div key={vq.vendorId} className={cn(
                            "grid grid-cols-12 gap-1 px-2 py-1.5 items-center border-t text-sm",
                            isCheapest && "bg-green-50 dark:bg-green-950/20",
                            isSelected && "ring-2 ring-inset ring-primary bg-primary/5"
                          )}>
                            {/* Vendor Name */}
                            <div className="col-span-3 flex items-center gap-1.5 min-w-0">
                              <button onClick={() => selectVendor(vq.vendorId)} disabled={activeItem.addedToQuote} className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0", isSelected ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                                {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                              </button>
                              <span className="font-medium truncate">{vq.vendorName}</span>
                              {vq.isInternal && <Badge variant="secondary" className="text-[9px] px-1 h-4 shrink-0">P</Badge>}
                              {isCheapest && <Trophy className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                            </div>
                            {/* Cost */}
                            <div className="col-span-2">
                              <Input type="number" min={0} step={0.01} value={vq.cost || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "cost", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-7 text-right text-xs px-1" />
                            </div>
                            {/* Pickup/Shipping */}
                            <div className="col-span-2">
                              <Input type="number" min={0} step={0.01} value={vq.shipping || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "shipping", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-7 text-right text-xs px-1" />
                            </div>
                            {/* Markup % */}
                            <div className="col-span-1">
                              <Input type="number" min={0} step={1} value={vq.markupPercent || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-7 text-right text-xs px-1" />
                            </div>
                            {/* Price */}
                            <div className="col-span-2 flex items-center gap-0.5">
                              <Input type="number" min={0} step={0.01} value={vq.price || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "price", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className={cn("h-7 text-right text-xs px-1 font-bold flex-1", vq.price > 0 && "text-green-700 dark:text-green-400", vq.priceOverride && "border-amber-400")} />
                              {vq.priceOverride && <button onClick={() => recalculatePrice(vq.vendorId)} className="p-0.5 text-muted-foreground hover:text-foreground"><RefreshCw className="h-3 w-3" /></button>}
                            </div>
                            {/* Actions */}
                            <div className="col-span-2 flex items-center justify-end gap-1">
                              {vq.isInternal && <Button variant="ghost" size="sm" onClick={() => openCalculator(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-6 w-6 p-0"><Calculator className="h-3.5 w-3.5" /></Button>}
                              <Button variant="ghost" size="sm" onClick={() => removeVendor(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            {!activeItem.addedToQuote && activeItem.selectedVendorId && (
              <div className="px-3 py-2 border-t bg-muted/30 shrink-0">
                <Button onClick={handleAddToQuote} className="w-full h-8 gap-2 bg-green-600 hover:bg-green-700 text-white text-sm" disabled={activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price === 0}>
                  <Check className="h-3.5 w-3.5" />
                  Add to Quote - {formatCurrency(activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price || 0)}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Calculator Dialog */}
      <Dialog open={showCalc} onOpenChange={setShowCalc}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Printout Calculator</DialogTitle>
            <DialogDescription>Calculate price, then click "Use This Price"</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {activeItem?.calcType === "flat" && <PrintingCalculator onResult={(r) => { if (calcVendorId) updateVendorQuote(calcVendorId, "cost", r.cost); if (calcVendorId) updateVendorQuote(calcVendorId, "price", r.price); setShowCalc(false) }} />}
            {activeItem?.calcType === "envelope" && <EnvelopeTab standalone />}
            {activeItem?.calcType === "booklet" && <BookletCalculator standalone />}
            {activeItem?.calcType === "spiral" && <SpiralCalculator standalone />}
            {activeItem?.calcType === "perfect" && <PerfectCalculator standalone />}
            {activeItem?.calcType === "pad" && <PadCalculator standalone />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

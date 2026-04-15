"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Calculator, Plus, Trophy, Check, Building2, Trash2, Package, RefreshCw
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
          shipping: vendor.pickup_cost || 0,
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
    <div className="space-y-3">
      {/* PIECE TABS - Horizontal tabs for piece selection */}
      <div className="flex items-center gap-2 flex-wrap">
        {printItems.map((item, idx) => {
          const isActive = item.id === activeItemId
          return (
            <button
              key={item.id}
              onClick={() => setActiveItemId(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                isActive 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : item.addedToQuote 
                    ? "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                    : "bg-card hover:bg-muted border-border"
              )}
            >
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                item.addedToQuote ? "bg-green-600 text-white" : isActive ? "bg-primary-foreground text-primary" : "bg-muted-foreground/20"
              )}>
                {item.addedToQuote ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              {item.pieceLabel}
            </button>
          )
        })}
        <Badge variant="outline" className="ml-auto">
          {printItems.filter(i => i.addedToQuote).length}/{printItems.length} quoted
        </Badge>
      </div>

      {/* MAIN CONTENT - Full width */}
      {activeItem && (
        <Card className={cn(activeItem.addedToQuote && "border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20")}>
          <CardContent className="p-4 space-y-4">
            {/* SPECIFICATIONS - Single row with all fields */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specifications</h4>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Qty</Label>
                  <Input type="number" value={activeItem.specs.quantity} onChange={(e) => updateSpecs({ quantity: parseInt(e.target.value) || 0 })} disabled={activeItem.addedToQuote} className="h-8 text-sm" />
                </div>
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Width</Label>
                  <Input type="number" step={0.125} value={activeItem.specs.width || ""} onChange={(e) => updateSpecs({ width: parseFloat(e.target.value) || 0 })} disabled={activeItem.addedToQuote} className="h-8 text-sm" />
                </div>
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Height</Label>
                  <Input type="number" step={0.125} value={activeItem.specs.height || ""} onChange={(e) => updateSpecs({ height: parseFloat(e.target.value) || 0 })} disabled={activeItem.addedToQuote} className="h-8 text-sm" />
                </div>
                {isBooklet && (
                  <div className="w-20">
                    <Label className="text-[10px] text-muted-foreground">Pages</Label>
                    <Input type="number" step={4} min={4} value={activeItem.specs.pages || ""} onChange={(e) => updateSpecs({ pages: parseInt(e.target.value) || 0 })} disabled={activeItem.addedToQuote} className="h-8 text-sm" />
                  </div>
                )}
                <div className="w-28">
                  <Label className="text-[10px] text-muted-foreground">Colors</Label>
                  <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-36">
                  <Label className="text-[10px] text-muted-foreground">Paper</Label>
                  <Select value={activeItem.specs.paper} onValueChange={(v) => updateSpecs({ paper: v })} disabled={activeItem.addedToQuote}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {!isBooklet && (
                  <div className="w-28">
                    <Label className="text-[10px] text-muted-foreground">Fold</Label>
                    <Select value={activeItem.specs.fold} onValueChange={(v) => updateSpecs({ fold: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{FOLD_TYPE_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="w-28">
                  <Label className="text-[10px] text-muted-foreground">Lam</Label>
                  <Select value={activeItem.specs.lamination} onValueChange={(v) => updateSpecs({ lamination: v })} disabled={activeItem.addedToQuote}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{LAM_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm h-8">
                  <Checkbox checked={activeItem.specs.hasBleed} onCheckedChange={(c) => updateSpecs({ hasBleed: !!c })} disabled={activeItem.addedToQuote} />
                  Bleed
                </label>
              </div>
              {/* Notes */}
              <Input 
                value={activeItem.specs.notes} 
                onChange={(e) => updateSpecs({ notes: e.target.value })} 
                placeholder="Notes / special instructions..." 
                disabled={activeItem.addedToQuote} 
                className="h-8 text-sm" 
              />
              {/* Summary */}
              <div className="px-2 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground font-mono">
                {buildSpecsText(activeItem.specs) || "Fill in specs above..."}
              </div>
            </div>

            {/* VENDOR PRICING */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  Vendor Pricing
                </h4>
                <Select onValueChange={addVendor} disabled={activeItem.addedToQuote || vendorsLoading}>
                  <SelectTrigger className="w-40 h-8 text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    <SelectValue placeholder="Add Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {!vendors || vendors.length === 0 ? (
                      <SelectItem value="_none" disabled>No vendors</SelectItem>
                    ) : (
                      vendors.filter(v => !activeItem.vendorQuotes.some(vq => vq.vendorId === v.id)).map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {activeItem.vendorQuotes.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                  Click "Add Vendor" to compare prices
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] uppercase text-muted-foreground font-semibold">
                    <div className="col-span-3">Vendor</div>
                    <div className="col-span-2 text-right">Cost</div>
                    <div className="col-span-2 text-right">Pickup</div>
                    <div className="col-span-1 text-right">%</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2"></div>
                  </div>
                  {/* Rows */}
                  {activeItem.vendorQuotes.map((vq) => {
                    const isCheapest = getCheapestId(activeItem) === vq.vendorId
                    const isSelected = activeItem.selectedVendorId === vq.vendorId
                    return (
                      <div 
                        key={vq.vendorId} 
                        onClick={() => !activeItem.addedToQuote && selectVendor(vq.vendorId)}
                        className={cn(
                          "grid grid-cols-12 gap-2 px-3 py-2 items-center border-t cursor-pointer transition-colors",
                          isSelected 
                            ? "bg-primary/10 dark:bg-primary/20" 
                            : isCheapest 
                              ? "bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-900/30" 
                              : "hover:bg-muted/50"
                        )}
                      >
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          <span className={cn("font-medium text-sm truncate", isSelected && "text-primary")}>{vq.vendorName}</span>
                          {vq.isInternal && <Badge variant="secondary" className="text-[9px] px-1 h-4 shrink-0">P</Badge>}
                          {isCheapest && <Trophy className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                        </div>
                        <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.cost || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "cost", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-7 text-right text-xs" />
                        </div>
                        <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.shipping || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "shipping", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-7 text-right text-xs" />
                        </div>
                        <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={1} value={vq.markupPercent || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-7 text-right text-xs" />
                        </div>
                        <div className="col-span-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.price || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "price", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className={cn("h-7 text-right text-xs font-bold", vq.price > 0 && "text-green-700 dark:text-green-400", vq.priceOverride && "border-amber-400")} />
                          {vq.priceOverride && <button onClick={() => recalculatePrice(vq.vendorId)} className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"><RefreshCw className="h-3 w-3" /></button>}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {vq.isInternal && <Button variant="ghost" size="sm" onClick={() => openCalculator(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-6 w-6 p-0"><Calculator className="h-3.5 w-3.5" /></Button>}
                          <Button variant="ghost" size="sm" onClick={() => removeVendor(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ADD TO QUOTE BUTTON */}
            {!activeItem.addedToQuote && activeItem.selectedVendorId && (
              <Button 
                onClick={handleAddToQuote} 
                className="w-full h-9 gap-2 bg-green-600 hover:bg-green-700 text-white" 
                disabled={activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price === 0}
              >
                <Check className="h-4 w-4" />
                Add to Quote - {formatCurrency(activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price || 0)}
              </Button>
            )}
            {activeItem.addedToQuote && (
              <div className="text-center py-2 text-green-600 font-medium flex items-center justify-center gap-2">
                <Check className="h-5 w-5" /> Added to Quote
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calculator Dialog */}
      <Dialog open={showCalc} onOpenChange={setShowCalc}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Printout Calculator</DialogTitle>
            <DialogDescription>Calculate in-house printing cost</DialogDescription>
          </DialogHeader>
          {activeItem?.calcType === "printing" && <PrintingCalculator viewMode="detailed" />}
          {activeItem?.calcType === "booklet" && <BookletCalculator viewMode="detailed" />}
          {activeItem?.calcType === "spiral" && <SpiralCalculator viewMode="detailed" />}
          {activeItem?.calcType === "perfect" && <PerfectCalculator viewMode="detailed" />}
          {activeItem?.calcType === "pad" && <PadCalculator viewMode="detailed" />}
          {activeItem?.calcType === "envelope" && <EnvelopeTab />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

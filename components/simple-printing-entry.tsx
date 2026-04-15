"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  
  // Handler for when calculator returns a result - fills in the vendor's cost/price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCalculatorResult = (result: { cost: number; price: number; description?: string; inputs?: any }) => {
    if (!activeItemId || !calcVendorId) return
    
    // Update the vendor quote with the calculated cost and price
    // The calculator already calculates the final price including markup
    // IMPORTANT: Store the inputs so we can reopen calculator with same settings
    setPrintItems(prev => prev.map(item => {
      if (item.id !== activeItemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== calcVendorId) return vq
          return {
            ...vq,
            cost: result.cost,
            price: result.price,
            priceOverride: false,
            calcState: {
              inputs: result.inputs, // Store inputs to reopen calculator with same settings
              description: result.description
            }
          }
        })
      }
    }))
    
    // Close the calculator dialog
    setShowCalc(false)
    setCalcVendorId(null)
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
    <div className="flex gap-4">
      {/* LEFT SIDEBAR - Pieces List */}
      <div className="w-48 shrink-0">
        <div className="sticky top-0 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pieces</h3>
            <Badge variant="secondary" className="text-[10px] h-5">
              {printItems.filter(i => i.addedToQuote).length}/{printItems.length}
            </Badge>
          </div>
          {printItems.map((item, idx) => {
            const isActive = item.id === activeItemId
            const selectedVendor = item.vendorQuotes.find(vq => vq.vendorId === item.selectedVendorId)
            return (
              <button
                key={item.id}
                onClick={() => setActiveItemId(item.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : item.addedToQuote 
                      ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                      : "hover:bg-muted/80"
                )}
              >
                <span className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  item.addedToQuote ? "bg-green-600 text-white" : isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {item.addedToQuote ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{item.pieceLabel}</div>
                  {selectedVendor && selectedVendor.price > 0 && (
                    <div className={cn("text-[10px] truncate", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {selectedVendor.vendorName}: {formatCurrency(selectedVendor.price)}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* MAIN CONTENT */}
      {activeItem && (
        <div className="flex-1 min-w-0 space-y-4">
          {/* SPECIFICATIONS - Apple-style crisp fields */}
          <div className={cn(
            "rounded-xl border bg-card p-4",
            activeItem.addedToQuote && "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20"
          )}>
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Specifications</h4>
            
            {/* Spec Fields Grid - Crisp Apple-style */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {/* Qty */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Qty</label>
                <Input 
                  type="number" 
                  value={activeItem.specs.quantity} 
                  onChange={(e) => updateSpecs({ quantity: parseInt(e.target.value) || 0 })} 
                  disabled={activeItem.addedToQuote} 
                  className="h-9 text-sm font-medium bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20" 
                />
              </div>
              
              {/* Width */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Width</label>
                <Input 
                  type="number" 
                  step={0.125} 
                  value={activeItem.specs.width || ""} 
                  onChange={(e) => updateSpecs({ width: parseFloat(e.target.value) || 0 })} 
                  disabled={activeItem.addedToQuote} 
                  placeholder="0"
                  className="h-9 text-sm font-medium bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20" 
                />
              </div>
              
              {/* Height */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Height</label>
                <Input 
                  type="number" 
                  step={0.125} 
                  value={activeItem.specs.height || ""} 
                  onChange={(e) => updateSpecs({ height: parseFloat(e.target.value) || 0 })} 
                  disabled={activeItem.addedToQuote} 
                  placeholder="0"
                  className="h-9 text-sm font-medium bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20" 
                />
              </div>
              
              {/* Pages (booklets only) */}
              {isBooklet && (
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Pages</label>
                  <Input 
                    type="number" 
                    step={4} 
                    min={4} 
                    value={activeItem.specs.pages || ""} 
                    onChange={(e) => updateSpecs({ pages: parseInt(e.target.value) || 0 })} 
                    disabled={activeItem.addedToQuote} 
                    className="h-9 text-sm font-medium bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20" 
                  />
                </div>
              )}
              
              {/* Colors */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Colors</label>
                <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                  <SelectTrigger className="h-9 text-sm font-medium bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              
              {/* Paper */}
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Paper</label>
                <Select value={activeItem.specs.paper} onValueChange={(v) => updateSpecs({ paper: v })} disabled={activeItem.addedToQuote}>
                  <SelectTrigger className="h-9 text-sm font-medium bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              
              {/* Fold (non-booklets only) */}
              {!isBooklet && (
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Fold</label>
                  <Select value={activeItem.specs.fold} onValueChange={(v) => updateSpecs({ fold: v })} disabled={activeItem.addedToQuote}>
                    <SelectTrigger className="h-9 text-sm font-medium bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{FOLD_TYPE_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Lam */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Lamination</label>
                <Select value={activeItem.specs.lamination} onValueChange={(v) => updateSpecs({ lamination: v })} disabled={activeItem.addedToQuote}>
                  <SelectTrigger className="h-9 text-sm font-medium bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{LAM_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Bleed + Notes row */}
            <div className="mt-3 flex items-center gap-4">
              <button 
                type="button"
                onClick={() => !activeItem.addedToQuote && updateSpecs({ hasBleed: !activeItem.specs.hasBleed })}
                disabled={activeItem.addedToQuote}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                  activeItem.specs.hasBleed 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background text-muted-foreground border-border/60 hover:border-border"
                )}
              >
                {activeItem.specs.hasBleed && <Check className="h-3.5 w-3.5" />}
                Bleed
              </button>
              <Input 
                value={activeItem.specs.notes} 
                onChange={(e) => updateSpecs({ notes: e.target.value })} 
                placeholder="Notes / special instructions..." 
                disabled={activeItem.addedToQuote} 
                className="h-9 flex-1 text-sm bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20" 
              />
            </div>
            
            {/* Summary bar */}
            <div className="mt-3 px-3 py-2 bg-muted/40 rounded-lg text-xs text-muted-foreground font-mono tracking-tight">
              {buildSpecsText(activeItem.specs) || "Fill in specifications above..."}
            </div>
          </div>

          {/* VENDOR PRICING - Crisp card */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" />
                Vendor Pricing
              </h4>
              <Select onValueChange={addVendor} disabled={activeItem.addedToQuote || vendorsLoading}>
                <SelectTrigger className="w-36 h-8 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 border-0 rounded-lg">
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
              <div className="py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                Click "Add Vendor" to compare prices
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
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
                        "grid grid-cols-12 gap-2 px-3 py-2 items-center border-t cursor-pointer transition-all",
                        isSelected 
                          ? "bg-primary/10 dark:bg-primary/20 ring-1 ring-inset ring-primary/30" 
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
                        <Input type="number" min={0} step={0.01} value={vq.cost || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "cost", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-8 text-right text-xs font-medium bg-background border-border/60" />
                      </div>
                      <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                        <Input type="number" min={0} step={0.01} value={vq.shipping || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "shipping", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-8 text-right text-xs font-medium bg-background border-border/60" />
                      </div>
                      <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                        <Input type="number" min={0} step={1} value={vq.markupPercent || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-8 text-right text-xs font-medium bg-background border-border/60" />
                      </div>
                      <div className="col-span-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input type="number" min={0} step={0.01} value={vq.price || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "price", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className={cn("h-8 text-right text-xs font-bold bg-background border-border/60", vq.price > 0 && "text-green-700 dark:text-green-400", vq.priceOverride && "border-amber-400")} />
                        {vq.priceOverride && <button onClick={() => recalculatePrice(vq.vendorId)} className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"><RefreshCw className="h-3 w-3" /></button>}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {vq.isInternal && <Button variant="ghost" size="sm" onClick={() => openCalculator(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-7 w-7 p-0"><Calculator className="h-4 w-4" /></Button>}
                        <Button variant="ghost" size="sm" onClick={() => removeVendor(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
              className="w-full h-10 gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm" 
              disabled={activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price === 0}
            >
              <Check className="h-4 w-4" />
              Add to Quote - {formatCurrency(activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price || 0)}
            </Button>
          )}
          {activeItem.addedToQuote && (
            <div className="text-center py-3 text-green-600 font-medium flex items-center justify-center gap-2 bg-green-50 dark:bg-green-950/30 rounded-xl">
              <Check className="h-5 w-5" /> Added to Quote
            </div>
          )}
        </div>
      )}

      {/* Calculator Dialog - passes onResult so price goes to vendor row, NOT directly to quote */}
      {/* Also passes initialInputs from saved calcState so calculator reopens with previous settings */}
      <Dialog open={showCalc} onOpenChange={setShowCalc}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Printout Calculator</DialogTitle>
            <DialogDescription>Calculate in-house printing cost - price will be added to vendor comparison</DialogDescription>
          </DialogHeader>
          {(() => {
            // Get saved inputs from the vendor we're calculating for
            const vendorQuote = activeItem?.vendorQuotes.find(vq => vq.vendorId === calcVendorId)
            const savedInputs = vendorQuote?.calcState?.inputs
            
            return (
              <>
                {/* "flat" calcType uses PrintingCalculator for postcards, flat cards, folded cards, self-mailers, letters */}
                {(activeItem?.calcType === "flat" || activeItem?.calcType === "printing") && (
                  <PrintingCalculator viewMode="detailed" onResult={handleCalculatorResult} initialInputs={savedInputs} />
                )}
                {activeItem?.calcType === "booklet" && (
                  <BookletCalculator viewMode="detailed" onResult={handleCalculatorResult} initialInputs={savedInputs} />
                )}
                {activeItem?.calcType === "spiral" && (
                  <SpiralCalculator viewMode="detailed" onResult={handleCalculatorResult} initialInputs={savedInputs} />
                )}
                {activeItem?.calcType === "perfect" && (
                  <PerfectCalculator viewMode="detailed" onResult={handleCalculatorResult} initialInputs={savedInputs} />
                )}
                {activeItem?.calcType === "pad" && (
                  <PadCalculator viewMode="detailed" onResult={handleCalculatorResult} initialInputs={savedInputs} />
                )}
                {activeItem?.calcType === "envelope" && (
                  <EnvelopeTab onResult={handleCalculatorResult} initialInputs={savedInputs} />
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

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

import { 
  Calculator, Plus, Trophy, Check, Building2, Trash2, RefreshCw
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
  // Common fields
  quantity: number
  width: number
  height: number
  notes: string
  
  // Flat printing fields (postcards, letters, self-mailers)
  paper: string
  colors: string        // "4/4", "4/0", "1/1", "1/0"
  hasBleed: boolean
  fold: string
  lamination: string
  
  // Booklet/Spiral specific fields
  pages?: number
  coverPaper?: string
  coverColors?: string  // "4/4", "4/0"
  coverBleed?: boolean
  insidePaper?: string
  insideColors?: string // "D/S", "S/S"
  insideBleed?: boolean
  bindingType?: string  // "staple", "spiral", "perfect"
  
  // Pad specific
  sheetsPerPad?: number
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
            // Only fill what we KNOW from the mail piece - everything else EMPTY
            quantity: printQty,
            width: piece.width || 0,
            height: piece.height || 0,
            pages: piece.pageCount,
            // ALL selection fields start EMPTY - forces user to choose
            paper: "",
            colors: "",           // empty = amber, user must select
            hasBleed: false,
            fold: "",             // empty = amber, user must select  
            lamination: "",       // empty = amber, user must select
            notes: "",
            // Booklet fields - all empty
            coverPaper: "",
            coverColors: "",
            insidePaper: "",
            insideColors: "",
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
    <div className="h-full">
      {/* TWO-COLUMN LAYOUT - Pieces sidebar + Main content */}
      <div className="flex h-full">
        {/* LEFT SIDEBAR - Pieces List */}
        <div className="w-56 shrink-0 border-r bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Pieces</h3>
            <Badge variant="outline" className="text-[10px] h-5 font-semibold">
              {printItems.filter(i => i.addedToQuote).length}/{printItems.length}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {printItems.map((item, idx) => {
              const isActive = item.id === activeItemId
              const selectedVendor = item.vendorQuotes.find(vq => vq.vendorId === item.selectedVendorId)
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveItemId(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                    isActive 
                      ? "bg-foreground text-background shadow-md" 
                      : item.addedToQuote 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-background hover:bg-muted border border-border/50"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    item.addedToQuote ? "bg-green-600 text-white" : isActive ? "bg-background/20 text-background" : "bg-muted-foreground/10 text-muted-foreground"
                  )}>
                    {item.addedToQuote ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("font-semibold text-sm truncate", isActive && "text-background")}>{item.pieceLabel}</div>
                    {selectedVendor && selectedVendor.price > 0 ? (
                      <div className={cn("text-xs truncate", isActive ? "text-background/70" : "text-muted-foreground")}>
                        {formatCurrency(selectedVendor.price)}
                      </div>
                    ) : (
                      <div className={cn("text-xs", isActive ? "text-background/50" : "text-muted-foreground/50")}>No price yet</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        {activeItem && (
          <div className="flex-1 p-6 overflow-y-auto">
            {/* PIECE HEADER */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">{activeItem.pieceLabel}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{buildSpecsText(activeItem.specs) || "Configure specifications below"}</p>
              </div>
              {activeItem.addedToQuote && (
                <Badge className="bg-green-600 text-white gap-1.5 px-3 py-1">
                  <Check className="h-3.5 w-3.5" /> Added to Quote
                </Badge>
              )}
            </div>

            {/* SPECIFICATIONS CARD - Shows different fields based on calcType */}
            {/* Helper: styling for unfilled vs filled fields */}
            {(() => {
              // Unfilled fields get amber border to show they need attention
              const inputUnfilled = "h-11 text-base font-semibold text-center rounded-xl border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 focus:border-foreground focus:ring-0 shadow-sm placeholder:text-amber-600/70"
              const inputFilled = "h-11 text-base font-semibold text-center rounded-xl border-2 border-green-500/60 bg-background focus:border-foreground focus:ring-0 shadow-sm"
              const selectUnfilled = "h-11 text-sm font-semibold rounded-xl border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 focus:border-foreground focus:ring-0 w-full shadow-sm text-amber-700 dark:text-amber-400"
              const selectFilled = "h-11 text-sm font-semibold rounded-xl border-2 border-green-500/60 bg-background focus:border-foreground focus:ring-0 w-full shadow-sm"
              
              const specs = activeItem.specs
              const isQtyFilled = specs.quantity > 0
              const isWidthFilled = specs.width > 0
              const isHeightFilled = specs.height > 0
              const isPaperFilled = !!specs.paper && specs.paper !== ""
              const isColorsFilled = !!specs.colors && specs.colors !== ""
              const isFoldFilled = !!specs.fold && specs.fold !== ""
              const isLamFilled = !!specs.lamination && specs.lamination !== ""
              const isCoverPaperFilled = !!specs.coverPaper && specs.coverPaper !== ""
              const isCoverColorsFilled = !!specs.coverColors && specs.coverColors !== ""
              const isInsidePaperFilled = !!specs.insidePaper && specs.insidePaper !== ""
              const isInsideColorsFilled = !!specs.insideColors && specs.insideColors !== ""
              const isPagesFilled = (specs.pages || 0) > 0
              const isSheetsFilled = (specs.sheetsPerPad || 0) > 0
              
              return (
            <div className={cn(
              "rounded-2xl border-2 bg-card p-6 mb-6",
              activeItem.addedToQuote ? "border-green-300 bg-green-50/20 dark:border-green-800 dark:bg-green-950/10" : "border-border/50"
            )}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Specifications</h4>
              
              {/* COMMON FIELDS: Qty + Size */}
              <div className="flex flex-wrap items-end gap-5 mb-4">
                <div className="w-28">
                  <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isQtyFilled ? "text-muted-foreground" : "text-amber-600")}>
                    Quantity {!isQtyFilled && <span className="text-amber-500">*</span>}
                  </label>
                  <Input 
                    type="number" 
                    value={activeItem.specs.quantity || ""} 
                    onChange={(e) => updateSpecs({ quantity: parseInt(e.target.value) || 0 })} 
                    disabled={activeItem.addedToQuote} 
                    placeholder="0"
                    className={isQtyFilled ? inputFilled : inputUnfilled} 
                  />
                </div>
                
                <div>
                  <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", (isWidthFilled && isHeightFilled) ? "text-muted-foreground" : "text-amber-600")}>
                    Finished Size (W × H) {(!isWidthFilled || !isHeightFilled) && <span className="text-amber-500">*</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      step={0.125} 
                      value={activeItem.specs.width || ""} 
                      onChange={(e) => updateSpecs({ width: parseFloat(e.target.value) || 0 })} 
                      disabled={activeItem.addedToQuote} 
                      placeholder="W"
                      className={cn(isWidthFilled ? inputFilled : inputUnfilled, "w-20")} 
                    />
                    <span className="text-muted-foreground font-bold text-lg">×</span>
                    <Input 
                      type="number" 
                      step={0.125} 
                      value={activeItem.specs.height || ""} 
                      onChange={(e) => updateSpecs({ height: parseFloat(e.target.value) || 0 })} 
                      disabled={activeItem.addedToQuote} 
                      placeholder="H"
                      className={cn(isHeightFilled ? inputFilled : inputUnfilled, "w-20")} 
                    />
                  </div>
                </div>
                
                {/* Pages - for booklets/spirals/pads */}
                {(isBooklet || activeItem.calcType === "spiral" || activeItem.calcType === "pad") && (
                  <div className="w-24">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", (activeItem.calcType === "pad" ? isSheetsFilled : isPagesFilled) ? "text-muted-foreground" : "text-amber-600")}>
                      {activeItem.calcType === "pad" ? "Sheets" : "Pages"} {!(activeItem.calcType === "pad" ? isSheetsFilled : isPagesFilled) && <span className="text-amber-500">*</span>}
                    </label>
                    <Input 
                      type="number" 
                      step={activeItem.calcType === "pad" ? 25 : 4} 
                      min={activeItem.calcType === "pad" ? 25 : 4} 
                      value={activeItem.calcType === "pad" ? (activeItem.specs.sheetsPerPad || "") : (activeItem.specs.pages || "")} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        if (activeItem.calcType === "pad") {
                          updateSpecs({ sheetsPerPad: val })
                        } else {
                          updateSpecs({ pages: val })
                        }
                      }} 
                      disabled={activeItem.addedToQuote} 
                      placeholder="0"
                      className={(activeItem.calcType === "pad" ? isSheetsFilled : isPagesFilled) ? inputFilled : inputUnfilled} 
                    />
                  </div>
                )}
              </div>
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* FLAT PRINTING SPECS (postcards, letters, self-mailers, etc) */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {(activeItem.calcType === "flat" || activeItem.calcType === "printing") && (
                <div className="flex flex-wrap items-end gap-5">
                  <div className="min-w-[185px]">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isPaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Paper Stock {!isPaperFilled && <span className="text-amber-500">*</span>}
                    </label>
                    <Select value={activeItem.specs.paper} onValueChange={(v) => updateSpecs({ paper: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={isPaperFilled ? selectFilled : selectUnfilled}>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[185px]">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isColorsFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Colors {!isColorsFilled && <span className="text-amber-500">*</span>}
                    </label>
                    <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={isColorsFilled ? selectFilled : selectUnfilled}>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>{COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[145px]">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isFoldFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Fold Type {!isFoldFilled && <span className="text-amber-500">*</span>}
                    </label>
                    <Select value={activeItem.specs.fold} onValueChange={(v) => updateSpecs({ fold: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={isFoldFilled ? selectFilled : selectUnfilled}>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>{FOLD_TYPE_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[145px]">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isLamFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Lamination {!isLamFilled && <span className="text-amber-500">*</span>}
                    </label>
                    <Select value={activeItem.specs.lamination} onValueChange={(v) => updateSpecs({ lamination: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={isLamFilled ? selectFilled : selectUnfilled}>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>{LAM_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => !activeItem.addedToQuote && updateSpecs({ hasBleed: !activeItem.specs.hasBleed })}
                    disabled={activeItem.addedToQuote}
                    className={cn(
                      "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                      activeItem.specs.hasBleed 
                        ? "bg-foreground text-background border-foreground" 
                        : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                    )}
                  >
                    {activeItem.specs.hasBleed && <Check className="h-4 w-4" />}
                    Bleed
                  </button>
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* BOOKLET / SPIRAL SPECS - Cover + Inside sections */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {(isBooklet || activeItem.calcType === "spiral") && (
                <div className="space-y-4">
                  {/* COVER */}
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <h5 className={cn("text-[11px] font-bold uppercase tracking-wide mb-3", isCoverPaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Cover {!isCoverPaperFilled && <span className="text-amber-500">— needs paper selection</span>}
                    </h5>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-[185px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isCoverPaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Cover Paper {!isCoverPaperFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.coverPaper || ""} onValueChange={(v) => updateSpecs({ coverPaper: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isCoverPaperFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      
                      <div className="min-w-[185px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isCoverColorsFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Cover Colors {!isCoverColorsFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.coverColors || ""} onValueChange={(v) => updateSpecs({ coverColors: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isCoverColorsFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>{COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => !activeItem.addedToQuote && updateSpecs({ coverBleed: !activeItem.specs.coverBleed })}
                        disabled={activeItem.addedToQuote}
                        className={cn(
                          "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                          activeItem.specs.coverBleed 
                            ? "bg-foreground text-background border-foreground" 
                            : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                        )}
                      >
                        {activeItem.specs.coverBleed && <Check className="h-4 w-4" />}
                        Bleed
                      </button>
                      
                      <div className="min-w-[145px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isLamFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Cover Lam {!isLamFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.lamination || ""} onValueChange={(v) => updateSpecs({ lamination: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isLamFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>{LAM_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  {/* INSIDE PAGES */}
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <h5 className={cn("text-[11px] font-bold uppercase tracking-wide mb-3", isInsidePaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Inside Pages {!isInsidePaperFilled && <span className="text-amber-500">— needs paper selection</span>}
                    </h5>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-[185px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isInsidePaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Inside Paper {!isInsidePaperFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.insidePaper || ""} onValueChange={(v) => updateSpecs({ insidePaper: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isInsidePaperFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      
                      <div className="min-w-[145px]">
                        <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isInsideColorsFilled ? "text-muted-foreground" : "text-amber-600")}>
                          Inside Colors {!isInsideColorsFilled && <span className="text-amber-500">*</span>}
                        </label>
                        <Select value={activeItem.specs.insideColors || ""} onValueChange={(v) => updateSpecs({ insideColors: v })} disabled={activeItem.addedToQuote}>
                          <SelectTrigger className={isInsideColorsFilled ? selectFilled : selectUnfilled}>
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="D/S">Double-Sided</SelectItem>
                            <SelectItem value="S/S">Single-Sided</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => !activeItem.addedToQuote && updateSpecs({ insideBleed: !activeItem.specs.insideBleed })}
                        disabled={activeItem.addedToQuote}
                        className={cn(
                          "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                          activeItem.specs.insideBleed 
                            ? "bg-foreground text-background border-foreground" 
                            : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                        )}
                      >
                        {activeItem.specs.insideBleed && <Check className="h-4 w-4" />}
                        Bleed
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* PAD SPECS */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeItem.calcType === "pad" && (
                <div className="flex flex-wrap items-end gap-5">
                  <div className="min-w-[185px]">
                    <label className={cn("block text-[11px] font-semibold uppercase tracking-wide mb-1.5", isPaperFilled ? "text-muted-foreground" : "text-amber-600")}>
                      Paper Stock {!isPaperFilled && <span className="text-amber-500">*</span>}
                    </label>
                    <Select value={activeItem.specs.paper} onValueChange={(v) => updateSpecs({ paper: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={isPaperFilled ? selectFilled : selectUnfilled}>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>{PAPER_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="min-w-[185px]">
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Colors</label>
                    <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={selectFilled}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => !activeItem.addedToQuote && updateSpecs({ hasBleed: !activeItem.specs.hasBleed })}
                    disabled={activeItem.addedToQuote}
                    className={cn(
                      "h-11 px-5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center gap-2 shadow-sm",
                      activeItem.specs.hasBleed 
                        ? "bg-foreground text-background border-foreground" 
                        : "bg-background text-muted-foreground border-border/60 hover:border-foreground/30"
                    )}
                  >
                    {activeItem.specs.hasBleed && <Check className="h-4 w-4" />}
                    Bleed
                  </button>
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* ENVELOPE SPECS */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeItem.calcType === "envelope" && (
                <div className="flex flex-wrap items-end gap-5">
                  <div className="min-w-[185px]">
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Colors</label>
                    <Select value={activeItem.specs.colors} onValueChange={(v) => updateSpecs({ colors: v })} disabled={activeItem.addedToQuote}>
                      <SelectTrigger className={selectFilled}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {/* Notes - shown for all types */}
              <div className="mt-5">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notes / Special Instructions</label>
                <Input 
                  value={activeItem.specs.notes} 
                  onChange={(e) => updateSpecs({ notes: e.target.value })} 
                  placeholder="Enter any special instructions..." 
                  disabled={activeItem.addedToQuote} 
                  className="h-11 text-sm rounded-xl border-2 border-border/60 bg-background focus:border-foreground focus:ring-0 shadow-sm" 
                />
              </div>
            </div>
              )
            })()}

            {/* VENDOR PRICING CARD */}
            <div className="rounded-2xl border-2 border-border/50 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Vendor Pricing
                </h4>
                <Select onValueChange={addVendor} disabled={activeItem.addedToQuote || vendorsLoading}>
                  <SelectTrigger className="w-40 h-10 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 border-0 rounded-xl gap-2">
                    <Plus className="h-4 w-4" />
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
                <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No vendors added yet</p>
                  <p className="text-xs mt-1">Click "Add Vendor" to compare prices</p>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-muted/50 text-[11px] uppercase text-muted-foreground font-bold tracking-wider">
                    <div className="col-span-3">Vendor</div>
                    <div className="col-span-2 text-right">Cost</div>
                    <div className="col-span-2 text-right">Shipping</div>
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
                          "grid grid-cols-12 gap-3 px-4 py-3 items-center border-t-2 border-border/30 cursor-pointer transition-all",
                          isSelected 
                            ? "bg-foreground/5 ring-2 ring-inset ring-foreground/20" 
                            : isCheapest 
                              ? "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/40" 
                              : "hover:bg-muted/50"
                        )}
                      >
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          {isSelected && <div className="w-2 h-2 rounded-full bg-foreground shrink-0" />}
                          <span className={cn("font-semibold text-sm truncate", isSelected && "text-foreground")}>{vq.vendorName}</span>
                          {vq.isInternal && <Badge variant="outline" className="text-[9px] px-1.5 h-5 shrink-0 font-bold">P</Badge>}
                          {isCheapest && <Trophy className="h-4 w-4 text-green-600 shrink-0" />}
                        </div>
                        <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.cost || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "cost", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-9 text-right text-sm font-semibold rounded-lg border-2 border-border/50 bg-background" />
                        </div>
                        <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.shipping || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "shipping", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-9 text-right text-sm font-semibold rounded-lg border-2 border-border/50 bg-background" />
                        </div>
                        <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={1} value={vq.markupPercent || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className="h-9 text-right text-sm font-semibold rounded-lg border-2 border-border/50 bg-background" />
                        </div>
                        <div className="col-span-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input type="number" min={0} step={0.01} value={vq.price || ""} onChange={(e) => updateVendorQuote(vq.vendorId, "price", parseFloat(e.target.value) || 0)} disabled={activeItem.addedToQuote} className={cn("h-9 text-right text-sm font-bold rounded-lg border-2 border-border/50 bg-background", vq.price > 0 && "text-green-700 dark:text-green-400", vq.priceOverride && "border-amber-400")} />
                          {vq.priceOverride && <button onClick={() => recalculatePrice(vq.vendorId)} className="p-1 text-muted-foreground hover:text-foreground shrink-0"><RefreshCw className="h-3.5 w-3.5" /></button>}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {vq.isInternal && (
                            <Button variant="outline" size="sm" onClick={() => openCalculator(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-9 px-3 rounded-lg font-semibold gap-1.5">
                              <Calculator className="h-4 w-4" />
                              Calc
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => removeVendor(vq.vendorId)} disabled={activeItem.addedToQuote} className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ADD TO QUOTE BUTTON */}
              {!activeItem.addedToQuote && activeItem.selectedVendorId && (
                <Button 
                  onClick={handleAddToQuote} 
                  className="w-full h-12 gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-base mt-4" 
                  disabled={activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price === 0}
                >
                  <Check className="h-5 w-5" />
                  Add to Quote - {formatCurrency(activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price || 0)}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Calculator Dialog - passes onResult so price goes to vendor row, NOT directly to quote */}
      {/* Compute initialInputs from specs BEFORE the Dialog opens */}
      {(() => {
        // Get saved inputs from the vendor we're calculating for
        const vendorQuote = activeItem?.vendorQuotes.find(vq => vq.vendorId === calcVendorId)
        const savedInputs = vendorQuote?.calcState?.inputs
        
        // Map colors string to sidesValue: "4/4" → "D/S", "4/0" → "S/S"
        const colorsToSides = (colors: string | undefined): string => {
          if (!colors) return "S/S"
          if (colors.includes("/4") || colors.includes("/1")) return "D/S"
          return "S/S"
        }
        
        // Map lamination spec to lamination object
        const lamToObject = (lam: string | undefined) => {
          if (!lam || lam === "none") return { enabled: false, type: "Gloss" as const, sides: "S/S" as const, markupPct: 225, brokerDiscountPct: 30 }
          const isGloss = lam.toLowerCase().includes("gloss")
          const isTwoSide = lam.includes("2-Side") || lam.includes("2 Side")
          return { enabled: true, type: isGloss ? "Gloss" as const : "Matte" as const, sides: isTwoSide ? "D/S" as const : "S/S" as const, markupPct: 225, brokerDiscountPct: 30 }
        }
        
        // Build specsToInputs based on calculator type
        let specsToInputs: Record<string, unknown> | undefined = undefined
        
        if (activeItem?.specs) {
          const specs = activeItem.specs
          const calcType = activeItem.calcType
          
          if (calcType === "flat" || calcType === "printing") {
            // ONLY pass values user actually selected - empty stays empty!
            specsToInputs = {
              qty: specs.quantity || 0,
              width: specs.width || 0,
              height: specs.height || 0,
              paperName: specs.paper || "",  // empty if not selected
              sidesValue: specs.colors ? colorsToSides(specs.colors) : "",  // empty if not selected
              hasBleed: specs.hasBleed || false,
              addOnCharge: 0,
              addOnDescription: "",
              finishingIds: [],
              finishingCalcIds: [],
              isBroker: false,
              printingMarkupPct: 0,
              lamination: lamToObject(specs.lamination),
            }
          } else if (calcType === "booklet") {
            // ONLY pass values user actually selected
            specsToInputs = {
              bookQty: specs.quantity || 0,
              pagesPerBook: specs.pages || 0,  // 0 if not set
              pageWidth: specs.width || 0,
              pageHeight: specs.height || 0,
              separateCover: true,
              coverPaper: specs.coverPaper || "",  // empty if not selected
              coverSides: specs.coverColors || "",  // empty if not selected
              coverBleed: specs.coverBleed || false,
              coverSheetSize: "cheapest",
              insidePaper: specs.insidePaper || "",  // empty if not selected
              insideSides: specs.insideColors || "",  // empty if not selected
              insideBleed: specs.insideBleed || false,
              insideSheetSize: "cheapest",
              bindingType: specs.bindingType || "staple",
              laminationType: specs.lamination ? (specs.lamination.toLowerCase().includes("gloss") ? "gloss" : "matte") : "none",
              insertSections: [],
              insertFeePerSection: 25,
              customLevel: "auto",
              isBroker: false,
              printingMarkupPct: 0,
            }
          } else if (calcType === "spiral") {
            specsToInputs = {
              bookQty: specs.quantity || 0,
              pagesPerBook: specs.pages || 0,
              pageWidth: specs.width || 0,
              pageHeight: specs.height || 0,
              separateCover: true,
              coverPaper: specs.coverPaper || "",
              coverSides: specs.coverColors || "",
              coverBleed: specs.coverBleed || false,
              insidePaper: specs.insidePaper || "",
              insideSides: specs.insideColors || "",
              insideBleed: specs.insideBleed || false,
            }
          } else if (calcType === "pad") {
            specsToInputs = {
              padQty: specs.quantity || 0,
              sheetsPerPad: specs.sheetsPerPad || 0,
              padWidth: specs.width || 0,
              padHeight: specs.height || 0,
              paperName: specs.paper || "",
              sidesValue: specs.colors ? colorsToSides(specs.colors) : "",
              hasBleed: specs.hasBleed || false,
            }
          } else if (calcType === "envelope") {
            const w = specs.width || 0
            const h = specs.height || 0
            let itemName = "6x9"
            if (w === 9 && h === 12) itemName = "9x12"
            else if (w === 6 && h === 9) itemName = "6x9"
            else if (w === 9.5 && h === 4.125) itemName = "#10 no window"
            else if (w === 4.125 && h === 9.5) itemName = "#10 no window"
            else if (w > 0 && h > 0) itemName = `${w}x${h}`
            
            specsToInputs = {
              amount: specs.quantity || 0,
              itemName: itemName,
              inkType: "InkJet" as const,
              printType: "Text + Logo" as const,
              hasBleed: specs.hasBleed || false,
              customerType: "Regular" as const,
              customEnvCost: 0,
              customPrintCost: 0,
            }
          }
        }
        
        // Use saved inputs first, then fall back to specs-derived inputs
        const initialInputs = savedInputs || specsToInputs
        
        // Key forces remount when specs change
        const specsKey = activeItem?.specs ? `${activeItem.specs.quantity}-${activeItem.specs.width}-${activeItem.specs.height}-${activeItem.specs.paper || activeItem.specs.coverPaper}-${activeItem.specs.colors || activeItem.specs.coverColors}-${activeItem.specs.insidePaper}-${activeItem.specs.pages}` : "empty"
        
        return (
          <Dialog open={showCalc} onOpenChange={setShowCalc}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Printout Calculator</DialogTitle>
                <DialogDescription>Calculate in-house printing cost - price will be added to vendor comparison</DialogDescription>
              </DialogHeader>
              {showCalc && (
                <>
                  {(activeItem?.calcType === "flat" || activeItem?.calcType === "printing") && (
                    <PrintingCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "booklet" && (
                    <BookletCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "spiral" && (
                    <SpiralCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "perfect" && (
                    <PerfectCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "pad" && (
                    <PadCalculator key={specsKey} viewMode="detailed" onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                  {activeItem?.calcType === "envelope" && (
                    <EnvelopeTab key={specsKey} onResult={handleCalculatorResult} initialInputs={initialInputs} />
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}

"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import { buildCustomerSpecs } from "@/lib/build-quote-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { 
  Calculator, Plus, Trophy, Check, Building2, Trash2, Package, RefreshCw, ChevronDown, ChevronUp, FileText, Pencil
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

// Paper options
const PAPER_OPTIONS = [
  { value: "100# Gloss Text", label: "100# Gloss Text" },
  { value: "100# Gloss Cover", label: "100# Gloss Cover" },
  { value: "80# Gloss Text", label: "80# Gloss Text" },
  { value: "80# Gloss Cover", label: "80# Gloss Cover" },
  { value: "70# Uncoated Text", label: "70# Uncoated Text" },
  { value: "80# Uncoated Cover", label: "80# Uncoated Cover" },
  { value: "100# Uncoated Cover", label: "100# Uncoated Cover" },
  { value: "60# Offset Text", label: "60# Offset Text" },
  { value: "24# Bond", label: "24# Bond" },
  { value: "28# Bond", label: "28# Bond" },
  { value: "Custom", label: "Custom..." },
]

const COLOR_OPTIONS = [
  { value: "4/4", label: "4/4 (Full Color Both Sides)" },
  { value: "4/0", label: "4/0 (Full Color One Side)" },
  { value: "4/1", label: "4/1 (Full Color / Black)" },
  { value: "1/1", label: "1/1 (Black Both Sides)" },
  { value: "1/0", label: "1/0 (Black One Side)" },
]

const FOLD_TYPE_OPTIONS = [
  { value: "none", label: "No Fold (Flat)" },
  { value: "half", label: "Half Fold" },
  { value: "tri", label: "Tri-Fold (Letter)" },
  { value: "z", label: "Z-Fold" },
  { value: "gate", label: "Gate Fold" },
  { value: "accordion", label: "Accordion Fold" },
]

const LAM_OPTIONS = [
  { value: "none", label: "No Lamination" },
  { value: "gloss_one", label: "Gloss Lamination (One Side)" },
  { value: "gloss_both", label: "Gloss Lamination (Both Sides)" },
  { value: "matte_one", label: "Matte Lamination (One Side)" },
  { value: "matte_both", label: "Matte Lamination (Both Sides)" },
  { value: "soft_touch_one", label: "Soft Touch (One Side)" },
  { value: "soft_touch_both", label: "Soft Touch (Both Sides)" },
]

// Spec metadata for a piece
interface PieceSpecs {
  quantity: number
  finishedWidth: number
  finishedHeight: number
  flatWidth?: number
  flatHeight?: number
  paper: string
  customPaper?: string
  colors: string
  hasBleed: boolean
  foldType: string
  lamination: string
  pageCount?: number // for booklets
  coverPaper?: string // for booklets with separate cover
  coverColors?: string
  notes: string
}

function getCalcType(piece: MailPiece): "envelope" | "flat" | "booklet" | "spiral" | "perfect" | "pad" | null {
  if (piece.type === "envelope") return "envelope"
  const meta = PIECE_TYPE_META[piece.type]
  if (!meta) return null
  return meta.calc as any
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
  pieceType: string
  calcType: string
  specs: PieceSpecs
  vendorQuotes: VendorQuote[]
  selectedVendorId: string | null
  addedToQuote: boolean
  specsExpanded: boolean
}

function buildSpecsText(specs: PieceSpecs, pieceType: string): string {
  const parts: string[] = []
  parts.push(`Qty: ${specs.quantity.toLocaleString()}`)
  
  if (pieceType === "envelope") {
    parts.push("Envelope")
    if (specs.finishedWidth && specs.finishedHeight) parts.push(`${specs.finishedWidth}" x ${specs.finishedHeight}"`)
    if (specs.colors) parts.push(specs.colors)
  } else {
    // Size
    if (specs.finishedWidth && specs.finishedHeight) {
      const sizeStr = `${specs.finishedWidth}" x ${specs.finishedHeight}"`
      parts.push(specs.hasBleed ? `${sizeStr} + Bleed` : sizeStr)
    }
    // Pages (for booklets)
    if (specs.pageCount && specs.pageCount > 1) parts.push(`${specs.pageCount} Pages`)
    // Paper
    if (specs.paper === "Custom" && specs.customPaper) {
      parts.push(specs.customPaper)
    } else if (specs.paper) {
      parts.push(specs.paper)
    }
    // Cover paper (booklets)
    if (specs.coverPaper) parts.push(`Cover: ${specs.coverPaper}`)
    // Colors
    if (specs.colors) parts.push(specs.colors)
    if (specs.coverColors) parts.push(`Cover: ${specs.coverColors}`)
    // Fold
    if (specs.foldType && specs.foldType !== "none") {
      const foldLabel = FOLD_TYPE_OPTIONS.find(f => f.value === specs.foldType)?.label || specs.foldType
      parts.push(foldLabel)
    }
    // Lamination
    if (specs.lamination && specs.lamination !== "none") {
      const lamLabel = LAM_OPTIONS.find(l => l.value === specs.lamination)?.label || specs.lamination
      parts.push(lamLabel)
    }
  }
  // Notes
  if (specs.notes) parts.push(specs.notes)
  
  return parts.join(" | ")
}

function createDefaultSpecs(piece: MailPiece, printQty: number): PieceSpecs {
  const flatSize = getFlatSize(piece)
  return {
    quantity: printQty,
    finishedWidth: piece.width || 0,
    finishedHeight: piece.height || 0,
    flatWidth: flatSize.w || undefined,
    flatHeight: flatSize.h || undefined,
    paper: piece.paperName || "",
    colors: piece.sides || "4/4",
    hasBleed: piece.hasBleed || false,
    foldType: piece.foldType || "none",
    lamination: "none",
    pageCount: piece.pageCount,
    notes: ""
  }
}

export function SimplePrintingEntry() {
  const { addItem } = useQuote()
  const { pieces, printQty } = useMailing()
  const { data: vendors, isLoading: vendorsLoading } = useSWR<Vendor[]>("/api/vendors", fetcher)
  
  const [printItems, setPrintItems] = useState<PrintItem[]>([])
  const [showCalc, setShowCalc] = useState(false)
  const [calcItemId, setCalcItemId] = useState<string | null>(null)
  const [calcVendorId, setCalcVendorId] = useState<string | null>(null)
  
  const printablePieces = useMemo(() => {
    return pieces.filter(piece => {
      if (piece.type === "envelope" && piece.envelopeKind === "plastic") return false
      return getCalcType(piece) !== null
    })
  }, [pieces])
  
  useEffect(() => {
    if (printablePieces.length > 0 && printItems.length === 0) {
      const items: PrintItem[] = printablePieces.map((piece) => ({
        id: crypto.randomUUID(),
        pieceId: piece.id,
        pieceType: piece.type,
        calcType: getCalcType(piece) || "flat",
        specs: createDefaultSpecs(piece, printQty),
        vendorQuotes: [],
        selectedVendorId: null,
        addedToQuote: false,
        specsExpanded: true // Start expanded so user can fill in specs
      }))
      setPrintItems(items)
    }
  }, [printablePieces, printItems.length, printQty])
  
  const updateSpecs = (itemId: string, updates: Partial<PieceSpecs>) => {
    setPrintItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, specs: { ...item.specs, ...updates } } : item
    ))
  }
  
  const toggleSpecsExpanded = (itemId: string) => {
    setPrintItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, specsExpanded: !item.specsExpanded } : item
    ))
  }
  
  const updateVendorQuote = (itemId: string, vendorId: string, field: "cost" | "shipping" | "markupPercent" | "price", value: number) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
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
  
  const recalculatePrice = (itemId: string, vendorId: string) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== vendorId) return vq
          return { ...vq, price: Math.round((vq.cost + vq.shipping) * (1 + vq.markupPercent / 100) * 100) / 100, priceOverride: false }
        })
      }
    }))
  }
  
  const addVendorToItem = (itemId: string, vendorId: string) => {
    const vendor = vendors?.find(v => v.id === vendorId)
    if (!vendor) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId || item.vendorQuotes.some(vq => vq.vendorId === vendorId)) return item
      return {
        ...item,
        vendorQuotes: [...item.vendorQuotes, {
          vendorId: vendor.id,
          vendorName: vendor.company_name,
          isInternal: vendor.is_internal,
          cost: 0, shipping: 0, markupPercent: 30, price: 0, priceOverride: false
        }]
      }
    }))
  }
  
  const removeVendorFromItem = (itemId: string, vendorId: string) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.filter(vq => vq.vendorId !== vendorId),
        selectedVendorId: item.selectedVendorId === vendorId ? null : item.selectedVendorId
      }
    }))
  }
  
  const selectVendor = (itemId: string, vendorId: string) => {
    setPrintItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, selectedVendorId: vendorId } : item
    ))
  }
  
  const openCalculator = (itemId: string, vendorId: string) => {
    setCalcItemId(itemId)
    setCalcVendorId(vendorId)
    setShowCalc(true)
  }
  
  const handleAddToQuote = (itemId: string) => {
    const item = printItems.find(i => i.id === itemId)
    if (!item || !item.selectedVendorId) return
    const selected = item.vendorQuotes.find(vq => vq.vendorId === item.selectedVendorId)
    if (!selected || selected.price <= 0) return
    
    const specsText = buildSpecsText(item.specs, item.pieceType)
    
    addItem({
      id: crypto.randomUUID(),
      category: "printing",
      description: specsText,
      quantity: item.specs.quantity,
      unitCost: (selected.cost + selected.shipping) / item.specs.quantity,
      unitPrice: selected.price / item.specs.quantity,
      vendor: selected.vendorName,
      vendorId: selected.vendorId,
      metadata: { 
        ...item.specs,
        baseCost: selected.cost, 
        shipping: selected.shipping, 
        markupPercent: selected.markupPercent, 
        isInternal: selected.isInternal,
        pieceType: item.pieceType,
        pieceDimensions: `${item.specs.finishedWidth}x${item.specs.finishedHeight}`
      }
    })
    setPrintItems(prev => prev.map(i => i.id === itemId ? { ...i, addedToQuote: true } : i))
  }
  
  const getCheapestVendor = (item: PrintItem) => {
    const withPrices = item.vendorQuotes.filter(vq => vq.price > 0)
    if (withPrices.length === 0) return null
    return withPrices.reduce((min, vq) => vq.price < min.price ? vq : min).vendorId
  }
  
  const calcItem = printItems.find(i => i.id === calcItemId)

  if (printablePieces.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">No Printable Pieces</p>
          <p className="text-sm text-muted-foreground">Add pieces to your mailer first</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Print Production</h2>
          <p className="text-sm text-muted-foreground">Build specs and compare vendor prices for each piece</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{printItems.filter(i => i.addedToQuote).length}/{printItems.length} complete</span>
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(printItems.filter(i => i.addedToQuote).length / printItems.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ALL PIECES */}
      {printItems.map((item, idx) => {
        const typeMeta = PIECE_TYPE_META[item.pieceType]
        const cheapestId = getCheapestVendor(item)
        const isBooklet = ["booklet", "spiral", "perfect"].includes(item.calcType)
        
        return (
          <Card key={item.id} className={cn(
            "overflow-hidden",
            item.addedToQuote && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
          )}>
            {/* PIECE HEADER */}
            <CardHeader className={cn(
              "py-3 border-b",
              item.addedToQuote ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/40"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                    item.addedToQuote ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
                  )}>
                    {item.addedToQuote ? <Check className="h-5 w-5" /> : idx + 1}
                  </span>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {typeMeta?.label || item.pieceType}
                      <Badge variant="outline" className="font-normal">
                        {item.specs.quantity.toLocaleString()} pcs
                      </Badge>
                      {item.addedToQuote && <Badge className="bg-green-600">Added to Quote</Badge>}
                    </CardTitle>
                    {!item.specsExpanded && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {buildSpecsText(item.specs, item.pieceType)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleSpecsExpanded(item.id)}
                    className="gap-1"
                  >
                    <FileText className="h-4 w-4" />
                    Specs
                    {item.specsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Select onValueChange={(v) => addVendorToItem(item.id, v)} disabled={item.addedToQuote || vendorsLoading}>
                    <SelectTrigger className="w-40 h-9 bg-primary text-primary-foreground">
                      <Plus className="h-4 w-4 mr-1" />
                      <SelectValue placeholder="Add Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors?.filter(v => !item.vendorQuotes.some(vq => vq.vendorId === v.id)).map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.company_name} {v.is_internal && "(Printout)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {/* SPECS BUILDER - Collapsible */}
              {item.specsExpanded && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b space-y-4">
                  {/* Row 1: Size & Quantity */}
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        value={item.specs.quantity}
                        onChange={(e) => updateSpecs(item.id, { quantity: parseInt(e.target.value) || 0 })}
                        disabled={item.addedToQuote}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Width (in)</Label>
                      <Input
                        type="number"
                        step={0.125}
                        value={item.specs.finishedWidth || ""}
                        onChange={(e) => updateSpecs(item.id, { finishedWidth: parseFloat(e.target.value) || 0 })}
                        disabled={item.addedToQuote}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height (in)</Label>
                      <Input
                        type="number"
                        step={0.125}
                        value={item.specs.finishedHeight || ""}
                        onChange={(e) => updateSpecs(item.id, { finishedHeight: parseFloat(e.target.value) || 0 })}
                        disabled={item.addedToQuote}
                        className="h-9"
                      />
                    </div>
                    {isBooklet && (
                      <div>
                        <Label className="text-xs">Pages</Label>
                        <Input
                          type="number"
                          step={4}
                          min={4}
                          value={item.specs.pageCount || ""}
                          onChange={(e) => updateSpecs(item.id, { pageCount: parseInt(e.target.value) || 0 })}
                          disabled={item.addedToQuote}
                          className="h-9"
                        />
                      </div>
                    )}
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 h-9 cursor-pointer">
                        <Checkbox
                          checked={item.specs.hasBleed}
                          onCheckedChange={(c) => updateSpecs(item.id, { hasBleed: !!c })}
                          disabled={item.addedToQuote}
                        />
                        <span className="text-sm">+ Bleed</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Row 2: Paper & Colors */}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs">Paper Stock</Label>
                      <Select 
                        value={item.specs.paper} 
                        onValueChange={(v) => updateSpecs(item.id, { paper: v })}
                        disabled={item.addedToQuote}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select paper..." /></SelectTrigger>
                        <SelectContent>
                          {PAPER_OPTIONS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {item.specs.paper === "Custom" && (
                      <div>
                        <Label className="text-xs">Custom Paper</Label>
                        <Input
                          value={item.specs.customPaper || ""}
                          onChange={(e) => updateSpecs(item.id, { customPaper: e.target.value })}
                          placeholder="Describe paper..."
                          disabled={item.addedToQuote}
                          className="h-9"
                        />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Colors</Label>
                      <Select 
                        value={item.specs.colors} 
                        onValueChange={(v) => updateSpecs(item.id, { colors: v })}
                        disabled={item.addedToQuote}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {COLOR_OPTIONS.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!isBooklet && (
                      <div>
                        <Label className="text-xs">Fold</Label>
                        <Select 
                          value={item.specs.foldType} 
                          onValueChange={(v) => updateSpecs(item.id, { foldType: v })}
                          disabled={item.addedToQuote}
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FOLD_TYPE_OPTIONS.map(f => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Lamination</Label>
                      <Select 
                        value={item.specs.lamination} 
                        onValueChange={(v) => updateSpecs(item.id, { lamination: v })}
                        disabled={item.addedToQuote}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LAM_OPTIONS.map(l => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Row 3: Booklet Cover (if applicable) */}
                  {isBooklet && (
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs">Cover Paper</Label>
                        <Select 
                          value={item.specs.coverPaper || ""} 
                          onValueChange={(v) => updateSpecs(item.id, { coverPaper: v })}
                          disabled={item.addedToQuote}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="Same as inside" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Same as inside</SelectItem>
                            {PAPER_OPTIONS.filter(p => p.value !== "Custom").map(p => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Cover Colors</Label>
                        <Select 
                          value={item.specs.coverColors || ""} 
                          onValueChange={(v) => updateSpecs(item.id, { coverColors: v })}
                          disabled={item.addedToQuote}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="Same as inside" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Same as inside</SelectItem>
                            {COLOR_OPTIONS.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  {/* Row 4: Notes */}
                  <div>
                    <Label className="text-xs">Additional Notes</Label>
                    <Input
                      value={item.specs.notes}
                      onChange={(e) => updateSpecs(item.id, { notes: e.target.value })}
                      placeholder="Any special instructions, finishing, etc."
                      disabled={item.addedToQuote}
                      className="h-9"
                    />
                  </div>
                  
                  {/* Spec Preview */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border">
                    <Label className="text-xs text-muted-foreground mb-1 block">Spec Summary (for vendors)</Label>
                    <p className="text-sm font-medium">{buildSpecsText(item.specs, item.pieceType)}</p>
                  </div>
                </div>
              )}
              
              {/* VENDOR TABLE */}
              {item.vendorQuotes.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Add vendors to compare prices</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Vendor</th>
                      <th className="px-2 py-2 text-right w-24">Cost</th>
                      <th className="px-2 py-2 text-right w-24">Ship</th>
                      <th className="px-2 py-2 text-right w-20">Markup</th>
                      <th className="px-2 py-2 text-right w-28">Price</th>
                      <th className="px-4 py-2 text-center w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {item.vendorQuotes.map(vq => {
                      const isCheapest = cheapestId === vq.vendorId && vq.price > 0
                      const isSelected = item.selectedVendorId === vq.vendorId
                      
                      return (
                        <tr key={vq.vendorId} className={cn(
                          "transition-colors",
                          isCheapest && "bg-green-50 dark:bg-green-950/30",
                          isSelected && "ring-2 ring-inset ring-primary"
                        )}>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{vq.vendorName}</span>
                              {vq.isInternal && <Badge variant="secondary" className="text-[10px]">Printout</Badge>}
                              {isCheapest && <Trophy className="h-4 w-4 text-green-600" />}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number" min={0} step={0.01}
                              value={vq.cost || ""}
                              onChange={(e) => updateVendorQuote(item.id, vq.vendorId, "cost", parseFloat(e.target.value) || 0)}
                              className="h-8 text-right"
                              disabled={item.addedToQuote}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number" min={0} step={0.01}
                              value={vq.shipping || ""}
                              onChange={(e) => updateVendorQuote(item.id, vq.vendorId, "shipping", parseFloat(e.target.value) || 0)}
                              className="h-8 text-right"
                              disabled={item.addedToQuote}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number" min={0} step={1}
                              value={vq.markupPercent || ""}
                              onChange={(e) => updateVendorQuote(item.id, vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)}
                              className="h-8 text-right"
                              disabled={item.addedToQuote}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number" min={0} step={0.01}
                                value={vq.price || ""}
                                onChange={(e) => updateVendorQuote(item.id, vq.vendorId, "price", parseFloat(e.target.value) || 0)}
                                className={cn("h-8 text-right font-bold", vq.price > 0 && "text-green-700", vq.priceOverride && "border-amber-400")}
                                disabled={item.addedToQuote}
                              />
                              {vq.priceOverride && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => recalculatePrice(item.id, vq.vendorId)}>
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {vq.isInternal && (
                                <Button
                                  variant={vq.calcState ? "default" : "outline"}
                                  size="sm"
                                  className={cn("h-8 px-2", vq.calcState && "bg-blue-600")}
                                  onClick={() => openCalculator(item.id, vq.vendorId)}
                                  disabled={item.addedToQuote}
                                >
                                  <Calculator className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                className="h-8"
                                onClick={() => selectVendor(item.id, vq.vendorId)}
                                disabled={item.addedToQuote}
                              >
                                {isSelected && <Check className="h-4 w-4 mr-1" />}
                                {isSelected ? "Selected" : "Select"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeVendorFromItem(item.id, vq.vendorId)}
                                disabled={item.addedToQuote}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              
              {/* ADD TO QUOTE BUTTON */}
              {item.selectedVendorId && !item.addedToQuote && (
                <div className="px-4 py-3 bg-muted/30 border-t">
                  <Button
                    onClick={() => handleAddToQuote(item.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    disabled={item.vendorQuotes.find(v => v.vendorId === item.selectedVendorId)?.price === 0}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Add to Quote - {formatCurrency(item.vendorQuotes.find(v => v.vendorId === item.selectedVendorId)?.price || 0)}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Calculator Dialog */}
      <Dialog open={showCalc} onOpenChange={setShowCalc}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Printout Calculator</DialogTitle>
            <DialogDescription>Calculate price, then click "Use This Price"</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {calcItem?.calcType === "flat" && <PrintingCalculator standalone />}
            {calcItem?.calcType === "envelope" && <EnvelopeTab standalone />}
            {calcItem?.calcType === "booklet" && <BookletCalculator standalone />}
            {calcItem?.calcType === "spiral" && <SpiralCalculator standalone />}
            {calcItem?.calcType === "perfect" && <PerfectCalculator standalone />}
            {calcItem?.calcType === "pad" && <PadCalculator standalone />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

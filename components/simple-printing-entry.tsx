"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Calculator, Plus, Trophy, Check, Building2, Trash2, FileText, Package, RefreshCw, ChevronRight
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

// Determine which calculator to use based on piece type
function getCalcType(piece: MailPiece): "envelope" | "flat" | "booklet" | "spiral" | "perfect" | "pad" | null {
  if (piece.type === "envelope") return "envelope"
  const meta = PIECE_TYPE_META[piece.type]
  if (!meta) return null
  return meta.calc as any
}

const CALC_LABELS: Record<string, string> = {
  envelope: "Envelope",
  flat: "Flat Print",
  booklet: "Booklet",
  spiral: "Spiral",
  perfect: "Perfect Bound",
  pad: "Pad"
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
  pieceName: string
  pieceType: string
  calcType: string
  specs: string
  quantity: number
  vendorQuotes: VendorQuote[]
  selectedVendorId: string | null
  addedToQuote: boolean
}

// Generate specs from piece info
function generateSpecsFromPiece(piece: MailPiece, printQty: number): string {
  const parts: string[] = []
  parts.push(`Qty: ${printQty.toLocaleString()}`)
  
  if (piece.type === "envelope") {
    parts.push("Envelope")
    if (piece.envelopeName) parts.push(piece.envelopeName)
    if (piece.envelopeKind) parts.push(piece.envelopeKind === "paper" ? "Paper" : "Plastic")
    if (piece.width && piece.height) parts.push(`${piece.width}" x ${piece.height}"`)
  } else {
    const typeMeta = PIECE_TYPE_META[piece.type]
    if (typeMeta) parts.push(typeMeta.label)
    if (piece.width && piece.height) parts.push(`${piece.width}" x ${piece.height}"`)
    if (piece.foldType && piece.foldType !== "none") {
      const foldInfo = FOLD_OPTIONS.find(f => f.id === piece.foldType)
      if (foldInfo) {
        const flatSize = getFlatSize(piece)
        parts.push(`${foldInfo.label}${flatSize.w ? ` (${flatSize.w}" x ${flatSize.h}" flat)` : ""}`)
      }
    }
  }
  return parts.join(" | ")
}

// Main component - shows ALL pieces from mailing, each in a tab
export function SimplePrintingEntry() {
  const { addItem } = useQuote()
  const { pieces, printQty } = useMailing()
  const { data: vendors, error: vendorsError, isLoading: vendorsLoading } = useSWR<Vendor[]>("/api/vendors", fetcher)
  
  // Items per piece - one for each printable piece
  const [printItems, setPrintItems] = useState<PrintItem[]>([])
  const [activePieceIdx, setActivePieceIdx] = useState(0)
  
  // Calculator dialog
  const [showCalc, setShowCalc] = useState(false)
  const [calcItemId, setCalcItemId] = useState<string | null>(null)
  const [calcVendorId, setCalcVendorId] = useState<string | null>(null)
  
  // Get all printable pieces (exclude customer-provided in full mode, but in simple mode we show ALL)
  const printablePieces = useMemo(() => {
    return pieces.filter(piece => {
      // Skip plastic envelopes (no printing)
      if (piece.type === "envelope" && piece.envelopeKind === "plastic") return false
      // Include all pieces that can be printed
      const calcType = getCalcType(piece)
      return calcType !== null
    })
  }, [pieces])
  
  // Initialize items from ALL printable pieces
  useEffect(() => {
    if (printablePieces.length > 0 && printItems.length === 0) {
      const items: PrintItem[] = printablePieces.map((piece, idx) => {
        const calcType = getCalcType(piece) || "flat"
        return {
          id: crypto.randomUUID(),
          pieceId: piece.id,
          pieceName: `Piece ${idx + 1}: ${PIECE_TYPE_META[piece.type]?.label || piece.type}`,
          pieceType: piece.type,
          calcType,
          specs: generateSpecsFromPiece(piece, printQty),
          quantity: printQty,
          vendorQuotes: [],
          selectedVendorId: null,
          addedToQuote: false
        }
      })
      setPrintItems(items)
    }
  }, [printablePieces, printItems.length, printQty])
  
  // Current active item
  const activeItem = printItems[activePieceIdx]
  
  // Update functions
  const updateItemSpecs = (itemId: string, specs: string) => {
    setPrintItems(prev => prev.map(item => item.id === itemId ? { ...item, specs } : item))
  }
  
  const updateVendorQuote = (itemId: string, vendorId: string, field: "cost" | "shipping" | "markupPercent" | "price", value: number) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== vendorId) return vq
          const updated = { ...vq, [field]: value }
          if (field === "price") {
            updated.priceOverride = true
          }
          if (!updated.priceOverride && (field === "cost" || field === "shipping" || field === "markupPercent")) {
            const totalCost = updated.cost + updated.shipping
            updated.price = Math.round(totalCost * (1 + updated.markupPercent / 100) * 100) / 100
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
          const totalCost = vq.cost + vq.shipping
          return { ...vq, price: Math.round(totalCost * (1 + vq.markupPercent / 100) * 100) / 100, priceOverride: false }
        })
      }
    }))
  }
  
  const addVendorToItem = (itemId: string, vendorId: string) => {
    const vendor = vendors?.find(v => v.id === vendorId)
    if (!vendor) return
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      if (item.vendorQuotes.some(vq => vq.vendorId === vendorId)) return item
      return {
        ...item,
        vendorQuotes: [...item.vendorQuotes, {
          vendorId: vendor.id,
          vendorName: vendor.company_name,
          isInternal: vendor.is_internal,
          cost: 0,
          shipping: 0,
          markupPercent: 30,
          price: 0,
          priceOverride: false
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
    
    const totalCost = selected.cost + selected.shipping
    
    addItem({
      id: crypto.randomUUID(),
      category: "printing",
      description: item.specs,
      quantity: item.quantity,
      unitCost: totalCost / item.quantity,
      unitPrice: selected.price / item.quantity,
      vendor: selected.vendorName,
      vendorId: selected.vendorId,
      metadata: {
        baseCost: selected.cost,
        shipping: selected.shipping,
        markupPercent: selected.markupPercent,
        isInternal: selected.isInternal,
        pieceType: item.pieceType
      }
    })
    
    setPrintItems(prev => prev.map(i => i.id === itemId ? { ...i, addedToQuote: true } : i))
  }
  
  const getCheapestVendor = (item: PrintItem) => {
    const withPrices = item.vendorQuotes.filter(vq => vq.price > 0)
    if (withPrices.length === 0) return null
    return withPrices.reduce((min, vq) => vq.price < min.price ? vq : min).vendorId
  }
  
  const refreshSpecs = (itemId: string) => {
    const item = printItems.find(i => i.id === itemId)
    if (!item) return
    const piece = printablePieces.find(p => p.id === item.pieceId)
    if (!piece) return
    setPrintItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, specs: generateSpecsFromPiece(piece, printQty), quantity: printQty } : i
    ))
  }
  
  // Get calculator component for current item
  const getCalculatorForItem = (item: PrintItem) => {
    const vq = item.vendorQuotes.find(v => v.vendorId === calcVendorId)
    const onResult = (result: { cost: number; price: number; inputs: any }) => {
      setPrintItems(prev => prev.map(i => {
        if (i.id !== item.id) return i
        return {
          ...i,
          vendorQuotes: i.vendorQuotes.map(v => 
            v.vendorId === calcVendorId 
              ? { ...v, cost: result.cost, price: result.price, calcState: result.inputs, priceOverride: false }
              : v
          )
        }
      }))
      setShowCalc(false)
    }
    
    switch (item.calcType) {
      case "envelope": return <EnvelopeTab standalone />
      case "flat": return <PrintingCalculator onResult={onResult} initialInputs={vq?.calcState} />
      case "booklet": return <BookletCalculator standalone />
      case "spiral": return <SpiralCalculator standalone />
      case "perfect": return <PerfectCalculator standalone />
      case "pad": return <PadCalculator standalone />
      default: return <PrintingCalculator onResult={onResult} initialInputs={vq?.calcState} />
    }
  }

  // No printable pieces
  if (printablePieces.length === 0) {
    return (
      <div className="p-12 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Printable Pieces</h3>
        <p className="text-muted-foreground">Add pieces to your mailer first, then come back here to get vendor pricing.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* PIECE NAVIGATION - Left sidebar style tabs */}
      <div className="flex flex-1 min-h-0">
        {/* Piece List Sidebar */}
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <div className="p-3 border-b bg-background">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Mail Pieces</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {printItems.map((item, idx) => {
              const cheapest = getCheapestVendor(item)
              const cheapestPrice = cheapest ? item.vendorQuotes.find(vq => vq.vendorId === cheapest)?.price : null
              const isActive = idx === activePieceIdx
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePieceIdx(idx)}
                  className={cn(
                    "w-full p-3 text-left border-b transition-all",
                    isActive ? "bg-background border-l-4 border-l-primary" : "hover:bg-muted/50",
                    item.addedToQuote && "bg-green-50 dark:bg-green-950/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      item.addedToQuote ? "bg-green-600 text-white" : "bg-primary/10 text-primary"
                    )}>
                      {item.addedToQuote ? <Check className="h-3 w-3" /> : idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {PIECE_TYPE_META[item.pieceType]?.label || item.pieceType}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {CALC_LABELS[item.calcType] || item.calcType}
                      </div>
                      {item.selectedVendorId && (
                        <div className="text-xs mt-1">
                          <span className="text-green-600 font-medium">
                            {cheapestPrice ? formatCurrency(cheapestPrice) : "Selected"}
                          </span>
                        </div>
                      )}
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                </button>
              )
            })}
          </div>
          
          {/* Summary Footer */}
          <div className="p-3 border-t bg-background">
            <div className="text-xs text-muted-foreground mb-1">Progress</div>
            <div className="flex gap-1">
              {printItems.map((item, idx) => (
                <div 
                  key={item.id}
                  className={cn(
                    "h-2 flex-1 rounded-full",
                    item.addedToQuote ? "bg-green-500" : item.selectedVendorId ? "bg-amber-400" : "bg-muted"
                  )}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {printItems.filter(i => i.addedToQuote).length} of {printItems.length} added
            </div>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeItem && (
            <div className="max-w-3xl space-y-6">
              {/* HEADER */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{PIECE_TYPE_META[activeItem.pieceType]?.label || activeItem.pieceType}</h1>
                  <p className="text-muted-foreground">{CALC_LABELS[activeItem.calcType]} - Qty: {activeItem.quantity.toLocaleString()}</p>
                </div>
                {activeItem.addedToQuote && (
                  <Badge className="bg-green-600 text-white text-sm px-3 py-1">Added to Quote</Badge>
                )}
              </div>
              
              {/* SPECS SECTION */}
              <Card className={cn(activeItem.addedToQuote && "opacity-60 pointer-events-none")}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Job Specifications
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => refreshSpecs(activeItem.id)}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Enter complete specs: Quantity, Size, Paper, Colors, Finishing, etc."
                    value={activeItem.specs}
                    onChange={(e) => updateItemSpecs(activeItem.id, e.target.value)}
                    className="min-h-[80px] text-sm"
                    disabled={activeItem.addedToQuote}
                  />
                </CardContent>
              </Card>
              
              {/* VENDOR PRICING SECTION */}
              <Card className={cn(activeItem.addedToQuote && "opacity-60 pointer-events-none")}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Vendor Pricing
                    </CardTitle>
                    <Select 
                      onValueChange={(v) => addVendorToItem(activeItem.id, v)} 
                      disabled={activeItem.addedToQuote}
                    >
                      <SelectTrigger className="w-52 h-9 bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-2" />
                        <SelectValue placeholder={vendorsLoading ? "Loading..." : "Add Vendor"} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendorsLoading ? (
                          <SelectItem value="_loading" disabled>Loading...</SelectItem>
                        ) : vendorsError ? (
                          <SelectItem value="_error" disabled>Error loading</SelectItem>
                        ) : !vendors || vendors.length === 0 ? (
                          <SelectItem value="_none" disabled>No vendors</SelectItem>
                        ) : (() => {
                          const available = vendors.filter(v => !activeItem.vendorQuotes.some(vq => vq.vendorId === v.id))
                          if (available.length === 0) return <SelectItem value="_all" disabled>All added</SelectItem>
                          return available.map(v => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.company_name} {v.is_internal && "(Printout)"}
                            </SelectItem>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {activeItem.vendorQuotes.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium mb-1">No vendors added yet</p>
                      <p className="text-sm">Click "Add Vendor" to compare prices</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {activeItem.vendorQuotes.map((vq) => {
                        const isCheapest = getCheapestVendor(activeItem) === vq.vendorId && vq.price > 0
                        const isSelected = activeItem.selectedVendorId === vq.vendorId
                        
                        return (
                          <div 
                            key={vq.vendorId}
                            className={cn(
                              "p-4 transition-all",
                              isCheapest && "bg-green-50 dark:bg-green-950/30",
                              isSelected && "ring-2 ring-inset ring-primary"
                            )}
                          >
                            {/* Vendor Header */}
                            <div className="flex items-center gap-3 mb-4">
                              <Building2 className={cn("h-5 w-5", vq.isInternal ? "text-blue-600" : "text-muted-foreground")} />
                              <span className="font-semibold text-lg">{vq.vendorName}</span>
                              {vq.isInternal && <Badge variant="secondary">Printout</Badge>}
                              {isCheapest && (
                                <Badge className="bg-green-600 text-white gap-1">
                                  <Trophy className="h-3 w-3" /> Best Price
                                </Badge>
                              )}
                              <div className="ml-auto flex gap-2">
                                {vq.isInternal && (
                                  <Button
                                    variant={vq.calcState ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => openCalculator(activeItem.id, vq.vendorId)}
                                    className={cn(vq.calcState && "bg-blue-600 hover:bg-blue-700")}
                                  >
                                    <Calculator className="h-4 w-4 mr-1" />
                                    {vq.calcState ? "Edit Calc" : "Calculator"}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeVendorFromItem(activeItem.id, vq.vendorId)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Pricing Grid */}
                            <div className="grid grid-cols-5 gap-4">
                              <div>
                                <label className="text-xs uppercase text-muted-foreground font-medium block mb-1">Cost</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  placeholder="0.00"
                                  value={vq.cost || ""}
                                  onChange={(e) => updateVendorQuote(activeItem.id, vq.vendorId, "cost", parseFloat(e.target.value) || 0)}
                                  className="text-right"
                                />
                              </div>
                              <div>
                                <label className="text-xs uppercase text-muted-foreground font-medium block mb-1">Shipping</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  placeholder="0.00"
                                  value={vq.shipping || ""}
                                  onChange={(e) => updateVendorQuote(activeItem.id, vq.vendorId, "shipping", parseFloat(e.target.value) || 0)}
                                  className="text-right"
                                />
                              </div>
                              <div>
                                <label className="text-xs uppercase text-muted-foreground font-medium block mb-1">Markup %</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  placeholder="30"
                                  value={vq.markupPercent || ""}
                                  onChange={(e) => updateVendorQuote(activeItem.id, vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)}
                                  className="text-right"
                                />
                              </div>
                              <div>
                                <label className="text-xs uppercase text-muted-foreground font-medium block mb-1">
                                  Price {vq.priceOverride && <span className="text-amber-600">(manual)</span>}
                                </label>
                                <div className="flex gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="0.00"
                                    value={vq.price || ""}
                                    onChange={(e) => updateVendorQuote(activeItem.id, vq.vendorId, "price", parseFloat(e.target.value) || 0)}
                                    className={cn("text-right font-bold", vq.price > 0 && "text-green-700 dark:text-green-400", vq.priceOverride && "border-amber-400")}
                                  />
                                  {vq.priceOverride && (
                                    <Button variant="ghost" size="icon" onClick={() => recalculatePrice(activeItem.id, vq.vendorId)} className="shrink-0">
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-end">
                                <Button
                                  variant={isSelected ? "default" : "outline"}
                                  className={cn("w-full", isSelected && "bg-primary")}
                                  onClick={() => selectVendor(activeItem.id, vq.vendorId)}
                                >
                                  {isSelected ? <Check className="h-4 w-4 mr-1" /> : null}
                                  {isSelected ? "Selected" : "Select"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* ADD TO QUOTE BUTTON */}
              {activeItem.selectedVendorId && !activeItem.addedToQuote && (
                <Button 
                  onClick={() => handleAddToQuote(activeItem.id)}
                  className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                  disabled={!activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId && vq.price > 0)}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add to Quote - {formatCurrency(activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price || 0)}
                </Button>
              )}
              
              {/* NEXT PIECE BUTTON */}
              {activeItem.addedToQuote && activePieceIdx < printItems.length - 1 && (
                <Button 
                  onClick={() => setActivePieceIdx(activePieceIdx + 1)}
                  className="w-full h-12 text-lg"
                  variant="outline"
                >
                  Next Piece
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Calculator Dialog */}
      <Dialog open={showCalc} onOpenChange={setShowCalc}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Printout Calculator</DialogTitle>
            <DialogDescription>Calculate price, then click "Use This Price" to bring it back</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {activeItem && getCalculatorForItem(activeItem)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

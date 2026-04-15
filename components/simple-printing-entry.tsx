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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { 
  Calculator, Plus, Trophy, Check, Building2, Trash2, FileText, Package, RefreshCw
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

type CalcType = "envelope" | "printing" | "booklet" | "spiral" | "perfect" | "pad"

const calcLabels: Record<CalcType, string> = {
  envelope: "Envelope Printing",
  printing: "Flat/Digital Print",
  booklet: "Saddle-Stitch Booklet",
  spiral: "Spiral Binding",
  perfect: "Perfect Binding",
  pad: "Pad"
}

interface VendorQuote {
  vendorId: string
  vendorName: string
  isInternal: boolean
  cost: number          // Base cost from vendor
  shipping: number      // Shipping cost to get it here
  markupPercent: number // Markup percentage
  price: number         // Final price to customer (can be auto-calculated or overridden)
  priceOverride: boolean // True if user manually set price instead of using calculated
  calcState?: any
}

interface PrintItem {
  id: string
  pieceId: string
  pieceName: string
  specs: string
  quantity: number
  vendorQuotes: VendorQuote[]
  selectedVendorId: string | null
  addedToQuote: boolean
}

// Generate specs text from a mail piece
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

export function SimplePrintingEntry({ calcType = "printing" }: { calcType?: CalcType }) {
  const { addItem } = useQuote()
  const { pieces, printQty } = useMailing()
  const { data: vendors, error: vendorsError, isLoading: vendorsLoading } = useSWR<Vendor[]>("/api/vendors", fetcher)
  

  
  // Items per piece
  const [printItems, setPrintItems] = useState<PrintItem[]>([])
  const [activePieceId, setActivePieceId] = useState<string | null>(null)
  
  // Calculator dialog
  const [showCalc, setShowCalc] = useState(false)
  const [calcItemId, setCalcItemId] = useState<string | null>(null)
  const [calcVendorId, setCalcVendorId] = useState<string | null>(null)
  
  // Get Printout vendor (internal)
  const printoutVendor = useMemo(() => vendors?.find(v => v.is_internal) || null, [vendors])
  const externalVendors = useMemo(() => vendors?.filter(v => !v.is_internal && v.status === "active") || [], [vendors])
  
  // Get relevant pieces for this calculator type
  const relevantPieces = useMemo(() => {
    return pieces.filter(piece => {
      const meta = PIECE_TYPE_META[piece.type]
      if (!meta) return false
      switch (calcType) {
        case "envelope": return piece.type === "envelope"
        case "printing": return meta.calc === "flat"
        case "booklet": return meta.calc === "booklet"
        case "spiral": return meta.calc === "spiral"
        case "perfect": return meta.calc === "perfect"
        case "pad": return meta.calc === "pad"
        default: return false
      }
    })
  }, [pieces, calcType])
  
  // Initialize items from relevant pieces - start with EMPTY vendor list
  // User decides which vendors to compare for each piece
  useEffect(() => {
    if (relevantPieces.length > 0 && printItems.length === 0) {
      const items: PrintItem[] = relevantPieces.map(piece => ({
        id: crypto.randomUUID(),
        pieceId: piece.id,
        pieceName: PIECE_TYPE_META[piece.type]?.label || piece.type,
        specs: generateSpecsFromPiece(piece, printQty),
        quantity: printQty,
        vendorQuotes: [], // START EMPTY - user adds vendors they want to compare
        selectedVendorId: null,
        addedToQuote: false
      }))
      setPrintItems(items)
      if (items.length > 0) setActivePieceId(items[0].pieceId)
    }
  }, [relevantPieces, printItems.length, printQty])
  
  // Get current active item
  const activeItem = printItems.find(item => item.pieceId === activePieceId)
  
  // Update functions
  const updateItemSpecs = (itemId: string, specs: string) => {
    setPrintItems(prev => prev.map(item => item.id === itemId ? { ...item, specs } : item))
  }
  
  const updateItemQuantity = (itemId: string, quantity: number) => {
    setPrintItems(prev => prev.map(item => item.id === itemId ? { ...item, quantity } : item))
  }
  
  const updateVendorQuote = (itemId: string, vendorId: string, field: "cost" | "shipping" | "markupPercent" | "price", value: number) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== vendorId) return vq
          const updated = { ...vq, [field]: value }
          // If user changes price directly, mark as override
          if (field === "price") {
            updated.priceOverride = true
          }
          // Auto-calculate price if not overridden and cost/shipping/markup changes
          if (!updated.priceOverride && (field === "cost" || field === "shipping" || field === "markupPercent")) {
            const totalCost = updated.cost + updated.shipping
            updated.price = Math.round(totalCost * (1 + updated.markupPercent / 100) * 100) / 100
          }
          return updated
        })
      }
    }))
  }
  
  // Recalculate price from cost+shipping+markup
  const recalculatePrice = (itemId: string, vendorId: string) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(vq => {
          if (vq.vendorId !== vendorId) return vq
          const totalCost = vq.cost + vq.shipping
          return { 
            ...vq, 
            price: Math.round(totalCost * (1 + vq.markupPercent / 100) * 100) / 100,
            priceOverride: false 
          }
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
          markupPercent: 30, // Default 30% markup
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
    
    // Total cost includes base cost + shipping
    const totalCost = selected.cost + selected.shipping
    
    addItem({
      id: crypto.randomUUID(),
      category: "printing",
      // Description for CUSTOMER - NO vendor name (internal only)
      description: item.specs,
      quantity: item.quantity,
      unitCost: totalCost / item.quantity,
      unitPrice: selected.price / item.quantity,
      // Vendor info stored internally but NOT shown to customer
      vendor: selected.vendorName,
      vendorId: selected.vendorId,
      // Store additional internal metadata
      metadata: {
        baseCost: selected.cost,
        shipping: selected.shipping,
        markupPercent: selected.markupPercent,
        isInternal: selected.isInternal
      }
    })
    
    setPrintItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, addedToQuote: true } : i
    ))
  }
  
  const getCheapestVendor = (item: PrintItem) => {
    const withPrices = item.vendorQuotes.filter(vq => vq.price > 0)
    if (withPrices.length === 0) return null
    return withPrices.reduce((min, vq) => vq.price < min.price ? vq : min).vendorId
  }
  
  const refreshSpecs = (itemId: string) => {
    const item = printItems.find(i => i.id === itemId)
    if (!item) return
    const piece = relevantPieces.find(p => p.id === item.pieceId)
    if (!piece) return
    setPrintItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, specs: generateSpecsFromPiece(piece, printQty), quantity: printQty } : i
    ))
  }

  // No relevant pieces
  if (relevantPieces.length === 0) {
    return (
      <div className="p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No {calcLabels[calcType]} Items</h3>
        <p className="text-muted-foreground">
          No pieces in this mailer need {calcLabels[calcType].toLowerCase()}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* HEADER: Piece Tabs (if multiple pieces) */}
      {relevantPieces.length > 1 && (
        <Tabs value={activePieceId || ""} onValueChange={setActivePieceId} className="w-full">
          <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-muted/50 p-1">
            {printItems.map((item, idx) => {
              const cheapest = getCheapestVendor(item)
              return (
                <TabsTrigger 
                  key={item.pieceId} 
                  value={item.pieceId}
                  className={cn(
                    "gap-2 data-[state=active]:bg-background",
                    item.addedToQuote && "bg-green-100 dark:bg-green-900/30"
                  )}
                >
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  {item.pieceName}
                  {item.addedToQuote && <Check className="h-3 w-3 text-green-600" />}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      )}
      
      {/* MAIN CONTENT: Active Item */}
      {activeItem && (
        <div className="space-y-4">
          {/* SPECS CARD - Clean and compact */}
          <Card className={cn(activeItem.addedToQuote && "opacity-60")}>
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{activeItem.pieceName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{calcLabels[calcType]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    Qty: {activeItem.quantity.toLocaleString()}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => refreshSpecs(activeItem.id)} title="Refresh from mailer">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea
                placeholder="Enter complete specs: Size, Paper, Colors, Finishing..."
                value={activeItem.specs}
                onChange={(e) => updateItemSpecs(activeItem.id, e.target.value)}
                className="min-h-[60px] text-sm resize-none"
                disabled={activeItem.addedToQuote}
              />
            </CardContent>
          </Card>
          
          {/* VENDOR COMPARISON CARD */}
          <Card className={cn(activeItem.addedToQuote && "opacity-60")}>
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Vendor Pricing</CardTitle>
                {/* ALWAYS show vendor dropdown - user picks who to compare */}
                <Select 
                  onValueChange={(v) => addVendorToItem(activeItem.id, v)} 
                  disabled={activeItem.addedToQuote}
                >
                  <SelectTrigger className="w-56 h-9 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={vendorsLoading ? "Loading..." : "Add Vendor to Compare"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorsLoading ? (
                      <SelectItem value="_loading" disabled>Loading vendors...</SelectItem>
                    ) : vendorsError ? (
                      <SelectItem value="_error" disabled>Error loading vendors</SelectItem>
                    ) : !vendors || vendors.length === 0 ? (
                      <SelectItem value="_none" disabled>No vendors in database</SelectItem>
                    ) : (() => {
                      const availableVendors = vendors.filter(v => !activeItem.vendorQuotes.some(vq => vq.vendorId === v.id))
                      if (availableVendors.length === 0) {
                        return <SelectItem value="_all" disabled>All vendors added</SelectItem>
                      }
                      return availableVendors.map(v => (
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
                <div className="p-8 text-center text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No vendors added yet</p>
                  <p className="text-sm mt-1">Use "Add vendor" above to add vendors to compare prices</p>
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
                        "p-4 transition-all cursor-pointer hover:bg-muted/50 border-b last:border-b-0",
                        isCheapest && "bg-green-50 dark:bg-green-950/20",
                        isSelected && "ring-2 ring-inset ring-primary bg-primary/5"
                      )}
                      onClick={() => !activeItem.addedToQuote && selectVendor(activeItem.id, vq.vendorId)}
                    >
                      {/* Row 1: Vendor name + badges + actions */}
                      <div className="flex items-center gap-3 mb-3">
                        {/* Selection indicator */}
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                        )}>
                          {isSelected && <Check className="h-4 w-4" />}
                        </div>
                        
                        {/* Vendor name */}
                        <div className="flex items-center gap-2 flex-1">
                          <Building2 className={cn("h-5 w-5", vq.isInternal ? "text-blue-600" : "text-muted-foreground")} />
                          <span className="font-semibold text-base">{vq.vendorName}</span>
                          {vq.isInternal && <Badge variant="secondary" className="text-xs">Printout</Badge>}
                          {isCheapest && (
                            <Badge className="bg-green-600 text-white text-xs gap-1">
                              <Trophy className="h-3 w-3" /> Best Price
                            </Badge>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {vq.isInternal && (
                            <Button
                              variant={vq.calcState ? "default" : "outline"}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openCalculator(activeItem.id, vq.vendorId)
                              }}
                              className={cn("gap-1", vq.calcState && "bg-blue-600 hover:bg-blue-700")}
                              disabled={activeItem.addedToQuote}
                            >
                              <Calculator className="h-4 w-4" />
                              {vq.calcState ? "Edit Calc" : "Calculator"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeVendorFromItem(activeItem.id, vq.vendorId)
                            }}
                            className="text-destructive hover:text-destructive"
                            disabled={activeItem.addedToQuote}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Row 2: Cost, Shipping, Markup, Price - horizontal layout */}
                      <div className="grid grid-cols-5 gap-3 pl-9">
                        {/* Cost */}
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block">Cost</label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            value={vq.cost || ""}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateVendorQuote(activeItem.id, vq.vendorId, "cost", parseFloat(e.target.value) || 0)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-9 text-sm text-right"
                            disabled={activeItem.addedToQuote}
                          />
                        </div>
                        
                        {/* Shipping */}
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block">Shipping</label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            value={vq.shipping || ""}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateVendorQuote(activeItem.id, vq.vendorId, "shipping", parseFloat(e.target.value) || 0)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-9 text-sm text-right"
                            disabled={activeItem.addedToQuote}
                          />
                        </div>
                        
                        {/* Markup % */}
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block">Markup %</label>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="30"
                            value={vq.markupPercent || ""}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateVendorQuote(activeItem.id, vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-9 text-sm text-right"
                            disabled={activeItem.addedToQuote}
                          />
                        </div>
                        
                        {/* Price (calculated or override) */}
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground font-medium mb-1 block flex items-center gap-1">
                            Price
                            {vq.priceOverride && <span className="text-amber-600">(manual)</span>}
                          </label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="0.00"
                              value={vq.price || ""}
                              onChange={(e) => {
                                e.stopPropagation()
                                updateVendorQuote(activeItem.id, vq.vendorId, "price", parseFloat(e.target.value) || 0)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "h-9 text-sm text-right font-bold flex-1",
                                vq.price > 0 && "text-green-700 dark:text-green-400",
                                vq.priceOverride && "border-amber-400"
                              )}
                              disabled={activeItem.addedToQuote}
                            />
                            {vq.priceOverride && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  recalculatePrice(activeItem.id, vq.vendorId)
                                }}
                                className="h-9 px-2"
                                title="Recalculate from cost+shipping+markup"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Select button */}
                        <div className="flex items-end">
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "w-full h-9",
                              isSelected && "bg-primary"
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              selectVendor(activeItem.id, vq.vendorId)
                            }}
                            disabled={activeItem.addedToQuote}
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
              size="lg" 
              className="w-full h-12 text-base gap-2"
              onClick={() => handleAddToQuote(activeItem.id)}
            >
              <Plus className="h-5 w-5" />
              Add to Quote - {formatCurrency(activeItem.vendorQuotes.find(vq => vq.vendorId === activeItem.selectedVendorId)?.price || 0)}
            </Button>
          )}
          
          {activeItem.addedToQuote && (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
              <Check className="h-6 w-6 mx-auto text-green-600 mb-2" />
              <p className="font-medium text-green-700 dark:text-green-300">Added to Quote</p>
            </div>
          )}
        </div>
      )}
      
      {/* Calculator Dialog */}
      <Dialog open={showCalc} onOpenChange={setShowCalc}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Printout Calculator - {calcLabels[calcType]}</DialogTitle>
            <DialogDescription>
              Calculate price, then click "Use This Price" to bring it back
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {calcType === "printing" && (
              <PrintingCalculator 
                onResult={(result) => {
                  if (calcItemId && calcVendorId) {
                    setPrintItems(prev => prev.map(item => {
                      if (item.id !== calcItemId) return item
                      return {
                        ...item,
                        vendorQuotes: item.vendorQuotes.map(vq => 
                          vq.vendorId === calcVendorId 
                            ? { ...vq, cost: result.cost, price: result.price, calcState: result.inputs }
                            : vq
                        )
                      }
                    }))
                  }
                  setShowCalc(false)
                }}
                initialInputs={printItems.find(i => i.id === calcItemId)?.vendorQuotes.find(vq => vq.vendorId === calcVendorId)?.calcState}
              />
            )}
            {calcType === "envelope" && <EnvelopeTab standalone />}
            {calcType === "booklet" && <BookletCalculator standalone />}
            {calcType === "spiral" && <SpiralCalculator standalone />}
            {calcType === "perfect" && <PerfectCalculator standalone />}
            {calcType === "pad" && <PadCalculator standalone />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

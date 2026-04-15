"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Printer, Plus, Calculator, DollarSign, FileText, Trash2, 
  Building2, Check, Trophy, X, ChevronDown, ChevronUp
} from "lucide-react"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { BookletCalculator } from "@/components/booklet/booklet-calculator"
import { SpiralCalculator } from "@/components/spiral/spiral-calculator"
import { PerfectCalculator } from "@/components/perfect/perfect-calculator"
import { PadCalculator } from "@/components/pad/pad-calculator"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import type { Vendor } from "@/lib/vendor-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface VendorQuote {
  vendorId: string
  vendorName: string
  isInternal: boolean
  cost: string
  price: string
}

interface PrintItem {
  id: string
  specs: string
  quantity: number
  vendorQuotes: VendorQuote[]
  selectedVendorId: string | null
}

// Which calculator to show
type CalcType = "printing" | "booklet" | "spiral" | "perfect" | "pad"

// Generate specs text from a mail piece
function generateSpecsFromPiece(piece: MailPiece, printQty: number): string {
  const parts: string[] = []
  
  // Quantity
  parts.push(`Qty: ${printQty.toLocaleString()}`)
  
  // Type
  const typeMeta = PIECE_TYPE_META[piece.type]
  parts.push(typeMeta?.label || piece.type)
  
  // Size (finished)
  if (piece.width && piece.height) {
    parts.push(`${piece.width}" x ${piece.height}" finished`)
  }
  
  // Fold info
  if (piece.foldType && piece.foldType !== "none") {
    const foldInfo = FOLD_OPTIONS.find(f => f.id === piece.foldType)
    if (foldInfo) {
      const flatSize = getFlatSize(piece)
      if (flatSize.w && flatSize.h) {
        parts.push(`${foldInfo.label} fold (${flatSize.w}" x ${flatSize.h}" flat)`)
      } else {
        parts.push(`${foldInfo.label} fold`)
      }
    }
  }
  
  // Production note
  if (piece.production === "inhouse") {
    parts.push("In-house printing")
  } else if (piece.production === "ohp") {
    parts.push("Out-of-house printing")
  }
  
  return parts.join(" | ")
}

export function SimplePrintingEntry({ calcType = "printing" }: { calcType?: CalcType }) {
  const { addItem, items, removeItem } = useQuote()
  const { pieces, printQty, quantity: mailingQty } = useMailing()
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)
  
  // Local state for items being built (before adding to quote)
  const [printItems, setPrintItems] = useState<PrintItem[]>([])
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  
  // New item form - auto-populate from mailing pieces
  const [specs, setSpecs] = useState("")
  const [quantity, setQuantity] = useState<number>(1)
  
  // Get relevant pieces based on calcType
  const relevantPieces = useMemo(() => {
    return pieces.filter(piece => {
      const meta = PIECE_TYPE_META[piece.type]
      if (!meta) return false
      
      switch (calcType) {
        case "printing": return meta.calc === "flat"
        case "booklet": return meta.calc === "booklet"
        case "spiral": return meta.calc === "spiral"
        case "perfect": return meta.calc === "perfect"
        case "pad": return meta.calc === "pad"
        default: return false
      }
    })
  }, [pieces, calcType])
  
  // Auto-populate specs from first relevant piece (only on initial load)
  useEffect(() => {
    if (relevantPieces.length > 0 && !specs && printQty > 0) {
      const piece = relevantPieces[0]
      setSpecs(generateSpecsFromPiece(piece, printQty))
      setQuantity(printQty)
    }
  }, [relevantPieces, printQty, specs])
  
  // Calculator dialog
  const [showCalculator, setShowCalculator] = useState(false)
  const [calcForItemId, setCalcForItemId] = useState<string | null>(null)
  
  // Get existing quote items of this type
  const existingItems = items.filter(i => i.category === "flat")
  
  // Separate internal (Printout) from external vendors
  const printoutVendor = vendors?.find(v => v.is_internal)
  const externalVendors = vendors?.filter(v => !v.is_internal) || []
  
  // Create new print item
  const handleCreateItem = useCallback(() => {
    if (!specs.trim()) return
    
    const newItem: PrintItem = {
      id: `temp-${Date.now()}`,
      specs: specs.trim(),
      quantity,
      vendorQuotes: [],
      selectedVendorId: null,
    }
    
    // Auto-add Printout as first vendor if exists
    if (printoutVendor) {
      newItem.vendorQuotes.push({
        vendorId: printoutVendor.id,
        vendorName: printoutVendor.company_name,
        isInternal: true,
        cost: "",
        price: "",
      })
    }
    
    setPrintItems(prev => [...prev, newItem])
    setExpandedItemId(newItem.id)
    setSpecs("")
    setQuantity(1)
  }, [specs, quantity, printoutVendor])
  
  // Add vendor to item
  const handleAddVendor = useCallback((itemId: string, vendorId: string) => {
    const vendor = vendors?.find(v => v.id === vendorId)
    if (!vendor) return
    
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      // Don't add duplicates
      if (item.vendorQuotes.some(q => q.vendorId === vendorId)) return item
      
      return {
        ...item,
        vendorQuotes: [...item.vendorQuotes, {
          vendorId: vendor.id,
          vendorName: vendor.company_name,
          isInternal: vendor.is_internal,
          cost: "",
          price: "",
        }]
      }
    }))
  }, [vendors])
  
  // Update vendor quote
  const handleUpdateQuote = useCallback((itemId: string, vendorId: string, field: "cost" | "price", value: string) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.map(q => 
          q.vendorId === vendorId ? { ...q, [field]: value } : q
        )
      }
    }))
  }, [])
  
  // Remove vendor from item
  const handleRemoveVendor = useCallback((itemId: string, vendorId: string) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        vendorQuotes: item.vendorQuotes.filter(q => q.vendorId !== vendorId),
        selectedVendorId: item.selectedVendorId === vendorId ? null : item.selectedVendorId,
      }
    }))
  }, [])
  
  // Select winning vendor
  const handleSelectVendor = useCallback((itemId: string, vendorId: string) => {
    setPrintItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return { ...item, selectedVendorId: vendorId }
    }))
  }, [])
  
  // Add item to quote
  const handleAddToQuote = useCallback((itemId: string) => {
    const item = printItems.find(i => i.id === itemId)
    if (!item || !item.selectedVendorId) return
    
    const selectedQuote = item.vendorQuotes.find(q => q.vendorId === item.selectedVendorId)
    if (!selectedQuote || !selectedQuote.price) return
    
    const cost = parseFloat(selectedQuote.cost) || 0
    const price = parseFloat(selectedQuote.price) || 0
    
    addItem({
      category: "flat",
      label: item.specs,
      description: `Qty: ${item.quantity} | Vendor: ${selectedQuote.vendorName}`,
      cost,
      price,
      qty: item.quantity,
    })
    
    // Remove from local state
    setPrintItems(prev => prev.filter(i => i.id !== itemId))
  }, [printItems, addItem])
  
  // Delete item
  const handleDeleteItem = useCallback((itemId: string) => {
    setPrintItems(prev => prev.filter(i => i.id !== itemId))
  }, [])
  
  // Open calculator for Printout
  const handleOpenCalculator = useCallback((itemId: string) => {
    setCalcForItemId(itemId)
    setShowCalculator(true)
  }, [])
  
  // Find cheapest quote for an item
  const getCheapestVendorId = (item: PrintItem): string | null => {
    const quotesWithPrices = item.vendorQuotes.filter(q => q.price && parseFloat(q.price) > 0)
    if (quotesWithPrices.length === 0) return null
    
    let cheapest = quotesWithPrices[0]
    for (const q of quotesWithPrices) {
      if (parseFloat(q.price) < parseFloat(cheapest.price)) {
        cheapest = q
      }
    }
    return cheapest.vendorId
  }
  
  // Calculator labels
  const calcLabels: Record<CalcType, string> = {
    printing: "Printing",
    booklet: "Booklet",
    spiral: "Spiral Binding",
    perfect: "Perfect Binding",
    pad: "Pad",
  }
  
  // Render appropriate calculator
  const renderCalculator = () => {
    switch (calcType) {
      case "booklet": return <BookletCalculator viewMode="detailed" />
      case "spiral": return <SpiralCalculator viewMode="detailed" />
      case "perfect": return <PerfectCalculator viewMode="detailed" />
      case "pad": return <PadCalculator viewMode="detailed" />
      default: return <PrintingCalculator viewMode="detailed" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900">
          <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{calcLabels[calcType]} - Simple Mode</h2>
          <p className="text-sm text-muted-foreground">Enter specs, get quotes from vendors, pick cheapest</p>
        </div>
      </div>
      
      {/* Existing Quote Items */}
      {existingItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              In Quote ({existingItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">{formatCurrency(item.price)}</p>
                    {item.cost > 0 && (
                      <p className="text-xs text-muted-foreground">Cost: {formatCurrency(item.cost)}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Items Being Quoted */}
      {printItems.map((item) => {
        const cheapestId = getCheapestVendorId(item)
        const isExpanded = expandedItemId === item.id
        const hasSelection = item.selectedVendorId !== null
        const selectedQuote = item.vendorQuotes.find(q => q.vendorId === item.selectedVendorId)
        
        return (
          <Card key={item.id} className={cn(
            "transition-all border-2",
            hasSelection && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-semibold">{item.specs}</CardTitle>
                  <CardDescription className="mt-1">Qty: {item.quantity.toLocaleString()}</CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasSelection && (
                    <Badge className="bg-green-600 text-white">
                      {selectedQuote?.vendorName} - {formatCurrency(parseFloat(selectedQuote?.price || "0"))}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setExpandedItemId(isExpanded ? null : item.id)}>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="space-y-4">
                {/* Vendor Quotes Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Vendor</th>
                        <th className="text-right p-3 font-medium w-32">Cost</th>
                        <th className="text-right p-3 font-medium w-32">Price</th>
                        <th className="text-center p-3 font-medium w-24">Select</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.vendorQuotes.map((quote) => {
                        const isCheapest = cheapestId === quote.vendorId && parseFloat(quote.price) > 0
                        const isSelected = item.selectedVendorId === quote.vendorId
                        
                        return (
                          <tr key={quote.vendorId} className={cn(
                            "border-t",
                            isCheapest && "bg-amber-50 dark:bg-amber-950/30",
                            isSelected && "bg-green-100 dark:bg-green-900/40"
                          )}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {quote.isInternal ? (
                                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">
                                    Printout
                                  </Badge>
                                ) : (
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium">{quote.vendorName}</span>
                                {isCheapest && (
                                  <Badge className="bg-amber-500 text-white text-xs gap-1">
                                    <Trophy className="h-3 w-3" /> Cheapest
                                  </Badge>
                                )}
                              </div>
                              {quote.isInternal && (
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="text-xs p-0 h-auto mt-1 text-blue-600"
                                  onClick={() => handleOpenCalculator(item.id)}
                                >
                                  <Calculator className="h-3 w-3 mr-1" />
                                  Open Calculator
                                </Button>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="0.00"
                                  value={quote.cost}
                                  onChange={(e) => handleUpdateQuote(item.id, quote.vendorId, "cost", e.target.value)}
                                  className="h-8 text-sm pl-7 text-right"
                                />
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="0.00"
                                  value={quote.price}
                                  onChange={(e) => handleUpdateQuote(item.id, quote.vendorId, "price", e.target.value)}
                                  className={cn(
                                    "h-8 text-sm pl-7 text-right font-medium",
                                    isCheapest && "border-amber-400 bg-amber-50"
                                  )}
                                />
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <Button
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                className={cn("h-8", isSelected && "bg-green-600 hover:bg-green-700")}
                                disabled={!quote.price || parseFloat(quote.price) <= 0}
                                onClick={() => handleSelectVendor(item.id, quote.vendorId)}
                              >
                                {isSelected ? <Check className="h-4 w-4" /> : "Use"}
                              </Button>
                            </td>
                            <td className="p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveVendor(item.id, quote.vendorId)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Add Vendor */}
                <div className="flex items-center gap-2">
                  <Select onValueChange={(v) => handleAddVendor(item.id, v)}>
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue placeholder="Add vendor to compare..." />
                    </SelectTrigger>
                    <SelectContent>
                      {printoutVendor && !item.vendorQuotes.some(q => q.vendorId === printoutVendor.id) && (
                        <SelectItem value={printoutVendor.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">In-House</Badge>
                            {printoutVendor.company_name}
                          </div>
                        </SelectItem>
                      )}
                      {externalVendors
                        .filter(v => !item.vendorQuotes.some(q => q.vendorId === v.id))
                        .map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Add to Quote Button */}
                {hasSelection && (
                  <Button 
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => handleAddToQuote(item.id)}
                  >
                    <Plus className="h-4 w-4" />
                    Add to Quote ({selectedQuote?.vendorName} - {formatCurrency(parseFloat(selectedQuote?.price || "0"))})
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
      
      {/* Add New Item Form */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New {calcLabels[calcType]} Item
          </CardTitle>
          <CardDescription>
            {relevantPieces.length > 0 
              ? "Specs auto-filled from mailer info - edit as needed"
              : "Enter complete specs so vendors know exactly what to quote"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-populated info banner */}
          {relevantPieces.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Auto-filled from mailer setup
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {relevantPieces.length} piece(s) found: {relevantPieces.map(p => PIECE_TYPE_META[p.type]?.label).join(", ")}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="shrink-0 h-7 text-xs"
                  onClick={() => {
                    if (relevantPieces.length > 0) {
                      setSpecs(generateSpecsFromPiece(relevantPieces[0], printQty))
                      setQuantity(printQty)
                    }
                  }}
                >
                  Refresh
                </Button>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="specs">Item Specs</Label>
            <Textarea
              id="specs"
              placeholder="Example: 5,000 Flyers - 8.5x11 - 100# Gloss Text - Full Color Both Sides - No Finishing"
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Include: Quantity, Size, Paper, Colors, Finishing - Add any details vendors need to quote
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleCreateItem}
            disabled={!specs.trim()}
            className="w-full gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Create Item & Get Quotes
          </Button>
        </CardContent>
      </Card>
      
      {/* Calculator Dialog */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Printout {calcLabels[calcType]} Calculator</DialogTitle>
          </DialogHeader>
          {renderCalculator()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

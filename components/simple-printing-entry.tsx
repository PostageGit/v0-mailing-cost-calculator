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
  Calculator, DollarSign, Plus, Trophy, Check, Building2, Trash2
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

type CalcType = "printing" | "booklet" | "spiral" | "perfect" | "pad"

const calcLabels: Record<CalcType, string> = {
  printing: "Flat/Digital Print",
  booklet: "Saddle-Stitch Booklet",
  spiral: "Spiral Binding",
  perfect: "Perfect Binding",
  pad: "Pad"
}

interface VendorQuote {
  vendorId: string
  vendorName: string
  isInternal: boolean // Printout = true
  cost: number
  price: number
  // Saved calculator state for Printout (so we can reopen and edit)
  calcState?: any
}

// Generate specs text from a mail piece
function generateSpecsFromPiece(piece: MailPiece, printQty: number): string {
  const parts: string[] = []
  parts.push(`Qty: ${printQty.toLocaleString()}`)
  const typeMeta = PIECE_TYPE_META[piece.type]
  if (typeMeta) parts.push(typeMeta.label)
  if (piece.width && piece.height) {
    parts.push(`${piece.width}" x ${piece.height}" finished`)
  }
  if (piece.foldType && piece.foldType !== "none") {
    const foldInfo = FOLD_OPTIONS.find(f => f.id === piece.foldType)
    if (foldInfo) {
      const flatSize = getFlatSize(piece)
      if (flatSize.w && flatSize.h) {
        parts.push(`${foldInfo.label} (${flatSize.w}" x ${flatSize.h}" flat)`)
      }
    }
  }
  return parts.join(" | ")
}

export function SimplePrintingEntry({ calcType = "printing" }: { calcType?: CalcType }) {
  const { addItem } = useQuote()
  const { pieces, printQty } = useMailing()
  const { data: vendors } = useSWR<Vendor[]>("/api/vendors", fetcher)
  
  // Item specs
  const [specs, setSpecs] = useState("")
  const [quantity, setQuantity] = useState<number>(1)
  
  // Vendor quotes
  const [vendorQuotes, setVendorQuotes] = useState<VendorQuote[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  
  // Calculator dialog
  const [showCalc, setShowCalc] = useState(false)
  const [calcVendorId, setCalcVendorId] = useState<string | null>(null)
  
  // Get Printout vendor (internal)
  const printoutVendor = useMemo(() => 
    vendors?.find(v => v.is_internal) || null
  , [vendors])
  
  // External vendors only
  const externalVendors = useMemo(() => 
    vendors?.filter(v => !v.is_internal && v.status === "active") || []
  , [vendors])
  
  // Find cheapest vendor
  const cheapestVendorId = useMemo(() => {
    const withPrices = vendorQuotes.filter(vq => vq.price > 0)
    if (withPrices.length === 0) return null
    return withPrices.reduce((min, vq) => vq.price < min.price ? vq : min).vendorId
  }, [vendorQuotes])
  
  // Auto-populate from mail pieces
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
  
  useEffect(() => {
    if (relevantPieces.length > 0 && !specs && printQty > 0) {
      setSpecs(generateSpecsFromPiece(relevantPieces[0], printQty))
      setQuantity(printQty)
    }
  }, [relevantPieces, printQty, specs])
  
  // Add Printout automatically if exists
  useEffect(() => {
    if (printoutVendor && vendorQuotes.length === 0) {
      setVendorQuotes([{
        vendorId: printoutVendor.id,
        vendorName: printoutVendor.name,
        isInternal: true,
        cost: 0,
        price: 0
      }])
    }
  }, [printoutVendor, vendorQuotes.length])
  
  const updateVendorQuote = (vendorId: string, field: "cost" | "price", value: number) => {
    setVendorQuotes(prev => prev.map(vq => 
      vq.vendorId === vendorId ? { ...vq, [field]: value } : vq
    ))
  }
  
  const addVendor = (vendorId: string) => {
    const vendor = vendors?.find(v => v.id === vendorId)
    if (!vendor) return
    if (vendorQuotes.some(vq => vq.vendorId === vendorId)) return
    setVendorQuotes(prev => [...prev, {
      vendorId: vendor.id,
      vendorName: vendor.name,
      isInternal: vendor.is_internal,
      cost: 0,
      price: 0
    }])
  }
  
  const removeVendor = (vendorId: string) => {
    setVendorQuotes(prev => prev.filter(vq => vq.vendorId !== vendorId))
    if (selectedVendorId === vendorId) setSelectedVendorId(null)
  }
  
  const openCalculator = (vendorId: string) => {
    setCalcVendorId(vendorId)
    setShowCalc(true)
  }
  
  const handleAddToQuote = () => {
    if (!selectedVendorId) return
    const selected = vendorQuotes.find(vq => vq.vendorId === selectedVendorId)
    if (!selected || selected.price <= 0) return
    
    addItem({
      id: crypto.randomUUID(),
      category: "printing",
      description: `${specs} (${selected.vendorName})`,
      quantity: quantity,
      unitCost: selected.cost / quantity,
      unitPrice: selected.price / quantity,
      vendor: selected.vendorName,
      vendorId: selected.vendorId
    })
    
    // Reset
    setSpecs("")
    setQuantity(1)
    setVendorQuotes(printoutVendor ? [{
      vendorId: printoutVendor.id,
      vendorName: printoutVendor.name,
      isInternal: true,
      cost: 0,
      price: 0
    }] : [])
    setSelectedVendorId(null)
  }
  
  const availableToAdd = externalVendors.filter(v => !vendorQuotes.some(vq => vq.vendorId === v.id))
  
  return (
    <div className="space-y-6 p-4">
      {/* SECTION 1: ITEM SPECS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
            Item Specs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-fill notice */}
          {relevantPieces.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-center justify-between">
              <span>Auto-filled from mailer: {relevantPieces.map(p => PIECE_TYPE_META[p.type]?.label).join(", ")}</span>
              <Button 
                variant="ghost" 
                size="sm"
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
          )}
          
          <Textarea
            placeholder="Enter complete specs: Qty, Size, Paper, Colors, Finishing..."
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            className="min-h-[80px] text-base"
          />
          
          <div className="flex gap-4 items-end">
            <div className="w-32">
              <label className="text-sm font-medium mb-1 block">Quantity</label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <Badge variant="outline" className="h-9 px-3">
              {calcLabels[calcType]}
            </Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* SECTION 2: GET VENDOR PRICES */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
            Get Vendor Prices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vendor Price Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Vendor</th>
                  <th className="text-right p-3 font-medium w-32">Cost</th>
                  <th className="text-right p-3 font-medium w-32">Price</th>
                  <th className="text-center p-3 font-medium w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {vendorQuotes.map((vq) => (
                  <tr 
                    key={vq.vendorId} 
                    className={cn(
                      "border-t transition-colors",
                      vq.vendorId === cheapestVendorId && vq.price > 0 && "bg-green-50 dark:bg-green-950/30",
                      vq.vendorId === selectedVendorId && "ring-2 ring-inset ring-primary"
                    )}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {vq.isInternal ? (
                          <Building2 className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{vq.vendorName}</span>
                        {vq.vendorId === cheapestVendorId && vq.price > 0 && (
                          <Badge className="bg-green-600 text-white gap-1">
                            <Trophy className="h-3 w-3" />
                            Cheapest
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={vq.cost || ""}
                          onChange={(e) => updateVendorQuote(vq.vendorId, "cost", parseFloat(e.target.value) || 0)}
                          className="pl-7 text-right"
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={vq.price || ""}
                          onChange={(e) => updateVendorQuote(vq.vendorId, "price", parseFloat(e.target.value) || 0)}
                          className="pl-7 text-right"
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Printout gets calculator button */}
                        {vq.isInternal && (
                          <Button
                            variant={vq.calcState ? "default" : "outline"}
                            size="sm"
                            onClick={() => openCalculator(vq.vendorId)}
                            title={vq.calcState ? "Edit Calculation" : "Open Calculator"}
                            className={vq.calcState ? "bg-blue-600 hover:bg-blue-700" : ""}
                          >
                            <Calculator className="h-4 w-4" />
                            {vq.calcState && <span className="ml-1 text-xs">Edit</span>}
                          </Button>
                        )}
                        {/* Non-Printout vendors can be removed */}
                        {!vq.isInternal && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVendor(vq.vendorId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                
                {vendorQuotes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No vendors added yet. Add Printout or external vendors below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Add Vendor */}
          {availableToAdd.length > 0 && (
            <div className="flex items-center gap-2">
              <Select onValueChange={addVendor}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Add vendor to compare..." />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {availableToAdd.length} vendor(s) available
              </span>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* SECTION 3: SELECT & ADD TO QUOTE */}
      <Card className={cn(
        "transition-all",
        selectedVendorId && "ring-2 ring-green-500"
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</span>
            Select Vendor & Add to Quote
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Select Buttons */}
          <div className="flex flex-wrap gap-2">
            {vendorQuotes.filter(vq => vq.price > 0).map((vq) => (
              <Button
                key={vq.vendorId}
                variant={selectedVendorId === vq.vendorId ? "default" : "outline"}
                onClick={() => setSelectedVendorId(vq.vendorId)}
                className={cn(
                  "gap-2",
                  vq.vendorId === cheapestVendorId && selectedVendorId !== vq.vendorId && "border-green-500 text-green-700"
                )}
              >
                {selectedVendorId === vq.vendorId && <Check className="h-4 w-4" />}
                {vq.vendorName}
                <span className="font-bold">{formatCurrency(vq.price)}</span>
                {vq.vendorId === cheapestVendorId && <Trophy className="h-3 w-3" />}
              </Button>
            ))}
          </div>
          
          {vendorQuotes.filter(vq => vq.price > 0).length === 0 && (
            <p className="text-muted-foreground text-sm">
              Enter prices above to see vendor options here.
            </p>
          )}
          
          {/* Add to Quote Button */}
          {selectedVendorId && (
            <div className="pt-4 border-t">
              <Button 
                size="lg" 
                className="w-full gap-2 text-lg h-14"
                onClick={handleAddToQuote}
                disabled={!specs.trim()}
              >
                <Plus className="h-5 w-5" />
                Add to Quote - {formatCurrency(vendorQuotes.find(vq => vq.vendorId === selectedVendorId)?.price || 0)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Calculator Dialog - Returns price via onResult and saves state */}
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
                  // Update the vendor quote with calculated price and save state
                  if (calcVendorId) {
                    setVendorQuotes(prev => prev.map(vq => 
                      vq.vendorId === calcVendorId 
                        ? { ...vq, cost: result.cost, price: result.price, calcState: result.inputs }
                        : vq
                    ))
                  }
                  setShowCalc(false)
                }}
                initialInputs={vendorQuotes.find(vq => vq.vendorId === calcVendorId)?.calcState}
              />
            )}
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

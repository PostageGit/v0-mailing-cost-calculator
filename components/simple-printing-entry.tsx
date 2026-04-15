"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useQuote } from "@/lib/quote-context"
import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
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
  specs: string
  quantity: number
  vendorQuotes: VendorQuote[]
  selectedVendorId: string | null
  addedToQuote: boolean
}

function generateSpecsFromPiece(piece: MailPiece, printQty: number): string {
  const parts: string[] = []
  parts.push(`Qty: ${printQty.toLocaleString()}`)
  if (piece.type === "envelope") {
    if (piece.envelopeName) parts.push(piece.envelopeName)
    if (piece.width && piece.height) parts.push(`${piece.width}" x ${piece.height}"`)
  } else {
    const typeMeta = PIECE_TYPE_META[piece.type]
    if (typeMeta) parts.push(typeMeta.label)
    if (piece.width && piece.height) parts.push(`${piece.width}" x ${piece.height}"`)
    if (piece.foldType && piece.foldType !== "none") {
      const foldInfo = FOLD_OPTIONS.find(f => f.id === piece.foldType)
      if (foldInfo) {
        const flatSize = getFlatSize(piece)
        parts.push(`${foldInfo.label}${flatSize.w ? ` (${flatSize.w}"x${flatSize.h}" flat)` : ""}`)
      }
    }
  }
  return parts.join(" | ")
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
        specs: generateSpecsFromPiece(piece, printQty),
        quantity: printQty,
        vendorQuotes: [],
        selectedVendorId: null,
        addedToQuote: false
      }))
      setPrintItems(items)
    }
  }, [printablePieces, printItems.length, printQty])
  
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
    
    addItem({
      id: crypto.randomUUID(),
      category: "printing",
      description: item.specs,
      quantity: item.quantity,
      unitCost: (selected.cost + selected.shipping) / item.quantity,
      unitPrice: selected.price / item.quantity,
      vendor: selected.vendorName,
      vendorId: selected.vendorId,
      metadata: { baseCost: selected.cost, shipping: selected.shipping, markupPercent: selected.markupPercent, isInternal: selected.isInternal }
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
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-sm font-medium text-muted-foreground">
          {printItems.filter(i => i.addedToQuote).length}/{printItems.length} pieces quoted
        </span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex gap-0.5">
          {printItems.map(item => (
            <div 
              key={item.id}
              className={cn(
                "flex-1 transition-colors",
                item.addedToQuote ? "bg-green-500" : item.selectedVendorId ? "bg-amber-400" : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
      </div>

      {/* ALL PIECES - Stacked cards, full width */}
      {printItems.map((item, idx) => {
        const piece = printablePieces.find(p => p.id === item.pieceId)
        const cheapestId = getCheapestVendor(item)
        const typeMeta = PIECE_TYPE_META[item.pieceType]
        
        return (
          <Card key={item.id} className={cn(
            "overflow-hidden",
            item.addedToQuote && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
          )}>
            {/* PIECE HEADER - Full width bar */}
            <div className={cn(
              "px-4 py-3 flex items-center justify-between border-b",
              item.addedToQuote ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/50"
            )}>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
                  item.addedToQuote ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
                )}>
                  {item.addedToQuote ? <Check className="h-4 w-4" /> : idx + 1}
                </span>
                <div>
                  <span className="font-semibold">{typeMeta?.label || item.pieceType}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    Qty: {item.quantity.toLocaleString()}
                  </span>
                </div>
                {item.addedToQuote && <Badge className="bg-green-600 ml-2">Added</Badge>}
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => refreshSpecs(item.id)} disabled={item.addedToQuote}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Select onValueChange={(v) => addVendorToItem(item.id, v)} disabled={item.addedToQuote || vendorsLoading}>
                  <SelectTrigger className="w-44 h-8 text-xs bg-primary text-primary-foreground">
                    <Plus className="h-3 w-3 mr-1" />
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
            
            <CardContent className="p-0">
              {/* SPECS ROW */}
              <div className="px-4 py-2 border-b bg-background">
                <Input
                  value={item.specs}
                  onChange={(e) => updateItemSpecs(item.id, e.target.value)}
                  placeholder="Job specs: size, paper, colors, finishing..."
                  className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
                  disabled={item.addedToQuote}
                />
              </div>
              
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
                      <th className="px-4 py-2 text-left w-[200px]">Vendor</th>
                      <th className="px-2 py-2 text-right w-[100px]">Cost</th>
                      <th className="px-2 py-2 text-right w-[100px]">Shipping</th>
                      <th className="px-2 py-2 text-right w-[80px]">Markup%</th>
                      <th className="px-2 py-2 text-right w-[120px]">Price</th>
                      <th className="px-4 py-2 text-center w-[160px]">Action</th>
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
                              {vq.isInternal && <Badge variant="secondary" className="text-[10px] h-5">Printout</Badge>}
                              {isCheapest && <Trophy className="h-4 w-4 text-green-600" />}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number" min={0} step={0.01}
                              value={vq.cost || ""}
                              onChange={(e) => updateVendorQuote(item.id, vq.vendorId, "cost", parseFloat(e.target.value) || 0)}
                              className="h-8 text-right w-full"
                              disabled={item.addedToQuote}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number" min={0} step={0.01}
                              value={vq.shipping || ""}
                              onChange={(e) => updateVendorQuote(item.id, vq.vendorId, "shipping", parseFloat(e.target.value) || 0)}
                              className="h-8 text-right w-full"
                              disabled={item.addedToQuote}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number" min={0} step={1}
                              value={vq.markupPercent || ""}
                              onChange={(e) => updateVendorQuote(item.id, vq.vendorId, "markupPercent", parseFloat(e.target.value) || 0)}
                              className="h-8 text-right w-full"
                              disabled={item.addedToQuote}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number" min={0} step={0.01}
                                value={vq.price || ""}
                                onChange={(e) => updateVendorQuote(item.id, vq.vendorId, "price", parseFloat(e.target.value) || 0)}
                                className={cn("h-8 text-right w-full font-bold", vq.price > 0 && "text-green-700", vq.priceOverride && "border-amber-400")}
                                disabled={item.addedToQuote}
                              />
                              {vq.priceOverride && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => recalculatePrice(item.id, vq.vendorId)}>
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
                                  className={cn("h-8", vq.calcState && "bg-blue-600")}
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
                                {isSelected ? <Check className="h-4 w-4 mr-1" /> : null}
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
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={item.vendorQuotes.find(vq => vq.vendorId === item.selectedVendorId)?.price === 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Quote - {formatCurrency(item.vendorQuotes.find(vq => vq.vendorId === item.selectedVendorId)?.price || 0)}
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
          {calcItem && (
            <div className="mt-4">
              {calcItem.calcType === "flat" && (
                <PrintingCalculator 
                  onResult={(result) => {
                    setPrintItems(prev => prev.map(i => {
                      if (i.id !== calcItem.id) return i
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
                  }}
                  initialInputs={calcItem.vendorQuotes.find(v => v.vendorId === calcVendorId)?.calcState}
                />
              )}
              {calcItem.calcType === "envelope" && <EnvelopeTab standalone />}
              {calcItem.calcType === "booklet" && <BookletCalculator standalone />}
              {calcItem.calcType === "spiral" && <SpiralCalculator standalone />}
              {calcItem.calcType === "perfect" && <PerfectCalculator standalone />}
              {calcItem.calcType === "pad" && <PadCalculator standalone />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

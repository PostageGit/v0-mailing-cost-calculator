"use client"

import { useState, useCallback } from "react"
import { useQuote } from "@/lib/quote-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Printer, Plus, Calculator, DollarSign, FileText, Trash2 } from "lucide-react"
import { PrintingCalculator } from "@/components/printing/printing-calculator"
import { formatCurrency } from "@/lib/pricing"
import { cn } from "@/lib/utils"

interface SimplePrintingItem {
  description: string
  quantity: number
  cost: number
  price: number
}

export function SimplePrintingEntry() {
  const { addItem, items, removeItem } = useQuote()
  
  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState<number>(1)
  const [cost, setCost] = useState<string>("")
  const [price, setPrice] = useState<string>("")
  const [showCalculator, setShowCalculator] = useState(false)
  
  // Get existing printing items (category "flat")
  const printingItems = items.filter(i => i.category === "flat")
  
  const handleAdd = useCallback(() => {
    if (!description.trim() || !price) return
    
    const costNum = parseFloat(cost) || 0
    const priceNum = parseFloat(price) || 0
    
    addItem({
      category: "flat",
      label: description.trim(),
      description: `Qty: ${quantity}`,
      cost: costNum,
      price: priceNum,
      qty: quantity,
    })
    
    // Reset form
    setDescription("")
    setQuantity(1)
    setCost("")
    setPrice("")
  }, [description, quantity, cost, price, addItem])
  
  const handleRemove = useCallback((id: string) => {
    removeItem(id)
  }, [removeItem])
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900">
            <Printer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">In-House Printing</h2>
            <p className="text-sm text-muted-foreground">Simple Mode - Enter printing costs directly</p>
          </div>
        </div>
        
        {/* Calculator Button */}
        <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calculator className="h-4 w-4" />
              Calculate Price
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Printing Calculator</DialogTitle>
            </DialogHeader>
            <PrintingCalculator viewMode="detailed" />
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Existing Items */}
      {printingItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Added Printing Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {printingItems.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(item.price)}</p>
                    {item.cost > 0 && (
                      <p className="text-xs text-muted-foreground">Cost: {formatCurrency(item.cost)}</p>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Add New Item Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Printing Item
          </CardTitle>
          <CardDescription>
            Enter printing details and price manually, or use the calculator above
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="e.g., 5000 postcards 4x6 full color both sides on 14pt"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
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
            
            <div className="space-y-2">
              <Label htmlFor="cost">Cost (Optional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cost"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleAdd}
            disabled={!description.trim() || !price}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Add to Quote
          </Button>
        </CardContent>
      </Card>
      
      {/* Info Note */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Simple Mode:</strong> You are entering printing prices directly. 
          Use the "Calculate Price" button above if you need help calculating a price based on paper, impressions, and finishing.
        </p>
      </div>
    </div>
  )
}

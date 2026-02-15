"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { formatCurrency } from "@/lib/pricing"
import { Mail, Plus, Check, Info } from "lucide-react"

// Common envelope sizes -- data to be expanded later
const ENVELOPE_SIZES = [
  { id: "10", name: "#10 Standard", width: 4.125, height: 9.5, description: "Business envelope" },
  { id: "9", name: "#9 Reply", width: 3.875, height: 8.875, description: "Reply envelope" },
  { id: "6x9", name: "6x9 Booklet", width: 6, height: 9, description: "Booklet style" },
  { id: "9x12", name: "9x12 Catalog", width: 9, height: 12, description: "Flat/catalog" },
  { id: "10x13", name: "10x13 Catalog", width: 10, height: 13, description: "Large flat" },
  { id: "a7", name: "A7 Invitation", width: 5.25, height: 7.25, description: "Invitation envelope" },
  { id: "a9", name: "A9 Invitation", width: 5.75, height: 8.75, description: "Large invitation" },
  { id: "custom", name: "Custom Size", width: 0, height: 0, description: "Enter dimensions" },
]

export function EnvelopeTab() {
  const quote = useQuote()
  const mailing = useMailing()

  const [selectedSize, setSelectedSize] = useState("")
  const [quantity, setQuantity] = useState(mailing.quantity || 5000)
  const [unitCost, setUnitCost] = useState("")
  const [added, setAdded] = useState(false)

  const selected = ENVELOPE_SIZES.find((e) => e.id === selectedSize)
  const cost = parseFloat(unitCost) || 0
  const totalCost = selected?.id === "custom" || !selected ? cost * quantity : cost * quantity

  const handleAdd = () => {
    if (!selected || cost <= 0) return
    const perUnit = selected.id === "custom"
      ? `${formatCurrency(cost)} / each`
      : `${formatCurrency(cost)} / each`

    quote.addItem({
      category: "item",
      label: `Envelope: ${selected.name} x ${quantity.toLocaleString()}`,
      description: `${selected.width}" x ${selected.height}" | ${perUnit}`,
      amount: totalCost,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <Card className="border-border rounded-2xl overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Envelope Pricing</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Select an envelope size and enter your cost per unit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Size grid */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Envelope Size</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ENVELOPE_SIZES.map((env) => {
              const isSelected = selectedSize === env.id
              return (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => setSelectedSize(env.id)}
                  className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card hover:border-foreground/20"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-background flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-foreground" />
                    </div>
                  )}
                  <span className={`text-xs font-semibold ${isSelected ? "text-background" : "text-foreground"}`}>
                    {env.name}
                  </span>
                  <span className={`text-[10px] mt-0.5 ${isSelected ? "text-background/60" : "text-muted-foreground"}`}>
                    {env.id === "custom" ? "Enter dimensions" : `${env.width}" x ${env.height}"`}
                  </span>
                  <span className={`text-[10px] ${isSelected ? "text-background/50" : "text-muted-foreground"}`}>{env.description}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Pricing inputs */}
        {selected && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground">Cost Per Envelope ($)</label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.00"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1 justify-end">
                <span className="text-lg font-bold font-mono text-primary tabular-nums">
                  {formatCurrency(totalCost)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {quantity.toLocaleString()} x {formatCurrency(cost)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                className="gap-1.5"
                onClick={handleAdd}
                disabled={cost <= 0 || added}
              >
                {added ? (
                  <><Check className="h-4 w-4" /> Added to Quote</>
                ) : (
                  <><Plus className="h-4 w-4" /> Add to Quote</>
                )}
              </Button>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Info className="h-3 w-3" />
                Envelope pricing data can be expanded in Settings.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

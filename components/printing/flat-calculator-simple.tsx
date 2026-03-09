"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { PAPER_OPTIONS, PAPER_PRICES, CLICK_COSTS, SIDES_RULES, getAvailableSides } from "@/lib/printing-pricing"
import { formatCurrency } from "@/lib/utils"

interface CalcResult {
  sheetSize: string
  totalSheets: number
  upsPerSheet: number
  paperCost: number
  clickCost: number
  totalCost: number
  pricePerPiece: number
}

export function FlatCalculatorSimple() {
  // Form state
  const [qty, setQty] = useState("")
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [paperName, setPaperName] = useState("")
  const [sidesValue, setSidesValue] = useState("")
  const [hasBleed, setHasBleed] = useState(false)
  
  // Result state
  const [result, setResult] = useState<CalcResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableSides = paperName ? getAvailableSides(paperName) : []
  const paper = PAPER_OPTIONS.find(p => p.name === paperName)
  const availableSizes = paper?.availableSizes || []

  function parseSize(sizeStr: string): { w: number; h: number } {
    const [a, b] = sizeStr.split("x").map(Number)
    return { w: a, h: b }
  }

  function calculateUps(sheetW: number, sheetH: number, pieceW: number, pieceH: number, bleed: boolean): number {
    const margin = bleed ? 0.25 : 0
    const gutter = 0.2
    const pw = pieceW + margin * 2
    const ph = pieceH + margin * 2

    // Try normal orientation
    const cols1 = Math.floor((sheetW + gutter) / (pw + gutter))
    const rows1 = Math.floor((sheetH + gutter) / (ph + gutter))
    const ups1 = cols1 * rows1

    // Try rotated orientation
    const cols2 = Math.floor((sheetW + gutter) / (ph + gutter))
    const rows2 = Math.floor((sheetH + gutter) / (pw + gutter))
    const ups2 = cols2 * rows2

    return Math.max(ups1, ups2)
  }

  function handleCalculate() {
    setError(null)
    setResult(null)

    const quantity = parseInt(qty)
    const w = parseFloat(width)
    const h = parseFloat(height)

    if (!quantity || quantity <= 0) {
      setError("Please enter a valid quantity")
      return
    }
    if (!w || w <= 0 || !h || h <= 0) {
      setError("Please enter valid dimensions")
      return
    }
    if (!paperName) {
      setError("Please select a paper type")
      return
    }
    if (!sidesValue) {
      setError("Please select sides")
      return
    }

    // Find best sheet size
    let bestOption: CalcResult | null = null

    for (const sizeStr of availableSizes) {
      const sheet = parseSize(sizeStr)
      const ups = calculateUps(sheet.w, sheet.h, w, h, hasBleed)
      
      if (ups === 0) continue

      const totalSheets = Math.ceil(quantity / ups)
      const paperPrice = PAPER_PRICES[paperName]?.[sizeStr] || 0
      const paperCost = paperPrice * totalSheets

      // Calculate click cost
      const sideRule = SIDES_RULES[sidesValue]
      const clickType = sideRule?.clickType || "Color"
      const clickAmount = sideRule?.clickAmount || 1
      const clickRate = CLICK_COSTS[clickType]?.regular || 0.049
      const clickCost = clickRate * clickAmount * totalSheets

      const totalCost = paperCost + clickCost
      const pricePerPiece = totalCost / quantity

      const option: CalcResult = {
        sheetSize: sizeStr,
        totalSheets,
        upsPerSheet: ups,
        paperCost,
        clickCost,
        totalCost,
        pricePerPiece,
      }

      if (!bestOption || totalCost < bestOption.totalCost) {
        bestOption = option
      }
    }

    if (!bestOption) {
      setError("Piece is too large for available sheet sizes")
      return
    }

    setResult(bestOption)
  }

  function handleReset() {
    setQty("")
    setWidth("")
    setHeight("")
    setPaperName("")
    setSidesValue("")
    setHasBleed(false)
    setResult(null)
    setError(null)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Flat Printing Calculator (Simple)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quantity */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. 1000"
            />
          </div>
          <div>
            <Label htmlFor="width">Width (in)</Label>
            <Input
              id="width"
              type="number"
              step="0.125"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="e.g. 6"
            />
          </div>
          <div>
            <Label htmlFor="height">Height (in)</Label>
            <Input
              id="height"
              type="number"
              step="0.125"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g. 9"
            />
          </div>
        </div>

        {/* Paper and Sides */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Paper Type</Label>
            <Select value={paperName} onValueChange={(v) => { setPaperName(v); setSidesValue("") }}>
              <SelectTrigger>
                <SelectValue placeholder="Select paper" />
              </SelectTrigger>
              <SelectContent>
                {PAPER_OPTIONS.map((p) => (
                  <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sides</Label>
            <Select value={sidesValue} onValueChange={setSidesValue} disabled={!paperName}>
              <SelectTrigger>
                <SelectValue placeholder="Select sides" />
              </SelectTrigger>
              <SelectContent>
                {availableSides.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bleed */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="bleed"
            checked={hasBleed}
            onCheckedChange={(checked) => setHasBleed(checked === true)}
          />
          <Label htmlFor="bleed" className="cursor-pointer">Add bleed margins</Label>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <Button onClick={handleCalculate} className="flex-1">
            Calculate
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1">
            Reset
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 rounded">{error}</div>
        )}

        {/* Result */}
        {result && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
            <div className="text-lg font-bold">Result</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Sheet Size:</div>
              <div className="font-medium">{result.sheetSize}</div>
              <div>Ups per Sheet:</div>
              <div className="font-medium">{result.upsPerSheet}</div>
              <div>Total Sheets:</div>
              <div className="font-medium">{result.totalSheets.toLocaleString()}</div>
              <div>Paper Cost:</div>
              <div className="font-medium">{formatCurrency(result.paperCost)}</div>
              <div>Click Cost:</div>
              <div className="font-medium">{formatCurrency(result.clickCost)}</div>
              <div className="font-bold">Total Cost:</div>
              <div className="font-bold text-lg">{formatCurrency(result.totalCost)}</div>
              <div>Price per Piece:</div>
              <div className="font-medium">{formatCurrency(result.pricePerPiece, 4)}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

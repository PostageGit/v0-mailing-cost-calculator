"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  BOX_SIZES,
  selectBestBoxes,
  formatShippingWeight,
  setBoxSizes,
  type ShippingEstimate,
  type BoxRecommendation,
  type BoxSize,
  type PackingLayout,
} from "@/lib/shipping-boxes"
import { calcSheetWeightOz } from "@/lib/paper-weights"
import { getActiveConfig } from "@/lib/pricing-config"
import { useQuote } from "@/lib/quote-context"
import {
  Package,
  AlertTriangle,
  Box as BoxIcon,
  Plus,
  Truck,
  Settings2,
  Sparkles,
  Copy,
  Check,
} from "lucide-react"
import { ShippingLabelModal } from "@/components/shipping-label"

type TabMode = "auto" | "manual"

interface ManualBoxEntry {
  id: string
  boxName: string
  customDims: { l: string; w: string; h: string } | null
  count: string
  piecesPerBox: string
  weightPerBoxLbs: string
}

/** SVG visualization showing how pieces pack in a box */
function BoxPackingViz({ 
  box, 
  layout,
  piecesPerBox,
}: { 
  box: BoxSize
  layout: PackingLayout
  piecesPerBox: number
}) {
  const svgWidth = 200
  const svgHeight = 140
  const padding = 10
  
  // Top-down view (box floor)
  const topViewWidth = 90
  const topViewHeight = 70
  
  // Side view (stack height)
  const sideViewWidth = 70
  const sideViewHeight = 70
  
  // Scale box dimensions to fit in views
  const boxAspect = box.lengthIn / box.widthIn
  let scaledBoxL: number, scaledBoxW: number
  if (boxAspect > topViewWidth / topViewHeight) {
    scaledBoxL = topViewWidth
    scaledBoxW = topViewWidth / boxAspect
  } else {
    scaledBoxW = topViewHeight
    scaledBoxL = topViewHeight * boxAspect
  }
  
  // Scale pieces within box
  const pieceScaleX = scaledBoxL / box.lengthIn
  const pieceScaleY = scaledBoxW / box.widthIn
  const scaledPieceW = layout.pieceWidthAsPlaced * pieceScaleX
  const scaledPieceH = layout.pieceHeightAsPlaced * pieceScaleY
  
  // Calculate actual stacks used (might be less than capacity if not full)
  const actualPiecesPerStack = Math.ceil(piecesPerBox / layout.totalStacks)
  
  // Top view position
  const topX = padding
  const topY = padding + 15
  
  // Side view position  
  const sideX = padding + topViewWidth + 20
  const sideY = padding + 15
  
  // Side view scaling
  const sideScaleH = sideViewHeight / box.heightIn
  const stackHeight = actualPiecesPerStack * (box.heightIn / layout.piecesPerStack)
  const scaledStackH = Math.min(stackHeight * sideScaleH, sideViewHeight)
  
  return (
    <svg width={svgWidth} height={svgHeight} className="bg-secondary/30 rounded-lg">
      {/* Labels */}
      <text x={topX + scaledBoxL/2} y={12} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">
        Top View
      </text>
      <text x={sideX + sideViewWidth/2} y={12} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">
        Side View
      </text>
      
      {/* Top-down view - box outline */}
      <rect
        x={topX}
        y={topY}
        width={scaledBoxL}
        height={scaledBoxW}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-foreground/30"
        rx={2}
      />
      
      {/* Top-down view - pieces/stacks */}
      {Array.from({ length: layout.stacksAlongLength }).map((_, li) =>
        Array.from({ length: layout.stacksAlongWidth }).map((_, wi) => {
          const stackIndex = li * layout.stacksAlongWidth + wi
          if (stackIndex >= layout.totalStacks) return null
          return (
            <rect
              key={`${li}-${wi}`}
              x={topX + li * scaledPieceW + 1}
              y={topY + wi * scaledPieceH + 1}
              width={scaledPieceW - 2}
              height={scaledPieceH - 2}
              className="fill-blue-500/20 stroke-blue-500"
              strokeWidth={1}
              rx={1}
            />
          )
        })
      )}
      
      {/* Stack count label */}
      <text x={topX + scaledBoxL/2} y={topY + scaledBoxW + 12} textAnchor="middle" className="fill-foreground text-[8px] font-bold">
        {layout.totalStacks} stack{layout.totalStacks > 1 ? "s" : ""}
      </text>
      
      {/* Side view - box outline */}
      <rect
        x={sideX}
        y={sideY}
        width={sideViewWidth}
        height={sideViewHeight}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-foreground/30"
        rx={2}
      />
      
      {/* Side view - stacked pieces */}
      <rect
        x={sideX + 4}
        y={sideY + sideViewHeight - scaledStackH - 2}
        width={sideViewWidth - 8}
        height={scaledStackH}
        className="fill-blue-500/20 stroke-blue-500"
        strokeWidth={1}
        rx={1}
      />
      
      {/* Pieces per stack label */}
      <text x={sideX + sideViewWidth/2} y={sideY + sideViewHeight + 12} textAnchor="middle" className="fill-foreground text-[8px] font-bold">
        {actualPiecesPerStack}/stack
      </text>
      
      {/* Total calculation */}
      <text x={svgWidth/2} y={svgHeight - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
        {layout.totalStacks} x {actualPiecesPerStack} = {piecesPerBox} pcs
      </text>
    </svg>
  )
}

/** Product type for applying stack thickness factor */
export type ShippingProductType = "flat" | "saddleStitch" | "perfectBinding" | "spiralBinding"

interface ShippingCalcDialogProps {
  open: boolean
  onClose: () => void
  /** Piece width in inches */
  pieceWidth: number
  /** Piece height in inches */
  pieceHeight: number
  /** Total quantity of pieces */
  quantity: number
  /** Paper name for weight calculation */
  paperName?: string
  /** Per-piece weight in oz (if already known) */
  perPieceWeightOz?: number
  /** Number of sheets per piece (for thickness) */
  sheetsPerPiece?: number
  /** Calculator label (e.g. "500 - 8.5x11 Flat Prints") for the quote line */
  itemLabel?: string
  /** Product type for stack thickness factor (default: flat) */
  productType?: ShippingProductType
  /** Pre-calculated thickness per piece in inches (overrides sheetsPerPiece calculation) */
  thicknessPerPieceIn?: number
}

export function ShippingCalcDialog({
  open,
  onClose,
  pieceWidth,
  pieceHeight,
  quantity,
  paperName,
  perPieceWeightOz,
  sheetsPerPiece = 1,
  itemLabel,
  productType = "flat",
  thicknessPerPieceIn: thicknessOverride,
}: ShippingCalcDialogProps) {
  const quote = useQuote()
  const [boxSizesLoaded, setBoxSizesLoaded] = useState(false)
  const [tabMode, setTabMode] = useState<TabMode>("auto")

  // Load custom box sizes from settings on mount
  useEffect(() => {
    fetch("/api/app-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.box_sizes && Array.isArray(data.box_sizes) && data.box_sizes.length > 0) {
          setBoxSizes(data.box_sizes as BoxSize[])
        }
        setBoxSizesLoaded(true)
      })
      .catch(() => setBoxSizesLoaded(true))
  }, [])
  const [upsOnly, setUpsOnly] = useState(false)
  const [overrideBox, setOverrideBox] = useState<string | null>(null)
  const [shippingCost, setShippingCost] = useState("")
  const [showLabels, setShowLabels] = useState(false)
  const [weightOverride, setWeightOverride] = useState("")
  // Per-box pieces override: key = recommendation index, value = pieces per box string
  const [perBoxOverrides, setPerBoxOverrides] = useState<Record<number, string>>({})
  // Global per-box override (applies to all boxes unless individually overridden)
  const [globalPerBox, setGlobalPerBox] = useState("")

  // Manual mode state
  const [manualBoxes, setManualBoxes] = useState<ManualBoxEntry[]>([
    { id: "1", boxName: "", customDims: null, count: "1", piecesPerBox: "", weightPerBoxLbs: "" },
  ])
  const [copied, setCopied] = useState(false)

  // Generate email-ready text summary
  const generateEmailSummary = (est: ShippingEstimate): string => {
    const lines: string[] = []

    for (const rec of est.recommendations) {
      const weightLbs = (rec.weightPerBoxOz / 16).toFixed(1)
      if (rec.count > 1) {
        lines.push(`${rec.count} boxes @ ${rec.piecesPerBox} pcs each, ${weightLbs} lbs/box`)
      } else {
        lines.push(`1 box @ ${rec.piecesPerBox} pcs, ${weightLbs} lbs`)
      }
    }

    lines.push(`Total: ${est.totalBoxes} box${est.totalBoxes !== 1 ? "es" : ""}, ${est.totalShippingWeightLbs.toFixed(1)} lbs`)

    return lines.join("\n")
  }

  const handleCopyForEmail = async () => {
    if (!displayEstimate) return
    const text = generateEmailSummary(displayEstimate)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Calculate thickness with stack factor for realistic packing
  const thicknessPerPiece = useMemo(() => {
    // Base thickness: use override if provided, otherwise calculate from sheets
    const baseThickness = thicknessOverride ?? sheetsPerPiece * 0.005
    
    // Get stack factor based on product type
    const stackFactor = getActiveConfig().shippingStackFactor
    let factorPercent = 0
    switch (productType) {
      case "saddleStitch":
        factorPercent = stackFactor.saddleStitchPercent
        break
      case "perfectBinding":
        factorPercent = stackFactor.perfectBindingPercent
        break
      case "spiralBinding":
        factorPercent = stackFactor.spiralBindingPercent
        break
      default:
        factorPercent = stackFactor.flatPercent
    }
    
    // Apply stack factor
    return baseThickness * (1 + factorPercent / 100)
  }, [sheetsPerPiece, thicknessOverride, productType])

  // Calculate per-piece weight: manual override > explicit prop > computed from paperName
  const autoPerPieceOz = useMemo(() => {
    if (perPieceWeightOz && perPieceWeightOz > 0) return perPieceWeightOz
    if (paperName && pieceWidth > 0 && pieceHeight > 0) {
      const sheetOz = calcSheetWeightOz(paperName, pieceWidth, pieceHeight)
      if (sheetOz !== null) return sheetOz * sheetsPerPiece
    }
    return 0
  }, [perPieceWeightOz, paperName, pieceWidth, pieceHeight, sheetsPerPiece])

  // Manual weight override takes priority (entered in oz per piece)
  const manualOz = weightOverride ? parseFloat(weightOverride) : 0
  const computedPerPieceOz = manualOz > 0 ? manualOz : autoPerPieceOz
  const totalWeightOz = computedPerPieceOz * quantity
  const hasWeight = computedPerPieceOz > 0

  const estimate = useMemo<ShippingEstimate | null>(() => {
    if (pieceWidth <= 0 || pieceHeight <= 0 || quantity <= 0) return null

    if (overrideBox) {
      const box = BOX_SIZES.find((b) => b.name === overrideBox)
      if (!box) return null
      const maxPerBox = thicknessPerPiece > 0
        ? Math.floor(box.heightIn / thicknessPerPiece)
        : quantity
      const boxCount = maxPerBox > 0 ? Math.ceil(quantity / maxPerBox) : 1
      const piecesPerBox = maxPerBox > 0 ? Math.min(quantity, maxPerBox) : quantity
      const weightPerBox =
        (computedPerPieceOz * piecesPerBox) + box.boxWeightOz
      return {
        recommendations: [
          {
            box,
            count: boxCount,
            piecesPerBox,
            weightPerBoxOz: weightPerBox,
            fillPercent: thicknessPerPiece > 0
              ? Math.min(
                  ((piecesPerBox * thicknessPerPiece) / box.heightIn) * 100,
                  100
                )
              : 50,
          },
        ],
        totalBoxes: boxCount,
        totalShippingWeightOz: weightPerBox * boxCount,
        totalShippingWeightLbs: (weightPerBox * boxCount) / 16,
        hasNonUPSBoxes: !box.upsEligible,
      }
    }

    return selectBestBoxes({
      pieceWidthIn: pieceWidth,
      pieceHeightIn: pieceHeight,
      thicknessPerPieceIn: thicknessPerPiece,
      quantity,
      totalWeightOz,
      upsOnly,
    })
  }, [
    pieceWidth,
    pieceHeight,
    quantity,
    thicknessPerPiece,
    totalWeightOz,
    upsOnly,
    overrideBox,
    computedPerPieceOz,
  ])

  // Apply per-box overrides to produce the final adjusted estimate
  const adjustedEstimate = useMemo<ShippingEstimate | null>(() => {
    if (!estimate) return null

    const globalPcs = globalPerBox ? parseInt(globalPerBox) : 0
    const hasAnyOverride = globalPcs > 0 || Object.values(perBoxOverrides).some(v => v && parseInt(v) > 0)
    if (!hasAnyOverride) return estimate

    // Rebuild recommendations with overrides
    const newRecs = estimate.recommendations.map((rec, i) => {
      const individualOverride = perBoxOverrides[i] ? parseInt(perBoxOverrides[i]) : 0
      const effectivePcs = individualOverride > 0 ? individualOverride : globalPcs > 0 ? globalPcs : rec.piecesPerBox

      // Clamp: at least 1, can't exceed what physically fits
      const maxFit = thicknessPerPiece > 0
        ? Math.floor(rec.box.heightIn / thicknessPerPiece)
        : effectivePcs
      const piecesPerBox = Math.max(1, Math.min(effectivePcs, maxFit))

      // Recalculate count, weight, fill
      const totalForThisRec = rec.piecesPerBox * rec.count
      const newCount = Math.ceil(totalForThisRec / piecesPerBox)
      const weightPerBox = (computedPerPieceOz * piecesPerBox) + rec.box.boxWeightOz
      const fillPercent = thicknessPerPiece > 0
        ? Math.min(((piecesPerBox * thicknessPerPiece) / rec.box.heightIn) * 100, 100)
        : 50

      return {
        ...rec,
        piecesPerBox,
        count: newCount,
        weightPerBoxOz: weightPerBox,
        fillPercent,
      }
    })

    const totalShippingOz = newRecs.reduce((s, r) => s + r.weightPerBoxOz * r.count, 0)

    return {
      recommendations: newRecs,
      totalBoxes: newRecs.reduce((s, r) => s + r.count, 0),
      totalShippingWeightOz: totalShippingOz,
      totalShippingWeightLbs: totalShippingOz / 16,
      hasNonUPSBoxes: newRecs.some((r) => !r.box.upsEligible),
    }
  }, [estimate, globalPerBox, perBoxOverrides, computedPerPieceOz, thicknessPerPiece])

  // Check for capacity warnings in auto mode
  const capacityWarnings = useMemo(() => {
    if (!estimate) return {}
    const warnings: Record<number, string> = {}

    estimate.recommendations.forEach((rec, i) => {
      const maxFit = thicknessPerPiece > 0
        ? Math.floor(rec.box.heightIn / thicknessPerPiece)
        : Infinity

      // Check global override
      const globalPcs = globalPerBox ? parseInt(globalPerBox) : 0
      // Check individual override
      const individualPcs = perBoxOverrides[i] ? parseInt(perBoxOverrides[i]) : 0
      const requestedPcs = individualPcs > 0 ? individualPcs : globalPcs > 0 ? globalPcs : 0

      if (requestedPcs > 0 && requestedPcs > maxFit) {
        warnings[i] = `Max ${maxFit} pcs fit in this box (${rec.box.heightIn}" height)`
      }
    })

    return warnings
  }, [estimate, globalPerBox, perBoxOverrides, thicknessPerPiece])

  // Build manual mode estimate
  const manualEstimate = useMemo<ShippingEstimate | null>(() => {
    if (tabMode !== "manual") return null

    const recs: BoxRecommendation[] = []
    let hasNonUPS = false

    for (const entry of manualBoxes) {
      const count = parseInt(entry.count) || 0
      if (count <= 0) continue

      let box = BOX_SIZES.find((b) => b.name === entry.boxName)

      // Custom dimensions
      if (entry.customDims) {
        const l = parseFloat(entry.customDims.l) || 0
        const w = parseFloat(entry.customDims.w) || 0
        const h = parseFloat(entry.customDims.h) || 0
        if (l > 0 && w > 0 && h > 0) {
          box = {
            name: `Custom (${l}x${w}x${h})`,
            lengthIn: l,
            widthIn: w,
            heightIn: h,
            boxWeightOz: 16, // ~1 lb default for custom
            upsEligible: l + w + h <= 165 && Math.max(l, w, h) <= 108,
          }
        }
      }

      if (!box) continue

      const piecesPerBox = parseInt(entry.piecesPerBox) || 0
      const weightLbs = parseFloat(entry.weightPerBoxLbs) || 0
      const weightOz = weightLbs * 16

      if (!box.upsEligible) hasNonUPS = true

      const fillPercent = thicknessPerPiece > 0 && piecesPerBox > 0
        ? Math.min(((piecesPerBox * thicknessPerPiece) / box.heightIn) * 100, 100)
        : 50

      recs.push({
        box,
        count,
        piecesPerBox,
        weightPerBoxOz: weightOz > 0 ? weightOz : (computedPerPieceOz * piecesPerBox) + box.boxWeightOz,
        fillPercent,
      })
    }

    if (recs.length === 0) return null

    const totalShippingOz = recs.reduce((s, r) => s + r.weightPerBoxOz * r.count, 0)

    return {
      recommendations: recs,
      totalBoxes: recs.reduce((s, r) => s + r.count, 0),
      totalShippingWeightOz: totalShippingOz,
      totalShippingWeightLbs: totalShippingOz / 16,
      hasNonUPSBoxes: hasNonUPS,
    }
  }, [tabMode, manualBoxes, thicknessPerPiece, computedPerPieceOz])

  // Use the adjusted estimate for display
  const displayEstimate = tabMode === "manual" ? manualEstimate : adjustedEstimate

  const handleAddShippingToQuote = () => {
    const cost = parseFloat(shippingCost)
    if (!cost || cost <= 0 || !displayEstimate) return

    const boxNames = displayEstimate.recommendations
      .map((r) => (r.count > 1 ? `${r.box.name} x${r.count}` : r.box.name))
      .join(", ")

    const desc = [
      `${displayEstimate.totalBoxes} box${displayEstimate.totalBoxes !== 1 ? "es" : ""} (${boxNames})`,
      hasWeight
        ? `${formatShippingWeight(displayEstimate.totalShippingWeightOz)} total`
        : "",
      itemLabel || "",
    ]
      .filter(Boolean)
      .join(" | ")

    quote.addItem({
      category: "shipping",
      label: `Shipping - ${displayEstimate.totalBoxes} box${displayEstimate.totalBoxes !== 1 ? "es" : ""}`,
      description: desc,
      amount: cost,
      metadata: {
        totalBoxes: displayEstimate.totalBoxes,
        boxNames,
        totalShippingWeightOz: displayEstimate.totalShippingWeightOz,
        totalShippingWeightLbs: displayEstimate.totalShippingWeightLbs,
        hasNonUPSBoxes: displayEstimate.hasNonUPSBoxes,
      },
    })
    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="w-[80vw] max-w-6xl h-auto max-h-[85vh] p-0 gap-0 overflow-hidden">
          {/* Apple-style header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                <Truck className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  Shipping Calculator
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {itemLabel || `${quantity.toLocaleString()} pieces at ${pieceWidth}"x${pieceHeight}"`}
                </DialogDescription>
              </div>
            </div>
            
            {/* Quick stats in header */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Pieces</p>
                <p className="text-sm font-bold font-mono tabular-nums">{quantity.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Size</p>
                <p className="text-sm font-bold font-mono tabular-nums">{pieceWidth}&quot;x{pieceHeight}&quot;</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Weight</p>
                <p className="text-sm font-bold font-mono tabular-nums">{hasWeight ? formatShippingWeight(totalWeightOz) : "---"}</p>
              </div>
              {productType !== "flat" && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    {productType === "saddleStitch" && "Saddle Stitch"}
                    {productType === "perfectBinding" && "Perfect Bind"}
                    {productType === "spiralBinding" && "Spiral"}
                  </span>
                  <span className="text-[10px] text-blue-500 dark:text-blue-500">
                    +{(() => {
                      const sf = getActiveConfig().shippingStackFactor
                      switch (productType) {
                        case "saddleStitch": return sf.saddleStitchPercent
                        case "perfectBinding": return sf.perfectBindingPercent
                        case "spiralBinding": return sf.spiralBindingPercent
                        default: return sf.flatPercent
                      }
                    })()}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Main content area - horizontal layout */}
          <div className="flex h-full">
            {/* Left sidebar - Controls */}
            <div className="w-72 shrink-0 border-r border-border/50 bg-secondary/20 p-5 flex flex-col gap-4">
              {/* Mode tabs */}
              <div className="flex gap-1 p-1 rounded-lg bg-background/80 border border-border/50">
                <button
                  onClick={() => setTabMode("auto")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all",
                    tabMode === "auto"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto
                </button>
                <button
                  onClick={() => setTabMode("manual")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all",
                    tabMode === "manual"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Manual
                </button>
              </div>

              {tabMode === "auto" && (
                <>
                  {/* Weight override */}
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                      Weight per piece (oz)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        placeholder={autoPerPieceOz > 0 ? autoPerPieceOz.toFixed(2) : "Enter oz"}
                        value={weightOverride}
                        onChange={(e) => setWeightOverride(e.target.value)}
                        className={cn(
                          "w-full h-9 text-sm font-mono rounded-lg border bg-background px-3 text-foreground tabular-nums",
                          manualOz > 0 ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border/60"
                        )}
                      />
                      {manualOz > 0 && (
                        <button
                          onClick={() => setWeightOverride("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground hover:text-foreground bg-secondary px-1.5 py-0.5 rounded"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    {!hasWeight && !manualOz && (
                      <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                        Enter weight manually
                      </p>
                    )}
                  </div>

                  {/* Box override */}
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                      Box selection
                    </label>
                    <select
                      value={overrideBox || ""}
                      onChange={(e) => setOverrideBox(e.target.value || null)}
                      className={cn(
                        "w-full h-9 text-sm rounded-lg border bg-background px-2.5 text-foreground",
                        overrideBox ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border/60"
                      )}
                    >
                      <option value="">Auto-select best</option>
                      {BOX_SIZES.filter((b) => !upsOnly || b.upsEligible).map(
                        (b) => (
                          <option key={b.name} value={b.name}>
                            {b.name} ({b.lengthIn}&quot;x{b.widthIn}&quot;x{b.heightIn}&quot;)
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* UPS filter */}
                  <label className="flex items-center gap-2.5 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={upsOnly}
                      onChange={(e) => {
                        setUpsOnly(e.target.checked)
                        setOverrideBox(null)
                      }}
                      className="h-4 w-4 rounded border-border accent-foreground"
                    />
                    <span className="text-xs font-medium text-foreground">
                      UPS-safe boxes only
                    </span>
                  </label>

                  {/* Global per-box override */}
                  {displayEstimate && displayEstimate.recommendations.length > 0 && (
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                        Pieces per box
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          placeholder={String(displayEstimate.recommendations[0].piecesPerBox)}
                          value={globalPerBox}
                          onChange={(e) => {
                            setGlobalPerBox(e.target.value)
                            setPerBoxOverrides({})
                          }}
                          className={cn(
                            "w-full h-9 text-sm font-mono rounded-lg border bg-background px-3 text-foreground tabular-nums",
                            Object.keys(capacityWarnings).length > 0
                              ? "border-red-500 ring-1 ring-red-200"
                              : globalPerBox
                              ? "border-foreground/40 ring-1 ring-foreground/10"
                              : "border-border/60"
                          )}
                        />
                        {globalPerBox && (
                          <button
                            onClick={() => setGlobalPerBox("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground hover:text-foreground bg-secondary px-1.5 py-0.5 rounded"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      {Object.keys(capacityWarnings).length > 0 && (
                        <p className="text-[9px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          Exceeds capacity
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Right main content - Box results */}
            <div className="flex-1 p-6 overflow-y-auto">
              {tabMode === "auto" && displayEstimate ? (
                <div className="h-full flex flex-col">
                  {/* Box cards in horizontal scroll */}
                  <div className="flex-1">
                    <div className="flex gap-4 pb-4">
                      {displayEstimate.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="w-72 shrink-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
                        >
                          {/* Box header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                                <BoxIcon className="h-5 w-5 text-foreground/60" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground">{rec.box.name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {rec.box.lengthIn}&quot;x{rec.box.widthIn}&quot;x{rec.box.heightIn}&quot;
                                </p>
                              </div>
                            </div>
                            {rec.count > 1 && (
                              <span className="text-sm font-bold text-foreground bg-foreground/5 px-2.5 py-1 rounded-full">
                                x{rec.count}
                              </span>
                            )}
                          </div>

                          {!rec.box.upsEligible && (
                            <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Not UPS Safe</span>
                            </div>
                          )}

                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="text-center p-2 rounded-lg bg-secondary/40">
                              <p className="text-[9px] text-muted-foreground font-medium uppercase">Pcs/Box</p>
                              <p className="text-base font-bold font-mono tabular-nums">{rec.piecesPerBox.toLocaleString()}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-secondary/40">
                              <p className="text-[9px] text-muted-foreground font-medium uppercase">Weight</p>
                              <p className="text-base font-bold font-mono tabular-nums">{hasWeight ? formatShippingWeight(rec.weightPerBoxOz) : "---"}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-secondary/40">
                              <p className="text-[9px] text-muted-foreground font-medium uppercase">Fill</p>
                              <p className="text-base font-bold font-mono tabular-nums">{Math.round(rec.fillPercent)}%</p>
                            </div>
                          </div>

                          {/* Packing visualization */}
                          {rec.packingLayout && (
                            <div className="flex justify-center mb-3">
                              <BoxPackingViz 
                                box={rec.box} 
                                layout={rec.packingLayout} 
                                piecesPerBox={rec.piecesPerBox}
                              />
                            </div>
                          )}

                          {/* Fill bar */}
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                rec.fillPercent > 90 ? "bg-amber-500" : "bg-foreground/25"
                              )}
                              style={{ width: `${Math.min(rec.fillPercent, 100)}%` }}
                            />
                          </div>

                          {/* Per-box override */}
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type="number"
                              step="1"
                              min="1"
                              placeholder={String(rec.piecesPerBox)}
                              value={perBoxOverrides[i] ?? ""}
                              onChange={(e) =>
                                setPerBoxOverrides((prev) => ({
                                  ...prev,
                                  [i]: e.target.value,
                                }))
                              }
                              className={cn(
                                "flex-1 h-8 text-xs font-mono rounded-lg border bg-background px-2.5 text-foreground tabular-nums",
                                capacityWarnings[i]
                                  ? "border-red-500 ring-1 ring-red-200"
                                  : perBoxOverrides[i]
                                  ? "border-foreground/40"
                                  : "border-border/50"
                              )}
                            />
                            {perBoxOverrides[i] && (
                              <button
                                onClick={() =>
                                  setPerBoxOverrides((prev) => {
                                    const next = { ...prev }
                                    delete next[i]
                                    return next
                                  })
                                }
                                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          {capacityWarnings[i] && (
                            <p className="text-[9px] text-red-500 font-medium mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {capacityWarnings[i]}
                            </p>
                          )}
                        </div>
                      ))}

                    </div>
                  </div>

                  {/* Totals + Actions footer */}
                  <div className="mt-6 pt-5 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      {/* Totals */}
                      <div className="flex items-center gap-8">
                        <div>
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Total Boxes</p>
                          <p className="text-2xl font-bold font-mono tabular-nums">{displayEstimate.totalBoxes}</p>
                        </div>
                        {hasWeight && (
                          <div>
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Total Weight</p>
                            <p className="text-2xl font-bold font-mono tabular-nums">{formatShippingWeight(displayEstimate.totalShippingWeightOz)}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleCopyForEmail}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-foreground/30 hover:bg-secondary/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-green-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => setShowLabels(true)}
                        >
                          <Package className="h-3.5 w-3.5" />
                          Labels
                        </Button>
                      </div>
                    </div>

                    {displayEstimate.hasNonUPSBoxes && (
                      <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          Some boxes are not UPS-safe
                        </span>
                      </div>
                    )}

                    {/* Add to quote */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="relative flex-1 max-w-[180px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={shippingCost}
                          onChange={(e) => setShippingCost(e.target.value)}
                          className="w-full h-10 text-sm font-mono rounded-lg border border-border bg-background pl-7 pr-3 text-foreground tabular-nums"
                        />
                      </div>
                      <Button
                      onClick={handleAddShippingToQuote}
                      disabled={
                        !shippingCost || parseFloat(shippingCost) <= 0
                      }
                      className="gap-1.5 h-10 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                      Add to Quote
                    </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Package className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No box fits the piece dimensions ({pieceWidth}&quot; x {pieceHeight}&quot;)
                    </p>
                  </div>
                </div>
              )}

              {/* ═══════════ MANUAL TAB - Right Content ═══════════ */}
              {tabMode === "manual" && (
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Customize box sizes, quantities, and weights manually.
                    </p>

                {manualBoxes.map((entry, idx) => (
                  <div key={entry.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Box {idx + 1}</span>
                      {manualBoxes.length > 1 && (
                        <button
                          onClick={() => setManualBoxes((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-[10px] font-bold text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Box selection or custom */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                          Box Type
                        </label>
                        <select
                          value={entry.boxName}
                          onChange={(e) => {
                            const val = e.target.value
                            setManualBoxes((prev) =>
                              prev.map((b, i) =>
                                i === idx
                                  ? { ...b, boxName: val, customDims: val === "custom" ? { l: "", w: "", h: "" } : null }
                                  : b
                              )
                            )
                          }}
                          className="w-full h-9 text-sm rounded-lg border border-border bg-background px-2 text-foreground"
                        >
                          <option value="">Select box...</option>
                          <option value="custom">Custom dimensions</option>
                          {BOX_SIZES.map((b) => (
                            <option key={b.name} value={b.name}>
                              {b.name} ({b.lengthIn}x{b.widthIn}x{b.heightIn})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                          # of Boxes
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={entry.count}
                          onChange={(e) =>
                            setManualBoxes((prev) =>
                              prev.map((b, i) => (i === idx ? { ...b, count: e.target.value } : b))
                            )
                          }
                          className="w-full h-9 text-sm font-mono rounded-lg border border-border bg-background px-3 text-foreground tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Custom dimensions */}
                    {entry.customDims && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-muted-foreground font-medium">Length (in)</label>
                          <input
                            type="number"
                            step="0.25"
                            placeholder="L"
                            value={entry.customDims.l}
                            onChange={(e) =>
                              setManualBoxes((prev) =>
                                prev.map((b, i) =>
                                  i === idx && b.customDims
                                    ? { ...b, customDims: { ...b.customDims, l: e.target.value } }
                                    : b
                                )
                              )
                            }
                            className="w-full h-8 text-xs font-mono rounded-md border border-border bg-background px-2 text-foreground tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground font-medium">Width (in)</label>
                          <input
                            type="number"
                            step="0.25"
                            placeholder="W"
                            value={entry.customDims.w}
                            onChange={(e) =>
                              setManualBoxes((prev) =>
                                prev.map((b, i) =>
                                  i === idx && b.customDims
                                    ? { ...b, customDims: { ...b.customDims, w: e.target.value } }
                                    : b
                                )
                              )
                            }
                            className="w-full h-8 text-xs font-mono rounded-md border border-border bg-background px-2 text-foreground tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground font-medium">Height (in)</label>
                          <input
                            type="number"
                            step="0.25"
                            placeholder="H"
                            value={entry.customDims.h}
                            onChange={(e) =>
                              setManualBoxes((prev) =>
                                prev.map((b, i) =>
                                  i === idx && b.customDims
                                    ? { ...b, customDims: { ...b.customDims, h: e.target.value } }
                                    : b
                                )
                              )
                            }
                            className="w-full h-8 text-xs font-mono rounded-md border border-border bg-background px-2 text-foreground tabular-nums"
                          />
                        </div>
                      </div>
                    )}

                    {/* Pieces per box + Weight */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                          Pieces per box
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={entry.piecesPerBox}
                          onChange={(e) =>
                            setManualBoxes((prev) =>
                              prev.map((b, i) => (i === idx ? { ...b, piecesPerBox: e.target.value } : b))
                            )
                          }
                          className="w-full h-9 text-sm font-mono rounded-lg border border-border bg-background px-3 text-foreground tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                          Weight per box (lbs)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="Auto"
                          value={entry.weightPerBoxLbs}
                          onChange={(e) =>
                            setManualBoxes((prev) =>
                              prev.map((b, i) => (i === idx ? { ...b, weightPerBoxLbs: e.target.value } : b))
                            )
                          }
                          className="w-full h-9 text-sm font-mono rounded-lg border border-border bg-background px-3 text-foreground tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add another box */}
                <button
                  onClick={() =>
                    setManualBoxes((prev) => [
                      ...prev,
                      { id: String(Date.now()), boxName: "", customDims: null, count: "1", piecesPerBox: "", weightPerBoxLbs: "" },
                    ])
                  }
                  className="w-full h-10 rounded-lg border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Another Box Type
                </button>

                {/* Manual totals */}
                {displayEstimate && (
                  <>
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                            Total Boxes
                          </p>
                          <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                            {displayEstimate.totalBoxes}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                            Total Weight
                          </p>
                          <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                            {formatShippingWeight(displayEstimate.totalShippingWeightOz)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setShowLabels(true)}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Print Labels
                      </Button>
                    </div>

                    {/* Copy for email - quick summary */}
                    <button
                      onClick={handleCopyForEmail}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border hover:border-foreground/30 hover:bg-secondary/30 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-green-600">Copied to clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy shipping info for email
                        </>
                      )}
                    </button>

                    {/* Shipping cost input + add to quote */}
                    <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 space-y-3">
                      <p className="text-xs font-semibold text-foreground">
                        Add shipping cost to quote
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={shippingCost}
                            onChange={(e) => setShippingCost(e.target.value)}
                            className="w-full h-10 text-sm font-mono rounded-lg border border-border bg-background pl-7 pr-3 text-foreground tabular-nums"
                          />
                        </div>
                        <Button
                          onClick={handleAddShippingToQuote}
                          disabled={!shippingCost || parseFloat(shippingCost) <= 0}
                          className="gap-1.5 h-10 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold"
                        >
                          <Plus className="h-4 w-4" />
                          Add to Quote
                        </Button>
                      </div>
                    </div>
                  </>
                )}
                </div>
              </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print labels sub-modal */}
      {displayEstimate && (
        <ShippingLabelModal
          open={showLabels}
          onClose={() => setShowLabels(false)}
          estimate={displayEstimate}
        />
      )}
    </>
  )
}

/**
 * Button to open the shipping calculator dialog.
 * Drop this into any calculator's result section.
 */
export function ShippingCalcButton(
  props: Omit<ShippingCalcDialogProps, "open" | "onClose">
) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-full text-xs h-8 border-border"
        onClick={() => setOpen(true)}
      >
        <Truck className="h-3.5 w-3.5" />
        Shipping
      </Button>
      <ShippingCalcDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

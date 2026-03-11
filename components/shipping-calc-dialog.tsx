"use client"

import { useState, useMemo } from "react"
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
  type ShippingEstimate,
} from "@/lib/shipping-boxes"
import { calcSheetWeightOz } from "@/lib/paper-weights"
import { useQuote } from "@/lib/quote-context"
import {
  Package,
  AlertTriangle,
  Box as BoxIcon,
  Plus,
  Truck,
} from "lucide-react"
import { ShippingLabelModal } from "@/components/shipping-label"

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
}: ShippingCalcDialogProps) {
  const quote = useQuote()
  const [upsOnly, setUpsOnly] = useState(false)
  const [overrideBox, setOverrideBox] = useState<string | null>(null)
  const [shippingCost, setShippingCost] = useState("")
  const [showLabels, setShowLabels] = useState(false)
  const [weightOverride, setWeightOverride] = useState("")
  // Per-box pieces override: key = recommendation index, value = pieces per box string
  const [perBoxOverrides, setPerBoxOverrides] = useState<Record<number, string>>({})
  // Global per-box override (applies to all boxes unless individually overridden)
  const [globalPerBox, setGlobalPerBox] = useState("")

  const thicknessPerPiece = sheetsPerPiece * 0.005

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

  // Use the adjusted estimate for display
  const displayEstimate = adjustedEstimate

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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4.5 w-4.5" />
              Shipping Calculator
            </DialogTitle>
            <DialogDescription className="sr-only">
              Calculate box sizes and shipping weight for this order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-1">
            {/* Order info summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Pieces
                </p>
                <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                  {quantity.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Piece Size
                </p>
                <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                  {pieceWidth}&quot;x{pieceHeight}&quot;
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Total Weight
                </p>
                <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                  {hasWeight
                    ? formatShippingWeight(totalWeightOz)
                    : "---"}
                </p>
              </div>
            </div>

            {/* Override controls */}
            <div className="grid grid-cols-2 gap-3">
              {/* Weight override */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
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
                      manualOz > 0 ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border"
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
                    Could not auto-detect weight. Enter manually.
                  </p>
                )}
              </div>

              {/* Box override */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                  Box selection
                </label>
                <select
                  value={overrideBox || ""}
                  onChange={(e) => setOverrideBox(e.target.value || null)}
                  className={cn(
                    "w-full h-9 text-sm rounded-lg border bg-background px-2.5 text-foreground",
                    overrideBox ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border"
                  )}
                >
                  <option value="">Auto-select best box</option>
                  {BOX_SIZES.filter((b) => !upsOnly || b.upsEligible).map(
                    (b) => (
                      <option key={b.name} value={b.name}>
                        {b.name} ({b.lengthIn}&quot;x{b.widthIn}&quot;x
                        {b.heightIn}&quot;)
                        {!b.upsEligible ? " - NOT UPS" : ""}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* UPS filter */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={upsOnly}
                onChange={(e) => {
                  setUpsOnly(e.target.checked)
                  setOverrideBox(null)
                }}
                className="h-3.5 w-3.5 rounded border-border accent-foreground"
              />
              <span className="text-xs font-medium text-muted-foreground">
                UPS-safe boxes only
              </span>
            </label>

            {/* Global per-box override */}
            {displayEstimate && displayEstimate.recommendations.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                  Pieces per box (all boxes)
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
                      globalPerBox ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border"
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
              </div>
            )}

            {/* Box recommendations */}
            {displayEstimate ? (
              <div className="space-y-3">
                {displayEstimate.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                          <BoxIcon className="h-4 w-4 text-foreground/70" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-foreground">
                            {rec.box.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {rec.box.lengthIn}&quot; x {rec.box.widthIn}&quot; x{" "}
                            {rec.box.heightIn}&quot;
                          </span>
                        </div>
                        {rec.count > 1 && (
                          <span className="text-xs font-bold text-foreground bg-secondary px-2 py-0.5 rounded-full">
                            x{rec.count}
                          </span>
                        )}
                      </div>
                      {!rec.box.upsEligible && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-lg uppercase">
                          <AlertTriangle className="h-3 w-3" />
                          Not UPS
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Pieces/box
                        </p>
                        <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                          {rec.piecesPerBox.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Weight/box
                        </p>
                        <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                          {hasWeight
                            ? formatShippingWeight(rec.weightPerBoxOz)
                            : "---"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Fill
                        </p>
                        <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                          {Math.round(rec.fillPercent)}%
                        </p>
                      </div>
                    </div>

                    {/* Per-box override */}
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-[9px] text-muted-foreground font-medium whitespace-nowrap">
                        Change pcs/box:
                      </label>
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
                          "w-20 h-7 text-xs font-mono rounded-md border bg-background px-2 text-foreground tabular-nums",
                          perBoxOverrides[i] ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border/50"
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
                          className="text-[9px] font-bold text-muted-foreground hover:text-foreground"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Fill bar */}
                    <div className="mt-2.5 h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          rec.fillPercent > 90
                            ? "bg-amber-500"
                            : "bg-foreground/30"
                        )}
                        style={{
                          width: `${Math.min(rec.fillPercent, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}

                {/* Totals bar */}
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
                    {hasWeight && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                          Total Weight
                        </p>
                        <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                          {formatShippingWeight(
                            displayEstimate.totalShippingWeightOz
                          )}
                        </p>
                      </div>
                    )}
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

                {displayEstimate.hasNonUPSBoxes && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      Selected box(es) are not strong enough for UPS shipping.
                      Consider upgrading or switching to a UPS-safe box.
                    </span>
                  </div>
                )}

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
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No box fits the piece dimensions ({pieceWidth}&quot; x{" "}
                  {pieceHeight}&quot;)
                </p>
              </div>
            )}
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

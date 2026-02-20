"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { PrintingInputs, FullPrintingResult } from "@/lib/printing-types"
import { FINISH_TYPE_OPTIONS, FOLD_TYPES, type FoldTypeId } from "@/lib/finishing-fold-data"
import {
  calculateFoldFinish,
  DEFAULT_FOLD_SETTINGS,
  type FoldFinishingSettings,
} from "@/lib/finishing-fold-engine"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const DEFAULT_FOLD_FINISH = {
  enabled: false,
  finishType: "fold" as const,
  foldType: "half" as const,
  orientation: "width" as const,
}

interface FoldFinishSectionProps {
  inputs: PrintingInputs
  onInputsChange: (i: PrintingInputs) => void
  currentResult?: FullPrintingResult | null
}

export function FoldFinishSection({
  inputs,
  onInputsChange,
  currentResult,
}: FoldFinishSectionProps) {
  const ff = inputs.foldFinish || DEFAULT_FOLD_FINISH
  const { data: appSettings } = useSWR("/api/app-settings", fetcher)
  const settings: FoldFinishingSettings =
    appSettings?.fold_finishing_settings || DEFAULT_FOLD_SETTINGS

  function update(patch: Partial<typeof ff>) {
    onInputsChange({ ...inputs, foldFinish: { ...ff, ...patch } })
  }

  // Compute live preview
  const preview = useMemo(() => {
    if (!ff.enabled || !ff.finishType || !ff.foldType || !inputs.width || !inputs.height) return null
    return calculateFoldFinish(
      {
        openWidth: inputs.width,
        openHeight: inputs.height,
        qty: inputs.qty || 1,
        paperName: inputs.paperName,
        finishType: ff.finishType as "fold" | "score_and_fold" | "score_only",
        foldType: ff.foldType,
        isBroker: inputs.isBroker || false,
        orientation: ff.orientation || "width",
      },
      settings,
    )
  }, [
    ff.enabled,
    ff.finishType,
    ff.foldType,
    ff.orientation,
    inputs.width,
    inputs.height,
    inputs.qty,
    inputs.paperName,
    inputs.isBroker,
    settings,
  ])

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="fold-enabled"
          checked={ff.enabled}
          onCheckedChange={(checked) =>
            update({ enabled: checked === true })
          }
        />
        <label
          htmlFor="fold-enabled"
          className="text-[13px] font-semibold text-foreground cursor-pointer"
        >
          Fold / Score Finishing
        </label>
      </div>

      {ff.enabled && (
        <div className="flex flex-col gap-3 pl-1">
          {/* Row 1: Finish type + Fold type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Finish Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FINISH_TYPE_OPTIONS.map((ft) => {
                  const selected = ff.finishType === ft.id
                  return (
                    <button
                      key={ft.id}
                      type="button"
                      onClick={() => update({ finishType: ft.id })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all",
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:border-foreground/40",
                      )}
                    >
                      {ft.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Fold Type
              </label>
              <Select
                value={ff.foldType}
                onValueChange={(v) => update({ foldType: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select fold..." />
                </SelectTrigger>
                <SelectContent>
                  {FOLD_TYPES.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Orientation */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Fold Along
            </label>
            <div className="flex gap-1.5">
              {(["width", "height"] as const).map((o) => {
                const selected = (ff.orientation || "width") === o
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => update({ orientation: o })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:border-foreground/40",
                    )}
                  >
                    {o === "width" ? "Width" : "Height"}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preview: fold visualization + pricing */}
          {preview && (
            <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-3">
              {/* Fold visualization */}
              <div className="flex items-center gap-4">
                <FoldVisualization
                  openW={inputs.width}
                  openH={inputs.height}
                  foldType={ff.foldType as FoldTypeId}
                  orientation={ff.orientation || "width"}
                  foldedDims={preview.foldedDimensions}
                />
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-foreground">
                      ${preview.sellPrice.toFixed(2)}
                    </span>
                    {preview.isMinApplied && (
                      <span className="text-[10px] text-amber-600 font-medium">
                        min applied
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <p>
                      Base: ${preview.baseCost.toFixed(2)} | Setup: $
                      {preview.setupCost.toFixed(2)}
                    </p>
                    {preview.foldedDimensions && (
                      <p>
                        Open: {inputs.width}" x {inputs.height}" &rarr; Folded:{" "}
                        {preview.foldedDimensions.w.toFixed(2)}" x{" "}
                        {preview.foldedDimensions.h.toFixed(2)}"
                      </p>
                    )}
                    {preview.isLongSheet && (
                      <p className="text-amber-600 font-medium">
                        Long sheet (+${settings.longSheetSetupFee} setup)
                      </p>
                    )}
                    <p className="text-[10px]">
                      Size tier: {preview.matchedSize} | Paper: {preview.paperCategory}
                      {preview.autoLevel != null && preview.autoLevel > 0 && (
                        <> | Level {preview.autoLevel} (auto)</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 space-y-1">
                  {preview.warnings.map((w, i) => (
                    <p
                      key={i}
                      className="text-[11px] text-amber-700 dark:text-amber-400 font-medium"
                    >
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Suggestion (auto-upgrade) */}
              {preview.suggestion && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    {preview.suggestion}
                  </p>
                </div>
              )}

              {/* Hand fold / Score only notices */}
              {preview.resolution === "hand" && (
                <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-2">
                  <p className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                    Machine fold N/A for this paper/size -- hand fold pricing
                    applied at ${settings.handFoldHourlyRate}/hr.
                  </p>
                </div>
              )}
              {preview.resolution === "score_only" && (
                <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-2">
                  <p className="text-[11px] text-violet-700 dark:text-violet-400 font-medium">
                    Score only -- no machine fold available for this
                    combination. Price includes scoring, customer folds by hand.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Fold Visualization SVG ──
function FoldVisualization({
  openW,
  openH,
  foldType,
  orientation,
  foldedDims,
}: {
  openW: number
  openH: number
  foldType: FoldTypeId
  orientation: "width" | "height"
  foldedDims: { w: number; h: number } | null
}) {
  const svgW = 120
  const svgH = 80
  const padding = 8
  const maxW = svgW - padding * 2
  const maxH = svgH - padding * 2

  // Scale to fit
  const scale = Math.min(maxW / openW, maxH / openH)
  const rW = openW * scale
  const rH = openH * scale
  const ox = (svgW - rW) / 2
  const oy = (svgH - rH) / 2

  // Generate fold lines
  const foldLines: number[] = []
  const isHoriz = orientation === "width" // fold along width = horizontal lines
  const dim = isHoriz ? openH : openW
  const scaledDim = isHoriz ? rH : rW

  switch (foldType) {
    case "half":
      foldLines.push(0.5)
      break
    case "tri":
    case "z":
    case "roll":
      foldLines.push(1 / 3, 2 / 3)
      break
    case "gate":
      foldLines.push(0.25, 0.75)
      break
    case "double_parallel":
      foldLines.push(0.25, 0.5, 0.75)
      break
    case "accordion":
      foldLines.push(0.25, 0.5, 0.75)
      break
  }

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="shrink-0 rounded border border-border bg-muted/20"
    >
      {/* Sheet rectangle */}
      <rect
        x={ox}
        y={oy}
        width={rW}
        height={rH}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        rx={1}
        className="text-foreground"
      />
      {/* Fold lines */}
      {foldLines.map((frac, i) => {
        if (isHoriz) {
          const y = oy + rH * frac
          return (
            <line
              key={i}
              x1={ox + 2}
              y1={y}
              x2={ox + rW - 2}
              y2={y}
              stroke="currentColor"
              strokeWidth={0.8}
              strokeDasharray="3 2"
              className="text-primary"
            />
          )
        } else {
          const x = ox + rW * frac
          return (
            <line
              key={i}
              x1={x}
              y1={oy + 2}
              x2={x}
              y2={oy + rH - 2}
              stroke="currentColor"
              strokeWidth={0.8}
              strokeDasharray="3 2"
              className="text-primary"
            />
          )
        }
      })}
      {/* Dimension labels */}
      <text
        x={svgW / 2}
        y={oy - 2}
        textAnchor="middle"
        className="fill-muted-foreground"
        fontSize={7}
        fontFamily="system-ui"
      >
        {openW}"
      </text>
      <text
        x={ox - 2}
        y={svgH / 2}
        textAnchor="end"
        className="fill-muted-foreground"
        fontSize={7}
        fontFamily="system-ui"
      >
        {openH}"
      </text>
    </svg>
  )
}

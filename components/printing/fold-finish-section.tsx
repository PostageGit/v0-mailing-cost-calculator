"use client"

import { useMemo, useCallback } from "react"
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
  DEFAULT_FOLD_SETTINGS,
  type FoldFinishingSettings,
  type FoldFinishResult,
  type FoldAlternative,
  mapPaperToFoldKey,
  mapFoldTypeToDataKey,
  validateFoldCombo,
} from "@/lib/finishing-fold-engine"
import { ArrowRight, Lightbulb, AlertTriangle, Info, Loader2 } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** POST fetcher for SWR -- calls the bridge API */
async function bridgeFetcher(url: string, body: unknown): Promise<FoldFinishResult> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return data
}

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

  // Check if the original HTML calculator is loaded on the server
  const { data: bridgeStatus } = useSWR("/api/fold-calc", fetcher)

  // Build the bridge API request body from current inputs
  const bridgeRequestBody = useMemo(() => {
    if (!ff.enabled || !ff.finishType || !ff.foldType || !inputs.width || !inputs.height) return null

    // "fold" → FOLD data, "score_and_fold" or "score_only" → SF data
    const cat: "folding" | "sf" = ff.finishType === "fold" ? "folding" : "sf"
    const paperMap = mapPaperToFoldKey(inputs.paperName)
    const paperKey = cat === "folding" ? paperMap.foldKey : paperMap.sfKey

    const dataFoldKey = mapFoldTypeToDataKey(ff.foldType)
    // For SF category, the data keys are "Score & Fold in Half", "Score & Fold in 3", etc.
    const finishDataKey = cat === "sf" ? `Score & ${dataFoldKey}` : dataFoldKey

    return {
      cat,
      paperKey,
      w: inputs.width,
      h: inputs.height,
      finish: finishDataKey,
      qty: inputs.qty || 1,
      axis: (ff.orientation || "width") === "width" ? "w" : "h",
      settings: {
        labor: settings.hourlyRate,
        run: settings.runRate || settings.hourlyRate,
        markup: settings.markupPercent,
        bdisc: settings.brokerDiscountPercent,
        longSetup: settings.longSheetSetupFee,
        lv: Object.fromEntries(settings.setupLevels.map((s, i) => [i + 1, s.minutes])),
      },
    }
  }, [
    ff.enabled, ff.finishType, ff.foldType, ff.orientation,
    inputs.width, inputs.height, inputs.qty, inputs.paperName,
    settings,
  ])

  // SWR key: serialize the request body so SWR dedupes properly
  const swrKey = bridgeRequestBody
    ? ["/api/fold-calc", JSON.stringify(bridgeRequestBody)]
    : null

  const { data: bridgeData, isLoading: bridgeLoading } = useSWR(
    swrKey,
    ([url, body]) => bridgeFetcher(url, JSON.parse(body)),
    { revalidateOnFocus: false, dedupingInterval: 300 }
  )

  // Transform bridge API response into a FoldFinishResult for the UI
  const preview = useMemo((): FoldFinishResult | null => {
    if (!ff.enabled || !bridgeRequestBody) return null

    const cat: "folding" | "sf" = ff.finishType === "fold" ? "folding" : "sf"
    const paperMap = mapPaperToFoldKey(inputs.paperName)
    const paperKey = cat === "folding" ? paperMap.foldKey : paperMap.sfKey
    const paperLabel = cat === "folding" ? "text" : (paperKey === "cardstock" ? "cardstock" : "cover")

    // Fold math for dimensions (pure math, no data dependency)
    const axis = (ff.orientation || "width") === "width" ? "w" : "h"
    const divW = axis === "w"
    const foldDim = divW ? inputs.width : inputs.height
    const dataFoldKey = mapFoldTypeToDataKey(ff.foldType)
    let panels = 1
    if (dataFoldKey === "Fold in Half") panels = 2
    else if (dataFoldKey === "Fold in 3") panels = 3
    else if (dataFoldKey === "Fold in 4" || dataFoldKey === "Gate Fold") panels = 4
    const divided = panels > 1 ? foldDim / panels : foldDim
    const foldedW = divW ? Math.round(divided * 100) / 100 : inputs.width
    const foldedH = divW ? inputs.height : Math.round(divided * 100) / 100

    const finishDataKey = cat === "sf" ? `Score & ${dataFoldKey}` : dataFoldKey
    const validationWarnings = validateFoldCombo(inputs.width, inputs.height, finishDataKey, axis)
    const warnings = validationWarnings.map((w) => w.message)

    // If paper not supported for this finish type, show N/A immediately
    if (!paperKey) {
      return {
        baseCost: 0, setupCost: 0, sellPrice: 0,
        isMinApplied: false, isLongSheet: false,
        warnings: [`${ff.finishType === "fold" ? "Folding" : "Score & Fold"} not available for ${inputs.paperName}`],
        suggestion: null, foldedDimensions: { w: foldedW, h: foldedH },
        matchedSize: "N/A", paperCategory: paperLabel,
        resolution: "na", autoLevel: null, alternatives: [], fromBridge: true,
      }
    }

    // Still loading from bridge
    if (bridgeLoading || !bridgeData) return null

    // Bridge returned an error / N/A / score_only (no pricing)
    if (bridgeData.error && (bridgeData.resolution === "na" || bridgeData.resolution === "hand" || bridgeData.resolution === "score_only")) {
      // Build alternatives from the bridge response
      const alts: FoldAlternative[] = []

      // 1. If bridge tells us which finishes ARE available for this paper/size, suggest them
      if (bridgeData.availableFinishes && Array.isArray(bridgeData.availableFinishes)) {
        for (const avail of bridgeData.availableFinishes) {
          const cleanFinish = avail.replace("Score & ", "")
          const foldTypeMap: Record<string, string> = {
            "Fold in Half": "half", "Fold in 3": "tri", "Fold in 4": "accordion",
            "Z Fold": "z", "Gate Fold": "gate", "Roll Fold": "roll",
            "Double Parallel": "double_parallel",
          }
          const mappedType = foldTypeMap[cleanFinish]
          if (mappedType && mappedType !== ff.foldType) {
            const isScoreFold = avail.startsWith("Score & ")
            alts.push({
              type: "switch_fold",
              label: `Switch to ${avail}`,
              description: `Available for ${inputs.paperName} at ${bridgeData.sizeLabel || bridgeData.sizeKey || "this size"}`,
              finishType: isScoreFold ? "score_and_fold" : cat === "sf" ? "score_and_fold" : "fold",
              foldType: mappedType,
            })
          }
        }
      }

      // 2. If bridge tells us other papers work at this size, suggest them
      if (bridgeData.papersWithTier && Array.isArray(bridgeData.papersWithTier)) {
        for (const altPaper of bridgeData.papersWithTier) {
          alts.push({
            type: "switch_paper",
            label: `Try ${altPaper}`,
            description: `${altPaper} supports ${cat === "folding" ? "folding" : "score & fold"} at size ${bridgeData.sizeKey || "this tier"}. Change paper type above.`,
          })
        }
      }

      // 3. If Score & Fold not available, suggest plain Fold
      if (cat === "sf") {
        const foldMap = mapPaperToFoldKey(inputs.paperName)
        if (foldMap.foldKey) {
          alts.push({
            type: "switch_finish",
            label: "Switch to Fold (no score)",
            description: `Folding available for ${inputs.paperName}`,
            finishType: "fold",
          })
        }
      }

      // Build warning messages: show the main error, the alt/suggestion, and available tiers
      const warningMessages = [...warnings]
      warningMessages.push(bridgeData.error)
      if (bridgeData.alt && bridgeData.alt !== bridgeData.error) {
        warningMessages.push(bridgeData.alt)
      }

      return {
        baseCost: 0, setupCost: 0, sellPrice: 0,
        isMinApplied: false, isLongSheet: bridgeData.sizeKey === "long",
        warnings: warningMessages,
        suggestion: null, foldedDimensions: { w: foldedW, h: foldedH },
        matchedSize: bridgeData.sizeKey || "N/A", paperCategory: paperLabel,
        resolution: bridgeData.resolution === "hand" ? "hand" : bridgeData.resolution === "score_only" ? "score_only" : "na",
        autoLevel: null, alternatives: alts, fromBridge: true,
      }
    }

    // Bridge returned a price
    if (bridgeData.price) {
      const p = bridgeData.price
      if (bridgeData.isScoreOnly) warnings.push("Score only -- no machine fold available")

      const sellPrice = inputs.isBroker ? p.broker : p.retail
      const finalPrice = Math.max(sellPrice, settings.minimumJobPrice)

      return {
        baseCost: p.base,
        setupCost: (p.setupCost || 0) + (p.longFee || 0),
        sellPrice: finalPrice,
        isMinApplied: finalPrice === settings.minimumJobPrice && sellPrice < settings.minimumJobPrice,
        isLongSheet: bridgeData.isLong,
        warnings, suggestion: null,
        foldedDimensions: { w: foldedW, h: foldedH },
        matchedSize: bridgeData.sizeKey, paperCategory: paperLabel,
        resolution: bridgeData.isScoreOnly ? "score_only" : "ok",
        autoLevel: p.level, alternatives: [], fromBridge: true,
      }
    }

    // Bridge returned fallback flag (HTML not loaded)
    if (bridgeData.fallback) {
      return {
        baseCost: 0, setupCost: 0, sellPrice: 0,
        isMinApplied: false, isLongSheet: false,
        warnings: ["HTML calculator not loaded -- upload fold-score-calculator.html to calculators/ folder"],
        suggestion: null, foldedDimensions: { w: foldedW, h: foldedH },
        matchedSize: "N/A", paperCategory: paperLabel,
        resolution: "na", autoLevel: null, alternatives: [], fromBridge: false,
      }
    }

    return null
  }, [ff, inputs, bridgeRequestBody, bridgeData, bridgeLoading, settings])

  function update(patch: Partial<typeof ff>) {
    onInputsChange({ ...inputs, foldFinish: { ...ff, ...patch } })
  }

  function applyAlternative(alt: FoldAlternative) {
    const newFf = { ...ff }
    const newInputs = { ...inputs }
    if (alt.finishType) newFf.finishType = alt.finishType
    if (alt.foldType) newFf.foldType = alt.foldType
    if (alt.paperName) newInputs.paperName = alt.paperName
    newInputs.foldFinish = newFf
    onInputsChange(newInputs)
  }

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
        {bridgeStatus?.loaded && (
          <span className="ml-2 text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            HTML
          </span>
        )}
        {bridgeStatus && !bridgeStatus.loaded && (
          <span className="ml-2 text-[9px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full" title={bridgeStatus.error || "HTML not loaded"}>
            no calc
          </span>
        )}
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

          {/* Loading state */}
          {bridgeLoading && ff.enabled && bridgeRequestBody && (
            <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Calculating from HTML...</span>
            </div>
          )}

          {/* Preview: fold visualization + pricing */}
          {preview && !bridgeLoading && (
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
                      {preview.fromBridge && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium"> | via HTML calc</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status notices */}
              {preview.resolution === "hand" && (
                <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-2.5 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                    Machine fold not available -- hand fold pricing applied at ${settings.handFoldHourlyRate}/hr.
                  </p>
                </div>
              )}
              {preview.resolution === "score_only" && (
                <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-2.5 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-violet-700 dark:text-violet-400 font-medium">
                    Score only -- machine fold not available. Price covers scoring; customer folds by hand.
                  </p>
                </div>
              )}

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                preview.resolution === "score_only" && preview.sellPrice === 0 ? (
                  /* Score-only with no pricing: blue info style (matches original HTML) */
                  <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-2.5 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      {preview.warnings.map((w, i) => (
                        <p key={i} className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">{w}</p>
                      ))}
                    </div>
                  </div>
                ) : preview.resolution === "na" ? (
                  /* Not available: amber warning style */
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      {preview.warnings.map((w, i) => (
                        <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">{w}</p>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* General warnings: amber style */
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 space-y-0.5">
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">{w}</p>
                    ))}
                  </div>
                )
              )}

              {/* Actionable alternatives */}
              {preview.alternatives.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-foreground" />
                    <p className="text-[11px] font-bold text-foreground">Available alternatives</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {preview.alternatives.map((alt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applyAlternative(alt)}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                          "border-border bg-card hover:bg-muted/60 hover:border-foreground/30 hover:shadow-sm",
                          "group",
                        )}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12px] font-semibold text-foreground">{alt.label}</span>
                          <span className="text-[10px] text-muted-foreground">{alt.description}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
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
  const scale = Math.min(maxW / openW, maxH / openH)
  const rW = openW * scale
  const rH = openH * scale
  const ox = (svgW - rW) / 2
  const oy = (svgH - rH) / 2
  const foldLines: number[] = []
  const isHoriz = orientation === "width"

  switch (foldType) {
    case "half": foldLines.push(0.5); break
    case "tri": case "z": case "roll": foldLines.push(1 / 3, 2 / 3); break
    case "gate": foldLines.push(0.25, 0.75); break
    case "double_parallel": case "accordion": foldLines.push(0.25, 0.5, 0.75); break
  }

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="shrink-0 rounded border border-border bg-muted/20">
      <rect x={ox} y={oy} width={rW} height={rH} fill="none" stroke="currentColor" strokeWidth={1.2} rx={1} className="text-foreground" />
      {foldLines.map((frac, i) =>
        isHoriz ? (
          <line key={i} x1={ox + 2} y1={oy + rH * frac} x2={ox + rW - 2} y2={oy + rH * frac} stroke="currentColor" strokeWidth={0.8} strokeDasharray="3 2" className="text-primary" />
        ) : (
          <line key={i} x1={ox + rW * frac} y1={oy + 2} x2={ox + rW * frac} y2={oy + rH - 2} stroke="currentColor" strokeWidth={0.8} strokeDasharray="3 2" className="text-primary" />
        )
      )}
      <text x={svgW / 2} y={oy - 2} textAnchor="middle" className="fill-muted-foreground" fontSize={7} fontFamily="system-ui">{openW}"</text>
      <text x={ox - 2} y={svgH / 2} textAnchor="end" className="fill-muted-foreground" fontSize={7} fontFamily="system-ui">{openH}"</text>
    </svg>
  )
}

"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { formatCurrency } from "@/lib/pricing"
import {
  calculateUSPSPostage,
  formatPostageRate,
  SORT_LABELS,
  ENTRY_LABELS,
  SHAPE_LABELS,
  SPECS,
  type USPSInputs,
  type USPSEntry,
  type SortLevel,
} from "@/lib/usps-rates"
import { Plus, AlertTriangle, AlertCircle, Info, ChevronDown } from "lucide-react"

/* ── Compact pill ── */
function Pill({
  active,
  disabled,
  onClick,
  label,
  sub,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  sub?: string
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-lg text-left transition-all font-medium border ${
        disabled
          ? "opacity-25 cursor-not-allowed border-border bg-secondary text-xs"
          : active
            ? "border-foreground bg-foreground text-background text-sm"
            : "border-border bg-card hover:border-foreground/20 cursor-pointer text-sm"
      }`}
    >
      <span className="block leading-tight">{label}</span>
      {sub && (
        <span
          className={`block text-xs leading-tight mt-0.5 ${
            active && !disabled ? "text-background/60" : "text-muted-foreground"
          }`}
        >
          {sub}
        </span>
      )}
    </button>
  )
}

/* ── Sort level button with big price ── */
function SortBtn({
  active,
  rate,
  sortLabel,
  onClick,
}: {
  active: boolean
  rate: number
  sortLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl py-3 px-2 transition-all border ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card border-border hover:border-foreground/20"
      }`}
    >
      <span className="text-lg font-bold font-mono tabular-nums leading-none">
        {rate > 0 ? formatPostageRate(rate) : "---"}
      </span>
      <span
        className={`text-xs font-medium mt-1 ${
          active ? "text-background/60" : "text-muted-foreground"
        }`}
      >
        {sortLabel}
      </span>
    </button>
  )
}

export function USPSPostageCalculator() {
  const [inputs, setInputs] = useState<USPSInputs>({
    service: "FCM_COMM",
    shape: "LETTER",
    pack: "ENV",
    quantity: 5000,
    saturationQty: 0,
    weight: 1,
    sortLevel: 1,
    entry: "ORIGIN",
  })

  const result = useMemo(() => calculateUSPSPostage(inputs), [inputs])
  const quote = useQuote()
  const mailing = useMailing()

  // Sync USPS inputs back to mailing context
  useEffect(() => {
    const totalQty = inputs.quantity + (inputs.saturationQty || 0)
    mailing.setQuantity(totalQty)
    mailing.setShape(inputs.shape)
    const classMap: Record<string, string> = {
      POSTCARD: "Postcard",
      LETTER: "Letter",
      FLAT: "Flat",
    }
    mailing.setClassName(classMap[inputs.shape] || inputs.shape)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.quantity, inputs.saturationQty, inputs.shape])

  // Auto-detect shape + format from planner's outer piece
  const seededQtyRef = useRef(false)
  useEffect(() => {
    const outer = mailing.outerPiece
    if (!outer) return

    const patch: Partial<USPSInputs> = {}

    if (!seededQtyRef.current && mailing.quantity) {
      patch.quantity = mailing.quantity
      seededQtyRef.current = true
    }

    if (outer.type === "envelope") {
      patch.pack = outer.envelopeKind === "plastic" ? "PLAS" : "ENV"
    } else if (outer.type === "booklet") {
      patch.pack = "SM_BOOK"
    } else if (outer.type === "folded_card" || outer.type === "self_mailer") {
      patch.pack = "SM_FOLD"
    } else if (outer.type === "postcard" || outer.type === "flat_card" || outer.type === "letter") {
      patch.pack = "SM_CARD"
    } else {
      patch.pack = "SM_CARD"
    }

    if (outer.width && outer.height) {
      const s = Math.min(outer.width, outer.height)
      const l = Math.max(outer.width, outer.height)
      if (outer.type === "postcard" && s >= 3.5 && s <= 6 && l >= 5 && l <= 9) {
        patch.shape = "POSTCARD"
      } else if (s >= 3.5 && s <= 6.125 && l >= 5 && l <= 11.5) {
        patch.shape = "LETTER"
      } else if (s > 6.125 || l > 11.5) {
        patch.shape = "FLAT"
      }
    }

    if (Object.keys(patch).length > 0) {
      setInputs((prev) => ({ ...prev, ...patch }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailing.outerPiece?.id, mailing.outerPiece?.type, mailing.outerPiece?.width, mailing.outerPiece?.height, mailing.outerPiece?.envelopeKind])

  const update = useCallback((partial: Partial<USPSInputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...partial }
      if (
        (next.service === "MKT_COMM" || next.service === "MKT_NP") &&
        next.shape === "POSTCARD"
      ) {
        next.shape = "LETTER"
      }
      if (next.service === "FCM_RETAIL") {
        next.saturationQty = 0
      }
      return next
    })
  }, [])

  const handleAddToQuote = useCallback(() => {
    if (!result.isValid) return
    const parts: string[] = []
    parts.push(result.className)
    if (result.description) parts.push(result.description)
    quote.addItem({
      category: "postage",
      label: `USPS Postage - ${inputs.quantity.toLocaleString()} pc`,
      description: parts.join(" | "),
      amount: result.total,
    })
  }, [result, inputs, quote])

  const hasDimensions = !!(mailing.mailerWidth && mailing.mailerHeight)
  const suggestedShapes = mailing.suggestedShapes
  const [shapeOverride, setShapeOverride] = useState(false)

  useEffect(() => {
    if (!hasDimensions || shapeOverride) return
    if (suggestedShapes.length > 0 && !suggestedShapes.includes(inputs.shape as any)) {
      const isMktService = inputs.service === "MKT_COMM" || inputs.service === "MKT_NP"
      const validShapes = isMktService
        ? suggestedShapes.filter((s) => s !== "POSTCARD")
        : suggestedShapes
      if (validShapes.length > 0) {
        update({ shape: validShapes[0] })
      }
    }
  }, [hasDimensions, shapeOverride, suggestedShapes, inputs.shape, inputs.service, update])

  const isMkt = inputs.service === "MKT_COMM" || inputs.service === "MKT_NP"
  const isRetail = inputs.service === "FCM_RETAIL"
  const isShapeDisabled = (shape: string) => {
    if (shape === "POSTCARD" && isMkt) return true
    if (hasDimensions && !shapeOverride && !suggestedShapes.includes(shape as "POSTCARD" | "LETTER" | "FLAT")) return true
    return false
  }
  const postcardDisabled = isShapeDisabled("POSTCARD")
  const showSaturation = isMkt
  const showEntryPoint = isMkt
  const showSortSlider = !isRetail
  const remainingQty = inputs.quantity - Math.min(inputs.saturationQty, inputs.quantity)
  const spec = SPECS[inputs.shape]

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Planner detection banner */}
      {mailing.outerPiece && (
        <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 flex items-center gap-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Auto-detected from planner:
            <strong className="text-foreground ml-1">{mailing.outerPiece.label}</strong>
            {mailing.outerPiece.width && mailing.outerPiece.height && (
              <span className="font-mono ml-1 text-foreground">{mailing.outerPiece.width}" x {mailing.outerPiece.height}"</span>
            )}
          </p>
        </div>
      )}

      {/* ── All inputs ── */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">

        {/* Mail Service */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
            Mail Service
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Pill active={inputs.service === "FCM_COMM"} onClick={() => update({ service: "FCM_COMM" })} label="FC Presort" sub="500+ pc" />
            <Pill active={inputs.service === "FCM_RETAIL"} onClick={() => update({ service: "FCM_RETAIL" })} label="FC Retail" sub="Stamps" />
            <Pill active={inputs.service === "MKT_COMM"} onClick={() => update({ service: "MKT_COMM" })} label="Marketing" sub="Commercial" />
            <Pill active={inputs.service === "MKT_NP"} onClick={() => update({ service: "MKT_NP" })} label="Nonprofit" sub="Auth req." />
          </div>
        </div>

        <hr className="border-border" />

        {/* Shape + Format */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Shape</label>
              {hasDimensions && (
                <button
                  type="button"
                  onClick={() => setShapeOverride(!shapeOverride)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    shapeOverride
                      ? "bg-foreground/10 text-foreground border-foreground/30 font-semibold"
                      : "bg-muted text-muted-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {shapeOverride ? "Override ON" : "Override"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Pill active={inputs.shape === "POSTCARD"} disabled={postcardDisabled} onClick={() => update({ shape: "POSTCARD" })} label="Postcard" />
              <Pill active={inputs.shape === "LETTER"} disabled={isShapeDisabled("LETTER")} onClick={() => update({ shape: "LETTER" })} label="Letter" />
              <Pill active={inputs.shape === "FLAT"} disabled={isShapeDisabled("FLAT")} onClick={() => update({ shape: "FLAT" })} label="Flat" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Format</label>
            <div className="flex flex-wrap gap-2">
              <Pill active={inputs.pack === "ENV"} onClick={() => update({ pack: "ENV" })} label="Envelope" sub="Paper" />
              <Pill active={inputs.pack === "PLAS"} onClick={() => update({ pack: "PLAS" })} label="Envelope" sub="Plastic" />
              <Pill active={inputs.pack === "SM_CARD"} onClick={() => update({ pack: "SM_CARD" })} label="Self-Mailer" sub="Card" />
              <Pill active={inputs.pack === "SM_FOLD"} onClick={() => update({ pack: "SM_FOLD" })} label="Self-Mailer" sub="Folded" />
              <Pill active={inputs.pack === "SM_BOOK"} onClick={() => update({ pack: "SM_BOOK" })} label="Self-Mailer" sub="Booklet" />
            </div>
          </div>
        </div>

        <hr className="border-border" />

        {/* Quantity + Weight + Saturation */}
        <div className={`grid gap-4 ${showSaturation ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
          <div>
            <label htmlFor="usps-qty" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Quantity
            </label>
            <Input
              id="usps-qty"
              type="number"
              inputMode="numeric"
              min={1}
              autoComplete="off"
              placeholder="5000"
              className="h-11 font-mono text-base"
              value={inputs.quantity || ""}
              onChange={(e) => update({ quantity: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label htmlFor="usps-weight" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Weight (oz)
            </label>
            <Input
              id="usps-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              autoComplete="off"
              placeholder="1.0"
              className="h-11 font-mono text-base"
              value={inputs.weight || ""}
              onChange={(e) => update({ weight: parseFloat(e.target.value) || 0 })}
            />
          </div>
          {showSaturation && (
            <div>
              <label htmlFor="usps-sat-qty" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Saturation Qty
              </label>
              <Input
                id="usps-sat-qty"
                type="number"
                inputMode="numeric"
                min={0}
                max={inputs.quantity}
                autoComplete="off"
                placeholder="0"
                className="h-11 font-mono text-base"
                value={inputs.saturationQty || ""}
                onChange={(e) => update({ saturationQty: parseInt(e.target.value) || 0 })}
              />
              {result.satRate > 0 && (
                <span className="text-xs text-muted-foreground mt-1.5 block font-mono">
                  Sat rate: {formatPostageRate(result.satRate)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sort Level */}
        {showSortSlider && (
          <>
            <hr className="border-border" />
            <div className={`grid gap-6 ${showEntryPoint ? "grid-cols-1 sm:grid-cols-[1fr_180px]" : "grid-cols-1"}`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sort Level</label>
                  <span className="text-sm text-muted-foreground">
                    Remaining: <strong className="font-mono text-foreground">{remainingQty.toLocaleString()}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([1, 2, 3] as SortLevel[]).map((level) => (
                    <SortBtn
                      key={level}
                      active={inputs.sortLevel === level}
                      rate={result.rateAtLevel[level]}
                      sortLabel={SORT_LABELS[level].split(" (")[0]}
                      onClick={() => update({ sortLevel: level })}
                    />
                  ))}
                </div>
              </div>
              {showEntryPoint && (
                <div>
                  <label htmlFor="usps-entry" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Entry Point
                  </label>
                  <Select value={inputs.entry} onValueChange={(v) => update({ entry: v as USPSEntry })}>
                    <SelectTrigger id="usps-entry" className="h-11 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORIGIN">{ENTRY_LABELS.ORIGIN}</SelectItem>
                      <SelectItem value="DSCF">{ENTRY_LABELS.DSCF}</SelectItem>
                      <SelectItem value="DDU">{ENTRY_LABELS.DDU}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </>
        )}

        {/* Spec reference */}
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{SHAPE_LABELS[inputs.shape]}</span>
            <span>Min: <strong className="font-mono">{spec.min}</strong></span>
            <span>Max: <strong className="font-mono">{spec.max}</strong></span>
            <span>Weight: <strong className="font-mono">{spec.weight}</strong></span>
          </div>
          {hasDimensions && suggestedShapes.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 text-sm font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {mailing.mailerWidth}" x {mailing.mailerHeight}" is too small for any USPS mail shape. Check dimensions.
            </div>
          )}
          {hasDimensions && suggestedShapes.length > 0 && !shapeOverride && !suggestedShapes.includes(inputs.shape as any) && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-3 py-2.5 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {mailing.mailerWidth}" x {mailing.mailerHeight}" does not fit {SHAPE_LABELS[inputs.shape]}. Switching to a valid shape.
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {result.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {result.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                alert.type === "error"
                  ? "bg-destructive/10 text-destructive"
                  : alert.type === "warning"
                    ? "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {alert.type === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : alert.type === "warning" ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Info className="h-4 w-4 shrink-0" />
              )}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Sticky results bar ── */}
      <div className="sticky bottom-4 z-20">
        <div className="bg-foreground text-background rounded-2xl shadow-2xl px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-baseline gap-6 sm:gap-8">
            <div>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-background/50 block mb-1">
                Per Piece
              </span>
              <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none">
                {result.isValid ? formatPostageRate(result.avgPerPiece) : "---"}
              </span>
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-background/50 block mb-1">
                Total
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums leading-none">
                {result.isValid ? formatCurrency(result.total) : "$0.00"}
              </span>
            </div>
          </div>
          <button
            onClick={handleAddToQuote}
            disabled={!result.isValid || (hasDimensions && suggestedShapes.length === 0 && !shapeOverride)}
            className="flex items-center justify-center gap-2 bg-background text-foreground text-sm font-semibold px-5 py-3 sm:py-2.5 rounded-full hover:bg-background/90 disabled:opacity-30 transition-all shrink-0 w-full sm:w-auto min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            Add to Quote
          </button>
        </div>
      </div>
    </div>
  )
}

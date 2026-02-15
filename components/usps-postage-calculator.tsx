"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, AlertTriangle, AlertCircle, Info } from "lucide-react"

/* ── Compact pill toggle ── */
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
      className={`px-3 py-1.5 rounded-lg text-left transition-all text-xs font-medium border ${
        disabled
          ? "opacity-25 cursor-not-allowed border-border bg-secondary"
          : active
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card hover:border-foreground/20 cursor-pointer"
      }`}
    >
      <span className="block leading-tight">{label}</span>
      {sub && (
        <span
          className={`block text-[10px] leading-tight mt-0.5 ${
            active && !disabled ? "text-background/60" : "text-muted-foreground"
          }`}
        >
          {sub}
        </span>
      )}
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
  }, [inputs.quantity, inputs.saturationQty, inputs.shape, mailing])

  // Auto-detect shape + format from planner's outer piece
  useEffect(() => {
    const outer = mailing.outerPiece
    if (!outer) return

    const patch: Partial<USPSInputs> = {}

    // Auto-set quantity from planner if it has one
    if (mailing.quantity && mailing.quantity !== inputs.quantity) {
      patch.quantity = mailing.quantity
    }

    // Determine format from outer piece type
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

    // Determine shape from outer piece dimensions
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
  }, [mailing.outerPiece?.id, mailing.outerPiece?.type, mailing.outerPiece?.width, mailing.outerPiece?.height, mailing.outerPiece?.envelopeKind, mailing.quantity])

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

  // Auto-switch shape when current selection is disqualified by dimensions
  useEffect(() => {
    if (!hasDimensions || shapeOverride) return
    if (suggestedShapes.length > 0 && !suggestedShapes.includes(inputs.shape as any)) {
      // Current shape is invalid -- switch to first valid one
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
    if (
      hasDimensions &&
      !shapeOverride &&
      !suggestedShapes.includes(shape as "POSTCARD" | "LETTER" | "FLAT")
    )
      return true
    return false
  }
  const postcardDisabled = isShapeDisabled("POSTCARD")
  const showSaturation = isMkt
  const showEntryPoint = isMkt
  const showSortSlider = !isRetail
  const remainingQty =
    inputs.quantity - Math.min(inputs.saturationQty, inputs.quantity)
  const spec = SPECS[inputs.shape]

  return (
    <div className="flex flex-col gap-4">
      {/* Planner detection banner */}
      {mailing.outerPiece && (
        <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground">
              Auto-detected from planner
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Outer piece: <strong>{mailing.outerPiece.label}</strong>
              {mailing.outerPiece.width && mailing.outerPiece.height && (
                <span className="font-mono ml-1">{mailing.outerPiece.width}" x {mailing.outerPiece.height}"</span>
              )}
              {mailing.outerPiece.type === "envelope" && mailing.outerPiece.envelopeKind && (
                <span className="ml-1">({mailing.outerPiece.envelopeKind})</span>
              )}
              <span className="mx-1.5 text-border">|</span>
              Shape: <strong>{SHAPE_LABELS[inputs.shape]}</strong>
              <span className="mx-1.5 text-border">|</span>
              Format: <strong>{inputs.pack === "ENV" ? "Envelope (Paper)" : inputs.pack === "PLAS" ? "Envelope (Plastic)" : inputs.pack === "SM_CARD" ? "Self-Mailer Card" : inputs.pack === "SM_FOLD" ? "Self-Mailer Folded" : "Self-Mailer Booklet"}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── Single card: all inputs ── */}
      <Card className="border-border rounded-2xl overflow-hidden">
        <CardContent className="p-5 flex flex-col gap-5">
          {/* Row 1: Service */}
          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Mail Service
            </Label>
            <div className="grid grid-cols-4 gap-2">
              <Pill
                active={inputs.service === "FCM_COMM"}
                onClick={() => update({ service: "FCM_COMM" })}
                label="FC Presort"
                sub="500+ pc"
              />
              <Pill
                active={inputs.service === "FCM_RETAIL"}
                onClick={() => update({ service: "FCM_RETAIL" })}
                label="FC Retail"
                sub="Stamps"
              />
              <Pill
                active={inputs.service === "MKT_COMM"}
                onClick={() => update({ service: "MKT_COMM" })}
                label="Marketing"
                sub="Commercial"
              />
              <Pill
                active={inputs.service === "MKT_NP"}
                onClick={() => update({ service: "MKT_NP" })}
                label="Nonprofit"
                sub="Auth req."
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Row 2: Shape + Format side by side */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Shape
                </Label>
                {hasDimensions && (
                  <button
                    type="button"
                    onClick={() => setShapeOverride(!shapeOverride)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      shapeOverride
                        ? "bg-foreground/10 text-foreground border-foreground/30"
                        : "bg-muted text-muted-foreground border-border hover:border-foreground/30"
                    }`}
                  >
                    {shapeOverride ? "Override ON" : "Override"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Pill
                  active={inputs.shape === "POSTCARD"}
                  disabled={postcardDisabled}
                  onClick={() => update({ shape: "POSTCARD" })}
                  label="Postcard"
                />
                <Pill
                  active={inputs.shape === "LETTER"}
                  disabled={isShapeDisabled("LETTER")}
                  onClick={() => update({ shape: "LETTER" })}
                  label="Letter"
                />
                <Pill
                  active={inputs.shape === "FLAT"}
                  disabled={isShapeDisabled("FLAT")}
                  onClick={() => update({ shape: "FLAT" })}
                  label="Flat"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Format
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Pill
                  active={inputs.pack === "ENV"}
                  onClick={() => update({ pack: "ENV" })}
                  label="Envelope"
                  sub="Paper"
                />
                <Pill
                  active={inputs.pack === "PLAS"}
                  onClick={() => update({ pack: "PLAS" })}
                  label="Envelope"
                  sub="Plastic"
                />
                <Pill
                  active={inputs.pack === "SM_CARD"}
                  onClick={() => update({ pack: "SM_CARD" })}
                  label="Self-Mailer"
                  sub="Card"
                />
                <Pill
                  active={inputs.pack === "SM_FOLD"}
                  onClick={() => update({ pack: "SM_FOLD" })}
                  label="Self-Mailer"
                  sub="Folded"
                />
                <Pill
                  active={inputs.pack === "SM_BOOK"}
                  onClick={() => update({ pack: "SM_BOOK" })}
                  label="Self-Mailer"
                  sub="Booklet"
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Row 3: Qty + Weight + (optional Saturation) inline */}
          <div className={`grid gap-3 ${showSaturation ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <Label
                htmlFor="usps-qty"
                className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block"
              >
                Quantity
              </Label>
              <Input
                id="usps-qty"
                type="number"
                inputMode="numeric"
                min={1}
                autoComplete="off"
                spellCheck={false}
                placeholder="5000"
                className="h-9 font-mono text-sm"
                value={inputs.quantity || ""}
                onChange={(e) =>
                  update({ quantity: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label
                htmlFor="usps-weight"
                className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block"
              >
                Weight (oz)
              </Label>
              <Input
                id="usps-weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                autoComplete="off"
                spellCheck={false}
                placeholder="1.0"
                className="h-9 font-mono text-sm"
                value={inputs.weight || ""}
                onChange={(e) =>
                  update({ weight: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            {showSaturation && (
              <div>
                <Label
                  htmlFor="usps-sat-qty"
                  className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block"
                >
                  Saturation Qty
                </Label>
                <Input
                  id="usps-sat-qty"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={inputs.quantity}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0"
                  className="h-9 font-mono text-sm"
                  value={inputs.saturationQty || ""}
                  onChange={(e) =>
                    update({
                      saturationQty: parseInt(e.target.value) || 0,
                    })
                  }
                />
                {result.satRate > 0 && (
                  <span className="text-[10px] text-muted-foreground mt-1 block font-mono">
                    Sat rate: {formatPostageRate(result.satRate)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Row 4: Sort + Entry (conditional) */}
          {showSortSlider && (
            <>
              <div className="border-t border-border" />
              <div className={`grid gap-5 ${showEntryPoint ? "grid-cols-[1fr_200px]" : "grid-cols-1"}`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Sort Level
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Remaining:{" "}
                      <strong className="font-mono text-foreground">
                        {remainingQty.toLocaleString()}
                      </strong>
                    </span>
                  </div>
                  <Slider
                    value={[inputs.sortLevel]}
                    onValueChange={([v]) =>
                      update({ sortLevel: v as SortLevel })
                    }
                    min={1}
                    max={3}
                    step={1}
                    className="mb-2"
                  />
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    {([1, 2, 3] as SortLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => update({ sortLevel: level })}
                        className={`text-[10px] font-mono font-bold py-1 rounded-md transition-colors ${
                          inputs.sortLevel === level
                            ? "bg-foreground text-background"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {result.rateAtLevel[level] > 0
                          ? formatPostageRate(result.rateAtLevel[level])
                          : "---"}
                        <span className="block text-[9px] font-sans font-medium opacity-70">
                          {SORT_LABELS[level].split(" (")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {showEntryPoint && (
                  <div>
                    <Label
                      htmlFor="usps-entry"
                      className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block"
                    >
                      Entry Point
                    </Label>
                    <Select
                      value={inputs.entry}
                      onValueChange={(v) => update({ entry: v as USPSEntry })}
                    >
                      <SelectTrigger id="usps-entry" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORIGIN">
                          {ENTRY_LABELS.ORIGIN}
                        </SelectItem>
                        <SelectItem value="DSCF">
                          {ENTRY_LABELS.DSCF}
                        </SelectItem>
                        <SelectItem value="DDU">
                          {ENTRY_LABELS.DDU}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Spec reference + dimension warning */}
          <div className="border-t border-border pt-3 flex flex-col gap-2">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">
                {SHAPE_LABELS[inputs.shape]}
              </span>
              <span>
                Min: <strong className="font-mono">{spec.min}</strong>
              </span>
              <span>
                Max: <strong className="font-mono">{spec.max}</strong>
              </span>
              <span>
                Weight: <strong className="font-mono">{spec.weight}</strong>
              </span>
            </div>
            {hasDimensions && suggestedShapes.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {mailing.mailerWidth}" x {mailing.mailerHeight}" is too small for any USPS mail shape. Check dimensions.
              </div>
            )}
            {hasDimensions && suggestedShapes.length > 0 && !shapeOverride && !suggestedShapes.includes(inputs.shape as any) && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-3 py-2 text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {mailing.mailerWidth}" x {mailing.mailerHeight}" does not fit {SHAPE_LABELS[inputs.shape]}. Switching to a valid shape.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {result.alerts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {result.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                alert.type === "error"
                  ? "bg-destructive/10 text-destructive"
                  : alert.type === "warning"
                    ? "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {alert.type === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              ) : alert.type === "warning" ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Info className="h-3.5 w-3.5 shrink-0" />
              )}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Sticky results bar ── */}
      <div className="sticky bottom-4 z-20">
        <div className="bg-foreground text-background rounded-2xl shadow-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-6">
            <div>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-background/40 block mb-0.5">
                Per Piece
              </span>
              <span className="text-2xl font-bold font-mono tabular-nums leading-none">
                {result.isValid ? formatPostageRate(result.avgPerPiece) : "---"}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-background/40 block mb-0.5">
                Total
              </span>
              <span className="text-lg font-bold font-mono tabular-nums leading-none">
                {result.isValid ? formatCurrency(result.total) : "$0.00"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-background/50 max-w-[140px] truncate hidden sm:block">
              {result.description || ""}
            </span>
            <button
              onClick={handleAddToQuote}
              disabled={!result.isValid || (hasDimensions && suggestedShapes.length === 0 && !shapeOverride)}
              className="flex items-center gap-1.5 bg-background text-foreground text-xs font-semibold px-4 py-2 rounded-full hover:bg-background/90 disabled:opacity-30 transition-all shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {hasDimensions && suggestedShapes.length === 0 && !shapeOverride ? "Size Error" : "Add to Quote"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

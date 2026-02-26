"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
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
  calculateTab2Postage,
  formatPostageRate,
  getActiveTiers,
  ENTRY_LABELS,
  SERVICE_LABELS,
  SHAPE_LABELS,
  SPECS,
  type USPSInputs,
  type USPSEntry,
  type USPSMailType,
  type Tab2Inputs,
  type Tab2Service,
  type Tab2PSEntry,
  type Tab2BPMShape,
  type Tab2BPMSort,
  type Tab2BPMEntry,
  type USPSShape,
} from "@/lib/usps-rates"
import { Plus, ChevronDown, ChevronRight, Info, AlertCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

/* ── Compact pill ── */
function Pill({
  active,
  disabled,
  onClick,
  label,
  sub,
  compact,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  sub?: string
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg text-left transition-all font-medium border",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        disabled
          ? "opacity-25 cursor-not-allowed border-border bg-secondary text-xs"
          : active
            ? "border-foreground bg-foreground text-background text-sm"
            : "border-border bg-card hover:border-foreground/20 cursor-pointer text-sm"
      )}
    >
      <span className="block leading-tight">{label}</span>
      {sub && (
        <span
          className={cn(
            "block text-xs leading-tight mt-0.5",
            active && !disabled ? "text-background/60" : "text-muted-foreground"
          )}
        >
          {sub}
        </span>
      )}
    </button>
  )
}

/* ── Unified Results Bar ── */
function ResultsBar({
  isValid,
  perPiece,
  total,
  quantity,
  disabled,
  onAdd,
  onAddManual,
}: {
  isValid: boolean
  perPiece: number
  total: number
  quantity: number
  disabled: boolean
  onAdd: (bufferCents: number) => void
  onAddManual: (ratePerPiece: number) => void
}) {
  const [bufferCents, setBufferCents] = useState<string>("0")
  const parsedBuffer = parseFloat(bufferCents) || 0
  const bufferAmt = parsedBuffer / 100
  const finalPerPiece = perPiece + bufferAmt
  const finalTotal = finalPerPiece * quantity

  const [showManual, setShowManual] = useState(false)
  const [manualRate, setManualRate] = useState<string>("")
  const parsedRate = parseFloat(manualRate)
  const hasManual = manualRate.length > 0 && !isNaN(parsedRate) && parsedRate > 0
  const manualTotal = hasManual ? parsedRate * quantity : 0

  return (
    <div className="sticky bottom-4 z-20 bg-foreground text-background rounded-2xl shadow-2xl overflow-hidden">
      {/* Main bar */}
      <div className="px-5 py-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Prices */}
          <div className="flex items-baseline gap-6">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-background/50 block mb-0.5">
                Per Piece
              </span>
              <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none">
                {isValid ? formatPostageRate(parsedBuffer > 0 ? finalPerPiece : perPiece) : "---"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-background/50 block mb-0.5">
                Total
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums leading-none">
                {isValid ? formatCurrency(parsedBuffer > 0 ? finalTotal : total) : "$0.00"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Inline buffer */}
            <div className="flex items-center gap-1.5 bg-background/10 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-background/50 uppercase tracking-wide">Buffer</span>
              <span className="text-background/40 text-xs">+</span>
              <input
                type="text"
                inputMode="decimal"
                value={bufferCents}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "" || /^\d*\.?\d{0,1}$/.test(v)) setBufferCents(v)
                }}
                className="w-10 text-center font-mono text-sm font-bold bg-transparent border-b border-background/20 text-background px-0 py-0 outline-none focus:border-background/50 transition-all"
              />
              <span className="text-background/40 text-[10px]">c</span>
            </div>
            {parsedBuffer > 0 && isValid && (
              <span className="text-[10px] text-background/40 font-mono hidden sm:inline">
                {formatPostageRate(perPiece)} + {parsedBuffer}c
              </span>
            )}
            {/* Add button */}
            <button
              onClick={() => onAdd(parsedBuffer)}
              disabled={disabled}
              className="flex items-center justify-center gap-1.5 bg-background text-foreground text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-background/90 disabled:opacity-30 transition-all shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add to Quote
            </button>
          </div>
        </div>
      </div>

      {/* Manual override -- collapsible */}
      <div className="border-t border-background/10">
        <button
          onClick={() => setShowManual(!showManual)}
          className="w-full px-5 py-2 flex items-center gap-2 hover:bg-background/5 transition-colors"
        >
          {showManual ? <ChevronDown className="h-3 w-3 text-background/40" /> : <ChevronRight className="h-3 w-3 text-background/40" />}
          <span className="text-[11px] font-semibold text-background/50 uppercase tracking-wider">Custom Rate Override</span>
        </button>
        {showManual && (
          <div className="px-5 pb-3 flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-background/40 font-mono text-sm">$</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.285"
                className="h-9 w-36 rounded-lg bg-background/10 border border-background/20 pl-6 pr-3 font-mono text-sm text-background placeholder:text-background/30 focus:outline-none focus:ring-2 focus:ring-background/30"
                value={manualRate}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "" || /^\d*\.?\d{0,4}$/.test(v)) setManualRate(v)
                }}
              />
            </div>
            {hasManual && (
              <>
                <span className="text-sm font-mono font-bold text-background tabular-nums">{formatCurrency(manualTotal)}</span>
                <button
                  onClick={() => { onAddManual(parsedRate); setManualRate("") }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3.5 py-2 rounded-full transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Estimate
                </button>
              </>
            )}
            {!hasManual && (
              <span className="text-[11px] text-background/40">Enter a custom rate to add as estimate</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
//  TAB 2 COMPONENT (Parcels & Special) -- kept as-is
// ═══════════════════════════════════════════════════════════════

function Tab2Parcels() {
  const mailing = useMailing()
  const [inputs, setInputs] = useState<Tab2Inputs>(() => ({
    service: "PS",
    quantity: mailing.quantity > 0 ? mailing.quantity : 500,
    weight: 1,
    psEntry: "DDU",
    psOversized: false,
    bpmShape: "FL",
    bpmSort: "NP",
    bpmEntry: "NONE",
  }))

  const result = useMemo(() => calculateTab2Postage(inputs), [inputs])
  const quote = useQuote()

  useEffect(() => {
    mailing.setMailService(inputs.service)
    mailing.setQuantity(inputs.quantity)
    mailing.setShape("PARCEL")
    mailing.setClassName("Parcel")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.service, inputs.quantity])

  const update = useCallback((partial: Partial<Tab2Inputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...partial }
      if (partial.bpmSort === "NP") next.bpmEntry = "NONE"
      return next
    })
  }, [])

  const handleAddToQuote = useCallback((bufferCents: number) => {
    if (!result.isValid) return
    const bufferPerPiece = bufferCents / 100
    const bufferedTotal = (result.perPiece + bufferPerPiece) * inputs.quantity
    const svcLabels: Record<Tab2Service, string> = { PS: "Parcel Select", MM: "Media Mail", LM: "Library Mail", BPM: "Bound Printed Matter" }
    const desc = bufferCents > 0 ? `${result.rateInfo} | +${bufferCents}c buffer` : result.rateInfo
    quote.addItem({
      category: "postage",
      label: `USPS ${result.description} - ${inputs.quantity.toLocaleString()} pc`,
      description: desc,
      amount: bufferCents > 0 ? bufferedTotal : result.total,
      metadata: {
        mailingClass: svcLabels[inputs.service],
        dropOff: inputs.service === "PS" ? inputs.psEntry : inputs.service === "BPM" ? inputs.bpmEntry : undefined,
        bufferCents: bufferCents > 0 ? bufferCents : undefined,
      },
    })
  }, [result, inputs, quote])

  const handleAddManual = useCallback((ratePerPiece: number) => {
    const manualTotal = ratePerPiece * inputs.quantity
    const svcLabels: Record<Tab2Service, string> = { PS: "Parcel Select", MM: "Media Mail", LM: "Library Mail", BPM: "Bound Printed Matter" }
    const svcLabel = svcLabels[inputs.service]
    quote.addItem({
      category: "postage",
      label: `USPS ${svcLabel} - ${inputs.quantity.toLocaleString()} pc`,
      description: `${svcLabel} | ${inputs.quantity.toLocaleString()} x $${ratePerPiece.toFixed(3)}`,
      amount: manualTotal,
      metadata: {
        mailingClass: svcLabel,
        isEstimated: true,
        manualRate: ratePerPiece,
      },
    })
  }, [inputs, quote])

  const svcOptions: { key: Tab2Service; label: string; sub: string }[] = [
    { key: "PS", label: "Parcel Select", sub: "Destination Entry" },
    { key: "MM", label: "Media Mail", sub: "Books, CDs, DVDs" },
    { key: "LM", label: "Library Mail", sub: "Library Materials" },
    { key: "BPM", label: "Bound Printed", sub: "Catalogs, Dirs" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 flex flex-col gap-5">
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
            Mail Class
          </label>
          <div className="grid grid-cols-2 gap-2">
            {svcOptions.map((s) => (
              <Pill key={s.key} active={inputs.service === s.key} onClick={() => update({ service: s.key })} label={s.label} sub={s.sub} />
            ))}
          </div>
        </div>

        <hr className="border-border" />

        {inputs.service === "PS" && (
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
              Entry Point
            </label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(["DDU", "DHUB", "DSCF"] as Tab2PSEntry[]).map((e) => (
                <Pill
                  key={e}
                  active={inputs.psEntry === e}
                  onClick={() => update({ psEntry: e })}
                  label={e}
                  sub={{ DDU: "Carrier Unit", DHUB: "Hub Facility", DSCF: "Sect. Center" }[e]}
                />
              ))}
            </div>
            <label className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.psOversized}
                onChange={(e) => update({ psOversized: e.target.checked })}
                className="accent-foreground w-4 h-4"
              />
              <div>
                <span className="text-sm font-semibold">Oversized</span>
                <span className="block text-xs text-muted-foreground">{'L+Girth 108"-130" (flat rate regardless of weight)'}</span>
              </div>
            </label>
          </div>
        )}

        {inputs.service === "BPM" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Shape</label>
              <div className="grid grid-cols-2 gap-2">
                <Pill active={inputs.bpmShape === "FL"} onClick={() => update({ bpmShape: "FL" })} label="Flats" sub="Large Envelopes" />
                <Pill active={inputs.bpmShape === "PC"} onClick={() => update({ bpmShape: "PC" })} label="Parcels" sub="Packages" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Sort Level</label>
              <div className="grid grid-cols-3 gap-2">
                <Pill active={inputs.bpmSort === "NP"} onClick={() => update({ bpmSort: "NP" })} label="Nonpresorted" />
                <Pill active={inputs.bpmSort === "CR"} onClick={() => update({ bpmSort: "CR" })} label="Carrier Route" />
                <Pill active={inputs.bpmSort === "PS"} onClick={() => update({ bpmSort: "PS" })} label="Presorted" />
              </div>
            </div>
            {(inputs.bpmSort === "CR" || inputs.bpmSort === "PS") && (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Entry Point</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["NONE", "DSCF", "DDU"] as Tab2BPMEntry[]).map((e) => (
                    <Pill
                      key={e}
                      active={inputs.bpmEntry === e}
                      onClick={() => update({ bpmEntry: e })}
                      label={e === "NONE" ? "None" : e}
                      sub={e === "NONE" ? "Origin" : e === "DSCF" ? "Sect. Center" : "Carrier Unit"}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <hr className="border-border" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="p2-qty" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Quantity
            </label>
            <Input
              id="p2-qty"
              type="number"
              inputMode="numeric"
              min={1}
              autoComplete="off"
              placeholder="500"
              className="h-11 font-mono text-base"
              value={inputs.quantity || ""}
              onChange={(e) => update({ quantity: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label htmlFor="p2-wt" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Weight (lbs)
            </label>
            <Input
              id="p2-wt"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              autoComplete="off"
              placeholder="1"
              className="h-11 font-mono text-base"
              value={inputs.weight || ""}
              onChange={(e) => update({ weight: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        {result.rateInfo && (
          <div className="bg-secondary/50 border border-border rounded-xl p-4 text-sm font-semibold text-foreground">
            {result.rateInfo}
          </div>
        )}
      </div>

      {/* Alerts */}
      {result.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {result.alerts.map((a, i) => (
            <div key={i} className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium", a.type === "error" ? "bg-destructive/10 text-destructive" : a.type === "warning" ? "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
              {a.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : a.type === "warning" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
              {a.message}
            </div>
          ))}
        </div>
      )}

      <ResultsBar
        isValid={result.isValid}
        perPiece={result.perPiece}
        total={result.total}
        quantity={inputs.quantity}
        disabled={!result.isValid}
        onAdd={handleAddToQuote}
        onAddManual={handleAddManual}
      />
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
//  TAB 1 COMPONENT (Letters & Flats) -- REDESIGNED
// ═══════════════════════════════════════════════════════════════

function Tab1LettersFlats() {
  const mailing = useMailing()
  const [inputs, setInputs] = useState<USPSInputs>(() => ({
    service: (mailing.mailService as USPSInputs["service"]) || "FCM_COMM",
    shape: (mailing.shape as USPSInputs["shape"]) || "LETTER",
    pack: "ENV",
    quantity: mailing.quantity > 0 ? mailing.quantity : 5000,
    saturationQty: 0,
    weight: 1,
    tierIndex: 0,
    entry: "ORIGIN",
    mailType: "AUTO",
    isNonMachinable: false,
  }))

  const tiers = useMemo(() => getActiveTiers(inputs.service, inputs.shape, inputs.mailType), [inputs.service, inputs.shape, inputs.mailType])
  const result = useMemo(() => calculateUSPSPostage(inputs), [inputs])
  const quote = useQuote()

  // Sync USPS inputs back to mailing context
  useEffect(() => {
    const totalQty = inputs.quantity + (inputs.saturationQty || 0)
    mailing.setQuantity(totalQty)
    mailing.setShape(inputs.shape)
    const classMap: Record<string, string> = { POSTCARD: "Postcard", LETTER: "Letter", FLAT: "Flat" }
    mailing.setClassName(classMap[inputs.shape] || inputs.shape)
    mailing.setMailService(inputs.service)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.quantity, inputs.saturationQty, inputs.shape, inputs.service])

  // Auto-detect shape + format from planner's outer piece
  const seededQtyRef = useRef(mailing.quantity > 0)
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
      if ((next.service === "MKT_COMM" || next.service === "MKT_NP") && next.shape === "POSTCARD") {
        next.shape = "LETTER"
      }
      if (next.service === "FCM_RETAIL") {
        next.saturationQty = 0
      }
      if (partial.pack === "PLAS" && next.shape === "LETTER") {
        next.isNonMachinable = true
      }
      const newTiers = getActiveTiers(next.service, next.shape, next.mailType)
      if (newTiers.length > 0 && next.tierIndex >= newTiers.length) {
        next.tierIndex = newTiers.length - 1
      }
      return next
    })
  }, [])

  const handleAddToQuote = useCallback((bufferCents: number) => {
    if (!result.isValid) return
    const bufferPerPiece = bufferCents / 100
    const bufferedTotal = (result.avgPerPiece + bufferPerPiece) * inputs.quantity
    const parts: string[] = []
    parts.push(result.className)
    if (result.description) parts.push(result.description)
    if (bufferCents > 0) parts.push(`+${bufferCents}c buffer`)
    const activeTier = tiers[inputs.tierIndex]
    const classMap: Record<string, string> = {
      FCM_COMM: "First Class", FCM_RETAIL: "Retail",
      MKT_COMM: "Marketing", MKT_NP: "Non-Profit",
    }
    quote.addItem({
      category: "postage",
      label: `USPS Postage - ${inputs.quantity.toLocaleString()} pc`,
      description: parts.join(" | "),
      amount: bufferCents > 0 ? bufferedTotal : result.total,
      metadata: {
        mailingClass: classMap[inputs.service] || SERVICE_LABELS[inputs.service],
        mailShape: inputs.shape.toLowerCase(),
        tierName: activeTier?.l || undefined,
        entryPoint: inputs.entry,
        mailType: (inputs.service === "MKT_COMM" || inputs.service === "MKT_NP") ? inputs.mailType : undefined,
        bufferCents: bufferCents > 0 ? bufferCents : undefined,
      },
    })
  }, [result, inputs, quote, tiers])

  const handleAddManual = useCallback((ratePerPiece: number) => {
    const manualTotal = ratePerPiece * inputs.quantity
    const classMap: Record<string, string> = {
      FCM_COMM: "First Class", FCM_RETAIL: "Retail",
      MKT_COMM: "Marketing", MKT_NP: "Non-Profit",
    }
    const mailingClass = classMap[inputs.service] || SERVICE_LABELS[inputs.service]
    quote.addItem({
      category: "postage",
      label: `USPS Postage - ${inputs.quantity.toLocaleString()} pc`,
      description: `${mailingClass} ${inputs.shape.charAt(0) + inputs.shape.slice(1).toLowerCase()} | ${inputs.quantity.toLocaleString()} x $${ratePerPiece.toFixed(3)}`,
      amount: manualTotal,
      metadata: {
        mailingClass,
        mailShape: inputs.shape.toLowerCase(),
        isEstimated: true,
        manualRate: ratePerPiece,
      },
    })
  }, [inputs, quote])

  const hasDimensions = !!(mailing.mailerWidth && mailing.mailerHeight)
  const suggestedShapes = mailing.suggestedShapes
  const [shapeOverride, setShapeOverride] = useState(false)

  useEffect(() => {
    if (!hasDimensions || shapeOverride) return
    if (suggestedShapes.length > 0 && !suggestedShapes.includes(inputs.shape as USPSShape)) {
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
    if (hasDimensions && !shapeOverride && !suggestedShapes.includes(shape as USPSShape)) return true
    return false
  }
  const postcardDisabled = isShapeDisabled("POSTCARD")
  const showSaturation = isMkt
  const showEntryPoint = isMkt
  const showSortSection = !isRetail
  const showMailType = isMkt
  const remainingQty = inputs.quantity - Math.min(inputs.saturationQty, inputs.quantity)
  const spec = SPECS[inputs.shape]
  const [showSpecs, setShowSpecs] = useState(false)

  // Collect info-level alerts into chips, keep errors/warnings inline
  const errorAlerts = result.alerts.filter((a) => a.type === "error" || a.type === "warning")
  const infoAlerts = result.alerts.filter((a) => a.type === "info")

  return (
    <div className="flex flex-col gap-4">
      {/* Planner detection banner */}
      {mailing.outerPiece && (
        <div className="rounded-xl border border-border bg-secondary/30 px-4 py-2.5 flex items-center gap-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Auto-detected:
            <strong className="text-foreground ml-1">{mailing.outerPiece.label}</strong>
            {mailing.outerPiece.width && mailing.outerPiece.height && (
              <span className="font-mono ml-1 text-foreground">{mailing.outerPiece.width}{'" x '}{mailing.outerPiece.height}{'"'}</span>
            )}
          </p>
        </div>
      )}

      {/* ── All inputs in ONE card ── */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-4">

        {/* Row 1: Mail Service */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5 block">
            Mail Service
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Pill active={inputs.service === "FCM_COMM"} onClick={() => update({ service: "FCM_COMM" })} label="FC Presort" sub="500+ pc" />
            <Pill active={inputs.service === "FCM_RETAIL"} onClick={() => update({ service: "FCM_RETAIL" })} label="FC Retail" sub="Stamps" />
            <Pill active={inputs.service === "MKT_COMM"} onClick={() => update({ service: "MKT_COMM" })} label="Marketing" sub="Commercial" />
            <Pill active={inputs.service === "MKT_NP"} onClick={() => update({ service: "MKT_NP" })} label="Nonprofit" sub="Auth req." />
          </div>
        </div>

        <hr className="border-border/50" />

        {/* Row 2: Shape + Format + NM combined */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Shape</label>
              {hasDimensions && (
                <button
                  type="button"
                  onClick={() => setShapeOverride(!shapeOverride)}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  {shapeOverride ? "auto-detect" : "change"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Pill active={inputs.shape === "POSTCARD"} disabled={postcardDisabled} onClick={() => update({ shape: "POSTCARD" })} label="Postcard" compact />
              <Pill active={inputs.shape === "LETTER"} disabled={isShapeDisabled("LETTER")} onClick={() => update({ shape: "LETTER" })} label="Letter" compact />
              <Pill active={inputs.shape === "FLAT"} disabled={isShapeDisabled("FLAT")} onClick={() => update({ shape: "FLAT" })} label="Flat" compact />
            </div>
            {/* NM checkbox inline for letters */}
            {inputs.shape === "LETTER" && (
              <label className="flex items-center gap-2.5 mt-2.5 p-2.5 rounded-lg bg-secondary/50 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={inputs.isNonMachinable}
                  onChange={(e) => update({ isNonMachinable: e.target.checked })}
                  className="accent-foreground w-3.5 h-3.5"
                />
                <span className="text-xs font-semibold">Non-Machinable</span>
                <span className="text-[10px] text-muted-foreground">(square, rigid, poly)</span>
              </label>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5 block">Format</label>
            <div className="flex flex-wrap gap-1.5">
              <Pill active={inputs.pack === "ENV"} onClick={() => update({ pack: "ENV" })} label="Envelope" sub="Paper" compact />
              <Pill active={inputs.pack === "PLAS"} onClick={() => update({ pack: "PLAS" })} label="Envelope" sub="Plastic" compact />
              <Pill active={inputs.pack === "SM_CARD"} onClick={() => update({ pack: "SM_CARD" })} label="SM Card" compact />
              <Pill active={inputs.pack === "SM_FOLD"} onClick={() => update({ pack: "SM_FOLD" })} label="SM Folded" compact />
              <Pill active={inputs.pack === "SM_BOOK"} onClick={() => update({ pack: "SM_BOOK" })} label="SM Booklet" compact />
            </div>
          </div>
        </div>

        {/* Dimension mismatch -- single subtle note */}
        {hasDimensions && suggestedShapes.length > 0 && suggestedShapes.includes("PARCEL") && !suggestedShapes.some((s) => s === "POSTCARD" || s === "LETTER" || s === "FLAT") && (
          <div className="flex items-center gap-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 px-3 py-2">
            <Info className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            <span className="text-xs text-purple-800 dark:text-purple-300">
              This piece qualifies as a <strong>Parcel</strong>. Use the "Parcels & Special" tab.
            </span>
          </div>
        )}
        {hasDimensions && suggestedShapes.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {mailing.mailerWidth}{'" x '}{mailing.mailerHeight}{'"'} is too small for any USPS mail shape.
          </div>
        )}

        <hr className="border-border/50" />

        {/* Row 3: Quantity + Weight + Saturation */}
        <div className={cn("grid gap-3", showSaturation ? "grid-cols-3" : "grid-cols-2")}>
          <div>
            <label htmlFor="usps-qty" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Quantity
            </label>
            <Input
              id="usps-qty"
              type="number"
              inputMode="numeric"
              min={1}
              autoComplete="off"
              placeholder="5000"
              className="h-10 font-mono"
              value={inputs.quantity || ""}
              onChange={(e) => update({ quantity: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label htmlFor="usps-weight" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
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
              className="h-10 font-mono"
              value={inputs.weight || ""}
              onChange={(e) => update({ weight: parseFloat(e.target.value) || 0 })}
            />
          </div>
          {showSaturation && (
            <div>
              <label htmlFor="usps-sat-qty" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Sat. Qty
              </label>
              <Input
                id="usps-sat-qty"
                type="number"
                inputMode="numeric"
                min={0}
                max={inputs.quantity}
                autoComplete="off"
                placeholder="0"
                className="h-10 font-mono"
                value={inputs.saturationQty || ""}
                onChange={(e) => update({ saturationQty: parseInt(e.target.value) || 0 })}
              />
            </div>
          )}
        </div>

        {/* ── Rate Comparison Table ── */}
        {showSortSection && (
          <>
            <hr className="border-border/50" />

            {/* Mail Prep + Entry row */}
            <div className="flex flex-wrap items-end gap-4">
              {showMailType && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Mail Prep
                  </label>
                  <div className="flex gap-1.5">
                    <Pill active={inputs.mailType === "AUTO"} onClick={() => update({ mailType: "AUTO", tierIndex: 0 })} label="Automation" compact />
                    <Pill active={inputs.mailType === "CR"} onClick={() => update({ mailType: "CR", tierIndex: 0 })} label="Carrier Route" compact />
                  </div>
                </div>
              )}
              {showEntryPoint && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Entry
                  </label>
                  <Select value={inputs.entry} onValueChange={(v) => update({ entry: v as USPSEntry })}>
                    <SelectTrigger className="h-9 text-xs w-44">
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
              {showSaturation && inputs.saturationQty > 0 && (
                <div className="ml-auto text-xs text-muted-foreground">
                  Remaining: <strong className="font-mono text-foreground">{remainingQty.toLocaleString()}</strong> |
                  Saturation: <strong className="font-mono text-foreground">{Math.min(inputs.saturationQty, inputs.quantity).toLocaleString()}</strong>
                </div>
              )}
            </div>

            {/* Rate table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">Sort Level</th>
                    <th className="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">Per Piece</th>
                    <th className="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">Total ({remainingQty.toLocaleString()})</th>
                  </tr>
                </thead>
                <tbody>
                  {result.tierPrices.map((tp, i) => {
                    const isActive = inputs.tierIndex === i
                    const tierTotal = tp.price * remainingQty
                    return (
                      <tr
                        key={tp.tier.k}
                        onClick={() => update({ tierIndex: i })}
                        className={cn(
                          "cursor-pointer transition-colors border-b border-border/50 last:border-b-0",
                          isActive
                            ? "bg-foreground text-background"
                            : "hover:bg-secondary/30"
                        )}
                      >
                        <td className="px-3 py-2.5 font-medium">
                          <span className="text-sm">{tp.tier.l}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn("font-mono font-bold tabular-nums text-base", isActive ? "text-background" : "text-foreground")}>
                            {tp.price > 0 ? formatPostageRate(tp.price) : "---"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn("font-mono tabular-nums text-sm", isActive ? "text-background/70" : "text-muted-foreground")}>
                            {tp.price > 0 ? formatCurrency(tierTotal) : "---"}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Saturation row */}
                  {showSaturation && result.satRate > 0 && inputs.saturationQty > 0 && (
                    <tr className="bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-200 dark:border-emerald-800/40">
                      <td className="px-3 py-2.5 font-medium text-emerald-800 dark:text-emerald-300">
                        <span className="text-sm">Saturation</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 ml-1.5">({Math.min(inputs.saturationQty, inputs.quantity).toLocaleString()} pc)</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-mono font-bold tabular-nums text-base text-emerald-800 dark:text-emerald-300">
                          {formatPostageRate(result.satRate)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-mono tabular-nums text-sm text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(result.satRate * Math.min(inputs.saturationQty, inputs.quantity))}
                        </span>
                      </td>
                    </tr>
                  )}
                  {/* Blended total row */}
                  {showSaturation && result.satRate > 0 && inputs.saturationQty > 0 && (
                    <tr className="bg-secondary/30 border-t border-border">
                      <td className="px-3 py-2 font-semibold text-xs text-muted-foreground">
                        Blended Total
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono font-bold tabular-nums text-sm text-foreground">
                          {formatPostageRate(result.avgPerPiece)}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">avg</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono font-bold tabular-nums text-sm text-foreground">
                          {formatCurrency(result.total)}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* USPS Specs -- collapsed by default */}
        <div className="border-t border-border/50 pt-2">
          <button
            onClick={() => setShowSpecs(!showSpecs)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showSpecs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span className="font-semibold uppercase tracking-wider">USPS {SHAPE_LABELS[inputs.shape]} Specs</span>
          </button>
          {showSpecs && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 pl-5">
              <span>Min: <strong className="font-mono text-foreground">{spec.min}</strong></span>
              <span>Max: <strong className="font-mono text-foreground">{spec.max}</strong></span>
              <span>Weight: <strong className="font-mono text-foreground">{spec.weight}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Error/warning alerts */}
      {errorAlerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {errorAlerts.map((a, i) => (
            <div key={i} className={cn("flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium", a.type === "error" ? "bg-destructive/10 text-destructive" : "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300")}>
              {a.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Info notes -- compact chips */}
      {infoAlerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {infoAlerts.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-full bg-muted/50 border border-border px-3 py-1.5 text-xs text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{a.message}</span>
            </div>
          ))}
        </div>
      )}

      <ResultsBar
        isValid={result.isValid}
        perPiece={result.avgPerPiece}
        total={result.total}
        quantity={inputs.quantity}
        disabled={!result.isValid || (hasDimensions && suggestedShapes.length === 0 && !shapeOverride)}
        onAdd={handleAddToQuote}
        onAddManual={handleAddManual}
      />
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
//  MAIN EXPORT -- Tab switcher
// ═══════════════════════════════════════════════════════════════

export function USPSPostageCalculator() {
  const [activeTab, setActiveTab] = useState<1 | 2>(1)
  const mailing = useMailing()
  const suggestedShapes = mailing.suggestedShapes

  useEffect(() => {
    if (suggestedShapes.length === 1 && suggestedShapes[0] === "PARCEL") {
      setActiveTab(2)
    }
  }, [suggestedShapes])

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border">
        <button
          type="button"
          onClick={() => setActiveTab(1)}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all",
            activeTab === 1
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Letters & Flats
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(2)}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all",
            activeTab === 2
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Parcels & Special
        </button>
      </div>

      {activeTab === 1 ? <Tab1LettersFlats /> : <Tab2Parcels />}
    </div>
  )
}

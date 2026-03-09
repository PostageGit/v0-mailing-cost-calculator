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
  type TierKey,
} from "@/lib/usps-rates"
import { getActiveConfig, sortMixKey } from "@/lib/pricing-config"
import { Plus, ChevronDown, ChevronRight, Info, AlertCircle, AlertTriangle, BookOpen, Check } from "lucide-react"
import useSWR from "swr"
import type { SuppliersConfig, SupplyItem } from "@/lib/suppliers"
import { DEFAULT_SUPPLIERS_CONFIG } from "@/lib/suppliers"
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

  const [bufferCents, setBufferCents] = useState("0")
  const parsedBuffer = parseFloat(bufferCents) || 0

  const handleAddToQuote = useCallback(() => {
    if (!result.isValid) return
    const bufferPerPiece = parsedBuffer / 100
    const bufferedTotal = (result.perPiece + bufferPerPiece) * inputs.quantity
    const svcLabels: Record<Tab2Service, string> = { PS: "Parcel Select", MM: "Media Mail", LM: "Library Mail", BPM: "Bound Printed Matter" }
    const desc = parsedBuffer > 0 ? `${result.rateInfo} | +${parsedBuffer}c buffer` : result.rateInfo
    quote.addItem({
      category: "postage",
      label: `USPS ${result.description} - ${inputs.quantity.toLocaleString()} pc`,
      description: desc,
      amount: parsedBuffer > 0 ? bufferedTotal : result.total,
      metadata: {
        mailingClass: svcLabels[inputs.service],
        dropOff: inputs.service === "PS" ? inputs.psEntry : inputs.service === "BPM" ? inputs.bpmEntry : undefined,
        bufferCents: parsedBuffer > 0 ? parsedBuffer : undefined,
      },
    })
  }, [result, inputs, quote, parsedBuffer])

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
  <div key={i} className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium", a.type === "error" ? "bg-destructive/10 text-destructive" : a.type === "warning" ? "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300" : a.type === "override" ? "bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300" : "bg-muted text-muted-foreground")}>
  {a.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : a.type === "warning" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : a.type === "override" ? <Info className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Add to quote */}
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card">
        <div className="flex-1">
          <div className="flex items-baseline gap-4">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Per Piece</span>
              <span className="text-xl font-bold font-mono tabular-nums">{result.isValid ? formatPostageRate(result.perPiece + parsedBuffer / 100) : "---"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total</span>
              <span className="text-lg font-bold font-mono tabular-nums">{result.isValid ? formatCurrency((result.perPiece + parsedBuffer / 100) * inputs.quantity) : "$0.00"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-2 py-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Buf</span>
          <span className="text-muted-foreground text-xs">+</span>
          <input
            type="text"
            inputMode="decimal"
            value={bufferCents}
            onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,1}$/.test(v)) setBufferCents(v) }}
            className="w-8 text-center font-mono text-xs font-bold bg-transparent border-b border-border text-foreground px-0 py-0 outline-none focus:border-foreground transition-all"
          />
          <span className="text-muted-foreground text-[10px]">c</span>
        </div>
        <button
          onClick={handleAddToQuote}
          disabled={!result.isValid}
          className="flex items-center gap-1.5 bg-foreground text-background text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-foreground/90 disabled:opacity-30 transition-all shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
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

  // ── Sort level qty distribution (editable) ──
  const mixConfigKey = sortMixKey(inputs.service, inputs.shape, inputs.mailType)
  const savedMix = getActiveConfig().sortLevelMix[mixConfigKey]

  // Build initial qty distribution from default %
  const [tierQtys, setTierQtys] = useState<Record<string, number>>({})
  const lastQtyRef = useRef(0)
  const lastMixKeyRef = useRef("")

  // Recalculate when quantity, tiers, or mix key changes
  useEffect(() => {
    if (inputs.quantity === lastQtyRef.current && mixConfigKey === lastMixKeyRef.current) return
    lastQtyRef.current = inputs.quantity
    lastMixKeyRef.current = mixConfigKey
    const mix = savedMix || {}
    const totalPct = Object.values(mix).reduce((s, v) => s + v, 0)
    const newQtys: Record<string, number> = {}
    let assigned = 0
    const tierKeys = tiers.map(t => t.k)
    tierKeys.forEach((k, i) => {
      const pct = mix[k] ?? (100 / tierKeys.length)
      const normPct = totalPct > 0 ? pct / totalPct : 1 / tierKeys.length
      if (i === tierKeys.length - 1) {
        newQtys[k] = inputs.quantity - assigned
      } else {
        newQtys[k] = Math.round(inputs.quantity * normPct)
        assigned += newQtys[k]
      }
    })
    setTierQtys(newQtys)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.quantity, tiers.length, mixConfigKey])

  // Weighted average rate across all tier quantities
  const weightedResult = useMemo(() => {
    if (tiers.length === 0) return null
    const totalQty = Object.values(tierQtys).reduce((s, v) => s + v, 0)
    if (totalQty <= 0) return null
    let weightedTotal = 0
    for (let i = 0; i < tiers.length; i++) {
      const tp = result.tierPrices[i]
      const qty = tierQtys[tiers[i].k] || 0
      if (tp && tp.price > 0) {
        weightedTotal += tp.price * qty
      }
    }
    // Add saturation if applicable
    const satQty = Math.min(inputs.saturationQty || 0, inputs.quantity)
    const satTotal = result.satRate > 0 && satQty > 0 ? result.satRate * satQty : 0
    const grandTotal = weightedTotal + satTotal
    const allQty = totalQty + satQty
    return { weightedTotal, satTotal, grandTotal, avgPerPiece: allQty > 0 ? grandTotal / allQty : 0, totalQty: allQty }
  }, [tiers, tierQtys, result, inputs.saturationQty, inputs.quantity])

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
      // Sync format to mailing context for tabbing inference
      if (patch.pack) mailing.setUspsFormat(patch.pack)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailing.outerPiece?.id, mailing.outerPiece?.type, mailing.outerPiece?.width, mailing.outerPiece?.height, mailing.outerPiece?.envelopeKind])

  const update = useCallback((partial: Partial<USPSInputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...partial }
      if ((next.service === "MKT_COMM" || next.service === "MKT_NP") && next.shape === "POSTCARD") {
        next.shape = "LETTER"
      }
      // USPS rule: postcards >4x6 must be Letter rate at Retail
      if (next.service === "FCM_RETAIL" && next.shape === "POSTCARD") {
        const w = mailing.mailerWidth || 0
        const h = mailing.mailerHeight || 0
        if (w > 0 && h > 0 && (Math.min(w, h) > 4 || Math.max(w, h) > 6)) {
          next.shape = "LETTER"
        }
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
      // Sync USPS format to mailing context for downstream inference (e.g. tabbing)
      if (partial.pack !== undefined) {
        mailing.setUspsFormat(next.pack)
      }
      return next
    })
  }, [mailing])

  const [bufferCents, setBufferCents] = useState("0")
  const parsedBuffer = parseFloat(bufferCents) || 0

  // Custom avg override - lets user type their own average rate
  const [avgOverride, setAvgOverride] = useState<number | null>(null)
  const [avgOverrideInput, setAvgOverrideInput] = useState("")

  const handleAddToQuote = useCallback(() => {
    if (!result.isValid) return
    const bufferPerPiece = parsedBuffer / 100
    const classMap: Record<string, string> = {
      FCM_COMM: "First Class", FCM_RETAIL: "Retail",
      MKT_COMM: "Marketing", MKT_NP: "Non-Profit",
    }
    const mailingClass = classMap[inputs.service] || SERVICE_LABELS[inputs.service]

    // Retail / single-rate path (no tiers)
    if (!weightedResult) {
      const totalQty = inputs.quantity
      const perPiece = result.avgPerPiece + bufferPerPiece
      const total = perPiece * totalQty
      // Customer-facing: mail class + qty + per-piece rate
      const custDesc = `${mailingClass} | ${totalQty.toLocaleString()} x ${formatPostageRate(perPiece)}`
      quote.addItem({
        category: "postage",
        label: `USPS Postage - ${totalQty.toLocaleString()} pc`,
        description: custDesc,
        amount: total,
        metadata: {
          mailingClass,
          mailShape: inputs.shape.toLowerCase(),
          avgPerPiece: perPiece,
          bufferCents: parsedBuffer > 0 ? parsedBuffer : undefined,
        },
      })
      return
    }

    // Presort path with tier breakdown
    // Use custom override if set, otherwise use calculated weighted average
    const baseAvg = avgOverride !== null ? avgOverride : weightedResult.avgPerPiece
    const baseTotal = avgOverride !== null ? avgOverride * inputs.quantity : weightedResult.grandTotal
    const totalWithBuffer = baseTotal + (bufferPerPiece * inputs.quantity)
    const avgWithBuffer = baseAvg + bufferPerPiece
    // Customer-facing description: mail class + qty + estimated per-piece only
    const custParts: string[] = [mailingClass]
    if (avgOverride !== null) {
      custParts.push(`${inputs.quantity.toLocaleString()} x ${formatPostageRate(avgWithBuffer)}`)
    } else {
      custParts.push(`${weightedResult.totalQty.toLocaleString()} x ~${formatPostageRate(avgWithBuffer)}`)
    }
    quote.addItem({
      category: "postage",
      label: `USPS Postage - ${inputs.quantity.toLocaleString()} pc`,
      description: custParts.join(" | "),
      amount: totalWithBuffer,
      metadata: {
        mailingClass,
        mailShape: inputs.shape.toLowerCase(),
        avgPerPiece: avgWithBuffer,
        // Internal-only fields (not shown to customer)
        entryPoint: inputs.entry,
        mailType: (inputs.service === "MKT_COMM" || inputs.service === "MKT_NP") ? inputs.mailType : undefined,
        bufferCents: parsedBuffer > 0 ? parsedBuffer : undefined,
        tierBreakdown: avgOverride === null ? tierQtys : undefined,
        isCustomAvg: avgOverride !== null,
      },
    })
  }, [result, inputs, quote, tiers, tierQtys, weightedResult, parsedBuffer, avgOverride])

  const [showManual, setShowManual] = useState(false)
  const [manualRate, setManualRate] = useState("")
  const parsedRate = parseFloat(manualRate)
  const hasManual = manualRate.length > 0 && !isNaN(parsedRate) && parsedRate > 0

  const handleAddManual = useCallback(() => {
    if (!hasManual) return
    const totalQty = inputs.quantity + (inputs.saturationQty || 0)
    const manualTotal = parsedRate * totalQty
    const classMap: Record<string, string> = {
      FCM_COMM: "First Class", FCM_RETAIL: "Retail",
      MKT_COMM: "Marketing", MKT_NP: "Non-Profit",
    }
    const mailingClass = classMap[inputs.service] || SERVICE_LABELS[inputs.service]
    quote.addItem({
      category: "postage",
      label: `USPS Postage - ${totalQty.toLocaleString()} pc`,
      description: `${mailingClass} ${inputs.shape.charAt(0) + inputs.shape.slice(1).toLowerCase()} | ${totalQty.toLocaleString()} x $${parsedRate.toFixed(3)}`,
      amount: manualTotal,
      metadata: {
        mailingClass,
        mailShape: inputs.shape.toLowerCase(),
        isEstimated: true,
        manualRate: parsedRate,
      },
    })
    setManualRate("")
  }, [inputs, quote, parsedRate, hasManual])

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
  // USPS rule: postcards larger than 4x6 are only postcard rate if presorted.
  // For retail, they must be classified as Letter.
  const isLargePostcard = hasDimensions && (() => {
    const w = mailing.mailerWidth || 0
    const h = mailing.mailerHeight || 0
    const s = Math.min(w, h)
    const l = Math.max(w, h)
    return s > 4 || l > 6
  })()
  const postcardBlockedByRetail = isRetail && isLargePostcard
  const isShapeDisabled = (shape: string) => {
    if (shape === "POSTCARD" && isMkt) return true
    if (shape === "POSTCARD" && postcardBlockedByRetail) return true
    if (hasDimensions && !shapeOverride && !suggestedShapes.includes(shape as USPSShape)) return true
    return false
  }
  const postcardDisabled = isShapeDisabled("POSTCARD")
  const showSaturation = isMkt
  const showEntryPoint = isMkt
  const showSortSection = !isRetail
  const showMailType = isMkt
  const spec = SPECS[inputs.shape]
  const [showSpecs, setShowSpecs] = useState(false)

  // Update a single tier's qty -- clamp so total never exceeds mailing qty
  const updateTierQty = (tierKey: string, newVal: number) => {
    setTierQtys(prev => {
      const otherSum = Object.entries(prev)
        .filter(([k]) => k !== tierKey)
        .reduce((s, [, v]) => s + (v || 0), 0)
      const clamped = Math.max(0, Math.min(newVal, inputs.quantity - otherSum))
      return { ...prev, [tierKey]: clamped }
    })
  }

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
            {/* Retail large-postcard rule alert */}
            {postcardBlockedByRetail && inputs.shape === "LETTER" && (
              <div className="flex items-start gap-2 mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>USPS Rule:</strong> Postcards larger than 4" x 6" are charged as <strong>Letter</strong> rate at Retail. Switch to <strong>FC Presort</strong> to use Postcard rates.
                </span>
              </div>
            )}
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

        {/* Dimension alerts -- inline where relevant */}
        {hasDimensions && suggestedShapes.length > 0 && suggestedShapes.includes("PARCEL") && !suggestedShapes.some((s) => s === "POSTCARD" || s === "LETTER" || s === "FLAT") && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
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

        {/* Weight/service errors RIGHT BELOW the weight field */}
        {result.alerts.filter(a => a.type === "error").map((a, i) => (
          <div key={`err-${i}`} className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {a.message}
          </div>
        ))}

        {/* Warning alerts inline */}
        {result.alerts.filter(a => a.type === "warning").map((a, i) => (
          <div key={`warn-${i}`} className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {a.message}
          </div>
        ))}

        {/* ── Rate Comparison Table with Editable Quantities ── */}
        {showSortSection && tiers.length > 0 && (
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
            </div>

            {/* Rate table with editable qty per tier */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">Sort Level</th>
                    <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">Pieces</th>
                    <th className="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">Per Piece</th>
                    <th className="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {result.tierPrices.map((tp, i) => {
                    const tierKey = tiers[i]?.k
                    const qty = tierQtys[tierKey] || 0
                    const tierSubtotal = tp.price * qty
                    return (
                      <tr
                        key={tp.tier.k}
                        className="border-b border-border/50 last:border-b-0 hover:bg-secondary/20 transition-colors"
                      >
                        <td className="px-3 py-2 font-medium text-sm">
                          {tp.tier.l}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            min={0}
                            value={qty || ""}
                            onChange={(e) => updateTierQty(tierKey, parseInt(e.target.value) || 0)}
                            className="w-20 h-7 text-center text-xs font-mono font-semibold rounded-md border border-border bg-background px-1 outline-none focus:ring-1 focus:ring-foreground/20 tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-mono font-bold tabular-nums">
                            {tp.price > 0 ? formatPostageRate(tp.price) : "---"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {tp.price > 0 && qty > 0 ? formatCurrency(tierSubtotal) : "---"}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Saturation row */}
                  {showSaturation && result.satRate > 0 && (inputs.saturationQty || 0) > 0 && (
                    <tr className="bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-200 dark:border-emerald-800/40">
                      <td className="px-3 py-2 font-medium text-emerald-800 dark:text-emerald-300 text-sm">
                        Saturation
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">{Math.min(inputs.saturationQty, inputs.quantity).toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                          {formatPostageRate(result.satRate)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(result.satRate * Math.min(inputs.saturationQty, inputs.quantity))}
                        </span>
                      </td>
                    </tr>
                  )}
                  {/* Weighted avg total row */}
                  {weightedResult && (() => {
                    const missing = inputs.quantity - weightedResult.totalQty
                    const hasMissing = missing > 0
                    // Use override if set, otherwise use calculated
                    const displayAvg = avgOverride !== null ? avgOverride : weightedResult.avgPerPiece
                    const displayTotal = displayAvg * inputs.quantity
                    const isOverridden = avgOverride !== null
                    return (
                    <tr className={cn("border-t border-border", isOverridden ? "bg-pink-50 dark:bg-pink-950/20" : "bg-secondary/40")}>
                      <td className="px-3 py-2.5 font-bold text-xs text-foreground">
                        {isOverridden ? "Custom Average" : "Weighted Average"}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={cn("text-xs font-mono font-bold tabular-nums", hasMissing && !isOverridden ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                          {inputs.quantity.toLocaleString()}
                        </span>
                        {hasMissing && !isOverridden && (
                          <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                            {missing.toLocaleString()} unallocated
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={formatPostageRate(weightedResult.avgPerPiece)}
                            value={avgOverrideInput}
                            onChange={(e) => {
                              const v = e.target.value
                              setAvgOverrideInput(v)
                              if (v === "" || v.trim() === "") {
                                setAvgOverride(null)
                              } else {
                                const parsed = parseFloat(v)
                                if (!isNaN(parsed) && parsed >= 0) {
                                  setAvgOverride(parsed)
                                }
                              }
                            }}
                            className={cn(
                              "w-16 h-6 text-right text-xs font-mono font-bold rounded border px-1 outline-none focus:ring-1 focus:ring-foreground/20 tabular-nums",
                              isOverridden 
                                ? "border-pink-300 dark:border-pink-700 bg-white dark:bg-pink-950/30 text-pink-700 dark:text-pink-300" 
                                : "border-border bg-background text-foreground"
                            )}
                          />
                          <span className="text-[10px] text-muted-foreground">avg</span>
                        </div>
                        {!isOverridden && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            calc: {formatPostageRate(weightedResult.avgPerPiece)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn("font-mono font-bold tabular-nums", isOverridden ? "text-pink-700 dark:text-pink-300" : "text-foreground")}>
                          {formatCurrency(displayTotal)}
                        </span>
                      </td>
                    </tr>
                    )})()}
                </tbody>
              </table>
            </div>

            {/* Info notes -- compact, right after the table */}
            {result.alerts.filter(a => a.type === "info").length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.alerts.filter(a => a.type === "info").map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-full bg-muted/50 border border-border px-2.5 py-1 text-[10px] text-muted-foreground">
                    <Info className="h-2.5 w-2.5 shrink-0" />
                    <span className="line-clamp-1">{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Retail -- no tiers, just show the rate */}
        {isRetail && result.isValid && (
          <div className="rounded-xl border border-border bg-secondary/30 p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Retail Rate</span>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold font-mono tabular-nums">{formatPostageRate(result.avgPerPiece)}</span>
              <span className="text-sm font-mono text-muted-foreground tabular-nums">{formatCurrency(result.total)}</span>
            </div>
          </div>
        )}

        {/* USPS Specs -- collapsed */}
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

      {/* ── Add to Quote bar (static, NOT sticky) ── */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-baseline gap-5">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Avg Per Piece</span>
              <span className={cn("text-2xl font-bold font-mono tabular-nums", avgOverride !== null && "text-pink-600 dark:text-pink-400")}>
                {result.isValid && weightedResult 
                  ? formatPostageRate((avgOverride !== null ? avgOverride : weightedResult.avgPerPiece) + parsedBuffer / 100) 
                  : isRetail && result.isValid 
                    ? formatPostageRate(result.avgPerPiece + parsedBuffer / 100) 
                    : "---"}
              </span>
              {avgOverride !== null && <span className="text-[9px] text-pink-500 block">custom</span>}
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Total</span>
              <span className={cn("text-lg font-bold font-mono tabular-nums", avgOverride !== null ? "text-pink-600 dark:text-pink-400" : "text-muted-foreground")}>
                {result.isValid && weightedResult
                  ? formatCurrency((avgOverride !== null ? avgOverride * inputs.quantity : weightedResult.grandTotal) + (parsedBuffer / 100) * inputs.quantity)
                  : isRetail && result.isValid
                    ? formatCurrency((result.avgPerPiece + parsedBuffer / 100) * inputs.quantity)
                    : "$0.00"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-secondary/60 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Buf</span>
              <span className="text-muted-foreground text-xs">+</span>
              <input
                type="text"
                inputMode="decimal"
                value={bufferCents}
                onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,1}$/.test(v)) setBufferCents(v) }}
                className="w-8 text-center font-mono text-xs font-bold bg-transparent border-b border-border text-foreground px-0 py-0 outline-none focus:border-foreground transition-all"
              />
              <span className="text-muted-foreground text-[10px]">c</span>
            </div>
            <button
              onClick={handleAddToQuote}
              disabled={!result.isValid}
              className="flex items-center gap-1.5 bg-foreground text-background text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-foreground/90 disabled:opacity-30 transition-all shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add to Quote
            </button>
          </div>
        </div>

        {/* Custom rate override -- collapsed */}
        <div className="border-t border-border/30 pt-2">
          <button
            onClick={() => setShowManual(!showManual)}
            className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
          >
            {showManual ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Custom Rate Override
          </button>
          {showManual && (
            <div className="flex items-center gap-3 mt-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.285"
                  className="h-9 w-32 pl-6 pr-3 font-mono text-sm"
                  value={manualRate}
                  onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,4}$/.test(v)) setManualRate(v) }}
                />
              </div>
              {hasManual && (
                <>
                  <span className="text-sm font-mono font-bold tabular-nums">{formatCurrency(parsedRate * (inputs.quantity + (inputs.saturationQty || 0)))}</span>
                  <button
                    onClick={handleAddManual}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add Estimate
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── List Rentals Add-On Section ── */}
      <ListRentalsAddOn quantity={inputs.quantity} />
    </div>
  )
}

// ─── List Rentals Add-On Component ───────────────────────────
function ListRentalsAddOn({ quantity }: { quantity: number }) {
  const quote = useQuote()
  const [addedLists, setAddedLists] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)

  // Fetch supplier config for list rental prices
  const { data: appSettings } = useSWR("/api/app-settings", (url: string) => fetch(url).then((r) => r.json()))
  const listRentals = useMemo(() => {
    const cfg: SuppliersConfig = appSettings?.suppliers_config || DEFAULT_SUPPLIERS_CONFIG
    return cfg.supplyItems.filter((item: SupplyItem) => item.category === "list_rental" && item.sellPrice > 0)
  }, [appSettings])

  const addListRental = useCallback((item: SupplyItem) => {
    // Use list's own count if billingMode is "list_count", otherwise use mailing quantity
    const billingQty = item.billingMode === "mailing_qty" ? quantity : (item.nameCount || quantity)
    const totalCost = item.sellPrice * billingQty
    const qtyLabel = item.billingMode === "mailing_qty" ? `${quantity.toLocaleString()} pcs` : `${billingQty.toLocaleString()} names`
    quote.addItem({
      category: "item",
      label: `List Rental - ${item.name}`,
      description: `${qtyLabel} @ $${(item.sellPrice * 1000).toFixed(0)}/M`,
      amount: totalCost,
      metadata: { 
        serviceId: `list-rent-${item.id}`, 
        priceUnit: "name/mailing", 
        unitPrice: item.sellPrice, 
        qty: billingQty,
        listName: item.name,
        billingMode: item.billingMode || "list_count"
      },
    })
    setAddedLists(prev => new Set(prev).add(item.id))
  }, [quote, quantity])

  if (listRentals.length === 0) return null

  return (
    <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-950/20 p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-500 p-2">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-foreground">Need a Mailing List?</h4>
            <p className="text-xs text-muted-foreground">Add list rentals to your quote</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {addedLists.size > 0 && (
            <span className="rounded-full bg-purple-500 text-white px-2.5 py-0.5 text-xs font-bold">
              {addedLists.size} added
            </span>
          )}
          {expanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {listRentals.map((item: SupplyItem) => {
            const isAdded = addedLists.has(item.id)
            const billingQty = item.billingMode === "mailing_qty" ? quantity : (item.nameCount || quantity)
            const totalCost = item.sellPrice * billingQty
            const isUsingListCount = (item.billingMode || "list_count") === "list_count" && item.nameCount && item.nameCount > 0
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !isAdded && addListRental(item)}
                disabled={isAdded || quantity <= 0}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all",
                  isAdded
                    ? "border-purple-400 bg-purple-100 dark:bg-purple-900/30"
                    : "border-border bg-background hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300"
                )}
              >
                <div className="flex items-center gap-1.5 w-full">
                  {isAdded ? (
                    <Check className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={cn("text-sm font-semibold truncate", isAdded ? "text-purple-700 dark:text-purple-300" : "text-foreground")}>
                    {item.name}
                  </span>
                </div>
                <div className="flex flex-col w-full gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      ${Math.round(item.sellPrice * 1000)}/M
                    </span>
                    {billingQty > 0 && (
                      <span className={cn("text-xs font-bold", isAdded ? "text-purple-600 dark:text-purple-400" : "text-foreground")}>
                        {formatCurrency(totalCost)}
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {isUsingListCount ? `${billingQty.toLocaleString()} names` : `x ${quantity.toLocaleString()} pcs`}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
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

"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useQuote } from "@/lib/quote-context"
import { useMailing } from "@/lib/mailing-context"
import { formatCurrency } from "@/lib/pricing"
import { Plus, Check, AlertCircle, ArrowRight, ArrowUpRight } from "lucide-react"

/*
 * Complete envelope catalog.
 * maxInsert = the largest INSERT (flat card) that fits, accounting for ~0.125" clearance per side.
 * fitsTypes = what kind of insert typically goes in this envelope.
 * Tags: "flat" = flat card unfolded, "folded" = folded piece, "booklet" = saddle-stitched booklet, "letter" = standard letter.
 */
const ENVELOPES = [
  // --- Announcement / Invitation (A-series) ---
  { id: "a2",    name: "A2",              w: 4.375,  h: 5.75,   maxInsert: [4.25, 5.5],   types: ["flat"],                      desc: "RSVP / Note card",       common: "4.25 x 5.5 card" },
  { id: "a6",    name: "A6",              w: 4.75,   h: 6.5,    maxInsert: [4.5, 6.25],    types: ["flat"],                      desc: "4x6 photo / postcard",   common: "4 x 6 card" },
  { id: "a7",    name: "A7",              w: 5.25,   h: 7.25,   maxInsert: [5, 7],         types: ["flat"],                      desc: "5x7 invitation",         common: "5 x 7 card" },
  { id: "a8",    name: "A8",              w: 5.5,    h: 8.125,  maxInsert: [5.25, 8],      types: ["flat", "folded"],            desc: "Large invitation",       common: "5.25 x 8 card" },
  { id: "a9",    name: "A9",              w: 5.75,   h: 8.75,   maxInsert: [5.5, 8.5],     types: ["flat", "folded"],            desc: "Large greeting card",    common: "5.5 x 8.5 card" },
  { id: "a10",   name: "A10",             w: 6,      h: 9.5,    maxInsert: [5.75, 9.25],   types: ["flat", "folded"],            desc: "6x9 programs",           common: "5.75 x 9.25 card" },
  // --- Commercial / Business ---
  { id: "6.75",  name: "#6¾",             w: 3.625,  h: 6.5,    maxInsert: [3.5, 6],       types: ["folded"],                    desc: "Personal / reply",       common: "Letter folded in thirds" },
  { id: "9",     name: "#9 Reply",        w: 3.875,  h: 8.875,  maxInsert: [3.75, 8.625],  types: ["folded"],                    desc: "Reply / return",         common: "8.5x11 folded in thirds" },
  { id: "10",    name: "#10 Standard",    w: 4.125,  h: 9.5,    maxInsert: [4, 9.25],      types: ["folded", "letter"],          desc: "Standard business",      common: "8.5 x 11 tri-fold" },
  { id: "11",    name: "#11",             w: 4.5,    h: 10.375, maxInsert: [4.25, 10.125], types: ["folded", "letter"],          desc: "Policy / statement",     common: "Legal fold" },
  { id: "12",    name: "#12",             w: 4.75,   h: 11,     maxInsert: [4.5, 10.75],   types: ["folded", "letter"],          desc: "Large statement",        common: "Legal fold" },
  { id: "14",    name: "#14",             w: 5,      h: 11.5,   maxInsert: [4.75, 11.25],  types: ["flat", "folded"],            desc: "Extra-large letter",     common: "8.5 x 11 flat or folded" },
  // --- Booklet / Catalog (open-side) ---
  { id: "6x9",   name: "6 x 9 Booklet",  w: 6,      h: 9,      maxInsert: [5.75, 8.75],   types: ["flat", "booklet"],           desc: "Booklet / catalog",      common: "5.5 x 8.5 booklet" },
  { id: "9x12",  name: "9 x 12 Catalog", w: 9,      h: 12,     maxInsert: [8.75, 11.75],  types: ["flat", "booklet"],           desc: "8.5x11 unfolded",        common: "8.5 x 11 flat" },
  { id: "10x13", name: "10 x 13 Catalog",w: 10,     h: 13,     maxInsert: [9.75, 12.75],  types: ["flat", "booklet"],           desc: "Large catalog",          common: "9.5 x 12.5 flat" },
  // --- Custom ---
  { id: "custom", name: "Custom",         w: 0,      h: 0,      maxInsert: [0, 0],         types: ["flat", "folded", "booklet"], desc: "Enter dimensions",       common: "" },
]

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  flat:    { label: "Flat",    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  folded:  { label: "Folded",  color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  booklet: { label: "Booklet", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  letter:  { label: "Letter",  color: "bg-secondary text-foreground" },
}

const CLEARANCE = 0.125

function cardFitsEnvelope(cardW: number, cardH: number, envW: number, envH: number): boolean {
  const shortC = Math.min(cardW, cardH)
  const longC = Math.max(cardW, cardH)
  const shortE = Math.min(envW, envH)
  const longE = Math.max(envW, envH)
  return shortC + CLEARANCE <= shortE && longC + CLEARANCE <= longE
}

export function EnvelopeTab() {
  const quote = useQuote()
  const mailing = useMailing()

  const [selectedId, setSelectedId] = useState("")
  const [quantity, setQuantity] = useState(mailing.quantity || 5000)
  const [unitCost, setUnitCost] = useState("")
  const [customW, setCustomW] = useState("")
  const [customH, setCustomH] = useState("")
  const [added, setAdded] = useState(false)

  const cardW = mailing.mailerWidth
  const cardH = mailing.mailerHeight
  const hasDims = !!(cardW && cardH)

  // Split envelopes by fit
  const { fits, tooSmall } = useMemo(() => {
    if (!hasDims) return { fits: ENVELOPES, tooSmall: [] as typeof ENVELOPES }
    const f: typeof ENVELOPES = []
    const t: typeof ENVELOPES = []
    for (const env of ENVELOPES) {
      if (env.id === "custom") { f.push(env); continue }
      if (cardFitsEnvelope(cardW!, cardH!, env.w, env.h)) f.push(env)
      else t.push(env)
    }
    return { fits: f, tooSmall: t }
  }, [hasDims, cardW, cardH])

  const bestMatch = useMemo(() => {
    if (!hasDims) return null
    const sorted = fits.filter((e) => e.id !== "custom").sort((a, b) => a.w * a.h - b.w * b.h)
    return sorted.length > 0 ? sorted[0].id : null
  }, [fits, hasDims])

  const selected = ENVELOPES.find((e) => e.id === selectedId)
  const cost = parseFloat(unitCost) || 0
  const totalCost = cost * quantity

  // When envelope is selected, push its dimensions as the mail piece size
  useEffect(() => {
    if (!selected || selected.id === "custom") return
    // Set mailer dims to the envelope size so USPS calc picks it up
    mailing.setOuterWidth(selected.w)
    mailing.setOuterHeight(selected.h)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = () => {
    if (!selected || cost <= 0) return
    const envLabel = selected.id === "custom"
      ? `Custom ${customW}" x ${customH}"`
      : `${selected.name} (${selected.w}" x ${selected.h}")`
    quote.addItem({
      category: "item",
      label: `Envelope: ${envLabel} x ${quantity.toLocaleString()}`,
      description: `${formatCurrency(cost)} / each`,
      amount: totalCost,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const renderEnvCard = (env: typeof ENVELOPES[0], dimmed = false) => {
    const isSelected = selectedId === env.id
    const isBest = env.id === bestMatch
    return (
      <button
        key={env.id}
        type="button"
        onClick={() => setSelectedId(env.id)}
        className={`relative flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-all ${
          dimmed ? "opacity-40 " : ""
        }${
          isSelected
            ? "border-foreground bg-foreground text-background"
            : isBest
              ? "border-foreground/40 bg-foreground/5 hover:bg-foreground/10"
              : "border-border bg-card hover:border-foreground/20"
        }`}
      >
        {isBest && !isSelected && (
          <span className="absolute -top-1.5 right-2 text-[7px] font-bold bg-foreground text-background px-1.5 py-0.5 rounded-full leading-none tracking-wide">
            BEST FIT
          </span>
        )}
        {/* Envelope name + dims on one line */}
        <div className="flex items-baseline gap-1.5 w-full">
          <span className={`text-[11px] font-semibold leading-none ${isSelected ? "text-background" : "text-foreground"}`}>
            {env.name}
          </span>
          {env.id !== "custom" && (
            <span className={`text-[9px] font-mono leading-none ${isSelected ? "text-background/50" : "text-muted-foreground"}`}>
              {env.w}" x {env.h}"
            </span>
          )}
        </div>
        {/* Type tags */}
        <div className="flex items-center gap-1 mt-1">
          {env.types.map((t) => (
            <span key={t} className={`text-[8px] font-semibold px-1.5 py-0.5 rounded leading-none ${
              isSelected ? "bg-background/20 text-background" : TYPE_LABELS[t]?.color
            }`}>
              {TYPE_LABELS[t]?.label}
            </span>
          ))}
        </div>
        {/* What fits inside */}
        {env.common && (
          <span className={`text-[9px] mt-1 leading-tight ${isSelected ? "text-background/50" : "text-muted-foreground"}`}>
            Fits: {env.common}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Dimension context bar */}
      {hasDims ? (
        <div className="flex items-center gap-3 rounded-xl bg-secondary/60 border border-border px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Card/Insert:</span>
          <span className="text-[11px] font-bold text-foreground font-mono">{cardW}" x {cardH}"</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {fits.filter((e) => e.id !== "custom").length} fits
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-[11px] text-amber-700 dark:text-amber-400">
            Set card dimensions in Job Info to auto-filter envelopes.
          </span>
        </div>
      )}

      {/* Envelopes that fit */}
      <Card className="border-border rounded-2xl overflow-hidden">
        <CardHeader className="pb-1.5 pt-3 px-3">
          <CardTitle className="text-xs font-semibold text-foreground">
            {hasDims ? "Envelopes That Fit" : "All Envelopes"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
            {fits.map((env) => renderEnvCard(env))}
          </div>
        </CardContent>
      </Card>

      {/* Too small -- collapsed */}
      {hasDims && tooSmall.length > 0 && (
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none px-1">
            {tooSmall.length} too small &mdash; show anyway
          </summary>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2">
            {tooSmall.map((env) => renderEnvCard(env, true))}
          </div>
        </details>
      )}

      {/* Custom dims */}
      {selectedId === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">Width (in)</label>
            <Input type="number" step="0.125" min="0" value={customW} onChange={(e) => setCustomW(e.target.value)} className="h-8 text-xs rounded-lg" placeholder="4.125" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">Height (in)</label>
            <Input type="number" step="0.125" min="0" value={customH} onChange={(e) => setCustomH(e.target.value)} className="h-8 text-xs rounded-lg" placeholder="9.5" />
          </div>
        </div>
      )}

      {/* Auto-suggest banner when envelope selected */}
      {selected && selected.id !== "custom" && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground">
            Dimensions set to <strong className="text-foreground font-mono">{selected.w}" x {selected.h}"</strong> for USPS calculator.
          </span>
        </div>
      )}

      {/* Pricing row */}
      {selected && (
        <div className="flex items-end gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
          <div className="flex flex-col gap-0.5 w-20">
            <label className="text-[10px] font-medium text-muted-foreground">Qty</label>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} className="h-8 text-xs rounded-lg" />
          </div>
          <div className="flex flex-col gap-0.5 w-24">
            <label className="text-[10px] font-medium text-muted-foreground">$/each</label>
            <Input type="number" step="0.001" min="0" placeholder="0.00" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="h-8 text-xs rounded-lg" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-[70px]">
            <span className="text-[10px] text-muted-foreground">Total</span>
            <span className="text-sm font-bold font-mono text-foreground tabular-nums">{formatCurrency(totalCost)}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={cost <= 0 || added}
            className="flex items-center gap-1.5 bg-foreground text-background text-[11px] font-semibold px-4 py-2 rounded-full hover:bg-foreground/90 disabled:opacity-30 transition-all ml-auto shrink-0"
          >
            {added ? <><Check className="h-3 w-3" />Added</> : <><Plus className="h-3 w-3" />Add</>}
          </button>
        </div>
      )}
    </div>
  )
}

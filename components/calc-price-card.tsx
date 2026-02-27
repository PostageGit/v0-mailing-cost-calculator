"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, ChevronUp, Settings2, Percent } from "lucide-react"
import { formatCurrency } from "@/lib/pricing"

/* ─── Shared price card for all calculators ─── */

export interface CostLine {
  label: string
  value: number
  sub?: string
  accent?: boolean
}

export interface PaperStat {
  label: string
  value: string
}

export interface LevelInfo {
  level: number
  defaultLevel: number
  maxLevel: number
  markup: number
  pricePerSheet: number
  onLevelChange?: (delta: number) => void
}

export interface CalcPriceCardProps {
  /** Grand total (before upcharge) */
  total: number
  /** Per-unit label e.g. "/ page", "/ booklet" */
  perUnitLabel: string
  perUnitCost: number
  /** Paper name e.g. "60lb Offset" */
  paperName: string
  /** Small stat badges: Sheet, Ups, Sheets, etc. */
  stats: PaperStat[]
  /** Level indicator with segmented bar */
  level?: LevelInfo
  /** Main cost lines shown in the breakdown */
  costLines: CostLine[]
  /** Expandable details (all the nitty-gritty) */
  details?: React.ReactNode
  /** Optional "Change Size" handler */
  onChangeSize?: () => void
  /** Callback when the effective total changes (with upcharge). Parent reads this for "Add to Quote" */
  onEffectiveTotalChange?: (effectiveTotal: number) => void
}

export function CalcPriceCard({
  total,
  perUnitLabel,
  perUnitCost,
  paperName,
  stats,
  level,
  costLines,
  details,
  onChangeSize,
  onEffectiveTotalChange,
}: CalcPriceCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [upchargeOn, setUpchargeOn] = useState(false)
  const [upchargePct, setUpchargePct] = useState(35)
  const [editingPct, setEditingPct] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upchargeAmount = upchargeOn ? total * (upchargePct / 100) : 0
  const effectiveTotal = total + upchargeAmount
  const effectivePerUnit = perUnitCost > 0 && total > 0 ? effectiveTotal * (perUnitCost / total) : 0

  // Notify parent when effective total changes
  useEffect(() => {
    onEffectiveTotalChange?.(effectiveTotal)
  }, [effectiveTotal, onEffectiveTotalChange])

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingPct && inputRef.current) {
      inputRef.current.select()
    }
  }, [editingPct])

  return (
    <div className="flex flex-col gap-3">
      {/* ── Hero total ── */}
      <div className="bg-foreground text-background rounded-2xl px-5 py-4 flex items-baseline justify-between">
        <div>
          <p className="text-3xl font-bold font-mono tracking-tight">{formatCurrency(effectiveTotal)}</p>
          <p className="text-xs opacity-60 mt-0.5">
            {formatCurrency(effectivePerUnit, 4)} {perUnitLabel}
          </p>
        </div>
        {onChangeSize && (
          <button
            type="button"
            onClick={onChangeSize}
            className="text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            Change Size
          </button>
        )}
      </div>

      {/* ── Paper + stats ── */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paper</span>
          <span className="text-sm font-semibold text-foreground">{paperName}</span>
        </div>
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <StatBadge key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        )}
      </div>

      {/* ── Level control ── */}
      {level && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Level</span>
              <span className="text-lg font-extrabold text-foreground font-mono">{level.level}</span>
              {level.markup > 0 && (
                <span className="text-xs font-semibold text-muted-foreground">/ {level.markup.toFixed(2)}x</span>
              )}
              {level.level !== level.defaultLevel && (
                <span className={`text-xs font-bold ${level.level < level.defaultLevel ? "text-emerald-600" : "text-red-500"}`}>
                  {level.level < level.defaultLevel ? "cheaper" : "higher"}
                </span>
              )}
            </div>
            {level.level !== level.defaultLevel && level.onLevelChange && (
              <button
                type="button"
                onClick={() => level.onLevelChange!(level.defaultLevel - level.level)}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 hover:bg-secondary transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          {/* Level bars with default marker */}
          <div className="mt-2.5 relative">
            <div className="flex gap-1">
              {Array.from({ length: level.maxLevel }, (_, i) => i + 1).map((lvl) => {
                const isActive = lvl <= level.level
                const isDefault = lvl === level.defaultLevel
                let barColor = "bg-border hover:bg-muted-foreground/30"
                if (isActive) {
                  if (level.level < level.defaultLevel) barColor = "bg-emerald-500"
                  else if (level.level > level.defaultLevel) barColor = "bg-red-400"
                  else barColor = "bg-foreground"
                }
                return (
                  <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (level.onLevelChange && lvl !== level.level) {
                          level.onLevelChange(lvl - level.level)
                        }
                      }}
                      className={`w-full h-2.5 rounded-full transition-colors cursor-pointer hover:opacity-80 ${barColor} ${isDefault ? "ring-1 ring-foreground/30 ring-offset-1 ring-offset-card" : ""}`}
                      aria-label={`Set level ${lvl}`}
                      title={`Level ${lvl}${isDefault ? " (default)" : ""}`}
                    />
                    {isDefault && (
                      <span className="text-[8px] font-black text-muted-foreground leading-none select-none">DEF</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-2">
            ${level.pricePerSheet.toFixed(level.level >= 7 ? 4 : 3)} / sheet
          </p>
        </div>
      )}

      {/* ── Cost lines ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {costLines.filter((c) => c.value > 0 || c.accent).map((line, i) => (
          <CostRow key={i} label={line.label} value={line.value} sub={line.sub} accent={line.accent} />
        ))}

        {/* ── Upcharge toggle ── */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* Toggle button */}
              <button
                type="button"
                onClick={() => setUpchargeOn(!upchargeOn)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                  upchargeOn ? "bg-foreground" : "bg-border"
                }`}
                aria-label="Toggle upcharge"
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform duration-200 ${
                    upchargeOn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>

              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${upchargeOn ? "text-foreground" : "text-muted-foreground"}`}>
                  Upcharge
                </span>
                {/* Editable percentage pill */}
                {editingPct ? (
                  <div className="flex items-center gap-0.5 bg-secondary rounded-lg px-1.5 py-0.5">
                    <input
                      ref={inputRef}
                      type="number"
                      min={0}
                      max={200}
                      step={1}
                      value={upchargePct}
                      onChange={(e) => setUpchargePct(Math.max(0, Math.min(200, parseFloat(e.target.value) || 0)))}
                      onBlur={() => setEditingPct(false)}
                      onKeyDown={(e) => { if (e.key === "Enter") setEditingPct(false) }}
                      className="w-10 bg-transparent text-xs font-bold text-foreground text-center outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingPct(true)}
                    className={`flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-xs font-bold font-mono transition-colors ${
                      upchargeOn
                        ? "bg-foreground/10 text-foreground hover:bg-foreground/20"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {upchargePct}%
                  </button>
                )}
              </div>
            </div>

            {/* Upcharge amount */}
            {upchargeOn && (
              <span className="text-xs font-bold text-foreground font-mono">
                +{formatCurrency(upchargeAmount)}
              </span>
            )}
          </div>
        </div>

        {/* Grand Total */}
        <div className="px-4 py-3 bg-secondary/30 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Total</span>
          <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(effectiveTotal)}</span>
        </div>
      </div>

      {/* ── Expandable details ── */}
      {details && (
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 rounded-xl border border-border bg-card hover:bg-secondary/30"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {showDetails ? "Hide Details" : "View Details"}
          {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      )}
      {showDetails && details && (
        <div className="rounded-xl border border-border bg-card p-4">
          {details}
        </div>
      )}
    </div>
  )
}

/* ── Small helpers ── */

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-secondary/30 py-2 px-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground font-mono leading-tight">{value}</span>
    </div>
  )
}

function CostRow({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <span className={`text-xs ${accent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {label}
        </span>
        {sub && <span className="text-[10px] text-muted-foreground ml-1.5">({sub})</span>}
      </div>
      <span className="text-xs font-semibold font-mono whitespace-nowrap text-foreground">
        {formatCurrency(value)}
      </span>
    </div>
  )
}

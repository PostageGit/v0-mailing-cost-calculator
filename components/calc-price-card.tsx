"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react"
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
  maxLevel: number
  markup: number
  pricePerSheet: number
  onLevelChange?: (delta: number) => void
}

export interface CalcPriceCardProps {
  /** Grand total */
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
}: CalcPriceCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      {/* ── Hero total ── */}
      <div className="bg-foreground text-background rounded-2xl px-5 py-4 flex items-baseline justify-between">
        <div>
          <p className="text-3xl font-bold font-mono tracking-tight">{formatCurrency(total)}</p>
          <p className="text-xs opacity-60 mt-0.5">
            {formatCurrency(perUnitCost, 4)} {perUnitLabel}
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
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Level</span>
              <span className="ml-2 text-lg font-bold text-foreground font-mono">{level.level}</span>
              {level.markup > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">/ {level.markup.toFixed(2)}x markup</span>
              )}
            </div>
            {level.onLevelChange && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => level.onLevelChange!(-1)}
                  disabled={level.level <= 1}
                  className="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Decrease level"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => level.onLevelChange!(1)}
                  disabled={level.level >= level.maxLevel}
                  className="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Increase level"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: level.maxLevel }, (_, i) => i + 1).map((lvl) => (
              <div
                key={lvl}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  lvl <= level.level ? "bg-foreground" : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            ${level.pricePerSheet.toFixed(level.level >= 7 ? 4 : 3)} / sheet
          </p>
        </div>
      )}

      {/* ── Cost lines ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {costLines.filter((c) => c.value > 0 || c.accent).map((line, i) => (
          <CostRow key={i} label={line.label} value={line.value} sub={line.sub} accent={line.accent} />
        ))}

        {/* Grand Total */}
        <div className="px-4 py-3 bg-secondary/30 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Total</span>
          <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(total)}</span>
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

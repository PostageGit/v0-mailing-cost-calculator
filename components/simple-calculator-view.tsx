"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Plus, Calculator, ChevronRight } from "lucide-react"
import { formatCurrency } from "@/lib/pricing"

// ── Types ────────────────────────────────────────────────────────────────────
export interface SimpleCalcRow {
  id: string
  label: string
  qty: number
  size: string
  paper: string
  sides: string
  total: number | null
  perPiece: number | null
  isCalculating?: boolean
}

interface SimpleCalculatorViewProps {
  rows: SimpleCalcRow[]
  onRowChange: (id: string, field: keyof SimpleCalcRow, value: string | number) => void
  onCalculate: (id: string) => void
  onAddToQuote: (id: string) => void
  onAddRow: () => void
  onRemoveRow: (id: string) => void
  paperOptions: { name: string; value: string }[]
  sideOptions: string[]
  title: string
  canAddRow?: boolean
}

// ── Simple Calculator View ───────────────────────────────────────────────────
export function SimpleCalculatorView({
  rows,
  onRowChange,
  onCalculate,
  onAddToQuote,
  onAddRow,
  onRemoveRow,
  paperOptions,
  sideOptions,
  title,
  canAddRow = true,
}: SimpleCalculatorViewProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Quick entry mode — fill in basics, get instant pricing</p>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_80px_100px_140px_80px_100px_80px_80px] gap-2 px-4 py-2 border-b border-border bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>Description</span>
        <span>Qty</span>
        <span>Size</span>
        <span>Paper</span>
        <span>Sides</span>
        <span className="text-right">Total</span>
        <span className="text-right">Per Pc</span>
        <span></span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {rows.map((row, idx) => (
          <SimpleCalcRowItem
            key={row.id}
            row={row}
            index={idx}
            onRowChange={onRowChange}
            onCalculate={onCalculate}
            onAddToQuote={onAddToQuote}
            onRemove={rows.length > 1 ? () => onRemoveRow(row.id) : undefined}
            paperOptions={paperOptions}
            sideOptions={sideOptions}
          />
        ))}
      </div>

      {/* Add Row Footer */}
      {canAddRow && rows.length < 10 && (
        <div className="px-4 py-2 border-t border-border bg-muted/10">
          <button
            type="button"
            onClick={onAddRow}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add another item
          </button>
        </div>
      )}
    </div>
  )
}

// ── Single Row ───────────────────────────────────────────────────────────────
interface SimpleCalcRowItemProps {
  row: SimpleCalcRow
  index: number
  onRowChange: (id: string, field: keyof SimpleCalcRow, value: string | number) => void
  onCalculate: (id: string) => void
  onAddToQuote: (id: string) => void
  onRemove?: () => void
  paperOptions: { name: string; value: string }[]
  sideOptions: string[]
}

function SimpleCalcRowItem({
  row,
  index,
  onRowChange,
  onCalculate,
  onAddToQuote,
  onRemove,
  paperOptions,
  sideOptions,
}: SimpleCalcRowItemProps) {
  const hasResult = row.total !== null
  const canCalculate = row.qty > 0 && row.size && row.paper && row.sides

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_80px_100px_140px_80px_100px_80px_80px] gap-2 px-4 py-2.5 items-center",
        "hover:bg-muted/20 transition-colors",
        hasResult && "bg-emerald-50/30 dark:bg-emerald-950/10"
      )}
    >
      {/* Label */}
      <Input
        value={row.label}
        onChange={(e) => onRowChange(row.id, "label", e.target.value)}
        placeholder={`Item ${index + 1}`}
        className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border"
      />

      {/* Qty */}
      <Input
        type="number"
        value={row.qty || ""}
        onChange={(e) => onRowChange(row.id, "qty", parseInt(e.target.value) || 0)}
        placeholder="500"
        className="h-8 text-sm"
      />

      {/* Size */}
      <Input
        value={row.size}
        onChange={(e) => onRowChange(row.id, "size", e.target.value)}
        placeholder="4x6"
        className="h-8 text-sm"
      />

      {/* Paper */}
      <Select
        value={row.paper}
        onValueChange={(v) => onRowChange(row.id, "paper", v)}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Paper..." />
        </SelectTrigger>
        <SelectContent>
          {paperOptions.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sides */}
      <Select
        value={row.sides}
        onValueChange={(v) => onRowChange(row.id, "sides", v)}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="..." />
        </SelectTrigger>
        <SelectContent>
          {sideOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Total */}
      <div className="text-right">
        {row.isCalculating ? (
          <span className="text-xs text-muted-foreground">...</span>
        ) : hasResult ? (
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(row.total!)}</span>
        ) : canCalculate ? (
          <button
            type="button"
            onClick={() => onCalculate(row.id)}
            className="text-xs text-primary hover:underline"
          >
            Calculate
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Per Piece */}
      <div className="text-right">
        {hasResult ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCurrency(row.perPiece!)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Action */}
      <div className="flex justify-end">
        {hasResult ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onAddToQuote(row.id)}
          >
            Add
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        ) : onRemove ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            ×
          </Button>
        ) : null}
      </div>
    </div>
  )
}

// ── View Toggle ──────────────────────────────────────────────────────────────
interface ViewToggleProps {
  view: "detailed" | "simple"
  onViewChange: (view: "detailed" | "simple") => void
}

export function CalculatorViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border">
      <button
        type="button"
        onClick={() => onViewChange("detailed")}
        className={cn(
          "px-3 py-1 text-xs font-medium rounded-md transition-all",
          view === "detailed"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Detailed
      </button>
      <button
        type="button"
        onClick={() => onViewChange("simple")}
        className={cn(
          "px-3 py-1 text-xs font-medium rounded-md transition-all",
          view === "simple"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Quick Entry
      </button>
    </div>
  )
}

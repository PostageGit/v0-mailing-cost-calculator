"use client"

import { Badge } from "@/components/ui/badge"
import type { PartCalcResult } from "@/lib/booklet-types"

const GUTTER = 0.2
const BLEED_MARGIN = 0.25

interface BookletLayoutSvgProps {
  result: PartCalcResult
  spreadWidth: number
  spreadHeight: number
  label: string
}

export function BookletLayoutSvg({ result, spreadWidth, spreadHeight, label }: BookletLayoutSvgProps) {
  const { finalSheetWidth: sheetW, finalSheetHeight: sheetH, isRotated, bleed: hasBleed, cols, rows } = result

  if (cols === 0 || rows === 0) return null

  const gutter = hasBleed ? GUTTER : 0
  const drawPageW = isRotated ? spreadHeight : spreadWidth
  const drawPageH = isRotated ? spreadWidth : spreadHeight

  const totalPrintedW = cols * drawPageW + Math.max(0, cols - 1) * gutter
  const totalPrintedH = rows * drawPageH + Math.max(0, rows - 1) * gutter
  const xOff = (sheetW - totalPrintedW) / 2
  const yOff = (sheetH - totalPrintedH) / 2

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-semibold text-foreground text-center">Sheet Layout ({label})</h3>
      <div className="w-full max-w-xs aspect-square bg-muted/30 border border-border rounded-lg p-2">
        <svg viewBox={`0 0 ${sheetW} ${sheetH}`} width="100%" height="100%">
          {/* Sheet background */}
          <rect x={0} y={0} width={sheetW} height={sheetH} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={0.1} />

          {/* Pages */}
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const x = c * (drawPageW + gutter) + xOff
              const y = r * (drawPageH + gutter) + yOff
              return (
                <g key={`${r}-${c}`}>
                  <rect x={x} y={y} width={drawPageW} height={drawPageH} fill="hsl(var(--primary) / 0.08)" stroke="hsl(var(--primary) / 0.3)" strokeWidth={0.05} />
                  {/* Fold line (center line of spread) */}
                  {isRotated ? (
                    <line x1={x} y1={y + drawPageH / 2} x2={x + drawPageW} y2={y + drawPageH / 2} stroke="hsl(var(--primary) / 0.5)" strokeWidth={0.05} strokeDasharray="0.2 0.1" />
                  ) : (
                    <line x1={x + drawPageW / 2} y1={y} x2={x + drawPageW / 2} y2={y + drawPageH} stroke="hsl(var(--primary) / 0.5)" strokeWidth={0.05} strokeDasharray="0.2 0.1" />
                  )}
                </g>
              )
            })
          )}

          {/* Bleed margin rectangle */}
          {hasBleed && (
            <rect
              x={BLEED_MARGIN}
              y={BLEED_MARGIN}
              width={sheetW - BLEED_MARGIN * 2}
              height={sheetH - BLEED_MARGIN * 2}
              fill="none"
              stroke="hsl(var(--destructive))"
              strokeWidth={0.05}
              strokeDasharray="0.2 0.1"
            />
          )}
        </svg>
      </div>

      {/* Info badges */}
      <div className="flex gap-2">
        <Badge variant="secondary" className="text-xs">{result.paper}</Badge>
        <Badge variant="outline" className="text-xs">{result.sheetSize}{isRotated ? " (rotated)" : ""}</Badge>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Total Sheets: {result.sheets.toLocaleString()} | Cost: ${result.cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  )
}

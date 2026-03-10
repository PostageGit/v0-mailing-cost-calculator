"use client"

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
  const { finalSheetWidth: sheetW, finalSheetHeight: sheetH, isRotated, bleed: hasBleed, cols, rows, sheets, maxUps } = result

  if (cols === 0 || rows === 0) return null

  const gutter = hasBleed ? GUTTER : 0
  const bleedMargin = hasBleed ? BLEED_MARGIN : 0
  const drawPageW = isRotated ? spreadHeight : spreadWidth
  const drawPageH = isRotated ? spreadWidth : spreadHeight

  const printableW = sheetW - bleedMargin * 2
  const printableH = sheetH - bleedMargin * 2
  const totalPrintedW = cols * drawPageW + Math.max(0, cols - 1) * gutter
  const totalPrintedH = rows * drawPageH + Math.max(0, rows - 1) * gutter
  const xOffset = bleedMargin + (printableW - totalPrintedW) / 2
  const yOffset = bleedMargin + (printableH - totalPrintedH) / 2

  const viewBoxW = sheetW + 1
  const viewBoxH = sheetH + 1
  const epsilon = 0.01
  const cutMarkLength = 0.4
  const cutMarkOffset = -0.1

  // Build cut marks
  const cutLines: { x1: number; y1: number; x2: number; y2: number }[] = []

  // Horizontal Cut Marks (left side)
  if (rows > 0) {
    if (hasBleed || yOffset > epsilon) {
      cutLines.push({ x1: cutMarkOffset, y1: yOffset, x2: cutMarkOffset - cutMarkLength, y2: yOffset })
    }
    for (let r = 1; r < rows; r++) {
      const y1 = yOffset + r * drawPageH + (r - 1) * gutter
      cutLines.push({ x1: cutMarkOffset, y1: y1, x2: cutMarkOffset - cutMarkLength, y2: y1 })
      if (hasBleed) {
        const y2 = y1 + gutter
        cutLines.push({ x1: cutMarkOffset, y1: y2, x2: cutMarkOffset - cutMarkLength, y2: y2 })
      }
    }
    const bottomEdgeY = yOffset + totalPrintedH
    if (hasBleed || sheetH - bottomEdgeY > epsilon) {
      cutLines.push({ x1: cutMarkOffset, y1: bottomEdgeY, x2: cutMarkOffset - cutMarkLength, y2: bottomEdgeY })
    }
  }

  // Vertical Cut Marks (bottom side)
  if (cols > 0) {
    if (hasBleed || xOffset > epsilon) {
      cutLines.push({ x1: xOffset, y1: sheetH - cutMarkOffset, x2: xOffset, y2: sheetH - cutMarkOffset + cutMarkLength })
    }
    for (let c = 1; c < cols; c++) {
      const x1 = xOffset + c * drawPageW + (c - 1) * gutter
      cutLines.push({ x1: x1, y1: sheetH - cutMarkOffset, x2: x1, y2: sheetH - cutMarkOffset + cutMarkLength })
      if (hasBleed) {
        const x2 = x1 + gutter
        cutLines.push({ x1: x2, y1: sheetH - cutMarkOffset, x2: x2, y2: sheetH - cutMarkOffset + cutMarkLength })
      }
    }
    const rightEdgeX = xOffset + totalPrintedW
    if (hasBleed || sheetW - rightEdgeX > epsilon) {
      cutLines.push({ x1: rightEdgeX, y1: sheetH - cutMarkOffset, x2: rightEdgeX, y2: sheetH - cutMarkOffset + cutMarkLength })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Info Boxes */}
      <div className="flex gap-2">
        <div className="flex-1 text-center py-1.5 px-2 rounded-md bg-primary/10">
          <p className="text-sm font-bold text-primary leading-tight">{maxUps} Up</p>
        </div>
        <div className="flex-1 text-center py-1.5 px-2 rounded-md bg-accent/10">
          <p className="text-sm font-bold text-accent leading-tight">
            {sheets.toLocaleString()} Sheets
          </p>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm font-semibold text-muted-foreground text-center">
        {label} - {result.sheetSize}{isRotated ? " (rotated)" : ""}
      </p>

      {/* SVG Sheet */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 flex items-center justify-center">
        <svg
          viewBox={`-0.5 -0.5 ${viewBoxW} ${viewBoxH}`}
          className="w-full max-w-xs"
          role="img"
          aria-label={`Sheet layout showing ${cols}x${rows} spreads on ${result.sheetSize} sheet`}
        >
          {/* Sheet background */}
          <rect x={0} y={0} width={sheetW} height={sheetH} fill="white" stroke="hsl(var(--border))" strokeWidth="0.1" />

          {/* Spreads with fold lines */}
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const x = xOffset + c * (drawPageW + gutter)
              const y = yOffset + r * (drawPageH + gutter)
              return (
                <g key={`${r}-${c}`}>
                  <rect x={x} y={y} width={drawPageW} height={drawPageH} fill="hsl(var(--primary) / 0.08)" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.05" />
                  {/* Fold line (center line of spread) */}
                  {isRotated ? (
                    <line x1={x} y1={y + drawPageH / 2} x2={x + drawPageW} y2={y + drawPageH / 2} stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.05" strokeDasharray="0.2 0.1" />
                  ) : (
                    <line x1={x + drawPageW / 2} y1={y} x2={x + drawPageW / 2} y2={y + drawPageH} stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.05" strokeDasharray="0.2 0.1" />
                  )}
                </g>
              )
            })
          )}

          {/* Bleed boundary */}
          {hasBleed && (
            <rect
              x={bleedMargin}
              y={bleedMargin}
              width={sheetW - bleedMargin * 2}
              height={sheetH - bleedMargin * 2}
              fill="none"
              stroke="hsl(var(--destructive))"
              strokeWidth="0.05"
              strokeDasharray="0.2 0.1"
            />
          )}

          {/* Cut marks */}
          {cutLines.map((line, i) => (
            <line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="hsl(var(--destructive))"
              strokeWidth="0.05"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

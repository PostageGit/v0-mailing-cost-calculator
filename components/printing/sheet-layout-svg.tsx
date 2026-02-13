"use client"

import type { PrintingCalcResult } from "@/lib/printing-types"

interface SheetLayoutSvgProps {
  result: PrintingCalcResult
  pageWidth: number
  pageHeight: number
}

const GUTTER_AMOUNT = 0.2
const BLEED_MARGIN = 0.25

export function SheetLayoutSvg({ result, pageWidth, pageHeight }: SheetLayoutSvgProps) {
  const { sheetDimensions, layout, bleed } = result
  const { w: sheetW, h: sheetH } = sheetDimensions
  const { cols, rows, isRotated } = layout

  const drawPageW = isRotated ? pageHeight : pageWidth
  const drawPageH = isRotated ? pageWidth : pageHeight
  const gutter = bleed ? GUTTER_AMOUNT : 0
  const bleedMargin = bleed ? BLEED_MARGIN : 0

  const totalPrintedWidth = cols * drawPageW + Math.max(0, cols - 1) * gutter
  const totalPrintedHeight = rows * drawPageH + Math.max(0, rows - 1) * gutter
  const xOffset = bleedMargin + (sheetW - bleedMargin * 2 - totalPrintedWidth) / 2
  const yOffset = bleedMargin + (sheetH - bleedMargin * 2 - totalPrintedHeight) / 2

  const viewBoxW = sheetW + 1
  const viewBoxH = sheetH + 1
  const epsilon = 0.01
  const cutMarkLength = 0.4
  const cutMarkOffset = -0.1

  // Build cut marks
  const cutLines: { x1: number; y1: number; x2: number; y2: number }[] = []

  // Horizontal Cut Marks
  if (rows > 0) {
    if (bleed || yOffset > epsilon) {
      const y = yOffset
      cutLines.push({ x1: cutMarkOffset, y1: y, x2: cutMarkOffset - cutMarkLength, y2: y })
    }
    for (let r = 1; r < rows; r++) {
      const y1 = yOffset + r * drawPageH + (r - 1) * gutter
      cutLines.push({ x1: cutMarkOffset, y1: y1, x2: cutMarkOffset - cutMarkLength, y2: y1 })
      if (bleed) {
        const y2 = y1 + gutter
        cutLines.push({ x1: cutMarkOffset, y1: y2, x2: cutMarkOffset - cutMarkLength, y2: y2 })
      }
    }
    const bottomEdgeY = yOffset + totalPrintedHeight
    if (bleed || sheetH - bottomEdgeY > epsilon) {
      cutLines.push({ x1: cutMarkOffset, y1: bottomEdgeY, x2: cutMarkOffset - cutMarkLength, y2: bottomEdgeY })
    }
  }

  // Vertical Cut Marks
  if (cols > 0) {
    if (bleed || xOffset > epsilon) {
      const x = xOffset
      cutLines.push({ x1: x, y1: sheetH - cutMarkOffset, x2: x, y2: sheetH - cutMarkOffset + cutMarkLength })
    }
    for (let c = 1; c < cols; c++) {
      const x1 = xOffset + c * drawPageW + (c - 1) * gutter
      cutLines.push({ x1: x1, y1: sheetH - cutMarkOffset, x2: x1, y2: sheetH - cutMarkOffset + cutMarkLength })
      if (bleed) {
        const x2 = x1 + gutter
        cutLines.push({ x1: x2, y1: sheetH - cutMarkOffset, x2: x2, y2: sheetH - cutMarkOffset + cutMarkLength })
      }
    }
    const rightEdgeX = xOffset + totalPrintedWidth
    if (bleed || sheetW - rightEdgeX > epsilon) {
      cutLines.push({ x1: rightEdgeX, y1: sheetH - cutMarkOffset, x2: rightEdgeX, y2: sheetH - cutMarkOffset + cutMarkLength })
    }
  }

  const totalJobCuts = result.cuts.total > 0 ? result.cuts.total * result.numberOfStacks : 0

  return (
    <div className="flex flex-col gap-3">
      {/* Info Boxes */}
      <div className="flex gap-2">
        <div className="flex-1 text-center py-1.5 px-2 rounded-md bg-primary/10">
          <p className="text-sm font-bold text-primary leading-tight">{result.maxUps} Up</p>
        </div>
        <div className="flex-1 text-center py-1.5 px-2 rounded-md bg-accent/10">
          <p className="text-sm font-bold text-accent leading-tight">
            {result.sheets.toLocaleString()} Sheets
          </p>
        </div>
        <div className="flex-1 text-center py-1.5 px-2 rounded-md bg-destructive/10">
          <p className="text-sm font-bold text-destructive leading-tight">{totalJobCuts} Cuts</p>
        </div>
      </div>

      {/* Extra details */}
      <p className="text-sm font-semibold text-muted-foreground text-center">
        {result.sheetSize}
      </p>

      {/* SVG Sheet */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 flex items-center justify-center">
        <svg
          viewBox={`-0.5 -0.5 ${viewBoxW} ${viewBoxH}`}
          className="w-full max-w-xs"
          role="img"
          aria-label={`Sheet layout showing ${cols}x${rows} pieces on ${result.sheetSize} sheet`}
        >
          {/* Sheet background */}
          <rect
            x={0}
            y={0}
            width={sheetW}
            height={sheetH}
            fill="white"
            stroke="hsl(var(--border))"
            strokeWidth="0.1"
          />

          {/* Page pieces */}
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const x = xOffset + c * (drawPageW + gutter)
              const y = yOffset + r * (drawPageH + gutter)
              return (
                <rect
                  key={`${r}-${c}`}
                  x={x}
                  y={y}
                  width={drawPageW}
                  height={drawPageH}
                  fill="hsl(var(--primary) / 0.08)"
                  stroke="hsl(var(--primary) / 0.3)"
                  strokeWidth="0.05"
                />
              )
            })
          )}

          {/* Bleed boundary */}
          {bleed && (
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

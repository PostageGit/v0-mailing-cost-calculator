"use client"

import type { PerfectPartResult } from "@/lib/perfect-types"

interface PerfectLayoutSvgProps {
  result: PerfectPartResult
  pageWidth: number
  pageHeight: number
  label: string
  /** For cover: spineWidth so we can draw the spine fold lines */
  spineWidth?: number
}

const BLEED_MARGIN = 0.25
const GUTTER_AMOUNT = 0.2

export function PerfectLayoutSvg({ result, pageWidth, pageHeight, label, spineWidth = 0 }: PerfectLayoutSvgProps) {
  const { finalSheetWidth: sheetW, finalSheetHeight: sheetH, isRotated, bleed, maxUps, name, sheets, isShort } = result

  const gutter = bleed ? GUTTER_AMOUNT : 0
  const drawW = isRotated ? pageHeight : pageWidth
  const drawH = isRotated ? pageWidth : pageHeight

  // Bleed margins differ for inside vs cover
  // Cover: NO boundary margins - cover spread already includes bleed that extends to sheet edge
  // Inside: Has margins because pages are gang-run and need cutting clearance
  let bleedX = 0, bleedY = 0
  if (bleed && name === "inside") {
    if (sheetW > sheetH) { bleedX = 0.25; bleedY = 0.15 }
    else { bleedX = 0.15; bleedY = 0.25 }
  }

  const printableW = sheetW - bleedX * 2
  const printableH = sheetH - bleedY * 2

  const S = 10000
  const fit = (area: number, item: number, g: number) => {
    const a = Math.round(area * S), i = Math.round(item * S), gs = Math.round(g * S)
    if (i > a) return 0
    return Math.floor((a + gs) / (i + gs))
  }

  const colCount = fit(printableW, drawW, gutter)
  const rowCount = fit(printableH, drawH, gutter)

  const totalPrintedW = colCount * drawW + Math.max(0, colCount - 1) * gutter
  const totalPrintedH = rowCount * drawH + Math.max(0, rowCount - 1) * gutter
  const xOffset = bleedX + (printableW - totalPrintedW) / 2
  const yOffset = bleedY + (printableH - totalPrintedH) / 2

  const viewBoxW = sheetW + 1
  const viewBoxH = sheetH + 1
  const epsilon = 0.01
  const cutMarkLength = 0.4
  const cutMarkOffset = -0.1

  const isCover = name === "cover"

  // Build cut marks
  const cutLines: { x1: number; y1: number; x2: number; y2: number }[] = []

  // Horizontal Cut Marks (left side)
  if (rowCount > 0) {
    if (bleed || yOffset > epsilon) {
      cutLines.push({ x1: cutMarkOffset, y1: yOffset, x2: cutMarkOffset - cutMarkLength, y2: yOffset })
    }
    for (let r = 1; r < rowCount; r++) {
      const y1 = yOffset + r * drawH + (r - 1) * gutter
      cutLines.push({ x1: cutMarkOffset, y1: y1, x2: cutMarkOffset - cutMarkLength, y2: y1 })
      if (bleed) {
        const y2 = y1 + gutter
        cutLines.push({ x1: cutMarkOffset, y1: y2, x2: cutMarkOffset - cutMarkLength, y2: y2 })
      }
    }
    const bottomEdgeY = yOffset + totalPrintedH
    if (bleed || sheetH - bottomEdgeY > epsilon) {
      cutLines.push({ x1: cutMarkOffset, y1: bottomEdgeY, x2: cutMarkOffset - cutMarkLength, y2: bottomEdgeY })
    }
  }

  // Vertical Cut Marks (bottom side)
  if (colCount > 0) {
    if (bleed || xOffset > epsilon) {
      cutLines.push({ x1: xOffset, y1: sheetH - cutMarkOffset, x2: xOffset, y2: sheetH - cutMarkOffset + cutMarkLength })
    }
    for (let c = 1; c < colCount; c++) {
      const x1 = xOffset + c * drawW + (c - 1) * gutter
      cutLines.push({ x1: x1, y1: sheetH - cutMarkOffset, x2: x1, y2: sheetH - cutMarkOffset + cutMarkLength })
      if (bleed) {
        const x2 = x1 + gutter
        cutLines.push({ x1: x2, y1: sheetH - cutMarkOffset, x2: x2, y2: sheetH - cutMarkOffset + cutMarkLength })
      }
    }
    const rightEdgeX = xOffset + totalPrintedW
    if (bleed || sheetW - rightEdgeX > epsilon) {
      cutLines.push({ x1: rightEdgeX, y1: sheetH - cutMarkOffset, x2: rightEdgeX, y2: sheetH - cutMarkOffset + cutMarkLength })
    }
  }

  // Display sheet size (remove "Short " prefix for display but show SHORT badge)
  const displaySize = result.sheetSize.replace("Short ", "")

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
        {isShort && (
          <div className="flex-1 text-center py-1.5 px-2 rounded-md bg-amber-500/10">
            <p className="text-sm font-bold text-amber-600 leading-tight">SHORT</p>
          </div>
        )}
      </div>

      {/* Spine thickness for covers */}
      {isCover && spineWidth > 0 && (
        <div className="text-center py-1.5 px-3 rounded-md bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground">
            Spine Thickness: <span className="font-bold text-foreground">{spineWidth.toFixed(3)}"</span>
          </p>
        </div>
      )}

      {/* Label */}
      <p className="text-sm font-semibold text-muted-foreground text-center">
        {label} - {displaySize}{isRotated ? " (rotated)" : ""}
      </p>

      {/* SVG Sheet */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 flex items-center justify-center">
        <svg
          viewBox={`-0.5 -0.5 ${viewBoxW} ${viewBoxH}`}
          className="w-full max-w-xs"
          role="img"
          aria-label={`Sheet layout showing ${colCount}x${rowCount} pieces on ${result.sheetSize} sheet`}
        >
          {/* Sheet background */}
          <rect x={0} y={0} width={sheetW} height={sheetH} fill="white" stroke="hsl(var(--border))" strokeWidth="0.1" />

          {/* Pages */}
          {Array.from({ length: rowCount }, (_, r) =>
            Array.from({ length: colCount }, (_, c) => {
              const x = xOffset + c * (drawW + gutter)
              const y = yOffset + r * (drawH + gutter)
              return (
                <g key={`${r}-${c}`}>
                  <rect
                    x={x} y={y} width={drawW} height={drawH}
                    fill="hsl(var(--primary) / 0.08)" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.05"
                  />
                  {/* Spine lines for cover ONLY - never for inside pages */}
                  {name === "cover" && spineWidth > 0 && !isRotated && (() => {
                    const singleCoverW = (drawW - spineWidth) / 2
                    return (
                      <>
                        <line x1={x + singleCoverW} y1={y} x2={x + singleCoverW} y2={y + drawH}
                          stroke="hsl(var(--muted-foreground))" strokeWidth="0.05" strokeDasharray="0.2 0.1" />
                        <line x1={x + singleCoverW + spineWidth} y1={y} x2={x + singleCoverW + spineWidth} y2={y + drawH}
                          stroke="hsl(var(--muted-foreground))" strokeWidth="0.05" strokeDasharray="0.2 0.1" />
                      </>
                    )
                  })()}
                  {name === "cover" && spineWidth > 0 && isRotated && (() => {
                    const singleCoverH = (drawH - spineWidth) / 2
                    return (
                      <>
                        <line x1={x} y1={y + singleCoverH} x2={x + drawW} y2={y + singleCoverH}
                          stroke="hsl(var(--muted-foreground))" strokeWidth="0.05" strokeDasharray="0.2 0.1" />
                        <line x1={x} y1={y + singleCoverH + spineWidth} x2={x + drawW} y2={y + singleCoverH + spineWidth}
                          stroke="hsl(var(--muted-foreground))" strokeWidth="0.05" strokeDasharray="0.2 0.1" />
                      </>
                    )
                  })()}
                </g>
              )
            })
          )}

          {/* Bleed boundary */}
          {bleed && (
            <rect
              x={bleedX} y={bleedY}
              width={sheetW - bleedX * 2} height={sheetH - bleedY * 2}
              fill="none" stroke="hsl(var(--destructive))" strokeWidth="0.05" strokeDasharray="0.2 0.1"
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

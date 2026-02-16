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

export function PerfectLayoutSvg({ result, pageWidth, pageHeight, label, spineWidth = 0 }: PerfectLayoutSvgProps) {
  const { finalSheetWidth: sheetW, finalSheetHeight: sheetH, isRotated, bleed, maxUps, name } = result

  const BLEED = 0.25
  const GUTTER = bleed ? 0.2 : 0

  const drawW = isRotated ? pageHeight : pageWidth
  const drawH = isRotated ? pageWidth : pageHeight

  // Bleed margins differ for inside vs cover
  let bleedX = 0, bleedY = 0
  if (bleed) {
    if (name === "inside") {
      if (sheetW > sheetH) { bleedX = 0.25; bleedY = 0.15 }
      else { bleedX = 0.15; bleedY = 0.25 }
    } else {
      bleedX = BLEED; bleedY = BLEED
    }
  }

  const printableW = sheetW - bleedX * 2
  const printableH = sheetH - bleedY * 2

  const S = 10000
  const fit = (area: number, item: number, g: number) => {
    const a = Math.round(area * S), i = Math.round(item * S), gs = Math.round(g * S)
    if (i > a) return 0
    return Math.floor((a + gs) / (i + gs))
  }

  const colCount = fit(printableW, drawW, GUTTER)
  const rowCount = fit(printableH, drawH, GUTTER)

  const scale = 30
  const svgW = sheetW * scale
  const svgH = sheetH * scale
  const bleedPxX = bleedX * scale
  const bleedPxY = bleedY * scale
  const gutterPx = GUTTER * scale
  const pageWpx = drawW * scale
  const pageHpx = drawH * scale

  // Center the pages inside the printable area
  const totalPrintedW = colCount * pageWpx + Math.max(0, colCount - 1) * gutterPx
  const totalPrintedH = rowCount * pageHpx + Math.max(0, rowCount - 1) * gutterPx
  const offsetX = (svgW - totalPrintedW) / 2
  const offsetY = (svgH - totalPrintedH) / 2

  const isCover = name === "cover"
  const spPx = spineWidth * scale

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-muted-foreground">
        {label} -- {result.sheetSize}{isRotated ? " (rotated)" : ""} ({maxUps} up)
      </p>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full max-w-xs border border-border rounded-lg bg-card"
        style={{ aspectRatio: `${svgW}/${svgH}` }}
      >
        {/* Sheet background */}
        <rect x={0} y={0} width={svgW} height={svgH} fill="hsl(var(--muted))" rx={4} />

        {/* Printable area */}
        {bleed && (
          <rect
            x={bleedPxX} y={bleedPxY}
            width={svgW - bleedPxX * 2} height={svgH - bleedPxY * 2}
            fill="none" stroke="hsl(var(--destructive))" strokeWidth={0.5} strokeDasharray="4 2"
          />
        )}

        {/* Pages */}
        {Array.from({ length: rowCount }, (_, r) =>
          Array.from({ length: colCount }, (_, c) => {
            const x = offsetX + c * (pageWpx + gutterPx)
            const y = offsetY + r * (pageHpx + gutterPx)
            return (
              <g key={`${r}-${c}`}>
                <rect
                  x={x} y={y} width={pageWpx} height={pageHpx}
                  fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={1} rx={2}
                />
                {/* Spine lines for cover */}
                {isCover && spPx > 0 && !isRotated && (() => {
                  const singleCoverW = (pageWpx - spPx) / 2
                  return (
                    <>
                      <line x1={x + singleCoverW} y1={y} x2={x + singleCoverW} y2={y + pageHpx}
                        stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} strokeDasharray="3 2" />
                      <line x1={x + singleCoverW + spPx} y1={y} x2={x + singleCoverW + spPx} y2={y + pageHpx}
                        stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} strokeDasharray="3 2" />
                    </>
                  )
                })()}
                {isCover && spPx > 0 && isRotated && (() => {
                  const singleCoverH = (pageHpx - spPx) / 2
                  return (
                    <>
                      <line x1={x} y1={y + singleCoverH} x2={x + pageWpx} y2={y + singleCoverH}
                        stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} strokeDasharray="3 2" />
                      <line x1={x} y1={y + singleCoverH + spPx} x2={x + pageWpx} y2={y + singleCoverH + spPx}
                        stroke="hsl(var(--muted-foreground))" strokeWidth={0.5} strokeDasharray="3 2" />
                    </>
                  )
                })()}
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}

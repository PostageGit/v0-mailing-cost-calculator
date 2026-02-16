"use client"

import type { SpiralPartResult } from "@/lib/spiral-types"

interface SpiralLayoutSvgProps {
  result: SpiralPartResult
  pageWidth: number
  pageHeight: number
  label: string
}

export function SpiralLayoutSvg({ result, pageWidth, pageHeight, label }: SpiralLayoutSvgProps) {
  const { finalSheetWidth: sheetW, finalSheetHeight: sheetH, isRotated, bleed, maxUps } = result

  const BLEED = 0.25
  const GUTTER = bleed ? 0.2 : 0
  const EPSILON = 1e-9

  // Draw dimensions
  const pW = pageWidth
  const pH = pageHeight
  const drawW = isRotated ? pH : pW
  const drawH = isRotated ? pW : pH

  const bleedTotal = bleed ? BLEED * 2 : 0
  const printableW = sheetW - bleedTotal
  const printableH = sheetH - bleedTotal

  const fit = (area: number, item: number, g: number) =>
    item > area + EPSILON ? 0 : 1 + Math.floor((area - item) / (item + g) + EPSILON)

  const colCount = fit(printableW, drawW, GUTTER)
  const rowCount = fit(printableH, drawH, GUTTER)

  // SVG sizing
  const scale = 30
  const svgW = sheetW * scale
  const svgH = sheetH * scale

  const bleedPx = bleed ? BLEED * scale : 0
  const gutterPx = GUTTER * scale
  const pageWpx = drawW * scale
  const pageHpx = drawH * scale

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-muted-foreground">{label} -- {result.sheetSize} ({maxUps} up)</p>
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
            x={bleedPx}
            y={bleedPx}
            width={svgW - bleedPx * 2}
            height={svgH - bleedPx * 2}
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth={0.5}
            strokeDasharray="4 2"
          />
        )}

        {/* Pages */}
        {Array.from({ length: rowCount }, (_, r) =>
          Array.from({ length: colCount }, (_, c) => {
            const x = bleedPx + c * (pageWpx + gutterPx)
            const y = bleedPx + r * (pageHpx + gutterPx)
            return (
              <rect
                key={`${r}-${c}`}
                x={x}
                y={y}
                width={pageWpx}
                height={pageHpx}
                fill="hsl(var(--primary) / 0.15)"
                stroke="hsl(var(--primary))"
                strokeWidth={1}
                rx={2}
              />
            )
          })
        )}
      </svg>
    </div>
  )
}

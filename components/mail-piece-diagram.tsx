"use client"

import { useMailing, PIECE_TYPE_META, FOLD_OPTIONS, getFlatSize, type MailPiece } from "@/lib/mailing-context"

// ─── Color map for piece types (fill + stroke) ──────────
const FILL_MAP: Record<string, { fill: string; stroke: string; text: string }> = {
  envelope:    { fill: "#ecfdf5", stroke: "#10b981", text: "#065f46" },
  flat_card:   { fill: "#f0f9ff", stroke: "#0ea5e9", text: "#0c4a6e" },
  folded_card: { fill: "#fffbeb", stroke: "#f59e0b", text: "#78350f" },
  postcard:    { fill: "#eff6ff", stroke: "#3b82f6", text: "#1e3a5f" },
  booklet:     { fill: "#f5f3ff", stroke: "#8b5cf6", text: "#3b0764" },
  self_mailer: { fill: "#fff7ed", stroke: "#f97316", text: "#7c2d12" },
  letter:      { fill: "#f8fafc", stroke: "#94a3b8", text: "#334155" },
  other:       { fill: "#f8fafc", stroke: "#94a3b8", text: "#334155" },
}

// ─── Fold line pattern ──────────────────────────────────
function FoldLines({ x, y, w, h, fold, pieceW, pieceH }: {
  x: number; y: number; w: number; h: number
  fold: string; pieceW: number; pieceH: number
}) {
  if (fold === "none" || fold === "custom") return null
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []

  if (fold === "x2w") {
    // Vertical fold line at center width
    lines.push({ x1: x + w / 2, y1: y + 2, x2: x + w / 2, y2: y + h - 2 })
  } else if (fold === "x2h") {
    // Horizontal fold line at center height
    lines.push({ x1: x + 2, y1: y + h / 2, x2: x + w - 2, y2: y + h / 2 })
  } else if (fold === "x3w") {
    lines.push({ x1: x + w / 3, y1: y + 2, x2: x + w / 3, y2: y + h - 2 })
    lines.push({ x1: x + (w * 2) / 3, y1: y + 2, x2: x + (w * 2) / 3, y2: y + h - 2 })
  } else if (fold === "x3h") {
    lines.push({ x1: x + 2, y1: y + h / 3, x2: x + w - 2, y2: y + h / 3 })
    lines.push({ x1: x + 2, y1: y + (h * 2) / 3, x2: x + w - 2, y2: y + (h * 2) / 3 })
  }

  return (
    <>
      {lines.map((l, i) => (
        <line key={i} {...l} stroke={FILL_MAP.folded_card.stroke} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
      ))}
    </>
  )
}

// ─── Single piece renderer ──────────────────────────────
function PieceRect({ piece, x, y, w, h, showFlat }: {
  piece: MailPiece; x: number; y: number; w: number; h: number; showFlat?: boolean
}) {
  const meta = PIECE_TYPE_META[piece.type]
  const colors = FILL_MAP[piece.type] || FILL_MAP.other
  const isEnvelope = piece.type === "envelope"
  const isFolded = piece.foldType !== "none" && ["folded_card", "self_mailer"].includes(piece.type)
  const flat = getFlatSize(piece)

  // Envelope flap triangle
  const flapH = Math.min(h * 0.18, 14)

  return (
    <g>
      {/* Main rect */}
      <rect x={x} y={y} width={w} height={h} rx={4} ry={4}
        fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />

      {/* Envelope flap */}
      {isEnvelope && (
        <path
          d={`M ${x + 2} ${y} L ${x + w / 2} ${y + flapH} L ${x + w - 2} ${y} Z`}
          fill="none" stroke={colors.stroke} strokeWidth={1} strokeDasharray="3 2" opacity={0.5}
        />
      )}

      {/* Fold lines on the FLAT view */}
      {showFlat && isFolded && (
        <FoldLines x={x} y={y} w={w} h={h} fold={piece.foldType}
          pieceW={piece.width || 0} pieceH={piece.height || 0} />
      )}

      {/* Type badge */}
      <rect x={x + 6} y={y + 6} width={28} height={14} rx={3} fill={colors.stroke} />
      <text x={x + 20} y={y + 16} fontSize={8} fontWeight={700} fill="white"
        textAnchor="middle" fontFamily="system-ui">{meta.short}</text>

      {/* Label */}
      <text x={x + 40} y={y + 16} fontSize={9} fontWeight={600} fill={colors.text}
        fontFamily="system-ui">{piece.label}</text>

      {/* Dimensions bottom-right */}
      {piece.width && piece.height && (
        <text x={x + w - 6} y={y + h - 6} fontSize={9} fontWeight={700} fill={colors.text}
          textAnchor="end" fontFamily="ui-monospace, monospace">
          {showFlat && isFolded && flat.w && flat.h
            ? `${flat.w}" x ${flat.h}" flat`
            : `${piece.width}" x ${piece.height}"`
          }
        </text>
      )}

      {/* Production badge */}
      {piece.production !== "inhouse" && piece.production !== "no_print" && (
        <>
          <rect x={x + w - 34} y={y + 5} width={28} height={13} rx={3}
            fill={piece.production === "ohp" ? "#fef3c7" : piece.production === "customer" ? "#fef3c7" : "#dbeafe"} />
          <text x={x + w - 20} y={y + 14} fontSize={7} fontWeight={700}
            fill={piece.production === "ohp" ? "#92400e" : piece.production === "customer" ? "#92400e" : "#1e40af"}
            textAnchor="middle" fontFamily="system-ui">
            {piece.production === "ohp" ? "OHP" : piece.production === "customer" ? "CUST" : "BOTH"}
          </text>
        </>
      )}
    </g>
  )
}

// ─── Main diagram component ─────────────────────────────
export function MailPieceDiagram() {
  const m = useMailing()
  if (m.pieces.length === 0) return null

  const pad = 24
  const gapY = 10
  const pieces = [...m.pieces].sort((a, b) => a.position - b.position)
  const outer = pieces[0]
  const inners = pieces.slice(1)

  // Scale: fit the largest piece into a fixed pixel area
  const maxRealW = Math.max(...pieces.map((p) => p.width || 6), 6)
  const maxRealH = Math.max(...pieces.map((p) => p.height || 4), 4)

  // Assembled view: all pieces are scaled to the same reference frame
  const assembledW = 260
  const scale = (assembledW - pad * 2) / maxRealW
  const outerPxW = (outer.width || maxRealW) * scale
  const outerPxH = (outer.height || maxRealH) * scale

  // Compute inner pieces pixel sizes
  const innerRects = inners.map((p) => ({
    piece: p,
    w: (p.width || 3) * scale,
    h: (p.height || 2) * scale,
  }))

  // Assembled view height
  const assembledH = outerPxH + pad * 2

  // Flat view: show each piece's flat (unfolded) print size side by side
  const flatPieces = pieces.filter((p) => p.type !== "envelope" && p.type !== "other")
  const flatScale = scale * 0.85
  let flatTotalW = 0
  const flatRects = flatPieces.map((p) => {
    const flat = getFlatSize(p)
    const fw = (flat.w || p.width || 3) * flatScale
    const fh = (flat.h || p.height || 2) * flatScale
    const rect = { piece: p, w: fw, h: fh, x: flatTotalW }
    flatTotalW += fw + 12
    return rect
  })
  flatTotalW -= 12 // remove last gap
  const flatViewH = flatPieces.length > 0 ? Math.max(...flatRects.map((r) => r.h)) + pad * 2 : 0

  // Total SVG size
  const totalW = Math.max(assembledW + (flatPieces.length > 0 ? flatTotalW + pad * 3 + 40 : 0), 400)
  const totalH = Math.max(assembledH, flatViewH, 120) + 40

  // Center inners inside the outer
  const outerX = pad
  const outerY = pad + 16

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-secondary/20">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-foreground/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-foreground">
              <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1 4.5L7 8L13 4.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-foreground">Mail Assembly</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Assembled
          </span>
          {flatPieces.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Flat / Print
            </span>
          )}
        </div>
      </div>

      {/* SVG Diagram */}
      <div className="overflow-x-auto">
        <svg
          width={totalW}
          height={totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="select-none"
          style={{ minHeight: 140 }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.08" />
            </pattern>
          </defs>
          <rect width={totalW} height={totalH} fill="url(#grid)" />

          {/* ─── ASSEMBLED VIEW ─── */}
          <text x={outerX} y={14} fontSize={10} fontWeight={700} fill="currentColor" opacity={0.4}
            fontFamily="system-ui">ASSEMBLED VIEW</text>

          {/* Outer piece */}
          <PieceRect piece={outer} x={outerX} y={outerY} w={outerPxW} h={outerPxH} />

          {/* Inner pieces -- stacked inside the outer, offset from top-left */}
          {innerRects.map((r, i) => {
            const offsetX = outerX + 12 + i * 6
            const offsetY = outerY + (outer.type === "envelope" ? Math.min(outerPxH * 0.22, 18) : 10) + i * 4
            return (
              <PieceRect key={r.piece.id} piece={r.piece}
                x={Math.min(offsetX, outerX + outerPxW - r.w - 8)}
                y={Math.min(offsetY, outerY + outerPxH - r.h - 8)}
                w={r.w} h={r.h} />
            )
          })}

          {/* Dimension callouts for outer */}
          {outer.width && outer.height && (
            <>
              {/* Width dimension line */}
              <line x1={outerX} y1={outerY + outerPxH + 12} x2={outerX + outerPxW} y2={outerY + outerPxH + 12}
                stroke="currentColor" strokeWidth={0.7} opacity={0.25} markerStart="url(#arrowL)" markerEnd="url(#arrowR)" />
              <text x={outerX + outerPxW / 2} y={outerY + outerPxH + 24} fontSize={9} fontWeight={600}
                fill="currentColor" opacity={0.45} textAnchor="middle" fontFamily="ui-monospace, monospace">
                {outer.width}"
              </text>
              {/* Height dimension line */}
              <line x1={outerX + outerPxW + 12} y1={outerY} x2={outerX + outerPxW + 12} y2={outerY + outerPxH}
                stroke="currentColor" strokeWidth={0.7} opacity={0.25} />
              <text x={outerX + outerPxW + 16} y={outerY + outerPxH / 2 + 3} fontSize={9} fontWeight={600}
                fill="currentColor" opacity={0.45} fontFamily="ui-monospace, monospace"
                transform={`rotate(-90, ${outerX + outerPxW + 22}, ${outerY + outerPxH / 2})`}
                textAnchor="middle">
                {outer.height}"
              </text>
            </>
          )}

          {/* ─── FLAT / PRINT VIEW ─── */}
          {flatPieces.length > 0 && (() => {
            const flatStartX = assembledW + 50
            return (
              <>
                {/* Divider */}
                <line x1={flatStartX - 20} y1={8} x2={flatStartX - 20} y2={totalH - 8}
                  stroke="currentColor" strokeWidth={0.5} opacity={0.08} strokeDasharray="4 4" />

                <text x={flatStartX} y={14} fontSize={10} fontWeight={700} fill="currentColor" opacity={0.4}
                  fontFamily="system-ui">FLAT / PRINT SIZE</text>

                {flatRects.map((r) => (
                  <PieceRect key={r.piece.id} piece={r.piece}
                    x={flatStartX + r.x} y={outerY} w={r.w} h={r.h} showFlat />
                ))}
              </>
            )
          })()}

          {/* Quantity badge */}
          {m.quantity > 0 && (
            <>
              <rect x={totalW - 80} y={totalH - 28} width={72} height={20} rx={10}
                fill="currentColor" opacity={0.07} />
              <text x={totalW - 44} y={totalH - 14} fontSize={10} fontWeight={700}
                fill="currentColor" opacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
                x {m.quantity.toLocaleString()}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

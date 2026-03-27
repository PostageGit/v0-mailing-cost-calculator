"use client"

import { useState, useCallback, useRef } from "react"
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib"
import { 
  Upload, Download, FileText, Play, Plus, X, RotateCw, Copy, 
  Trash2, ArrowUpDown, BookOpen, Grid3X3, Stamp, LayoutGrid, 
  Scissors, FileSearch, Layers, MoveVertical, ArrowDown, ArrowUp,
  Info, ChevronRight, Loader2, AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"

const IN = 72 // 1 inch = 72 points

// ============================================
// Live Imposition Preview Component
// ============================================
function ImpositionPreview({ toolId, params, fileInfo }: { 
  toolId: string
  params: Record<string, string | number>
  fileInfo: { firstPageW: number, firstPageH: number, pageCount: number } | null 
}) {
  const previewW = 260
  const previewH = 200
  const padding = 16
  
  // Get source page size (from loaded PDF or default)
  const srcW = fileInfo ? fileInfo.firstPageW / IN : 8.5
  const srcH = fileInfo ? fileInfo.firstPageH / IN : 11
  const pageCount = fileInfo?.pageCount || 8
  
  // Common SVG styles
  const sheetStyle = "fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600"
  const pageStyle = "fill-blue-100 dark:fill-blue-900/50 stroke-blue-400 dark:stroke-blue-500"
  const cropMarkStyle = "stroke-rose-500 dark:stroke-rose-400"
  const foldLineStyle = "stroke-amber-500 dark:stroke-amber-400 stroke-dasharray-4"
  const labelStyle = "fill-slate-500 dark:fill-slate-400 text-[8px] font-mono"
  
  // Render based on tool
  if (toolId === "SimpleBooklet") {
    // Booklet: show a spread with fold line
    const margin = Number(params.margin) || 0.25
    const sheetW = srcW * 2 + margin * 2
    const sheetH = srcH + margin * 2
    const scale = Math.min((previewW - padding * 2) / sheetW, (previewH - padding * 2) / sheetH)
    const sW = sheetW * scale, sH = sheetH * scale
    const pW = srcW * scale, pH = srcH * scale
    const mS = margin * scale
    const ox = (previewW - sW) / 2, oy = (previewH - sH) / 2
    const showCrop = params.cropMarks === "yes"
    
    return (
      <svg width={previewW} height={previewH} className="bg-white dark:bg-slate-900 rounded-lg border">
        {/* Sheet */}
        <rect x={ox} y={oy} width={sW} height={sH} className={sheetStyle} strokeWidth={1} />
        {/* Left page */}
        <rect x={ox + mS} y={oy + mS} width={pW} height={pH} className={pageStyle} strokeWidth={1} />
        <text x={ox + mS + pW/2} y={oy + mS + pH/2} textAnchor="middle" dominantBaseline="middle" className={labelStyle}>
          {Math.ceil(pageCount / 4) * 4}
        </text>
        {/* Right page */}
        <rect x={ox + mS + pW} y={oy + mS} width={pW} height={pH} className={pageStyle} strokeWidth={1} />
        <text x={ox + mS + pW + pW/2} y={oy + mS + pH/2} textAnchor="middle" dominantBaseline="middle" className={labelStyle}>
          1
        </text>
        {/* Fold line */}
        <line x1={ox + sW/2} y1={oy} x2={ox + sW/2} y2={oy + sH} className={foldLineStyle} strokeWidth={1} strokeDasharray="4 2" />
        <text x={ox + sW/2} y={oy - 4} textAnchor="middle" className="fill-amber-600 dark:fill-amber-400 text-[7px]">FOLD</text>
        {/* Crop marks */}
        {showCrop && (
          <g className={cropMarkStyle} strokeWidth={0.5}>
            {[[ox + mS, oy + mS], [ox + mS, oy + mS + pH], [ox + sW/2, oy + mS], [ox + sW/2, oy + mS + pH]].map(([cx, cy], i) => (
              <g key={i}>
                <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} />
                <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} />
              </g>
            ))}
          </g>
        )}
      </svg>
    )
  }
  
  if (toolId === "Nup" || toolId === "StepRepeat") {
    const rows = Number(params.rows) || 2
    const cols = Number(params.cols) || 2
    const sheetW = Number(params.sheetW) || 11
    const sheetH = Number(params.sheetH) || 17
    const margin = Number(params.margin) || 0
    const showCrop = params.cropMarks === "yes"
    const isStepRepeat = toolId === "StepRepeat"
    
    const scale = Math.min((previewW - padding * 2) / sheetW, (previewH - padding * 2) / sheetH)
    const sW = sheetW * scale, sH = sheetH * scale
    const mS = margin * scale
    const cellW = (sW - mS * 2) / cols
    const cellH = (sH - mS * 2) / rows
    const ox = (previewW - sW) / 2, oy = (previewH - sH) / 2
    
    return (
      <svg width={previewW} height={previewH} className="bg-white dark:bg-slate-900 rounded-lg border">
        {/* Sheet */}
        <rect x={ox} y={oy} width={sW} height={sH} className={sheetStyle} strokeWidth={1} />
        {/* Grid cells */}
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const cellX = ox + mS + c * cellW
            const cellY = oy + mS + r * cellH
            const pageNum = isStepRepeat ? 1 : r * cols + c + 1
            return (
              <g key={`${r}-${c}`}>
                <rect 
                  x={cellX + 2} y={cellY + 2} 
                  width={cellW - 4} height={cellH - 4} 
                  className={pageStyle} strokeWidth={1} 
                />
                <text 
                  x={cellX + cellW/2} y={cellY + cellH/2} 
                  textAnchor="middle" dominantBaseline="middle" 
                  className={labelStyle}
                >
                  {pageNum}
                </text>
                {/* Crop marks at corners */}
                {showCrop && (
                  <g className={cropMarkStyle} strokeWidth={0.4}>
                    {[[cellX, cellY], [cellX + cellW, cellY], [cellX, cellY + cellH], [cellX + cellW, cellY + cellH]].map(([cx, cy], i) => (
                      <g key={i}>
                        <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} />
                        <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} />
                      </g>
                    ))}
                  </g>
                )}
              </g>
            )
          })
        )}
        {/* Label */}
        <text x={previewW/2} y={previewH - 6} textAnchor="middle" className="fill-slate-400 text-[7px]">
          {cols}x{rows} = {cols * rows} {isStepRepeat ? "copies" : "pages"} per sheet
        </text>
      </svg>
    )
  }
  
  if (toolId === "TilePages") {
    const rows = Number(params.rows) || 2
    const cols = Number(params.cols) || 2
    const overlap = Number(params.overlap) || 0
    
    const scale = Math.min((previewW - padding * 2) / srcW, (previewH - padding * 2) / srcH)
    const pW = srcW * scale, pH = srcH * scale
    const ox = (previewW - pW) / 2, oy = (previewH - pH) / 2
    const tileW = pW / cols
    const tileH = pH / rows
    const overlapPx = overlap * scale * 5 // Exaggerate for visibility
    
    return (
      <svg width={previewW} height={previewH} className="bg-white dark:bg-slate-900 rounded-lg border">
        {/* Original page outline */}
        <rect x={ox} y={oy} width={pW} height={pH} className="fill-blue-50 dark:fill-blue-950/30 stroke-blue-300 dark:stroke-blue-700" strokeWidth={1} />
        {/* Tile grid */}
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => (
            <rect
              key={`${r}-${c}`}
              x={ox + c * tileW - (c > 0 ? overlapPx/2 : 0)}
              y={oy + r * tileH - (r > 0 ? overlapPx/2 : 0)}
              width={tileW + (c > 0 && c < cols - 1 ? overlapPx : c > 0 || c < cols - 1 ? overlapPx/2 : 0)}
              height={tileH + (r > 0 && r < rows - 1 ? overlapPx : r > 0 || r < rows - 1 ? overlapPx/2 : 0)}
              className="fill-none stroke-rose-400 dark:stroke-rose-500"
              strokeWidth={1}
              strokeDasharray="3 2"
            />
          ))
        )}
        {/* Tile numbers */}
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => (
            <text
              key={`t-${r}-${c}`}
              x={ox + c * tileW + tileW/2}
              y={oy + r * tileH + tileH/2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-rose-500 dark:fill-rose-400 text-[9px] font-bold"
            >
              {r * cols + c + 1}
            </text>
          ))
        )}
        {/* Label */}
        <text x={previewW/2} y={previewH - 6} textAnchor="middle" className="fill-slate-400 text-[7px]">
          Split into {cols * rows} tiles
        </text>
      </svg>
    )
  }
  
  if (toolId === "PageSizes") {
    const mode = params.mode as string || "proportional"
    const targetW = Number(params.w) || 8.5
    const targetH = Number(params.h) || 11
    
    // Show before/after comparison
    const maxDim = Math.max(srcW, srcH, targetW, targetH)
    const scale = Math.min((previewW/2 - padding * 2) / maxDim, (previewH - padding * 2) / maxDim)
    
    const srcPW = srcW * scale, srcPH = srcH * scale
    const tgtPW = targetW * scale, tgtPH = targetH * scale
    
    // Source (left)
    const srcOx = padding + (previewW/2 - padding * 2 - srcPW) / 2
    const srcOy = padding + (previewH - padding * 2 - srcPH) / 2
    // Target (right)
    const tgtOx = previewW/2 + padding + (previewW/2 - padding * 2 - tgtPW) / 2
    const tgtOy = padding + (previewH - padding * 2 - tgtPH) / 2
    
    // Calculate how content fits in target based on mode
    let contentW = srcPW, contentH = srcPH
    if (mode === "scale") {
      contentW = tgtPW; contentH = tgtPH
    } else if (mode === "proportional") {
      const s = Math.min(tgtPW / srcPW, tgtPH / srcPH)
      contentW = srcPW * s; contentH = srcPH * s
    } else if (mode === "crop") {
      const s = Math.max(tgtPW / srcPW, tgtPH / srcPH)
      contentW = srcPW * s; contentH = srcPH * s
    }
    const contentX = tgtOx + (tgtPW - contentW) / 2
    const contentY = tgtOy + (tgtPH - contentH) / 2
    
    return (
      <svg width={previewW} height={previewH} className="bg-white dark:bg-slate-900 rounded-lg border">
        {/* Arrow */}
        <path d={`M ${previewW/2 - 12} ${previewH/2} L ${previewW/2 + 12} ${previewH/2}`} className="stroke-slate-400" strokeWidth={1.5} markerEnd="url(#arrow)" />
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" className="fill-slate-400" />
          </marker>
        </defs>
        
        {/* Source page */}
        <rect x={srcOx} y={srcOy} width={srcPW} height={srcPH} className={pageStyle} strokeWidth={1} />
        <text x={srcOx + srcPW/2} y={srcOy - 6} textAnchor="middle" className="fill-slate-500 text-[7px]">BEFORE</text>
        <text x={srcOx + srcPW/2} y={srcOy + srcPH + 10} textAnchor="middle" className={labelStyle}>
          {srcW.toFixed(1)}&quot;x{srcH.toFixed(1)}&quot;
        </text>
        
        {/* Target page */}
        <rect x={tgtOx} y={tgtOy} width={tgtPW} height={tgtPH} className={sheetStyle} strokeWidth={1} />
        {/* Content in target (clipped for crop mode) */}
        <clipPath id="targetClip">
          <rect x={tgtOx} y={tgtOy} width={tgtPW} height={tgtPH} />
        </clipPath>
        <rect x={contentX} y={contentY} width={contentW} height={contentH} className={pageStyle} strokeWidth={1} clipPath="url(#targetClip)" />
        <text x={tgtOx + tgtPW/2} y={tgtOy - 6} textAnchor="middle" className="fill-slate-500 text-[7px]">AFTER ({mode})</text>
        <text x={tgtOx + tgtPW/2} y={tgtOy + tgtPH + 10} textAnchor="middle" className={labelStyle}>
          {targetW.toFixed(1)}&quot;x{targetH.toFixed(1)}&quot;
        </text>
      </svg>
    )
  }
  
  if (toolId === "Rotate") {
    const angle = params.angle?.toString() || "180"
    const rotation = angle.includes("90") ? (angle.includes("counter") ? -90 : 90) : 180
    
    const scale = Math.min((previewW/2 - padding * 2) / Math.max(srcW, srcH), (previewH - padding * 2) / Math.max(srcW, srcH))
    const pW = srcW * scale, pH = srcH * scale
    
    // Before (left)
    const ox1 = padding + (previewW/2 - padding * 2 - pW) / 2
    const oy1 = padding + (previewH - padding * 2 - pH) / 2
    
    // After (right) - rotated dimensions
    const rotW = Math.abs(rotation) === 90 ? pH : pW
    const rotH = Math.abs(rotation) === 90 ? pW : pH
    const ox2 = previewW/2 + padding + (previewW/2 - padding * 2 - rotW) / 2
    const oy2 = padding + (previewH - padding * 2 - rotH) / 2
    
    return (
      <svg width={previewW} height={previewH} className="bg-white dark:bg-slate-900 rounded-lg border">
        {/* Arrow */}
        <path d={`M ${previewW/2 - 12} ${previewH/2} L ${previewW/2 + 12} ${previewH/2}`} className="stroke-slate-400" strokeWidth={1.5} markerEnd="url(#arrow2)" />
        <defs>
          <marker id="arrow2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" className="fill-slate-400" />
          </marker>
        </defs>
        
        {/* Before */}
        <rect x={ox1} y={oy1} width={pW} height={pH} className={pageStyle} strokeWidth={1} />
        <text x={ox1 + 6} y={oy1 + 12} className="fill-blue-500 text-[8px] font-bold">A</text>
        <text x={ox1 + pW/2} y={oy1 - 6} textAnchor="middle" className="fill-slate-500 text-[7px]">BEFORE</text>
        
        {/* After */}
        <rect x={ox2} y={oy2} width={rotW} height={rotH} className={pageStyle} strokeWidth={1} />
        {/* Rotated "A" indicator */}
        <text 
          x={ox2 + rotW/2} y={oy2 + rotH/2} 
          textAnchor="middle" dominantBaseline="middle"
          className="fill-blue-500 text-[8px] font-bold"
          transform={`rotate(${rotation} ${ox2 + rotW/2} ${oy2 + rotH/2})`}
        >
          A
        </text>
        <text x={ox2 + rotW/2} y={oy2 - 6} textAnchor="middle" className="fill-slate-500 text-[7px]">{rotation}°</text>
      </svg>
    )
  }
  
  // Default: no preview for this tool
  return null
}

// Sheet presets
const SHEETS = [
  { name: 'US Letter (8.5×11")', w: 8.5, h: 11 },
  { name: 'US Legal (8.5×14")', w: 8.5, h: 14 },
  { name: 'Tabloid (11×17")', w: 11, h: 17 },
  { name: '12×18"', w: 12, h: 18 },
  { name: '12×19"', w: 12, h: 19 },
  { name: '13×19"', w: 13, h: 19 },
  { name: 'A4 (8.27×11.69")', w: 8.27, h: 11.69 },
  { name: 'A3 (11.69×16.54")', w: 11.69, h: 16.54 },
]

// Tool definitions - crop marks are now INSIDE the imposition tools
const TOOLS: ToolDef[] = [
  { group: "Imposition" },
  { id: "SimpleBooklet", name: "Simple Booklet", icon: BookOpen, color: "bg-rose-500",
    desc: "Saddle stitch for folded booklets",
    plain: "Rearranges pages so when you fold and staple in the middle, pages come out in order.",
    params: [
      { id: "margin", label: "Edge margin (inches)", type: "number", def: 0.25, min: 0, max: 2, step: 0.125 },
      { id: "cropMarks", label: "Crop marks", type: "select", opts: ["no", "yes"], def: "no" },
      { id: "noScale", label: "Scaling", type: "select", opts: ["keep 100%", "scale to fit"], def: "keep 100%" },
    ]
  },
  { id: "Nup", name: "N-Up Imposition", icon: Grid3X3, color: "bg-purple-500",
    desc: "Multiple pages per sheet",
    plain: "Puts multiple pages side-by-side on one big sheet.",
    params: [
      { id: "sheet", label: "Output sheet", type: "sheet", def: "Tabloid (11×17\")" },
      { id: "sheetW", label: "Width (in)", type: "number", def: 11, hidden: true },
      { id: "sheetH", label: "Height (in)", type: "number", def: 17, hidden: true },
      { id: "rows", label: "Rows", type: "number", def: 2, min: 1, max: 20 },
      { id: "cols", label: "Columns", type: "number", def: 2, min: 1, max: 20 },
      { id: "margin", label: "Margin (in)", type: "number", def: 0, min: 0, max: 2, step: 0.125 },
      { id: "cropMarks", label: "Crop marks", type: "select", opts: ["no", "yes"], def: "no" },
    ]
  },
  { id: "StepRepeat", name: "Step & Repeat", icon: LayoutGrid, color: "bg-green-500",
    desc: "Tile same page for cards/labels",
    plain: "Fills sheet with copies of ONE page - perfect for business cards or stickers.",
    params: [
      { id: "sheet", label: "Output sheet", type: "sheet", def: "Tabloid (11×17\")" },
      { id: "sheetW", label: "Width (in)", type: "number", def: 11, hidden: true },
      { id: "sheetH", label: "Height (in)", type: "number", def: 17, hidden: true },
      { id: "rows", label: "Rows", type: "number", def: 3, min: 1, max: 30 },
      { id: "cols", label: "Columns", type: "number", def: 3, min: 1, max: 30 },
      { id: "margin", label: "Margin (in)", type: "number", def: 0, min: 0, max: 2, step: 0.125 },
      { id: "cropMarks", label: "Crop marks", type: "select", opts: ["no", "yes"], def: "no" },
    ]
  },
  { id: "TilePages", name: "Tile Large Pages", icon: Scissors, color: "bg-cyan-500",
    desc: "Split posters for printing",
    plain: "Cuts one big page into smaller tiles to print on regular paper.",
    params: [
      { id: "rows", label: "Tile rows", type: "number", def: 2, min: 1, max: 10 },
      { id: "cols", label: "Tile columns", type: "number", def: 2, min: 1, max: 10 },
      { id: "overlap", label: "Overlap (in)", type: "number", def: 0, min: 0, max: 1, step: 0.125 },
    ]
  },
  { group: "Page Size" },
  { id: "PageSizes", name: "Adjust Page Sizes", icon: Layers, color: "bg-teal-500",
    desc: "Scale, pad, or crop pages",
    plain: "Changes page size - stretch to fit (scale), add border (pad), or cut edges (crop).",
    params: [
      { id: "mode", label: "Method", type: "select", opts: ["scale", "proportional", "pad", "crop"], def: "proportional" },
      { id: "w", label: "Target width (in)", type: "number", def: 8.5, min: 0.1 },
      { id: "h", label: "Target height (in)", type: "number", def: 11, min: 0.1 },
      { id: "range", label: "Apply to", type: "select", opts: ["all pages", "page 1 only", "all except first"], def: "all pages" },
    ]
  },
  { id: "GenerateBleed", name: "Generate Bleed", icon: Layers, color: "bg-orange-500",
    desc: "Extend page edges for printing",
    plain: "Extends edges so ink prints to the edge without white borders.",
    params: [
      { id: "method", label: "Method", type: "select", opts: ["mirror edges", "scale page"], def: "mirror edges" },
      { id: "bleed", label: "Bleed amount (in)", type: "number", def: 0.125, min: 0.04, max: 0.5, step: 0.0625 },
    ]
  },
  { group: "Page Tools" },
  { id: "Rotate", name: "Rotate Pages", icon: RotateCw, color: "bg-blue-500",
    desc: "90°, 180°, or 270° rotation",
    plain: "Spins pages around - turn sideways or upside down.",
    params: [
      { id: "angle", label: "Rotate by", type: "select", opts: ["180°", "90° clockwise", "90° counter-clockwise"], def: "180°" },
      { id: "range", label: "Which pages", type: "select", opts: ["all", "even only", "odd only"], def: "all" },
    ]
  },
  { id: "Duplicate", name: "Duplicate Pages", icon: Copy, color: "bg-blue-500",
    desc: "Multiple copies of each page",
    plain: "Makes extra copies of every page - like photocopying each page multiple times.",
    params: [
      { id: "copies", label: "Copies", type: "number", def: 2, min: 2, max: 20 },
      { id: "collate", label: "Order", type: "select", opts: ["collated (1,2,1,2)", "uncollated (1,1,2,2)"], def: "collated (1,2,1,2)" },
    ]
  },
  { id: "Delete", name: "Delete Pages", icon: Trash2, color: "bg-red-500",
    desc: "Remove specific pages",
    plain: "Removes pages from your document.",
    params: [
      { id: "from", label: "From page", type: "number", def: 1, min: 1 },
      { id: "to", label: "To page", type: "number", def: 1, min: 1 },
    ]
  },
  { id: "Move", name: "Move Page", icon: MoveVertical, color: "bg-blue-500",
    desc: "Rearrange page position",
    plain: "Moves a page to a different spot.",
    params: [
      { id: "pageNum", label: "Move page #", type: "number", def: 1, min: 1 },
      { id: "where", label: "To", type: "select", opts: ["start", "end"], def: "start" },
    ]
  },
  { id: "Reverse", name: "Reverse Order", icon: ArrowUpDown, color: "bg-rose-500",
    desc: "Flip page order",
    plain: "Reverses entire page order - last becomes first.",
    params: []
  },
  { id: "InsertBlanks", name: "Insert Blanks", icon: Plus, color: "bg-amber-500",
    desc: "Add empty pages",
    plain: "Adds blank pages - useful for booklet multiples of 4.",
    params: [
      { id: "count", label: "How many", type: "number", def: 2, min: 1, max: 20 },
      { id: "where", label: "Where", type: "select", opts: ["before first", "after last", "after specific page"], def: "after last" },
      { id: "pageNum", label: "After page #", type: "number", def: 1, min: 1 },
    ]
  },
  { id: "Split", name: "Split Even/Odd", icon: Scissors, color: "bg-green-500",
    desc: "Separate even and odd pages",
    plain: "Separates into even and odd numbered pages.",
    params: [
      { id: "output", label: "Output", type: "select", opts: ["odd pages only", "even pages only"], def: "odd pages only" },
    ]
  },
  { group: "Stamping" },
  { id: "PageNumbers", name: "Page Numbers", icon: Stamp, color: "bg-orange-500",
    desc: "Add automatic numbering",
    plain: "Prints page number on every page.",
    params: [
      { id: "startNum", label: "Start at", type: "number", def: 1, min: 0 },
      { id: "prefix", label: "Prefix", type: "text", def: "" },
      { id: "suffix", label: "Suffix", type: "text", def: "" },
      { id: "position", label: "Position", type: "select", opts: ["Bottom Center", "Bottom Left", "Bottom Right", "Top Center", "Top Left", "Top Right"], def: "Bottom Center" },
      { id: "fontSize", label: "Font size", type: "number", def: 10, min: 4, max: 72 },
    ]
  },
  { id: "BatesStamp", name: "Bates Stamp", icon: Stamp, color: "bg-amber-500",
    desc: "Legal document numbering",
    plain: "Prints number with leading zeros plus prefix for legal docs.",
    params: [
      { id: "startNum", label: "Start at", type: "number", def: 1, min: 0 },
      { id: "digits", label: "Min digits", type: "number", def: 6, min: 1, max: 12 },
      { id: "prefix", label: "Prefix", type: "text", def: "" },
      { id: "position", label: "Position", type: "select", opts: ["Bottom Right", "Bottom Left", "Bottom Center", "Top Right", "Top Left", "Top Center"], def: "Bottom Right" },
      { id: "fontSize", label: "Font size", type: "number", def: 10, min: 4, max: 72 },
    ]
  },
  { group: "Analysis" },
  { id: "Info", name: "PDF Info", icon: FileSearch, color: "bg-slate-500",
    desc: "Analyze document",
    plain: "Shows page count, sizes, and other info - no changes made.",
    params: []
  },
]

type ParamDef = {
  id: string
  label: string
  type: "number" | "select" | "sheet" | "text"
  def: string | number
  opts?: string[]
  min?: number
  max?: number
  step?: number
  hidden?: boolean
}

type ToolDef = 
  | { group: string }
  | { 
      id: string
      name: string
      icon: typeof BookOpen
      color: string
      desc: string
      plain: string
      params: ParamDef[]
    }

// ============================================
// PDF Operations (from clean v3 source)
// ============================================

// CRITICAL: Re-hydrate PDF to ensure content is properly loaded
// This forces pdf-lib to fully parse all content streams
async function rehy(doc: PDFDocument): Promise<PDFDocument> {
  return PDFDocument.load(await doc.save(), { ignoreEncryption: true })
}

async function opRotate(doc: PDFDocument, params: { angle: number, range: string }) {
  doc = await rehy(doc) // Re-hydrate first
  const nd = await PDFDocument.create()
  const pgs = doc.getPages()
  const a = params.angle
  
  for (let i = 0; i < pgs.length; i++) {
    const pw = pgs[i].getWidth(), ph = pgs[i].getHeight()
    let shouldRotate = false
    
    if (params.range === "all" || !params.range) shouldRotate = true
    else if (params.range.includes("even")) shouldRotate = (i + 1) % 2 === 0
    else if (params.range.includes("odd")) shouldRotate = (i + 1) % 2 === 1
    
    const [e] = await nd.embedPdf(doc, [i])
    
    if (shouldRotate) {
      const is90 = a === 90 || a === 270
      const pg = nd.addPage(is90 ? [ph, pw] : [pw, ph])
      let dx = 0, dy = 0
      if (a === 90) { dx = ph; dy = 0 }
      else if (a === 180) { dx = pw; dy = ph }
      else if (a === 270) { dx = 0; dy = pw }
      pg.drawPage(e, { x: dx, y: dy, width: pw, height: ph, rotate: degrees(a) })
    } else {
      const pg = nd.addPage([pw, ph])
      pg.drawPage(e, { x: 0, y: 0, width: pw, height: ph })
    }
  }
  return nd
}

async function opDuplicate(doc: PDFDocument, params: { copies: number, collate: boolean }) {
  doc = await rehy(doc)
  const nd = await PDFDocument.create()
  const pgs = doc.getPages()
  const n = pgs.length
  const order: number[] = []
  
  // collate=true  → complete sets: 1,2,3,1,2,3  (industry: collated)
  // collate=false → grouped copies: 1,1,2,2     (industry: uncollated)
  if (params.collate) {
    for (let c = 0; c < params.copies; c++) for (let i = 0; i < n; i++) order.push(i)
  } else {
    for (let i = 0; i < n; i++) for (let c = 0; c < params.copies; c++) order.push(i)
  }
  
  for (const idx of order) {
    const [e] = await nd.embedPdf(doc, [idx])
    const pg = nd.addPage([pgs[idx].getWidth(), pgs[idx].getHeight()])
    pg.drawPage(e, { x: 0, y: 0, width: pgs[idx].getWidth(), height: pgs[idx].getHeight() })
  }
  return nd
}

async function opDelete(doc: PDFDocument, params: { from: number, to: number }) {
  doc = await rehy(doc)
  const nd = await PDFDocument.create()
  const pgs = doc.getPages()
  const fromIdx = params.from - 1
  const toIdx = params.to - 1
  
  for (let i = 0; i < pgs.length; i++) {
    if (i >= fromIdx && i <= toIdx) continue
    const [e] = await nd.embedPdf(doc, [i])
    const pg = nd.addPage([pgs[i].getWidth(), pgs[i].getHeight()])
    pg.drawPage(e, { x: 0, y: 0, width: pgs[i].getWidth(), height: pgs[i].getHeight() })
  }
  return nd
}

async function opMove(doc: PDFDocument, params: { pageNum: number, where: string }) {
  doc = await rehy(doc)
  const nd = await PDFDocument.create()
  const pgs = doc.getPages()
  const n = pgs.length
  const fromIdx = params.pageNum - 1
  const order: number[] = []
  
  if (params.where === "start") {
    order.push(fromIdx)
    for (let i = 0; i < n; i++) if (i !== fromIdx) order.push(i)
  } else {
    for (let i = 0; i < n; i++) if (i !== fromIdx) order.push(i)
    order.push(fromIdx)
  }
  
  for (const idx of order) {
    const pi = Math.max(0, Math.min(idx, n - 1))
    const [e] = await nd.embedPdf(doc, [pi])
    const pg = nd.addPage([pgs[pi].getWidth(), pgs[pi].getHeight()])
    pg.drawPage(e, { x: 0, y: 0, width: pgs[pi].getWidth(), height: pgs[pi].getHeight() })
  }
  return nd
}

async function opReverse(doc: PDFDocument) {
  doc = await rehy(doc)
  const nd = await PDFDocument.create()
  const pgs = doc.getPages()
  
  for (let i = pgs.length - 1; i >= 0; i--) {
    const [e] = await nd.embedPdf(doc, [i])
    const pg = nd.addPage([pgs[i].getWidth(), pgs[i].getHeight()])
    pg.drawPage(e, { x: 0, y: 0, width: pgs[i].getWidth(), height: pgs[i].getHeight() })
  }
  return nd
}

// Simple Booklet with CROP MARKS built in
async function opBooklet(doc: PDFDocument, params: { margin: number, cropMarks: boolean, noScale: boolean }) {
  doc = await rehy(doc)
  const pgs = doc.getPages()
  const n = pgs.length
  const total = Math.ceil(n / 4) * 4
  const pw = pgs[0].getWidth(), ph = pgs[0].getHeight()
  const margin = params.margin * IN
  const shW = pw * 2 + margin * 2, shH = ph + margin * 2
  const nd = await PDFDocument.create()
  
  let lo = 1, hi = total
  const spreads: [number, number][] = []
  while (lo <= hi) {
    spreads.push([hi, lo])
    hi--; lo++
    if (lo <= hi) {
      spreads.push([lo, hi])
      lo++; hi--
    }
  }
  
  for (const [ln, rn] of spreads) {
    const sh = nd.addPage([shW, shH])
    
    for (const [num, xOff] of [[ln, margin], [rn, margin + pw]] as [number, number][]) {
      const idx = num - 1
      if (idx >= 0 && idx < n) {
        const [e] = await nd.embedPdf(doc, [idx])
        const s = params.noScale ? 1 : Math.min(pw / e.width, ph / e.height)
        const dw = e.width * s, dh = e.height * s
        sh.drawPage(e, { x: xOff + (pw - dw) / 2, y: margin + (ph - dh) / 2, width: dw, height: dh })
      }
    }
    
    // CROP MARKS - drawn at trim edges
    if (params.cropMarks) {
      const marks: [number, number][] = [
        [margin, margin], [margin, margin + ph],
        [margin + shW / 2, margin], [margin + shW / 2, margin + ph]
      ]
      for (const [cx, cy] of marks) {
        sh.drawLine({ start: { x: cx - 5, y: cy }, end: { x: cx + 5, y: cy }, thickness: 0.4, color: rgb(0, 0, 0) })
        sh.drawLine({ start: { x: cx, y: cy - 5 }, end: { x: cx, y: cy + 5 }, thickness: 0.4, color: rgb(0, 0, 0) })
      }
    }
  }
  return nd
}

// N-Up with CROP MARKS built in
async function opNUp(doc: PDFDocument, params: { rows: number, cols: number, sheetW: number, sheetH: number, margin: number, cropMarks: boolean, stepRepeat?: boolean }) {
  doc = await rehy(doc)
  const pgs = doc.getPages()
  const nd = await PDFDocument.create()
  const sheetW = params.sheetW * IN
  const sheetH = params.sheetH * IN
  const marginAll = params.margin * IN
  const cW = (sheetW - marginAll * 2) / params.cols
  const cH = (sheetH - marginAll * 2) / params.rows
  
  let idx = 0
  const total = params.stepRepeat ? params.rows * params.cols : pgs.length
  
  while (idx < total) {
    const sh = nd.addPage([sheetW, sheetH])
    
    for (let r = 0; r < params.rows; r++) {
      for (let c = 0; c < params.cols; c++) {
        const pi = params.stepRepeat ? 0 : idx
        if (!params.stepRepeat && idx >= pgs.length) break
        
        const [e] = await nd.embedPdf(doc, [pi])
        const x = marginAll + c * cW
        const y = sheetH - marginAll - (r + 1) * cH
        const s = Math.min(cW / e.width, cH / e.height)
        const dw = e.width * s, dh = e.height * s
        
        sh.drawPage(e, { x: x + (cW - dw) / 2, y: y + (cH - dh) / 2, width: dw, height: dh })
        
        // CROP MARKS at each cell corner
        if (params.cropMarks) {
          const marks: [number, number][] = [[x, y], [x + cW, y], [x, y + cH], [x + cW, y + cH]]
          for (const [cx, cy] of marks) {
            sh.drawLine({ start: { x: cx - 3, y: cy }, end: { x: cx + 3, y: cy }, thickness: 0.3, color: rgb(0, 0, 0) })
            sh.drawLine({ start: { x: cx, y: cy - 3 }, end: { x: cx, y: cy + 3 }, thickness: 0.3, color: rgb(0, 0, 0) })
          }
        }
        idx++
      }
    }
    if (params.stepRepeat) break
  }
  return nd
}

async function opPageSizes(doc: PDFDocument, params: { mode: string, w: number, h: number, range: string }) {
  doc = await rehy(doc)
  const pgs = doc.getPages()
  const nd = await PDFDocument.create()
  const w = params.w * IN
  const h = params.h * IN
  
  for (let i = 0; i < pgs.length; i++) {
    const skip = (params.range === "page 1 only" && i > 0) || (params.range === "all except first" && i === 0)
    const [e] = await nd.embedPdf(doc, [i])
    const tw = skip ? pgs[i].getWidth() : w
    const th = skip ? pgs[i].getHeight() : h
    const pg = nd.addPage([tw, th])
    
    if (skip) {
      pg.drawPage(e, { x: 0, y: 0, width: pgs[i].getWidth(), height: pgs[i].getHeight() })
    } else if (params.mode === "scale") {
      // Stretch to fill exactly - no aspect ratio preservation
      pg.drawPage(e, { x: 0, y: 0, width: w, height: h })
    } else if (params.mode === "proportional") {
      // Fit inside, preserve aspect ratio, center with white border
      const s = Math.min(w / e.width, h / e.height)
      const dw = e.width * s, dh = e.height * s
      pg.drawPage(e, { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh })
    } else if (params.mode === "pad") {
      // Place at native size, centered - adds white space around it
      pg.drawPage(e, { x: (w - e.width) / 2, y: (h - e.height) / 2, width: e.width, height: e.height })
    } else if (params.mode === "crop") {
      // Scale to fill (cover) - overflows edges are clipped by page boundary
      const s = Math.max(w / e.width, h / e.height)
      const dw = e.width * s, dh = e.height * s
      pg.drawPage(e, { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh })
    }
  }
  return nd
}

async function opInsert(doc: PDFDocument, params: { where: string, count: number, pageNum: number }) {
  doc = await rehy(doc)
  const pgs = doc.getPages()
  const nd = await PDFDocument.create()
  const rw = pgs[0].getWidth(), rh = pgs[0].getHeight()
  const addBlank = () => nd.addPage([rw, rh])
  
  if (params.where.includes("before")) {
    for (let b = 0; b < params.count; b++) addBlank()
  }
  
  for (let i = 0; i < pgs.length; i++) {
    const [e] = await nd.embedPdf(doc, [i])
    const pg = nd.addPage([pgs[i].getWidth(), pgs[i].getHeight()])
    pg.drawPage(e, { x: 0, y: 0, width: pgs[i].getWidth(), height: pgs[i].getHeight() })
    
    if (params.where.includes("specific") && i === params.pageNum - 1) {
      for (let b = 0; b < params.count; b++) addBlank()
    }
  }
  
  if (params.where.includes("after last")) {
    for (let b = 0; b < params.count; b++) addBlank()
  }
  
  return nd
}

async function opPageNumbers(doc: PDFDocument, params: { startNum: number, prefix: string, suffix: string, position: string, fontSize: number }) {
  doc = await rehy(doc)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const pgs = doc.getPages()
  
  pgs.forEach((pg, i) => {
    const { width, height } = pg.getSize()
    const label = params.prefix + (params.startNum + i) + params.suffix
    const tw = font.widthOfTextAtSize(label, params.fontSize)
    
    const pos = params.position.toUpperCase()
    const x = pos.includes("LEFT") ? 20 : pos.includes("RIGHT") ? width - tw - 20 : (width - tw) / 2
    const y = pos.includes("TOP") ? height - params.fontSize - 20 : 20
    
    pg.drawText(label, { x, y, size: params.fontSize, font, color: rgb(0, 0, 0) })
  })
  
  return doc
}

async function opBates(doc: PDFDocument, params: { startNum: number, digits: number, prefix: string, position: string, fontSize: number }) {
  doc = await rehy(doc)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const pgs = doc.getPages()
  
  pgs.forEach((pg, i) => {
    const { width, height } = pg.getSize()
    const label = params.prefix + String(params.startNum + i).padStart(params.digits, "0")
    const tw = font.widthOfTextAtSize(label, params.fontSize)
    
    const pos = params.position.toUpperCase()
    const x = pos.includes("LEFT") ? 20 : pos.includes("RIGHT") ? width - tw - 20 : (width - tw) / 2
    const y = pos.includes("TOP") ? height - params.fontSize - 20 : 20
    
    pg.drawText(label, { x, y, size: params.fontSize, font, color: rgb(0, 0, 0) })
  })
  
  return doc
}

async function opSplit(doc: PDFDocument, params: { output: string }) {
  doc = await rehy(doc)
  const pgs = doc.getPages()
  const nd = await PDFDocument.create()
  
  for (let i = 0; i < pgs.length; i++) {
    const isEven = (i + 1) % 2 === 0
    if (params.output.includes("odd") && isEven) continue
    if (params.output.includes("even") && !isEven) continue
    
    const [e] = await nd.embedPdf(doc, [i])
    const pg = nd.addPage([pgs[i].getWidth(), pgs[i].getHeight()])
    pg.drawPage(e, { x: 0, y: 0, width: pgs[i].getWidth(), height: pgs[i].getHeight() })
  }
  return nd
}

async function opTile(doc: PDFDocument, params: { rows: number, cols: number, overlap: number }) {
  doc = await rehy(doc)
  const pgs = doc.getPages()
  const nd = await PDFDocument.create()
  const overlap = params.overlap * IN
  
  for (let i = 0; i < pgs.length; i++) {
    const pw = pgs[i].getWidth(), ph = pgs[i].getHeight()
    const tW = pw / params.cols + overlap
    const tH = ph / params.rows + overlap
    
    for (let r = 0; r < params.rows; r++) {
      for (let c = 0; c < params.cols; c++) {
        const [e] = await nd.embedPdf(doc, [i])
        const pg = nd.addPage([tW - overlap, tH - overlap])
        pg.drawPage(e, {
          x: -(c * (pw / params.cols)),
          y: -((params.rows - 1 - r) * (ph / params.rows)),
          width: pw, height: ph
        })
      }
    }
  }
  return nd
}

async function opGenBleed(doc: PDFDocument, params: { method: string, bleed: number }) {
  doc = await rehy(doc)
  const pgs = doc.getPages()
  const nd = await PDFDocument.create()
  const bleedPt = params.bleed * IN
  
  for (let i = 0; i < pgs.length; i++) {
    const pw = pgs[i].getWidth(), ph = pgs[i].getHeight()
    const nw = pw + bleedPt * 2, nh = ph + bleedPt * 2
    const [e] = await nd.embedPdf(doc, [i])
    const pg = nd.addPage([nw, nh])
    
    if (params.method.includes("scale")) {
      pg.drawPage(e, { x: 0, y: 0, width: nw, height: nh })
    } else {
      pg.drawPage(e, { x: bleedPt, y: bleedPt, width: pw, height: ph })
    }
  }
  return nd
}

// ============================================
// Main Component
// ============================================

type FileInfo = {
  pageCount: number
  fileSize: number
  pages: { page: number, w: number, h: number, orientation: string }[]
  hasMixedSizes: boolean
  firstPageW: number
  firstPageH: number
  colorHint: string // CMYK/RGB detection hint
  creationDate?: string
  producer?: string
}

export function PDFImposeTool() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [pdfName, setPdfName] = useState("")
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, string | number>>({})
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState("")
  const [result, setResult] = useState<Uint8Array | null>(null)
  const [info, setInfo] = useState<{ pageCount: number, sizes: { page: number, w: number, h: number }[] } | null>(null)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
const handleFile = useCallback(async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    setPdfBytes(bytes)
    setPdfName(file.name)
    setResult(null)
    setInfo(null)
    
    // Extract file info for the bottom panel
    try {
      const doc = await PDFDocument.load(bytes)
      const pgs = doc.getPages()
      const pages = pgs.map((pg, i) => {
        const w = pg.getWidth()
        const h = pg.getHeight()
        return {
          page: i + 1,
          w,
          h,
          orientation: w > h ? "Landscape" : w < h ? "Portrait" : "Square"
        }
      })
      
      // Check for mixed sizes
      const firstW = pages[0]?.w || 0
      const firstH = pages[0]?.h || 0
      const hasMixedSizes = pages.some(p => Math.abs(p.w - firstW) > 1 || Math.abs(p.h - firstH) > 1)
      
      // Try to detect color space from PDF content (heuristic)
      const pdfString = new TextDecoder().decode(bytes.slice(0, 50000))
      let colorHint = "Unknown"
      if (pdfString.includes("/DeviceCMYK") || (pdfString.includes("/ICCBased") && pdfString.includes("CMYK"))) {
        colorHint = "CMYK"
      } else if (pdfString.includes("/DeviceRGB")) {
        colorHint = "RGB"
      } else if (pdfString.includes("/DeviceGray")) {
        colorHint = "Grayscale"
      } else if (pdfString.includes("/Separation")) {
        colorHint = "Spot Colors"
      }
      
      // Get metadata
      const creationDate = doc.getCreationDate()?.toLocaleDateString() || undefined
      const producer = doc.getProducer() || undefined
      
      setFileInfo({
        pageCount: pgs.length,
        fileSize: file.size,
        pages,
        hasMixedSizes,
        firstPageW: firstW,
        firstPageH: firstH,
        colorHint,
        creationDate,
        producer
      })
    } catch (err) {
      console.error("Error extracting file info:", err)
    }
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith(".pdf")) handleFile(file)
  }, [handleFile])
  
  const selectTool = (toolId: string) => {
    const tool = TOOLS.find(t => 'id' in t && t.id === toolId) as Extract<ToolDef, { id: string }>
    if (!tool) return
    
    setActiveTool(toolId)
    setResult(null)
    setInfo(null)
    
    // Set default params
    const defaults: Record<string, unknown> = {}
    tool.params?.forEach(p => {
      defaults[p.id] = p.def
    })
    setParams(defaults)
  }
  
  const updateParam = (id: string, value: unknown) => {
    setParams(prev => ({ ...prev, [id]: value }))
    
    // Handle sheet preset
    if (id === "sheet") {
      const sheet = SHEETS.find(s => s.name === value)
      if (sheet) {
        setParams(prev => ({ ...prev, sheetW: sheet.w, sheetH: sheet.h }))
      }
    }
  }
  
  const runTool = async () => {
    if (!pdfBytes || !activeTool) return
    setProcessing(true)
    setProgress("Loading PDF...")
    
    try {
      let doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
      
      setProgress(`Running ${activeTool}...`)
      
      switch (activeTool) {
        case "Rotate": {
          const angleStr = params.angle as string
          const angle = angleStr.includes("counter") ? -90 : angleStr.includes("clockwise") ? 90 : 180
          doc = await opRotate(doc, { angle, range: params.range as string })
          break
        }
        case "Duplicate":
          doc = await opDuplicate(doc, {
            copies: params.copies as number,
            collate: (params.collate as string).includes("collated (1,1")
          })
          break
        case "Delete":
          doc = await opDelete(doc, { from: params.from as number, to: params.to as number })
          break
        case "Move":
          doc = await opMove(doc, { pageNum: params.pageNum as number, where: params.where as string })
          break
        case "Reverse":
          doc = await opReverse(doc)
          break
        case "SimpleBooklet":
          doc = await opBooklet(doc, {
            margin: params.margin as number,
            cropMarks: params.cropMarks === "yes",
            noScale: (params.noScale as string).includes("100")
          })
          break
        case "Nup":
          doc = await opNUp(doc, {
            rows: params.rows as number,
            cols: params.cols as number,
            sheetW: params.sheetW as number,
            sheetH: params.sheetH as number,
            margin: params.margin as number,
            cropMarks: params.cropMarks === "yes"
          })
          break
        case "StepRepeat":
          doc = await opNUp(doc, {
            rows: params.rows as number,
            cols: params.cols as number,
            sheetW: params.sheetW as number,
            sheetH: params.sheetH as number,
            margin: params.margin as number,
            cropMarks: params.cropMarks === "yes",
            stepRepeat: true
          })
          break
        case "PageSizes":
          doc = await opPageSizes(doc, {
            mode: params.mode as string,
            w: params.w as number,
            h: params.h as number,
            range: params.range as string
          })
          break
        case "InsertBlanks":
          doc = await opInsert(doc, {
            where: params.where as string,
            count: params.count as number,
            pageNum: params.pageNum as number
          })
          break
        case "PageNumbers":
          doc = await opPageNumbers(doc, {
            startNum: params.startNum as number,
            prefix: params.prefix as string || "",
            suffix: params.suffix as string || "",
            position: params.position as string,
            fontSize: params.fontSize as number
          })
          break
        case "BatesStamp":
          doc = await opBates(doc, {
            startNum: params.startNum as number,
            digits: params.digits as number,
            prefix: params.prefix as string || "",
            position: params.position as string,
            fontSize: params.fontSize as number
          })
          break
        case "Split":
          doc = await opSplit(doc, { output: params.output as string })
          break
        case "TilePages":
          doc = await opTile(doc, {
            rows: params.rows as number,
            cols: params.cols as number,
            overlap: params.overlap as number || 0
          })
          break
        case "GenerateBleed":
          doc = await opGenBleed(doc, {
            method: params.method as string,
            bleed: params.bleed as number
          })
          break
        case "Info": {
          const pgs = doc.getPages()
          setInfo({
            pageCount: pgs.length,
            sizes: pgs.map((pg, i) => ({ page: i + 1, w: pg.getWidth(), h: pg.getHeight() }))
          })
          setProcessing(false)
          return
        }
      }
      
      setProgress("Saving PDF...")
      const resultBytes = await doc.save()
      setResult(new Uint8Array(resultBytes))
      
    } catch (err) {
      console.error(err)
      alert("Error processing PDF: " + (err as Error).message)
    }
    
    setProcessing(false)
  }
  
  const downloadResult = () => {
    if (!result) return
    const blob = new Blob([result], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${pdfName.replace(".pdf", "")}_imposed.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const tool = activeTool ? TOOLS.find(t => 'id' in t && t.id === activeTool) as Extract<ToolDef, { id: string }> : null
  
  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  
  // Get standard page size name
  const getPageSizeName = (w: number, h: number) => {
    const wIn = w / IN
    const hIn = h / IN
    const sizes: [string, number, number][] = [
      ["Letter", 8.5, 11],
      ["Legal", 8.5, 14],
      ["Tabloid", 11, 17],
      ["A4", 8.27, 11.69],
      ["A3", 11.69, 16.54],
      ["A5", 5.83, 8.27],
      ["Half Letter", 5.5, 8.5],
    ]
    for (const [name, sw, sh] of sizes) {
      if ((Math.abs(wIn - sw) < 0.1 && Math.abs(hIn - sh) < 0.1) ||
          (Math.abs(wIn - sh) < 0.1 && Math.abs(hIn - sw) < 0.1)) {
        return name
      }
    }
    return "Custom"
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="flex-1 flex min-h-0">
      {/* Sidebar - Tools */}
      <div className="w-72 border-r bg-card overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-bold text-sm">All Tools</h2>
        </div>
        <div className="py-2">
          {TOOLS.map((item, idx) => {
            if ('group' in item && !('id' in item)) {
              return (
                <div key={idx} className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {item.group}
                </div>
              )
            }
            const t = item as Extract<ToolDef, { id: string }>
            return (
              <button
                key={t.id}
                onClick={() => selectTool(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  activeTool === t.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/50"
                )}
              >
                <div className={cn("p-2 rounded-lg", t.color)}>
                  <t.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Main Panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {!pdfBytes ? (
          // Drop Zone
          <div
            className="h-full flex items-center justify-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div 
              className="w-96 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-bold mb-2">Upload your PDF</h3>
              <p className="text-sm text-muted-foreground mb-4">All processing happens in your browser. Nothing is uploaded.</p>
              <button className="px-5 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                Choose PDF
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        ) : !activeTool ? (
          // No tool selected
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">&#8592;</div>
              <h3 className="font-bold text-lg mb-2">Pick a tool</h3>
              <p className="text-muted-foreground">Select a tool from the sidebar to get started.</p>
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">{pdfName}</span>
                </div>
              </div>
            </div>
          </div>
        ) : tool ? (
          // Tool panel
          <div className="max-w-2xl">
            {/* Tool header */}
            <div className="bg-card rounded-xl shadow-sm p-6 mb-4">
              <div className="flex items-start gap-4">
                <div className={cn("p-3 rounded-xl", tool.color)}>
                  <tool.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{tool.name}</h2>
                  <p className="text-muted-foreground mt-1">{tool.plain || tool.desc}</p>
                </div>
              </div>
            </div>
            
            {/* Result banner */}
            {result && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4 flex items-center gap-4">
                <span className="text-2xl">Done!</span>
                <div className="flex-1">
                  <div className="font-bold text-green-700 dark:text-green-300">{(result.length / 1024).toFixed(0)} KB ready</div>
                </div>
                <button
                  onClick={downloadResult}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full text-sm font-semibold hover:bg-green-700"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
              </div>
            )}
            
            {/* Info result */}
            {info && (
              <div className="bg-card rounded-xl shadow-sm p-6 mb-4">
                <h3 className="font-bold mb-4">PDF Info</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase">Pages</div>
                    <div className="text-lg font-bold font-mono">{info.pageCount}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase">File</div>
                    <div className="text-sm font-medium truncate">{pdfName}</div>
                  </div>
                </div>
                <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Page Sizes</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {info.sizes.map(s => (
                    <div key={s.page} className="flex justify-between px-3 py-1.5 bg-muted/30 rounded text-sm font-mono">
                      <span>Page {s.page}</span>
                      <span>{(s.w / IN).toFixed(2)}&quot; x {(s.h / IN).toFixed(2)}&quot;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Live Preview */}
            {["SimpleBooklet", "Nup", "StepRepeat", "TilePages", "PageSizes", "Rotate"].includes(tool.id) && (
              <div className="bg-card rounded-xl shadow-sm p-4 mb-4">
                <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-wide mb-3">Live Preview</h3>
                <div className="flex justify-center">
                  <ImpositionPreview toolId={tool.id} params={params} fileInfo={fileInfo} />
                </div>
              </div>
            )}
            
            {/* Parameters */}
            <div className="bg-card rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-4">Settings</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                {tool.params?.filter(p => !p.hidden).map(p => (
                  <div key={p.id} className={cn("space-y-1.5", p.type === "text" && "col-span-2")}>
                    <label className="text-xs font-bold text-muted-foreground uppercase">{p.label}</label>
                    {p.type === "select" || p.type === "sheet" ? (
                      <select
                        value={params[p.id] as string}
                        onChange={(e) => updateParam(p.id, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                      >
                        {p.type === "sheet" 
                          ? SHEETS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)
                          : p.opts?.map(o => <option key={o} value={o}>{o}</option>)
                        }
                      </select>
                    ) : p.type === "text" ? (
                      <input
                        type="text"
                        value={params[p.id] as string || ""}
                        onChange={(e) => updateParam(p.id, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                      />
                    ) : (
                      <input
                        type="number"
                        value={params[p.id] as number}
                        onChange={(e) => updateParam(p.id, parseFloat(e.target.value) || 0)}
                        min={p.min}
                        max={p.max}
                        step={p.step || 1}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono"
                      />
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={runTool}
                  disabled={processing}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {progress}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run {tool.name}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
      
      {/* Processing overlay */}
      {processing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl shadow-xl p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
            <div className="font-bold mb-1">Processing PDF...</div>
            <div className="text-sm text-muted-foreground">{progress}</div>
          </div>
        </div>
      )}
      
      {/* Bottom File Info Panel - Pre-press info */}
      {fileInfo && (
        <div className="shrink-0 border-t bg-card">
          <div className="px-4 py-3">
            <div className="flex items-center gap-6 overflow-x-auto">
              {/* File name */}
              <div className="flex items-center gap-2 shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm truncate max-w-48">{pdfName}</span>
              </div>
              
              <div className="h-6 w-px bg-border shrink-0" />
              
              {/* Pages */}
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Pages</span>
                <span className="text-sm font-bold font-mono">{fileInfo.pageCount}</span>
              </div>
              
              {/* File Size */}
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Size</span>
                <span className="text-sm font-mono">{formatSize(fileInfo.fileSize)}</span>
              </div>
              
              {/* Page Dimensions */}
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Dimensions</span>
                <span className="text-sm font-mono">
                  {(fileInfo.firstPageW / IN).toFixed(2)}&quot; x {(fileInfo.firstPageH / IN).toFixed(2)}&quot;
                </span>
              </div>
              
              {/* Page Size Name */}
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Page Size</span>
                <span className="text-sm">{getPageSizeName(fileInfo.firstPageW, fileInfo.firstPageH)}</span>
              </div>
              
              {/* Orientation */}
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Orientation</span>
                <span className="text-sm">{fileInfo.pages[0]?.orientation || "Unknown"}</span>
              </div>
              
              {/* Color Space */}
              <div className="flex flex-col shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Color</span>
                <span className={cn(
                  "text-sm font-semibold",
                  fileInfo.colorHint === "CMYK" ? "text-cyan-600 dark:text-cyan-400" :
                  fileInfo.colorHint === "RGB" ? "text-green-600 dark:text-green-400" :
                  fileInfo.colorHint === "Grayscale" ? "text-slate-500" :
                  fileInfo.colorHint === "Spot Colors" ? "text-purple-600 dark:text-purple-400" :
                  "text-muted-foreground"
                )}>
                  {fileInfo.colorHint}
                </span>
              </div>
              
              {/* Mixed Sizes Warning */}
              {fileInfo.hasMixedSizes && (
                <>
                  <div className="h-6 w-px bg-border shrink-0" />
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-950 rounded text-amber-700 dark:text-amber-300 shrink-0">
                    <Info className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">Mixed Page Sizes</span>
                  </div>
                </>
              )}
              
              {/* Producer */}
              {fileInfo.producer && (
                <div className="flex flex-col shrink-0 ml-auto">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Created With</span>
                  <span className="text-xs text-muted-foreground truncate max-w-32">{fileInfo.producer}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

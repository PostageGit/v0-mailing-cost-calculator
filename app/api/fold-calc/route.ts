import { NextRequest, NextResponse } from "next/server"
import {
  isCalculatorLoaded,
  getLoadError,
  getFOLD,
  getSF,
  bridgeMatchSize,
  bridgePriceIt,
  type OriginalFoldEntry,
} from "@/lib/calculators/fold-score-bridge"

/**
 * POST /api/fold-calc
 * Runs the original fold/score calculator from the uploaded HTML file.
 *
 * Body: { cat, paperKey, w, h, finish, qty, axis, settings? }
 * Returns: { price, sizeKey, sizeLabel, resolution, entry, alternatives, error? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cat, paperKey, w, h, finish, qty, axis, settings } = body as {
      cat: "folding" | "sf"
      paperKey: string
      w: number
      h: number
      finish: string
      qty: number
      axis?: "w" | "h"
      settings?: { labor?: number; run?: number; markup?: number; bdisc?: number; longSetup?: number; lv?: Record<number, number> }
    }

    if (!isCalculatorLoaded()) {
      return NextResponse.json(
        { error: getLoadError() || "Calculator HTML file not loaded", fallback: true },
        { status: 503 }
      )
    }

    // Get data
    const db = cat === "folding" ? getFOLD() : getSF()
    const paper = db[paperKey]
    if (!paper) {
      return NextResponse.json({
        error: `Paper key "${paperKey}" not found in ${cat} data`,
        available: Object.keys(db),
        resolution: "na",
      })
    }

    // Match size
    const sizeKey = bridgeMatchSize(w, h, cat)
    const isLong = sizeKey === "long"
    const sizeData = paper.sizes[sizeKey]

    if (!sizeData) {
      return NextResponse.json({
        resolution: "na",
        sizeKey,
        error: `No pricing data for ${paper.label} at size tier ${sizeKey}`,
      })
    }

    const opt = sizeData[finish] as OriginalFoldEntry | undefined
    if (!opt) {
      return NextResponse.json({
        resolution: "na",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        error: `${finish} not found for ${paper.label} at ${sizeKey}`,
      })
    }

    // Handle l === "na" (not available)
    if (opt.l === "na" && !opt.so) {
      return NextResponse.json({
        resolution: "na",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        alt: opt.alt,
        error: `Not Available -- ${opt.alt || "No alternative."}`,
      })
    }

    // Handle l === "hand"
    if (opt.l === "hand") {
      return NextResponse.json({
        resolution: "hand",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        error: "Hand Fold -- Manual calc needed.",
      })
    }

    // Score-only fallback
    const isScoreOnly = opt.l === "na" && !!opt.so

    if (!qty) {
      return NextResponse.json({
        resolution: isScoreOnly ? "score_only" : "ok",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        isLong,
        isScoreOnly,
        entry: opt,
        needsQty: true,
      })
    }

    // Price it using the original function
    const settingsMap = settings
      ? {
          labor: settings.labor,
          run: settings.run,
          markup: settings.markup,
          bdisc: settings.bdisc,
          longSetup: settings.longSetup,
          lv: settings.lv,
        }
      : undefined

    const price = bridgePriceIt(opt, qty, isLong, settingsMap)

    if (!price) {
      return NextResponse.json({
        resolution: "na",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        error: "Missing rate data",
      })
    }

    // Auto-upgrade check (Rule 5)
    let upgraded = false
    let upgradedPaper = ""
    let upgradedPrice = price
    if (typeof opt.l === "number" && opt.l > 1) {
      for (const [pk, pv] of Object.entries(db)) {
        if (pk === paperKey || pv.thick <= paper.thick) continue
        const sd = pv.sizes[sizeKey]
        if (!sd) continue
        const fd = sd[finish] as OriginalFoldEntry | undefined
        if (!fd || fd.l === "na" || fd.l === "hand" || typeof fd.l !== "number") continue
        if (fd.l < opt.l) {
          const trial = bridgePriceIt(fd, qty, isLong, settingsMap)
          if (trial && trial.retail < upgradedPrice.retail) {
            upgradedPrice = trial
            upgraded = true
            upgradedPaper = pv.label
          }
        }
      }
    }

    return NextResponse.json({
      resolution: isScoreOnly ? "score_only" : "ok",
      sizeKey,
      sizeLabel: sizeData.lbl || sizeKey,
      isLong,
      isScoreOnly,
      price: {
        level: upgradedPrice.lv,
        setupMinutes: upgradedPrice.sm,
        setupCost: upgradedPrice.sc,
        longFee: upgradedPrice.longFee,
        runMinutes: upgradedPrice.rm,
        runCost: upgradedPrice.rc,
        base: upgradedPrice.base,
        retail: upgradedPrice.retail,
        broker: upgradedPrice.broker,
        perPiece: upgradedPrice.pp,
        brokerPerPiece: upgradedPrice.bp,
        batchSize: upgradedPrice.b,
        secondsPerBatch: upgradedPrice.s,
      },
      upgraded: upgraded
        ? {
            toPaper: upgradedPaper,
            originalRetail: price.retail,
            savings: price.retail - upgradedPrice.retail,
          }
        : null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

/**
 * GET /api/fold-calc
 * Returns the available data structure (paper keys, size keys, finish names)
 * so the client knows what options exist.
 */
export async function GET() {
  if (!isCalculatorLoaded()) {
    return NextResponse.json(
      { error: getLoadError() || "Calculator not loaded", fallback: true },
      { status: 503 }
    )
  }

  return NextResponse.json({
    loaded: true,
    fold: Object.fromEntries(
      Object.entries(getFOLD()).map(([k, v]) => [k, { label: v.label, thick: v.thick, sizes: Object.keys(v.sizes) }])
    ),
    sf: Object.fromEntries(
      Object.entries(getSF()).map(([k, v]) => [k, { label: v.label, thick: v.thick, sizes: Object.keys(v.sizes) }])
    ),
  })
}

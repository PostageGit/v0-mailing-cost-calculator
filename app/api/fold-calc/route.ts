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
 * Runs the original fold/score calculator from the FINAL HTML file.
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
      settings?: { labor?: number; run?: number; markup?: number; bdisc?: number; longSetup?: number; handRate?: number; lv?: Record<number, number> }
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

    // Match size using the NEW matchSz(w, h, cat, db, paper) -- returns null if too small
    const sizeKey = bridgeMatchSize(w, h, cat, paperKey)

    if (!sizeKey) {
      // Sheet is too small for this paper -- matchSz returned null
      const mn = paper.min || "?"
      // Find which OTHER papers might support smaller sizes
      const papersWithSmaller: string[] = []
      for (const [pk, pv] of Object.entries(db)) {
        if (pk === paperKey) continue
        const otherSk = bridgeMatchSize(w, h, cat, pk)
        if (otherSk) papersWithSmaller.push(pv.label)
      }

      return NextResponse.json({
        resolution: "too_small",
        sizeKey: null,
        error: `Sheet too small. Minimum for ${paper.label} is ${mn}. Your sheet is ${w}" x ${h}".`,
        alt: `Use a bigger sheet (at least ${mn}) or try a different paper.`,
        minSize: mn,
        papersWithTier: papersWithSmaller,
      })
    }

    const isLong = sizeKey === "long"
    const sizeData = paper.sizes[sizeKey]

    if (!sizeData) {
      // This shouldn't happen with the new matchSz (it skips missing tiers),
      // but handle gracefully just in case.
      return NextResponse.json({
        resolution: "na",
        sizeKey,
        error: `${paper.label} does not have pricing at size tier ${sizeKey}.`,
        availableTiers: Object.keys(paper.sizes).map(k => paper.sizes[k].lbl || k),
      })
    }

    const opt = sizeData[finish] as OriginalFoldEntry | undefined
    if (!opt) {
      const availableFinishes = Object.keys(sizeData).filter(k => k !== "lbl" && k !== "isLong")
      return NextResponse.json({
        resolution: "na",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        availableFinishes,
        error: `${finish} not listed for ${paper.label} at ${sizeData.lbl || sizeKey}. Available: ${availableFinishes.join(", ")}`,
      })
    }

    // Handle l === "na" (not available, no score-only fallback)
    if (opt.l === "na" && !opt.so) {
      const availableFinishes: string[] = []
      for (const [fKey, fEntry] of Object.entries(sizeData)) {
        if (fKey === "lbl" || fKey === "isLong") continue
        const fe = fEntry as OriginalFoldEntry
        if (fe && typeof fe.l === "number" && fe.l > 0) {
          availableFinishes.push(fKey)
        }
      }
      return NextResponse.json({
        resolution: "na",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        alt: opt.alt,
        availableFinishes,
        error: `Not available: ${opt.alt || "No alternative."}`,
      })
    }

    // Handle l === "hand" -- now priced using handRate ($/pc)
    if (opt.l === "hand") {
      const handRate = settings?.handRate ?? 0.25
      const markup = settings?.markup ?? 300
      const bdisc = settings?.bdisc ?? 30

      if (!qty) {
        return NextResponse.json({
          resolution: "hand",
          sizeKey,
          sizeLabel: sizeData.lbl || sizeKey,
          handRate,
          needsQty: true,
          error: `Hand Fold -- $${handRate.toFixed(2)}/pc`,
        })
      }

      const handBase = qty * handRate
      const handRetail = handBase * (1 + markup / 100)
      const handBroker = handRetail * (1 - bdisc / 100)
      const handPP = handRetail / qty
      const handBP = handBroker / qty

      return NextResponse.json({
        resolution: "hand",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        isLong: sizeKey === "long",
        handRate,
        alerts: [`Hand Fold -- $${handRate.toFixed(2)}/pc`],
        price: {
          level: 0,
          setupMinutes: 0,
          setupCost: 0,
          longFee: 0,
          runMinutes: 0,
          runCost: 0,
          base: handBase,
          retail: handRetail,
          broker: handBroker,
          perPiece: handPP,
          brokerPerPiece: handBP,
          batchSize: 1,
          secondsPerBatch: 0,
          isHandFold: true,
          handRate,
          markup,
        },
      })
    }

    // Score-only detection (matches new HTML logic exactly):
    // Case A: opt.l === "na" && opt.so → full fold N/A, score-only available, use l:4 default
    // Case B: typeof opt.l === "number" && opt.so → score-only, HAS a level, CAN be priced
    let isScoreOnly = !!opt.so
    let useOpt = opt

    if (opt.l === "na" && opt.so) {
      // New HTML line 512: useOpt={...opt,l:4}
      isScoreOnly = true
      useOpt = { ...opt, l: 4 }
    }

    if (!qty) {
      return NextResponse.json({
        resolution: isScoreOnly ? "score_only" : "ok",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        isLong,
        isScoreOnly,
        entry: opt,
        alt: opt.alt,
        needsQty: true,
      })
    }

    // Price it using the original priceIt function
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

    // Long sheet alert (info only -- the pricing handles it via isLong)
    const alerts: string[] = []
    if (isLong) alerts.push(`Long Sheet -- $${settingsMap?.longSetup || 35} flat fee added`)
    if (isScoreOnly && opt.l === "na") alerts.push(`Score Only -- full fold N/A for this combo`)

    const price = bridgePriceIt(useOpt, qty, isLong, settingsMap)

    if (!price) {
      const altText = opt.alt || null
      const availableFinishes: string[] = []
      for (const [fKey, fEntry] of Object.entries(sizeData)) {
        if (fKey === "lbl" || fKey === "isLong") continue
        const fe = fEntry as OriginalFoldEntry
        if (fe && typeof fe.l === "number" && fe.l > 0) {
          availableFinishes.push(fKey)
        }
      }
      return NextResponse.json({
        resolution: "na",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        alt: altText,
        availableFinishes,
        isScoreOnly: false,
        error: altText ? `Not available: ${altText}` : `${finish} not available for ${paper.label} at size tier ${sizeKey}`,
      })
    }

    // Auto-upgrade check: if level > 1, check if thicker paper is cheaper
    let upgraded = false
    let upgradedPaper = ""
    let upgradedPrice = price
    if (typeof useOpt.l === "number" && useOpt.l > 1) {
      for (const [pk, pv] of Object.entries(db)) {
        if (pk === paperKey || pv.thick <= paper.thick) continue
        const sd = pv.sizes[sizeKey]
        if (!sd) continue
        const fd = sd[finish] as OriginalFoldEntry | undefined
        if (!fd || fd.l === "na" || fd.l === "hand" || typeof fd.l !== "number") continue
        if (fd.l < useOpt.l) {
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
      alerts,
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
 * Returns the available data structure
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
      Object.entries(getFOLD()).map(([k, v]) => [k, { label: v.label, thick: v.thick, min: v.min, sizes: Object.keys(v.sizes) }])
    ),
    sf: Object.fromEntries(
      Object.entries(getSF()).map(([k, v]) => [k, { label: v.label, thick: v.thick, min: v.min, sizes: Object.keys(v.sizes) }])
    ),
  })
}

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

    // Match size -- try the primary tier first, then fall back to any
    // tier that exists in this paper's data
    let sizeKey = bridgeMatchSize(w, h, cat)
    const isLong = sizeKey === "long"
    let sizeData = paper.sizes[sizeKey]

    // Size tier fallback: if the matched tier doesn't exist for this paper,
    // try smaller available tiers first (the sheet fits in them), then larger.
    // This handles 80text_60_70 having "7x4" but not "7.5x5".
    if (!sizeData) {
      const allTiers = ["7x4", "7.5x5", "8.5x5.5", "8.5x11", "11x17+", "long"]
      const matchedIdx = allTiers.indexOf(sizeKey)
      // Try tiers from smallest up to the matched one (sheet fits in these)
      let foundFallback = false
      for (let i = matchedIdx - 1; i >= 0; i--) {
        if (paper.sizes[allTiers[i]]) {
          sizeKey = allTiers[i]
          sizeData = paper.sizes[sizeKey]
          foundFallback = true
          break
        }
      }
      // If no smaller tier, try larger tiers
      if (!foundFallback) {
        for (let i = matchedIdx + 1; i < allTiers.length; i++) {
          if (paper.sizes[allTiers[i]]) {
            sizeKey = allTiers[i]
            sizeData = paper.sizes[sizeKey]
            foundFallback = true
            break
          }
        }
      }

      if (!sizeData) {
        // Normalize dimensions to explain the actual problem
        const nw = Math.min(w, h)
        const nh = Math.max(w, h)
        const availableSizes = Object.keys(paper.sizes).map(k => {
          const sd = paper.sizes[k]
          return sd.lbl || k
        }).join(", ")
        return NextResponse.json({
          resolution: "na",
          sizeKey,
          error: `Sheet size ${nw}" x ${nh}" does not fit any available size tier for ${paper.label}. Available tiers: ${availableSizes}`,
        })
      }
    }

    const opt = sizeData[finish] as OriginalFoldEntry | undefined
    if (!opt) {
      // Show what finishes ARE available for this paper/size
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
      // Find which finishes ARE available for this paper/size
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

    // Handle l === "hand"
    if (opt.l === "hand") {
      return NextResponse.json({
        resolution: "hand",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        error: "Hand Fold -- Manual calc needed.",
      })
    }

    // Score-only fallback: l === "na" but so flag means score-only is available
    const isScoreOnly = opt.l === "na" && !!opt.so

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

    // For score-only entries: opt.l is "na" so priceIt returns null.
    // We create a modified entry with a numeric level for score-only pricing.
    // Score-only uses the entry's b and s values with a default level of 3.
    let priceableOpt = opt
    if (isScoreOnly && typeof opt.l !== "number" && opt.b && opt.s) {
      priceableOpt = { ...opt, l: 3 } // Default score-only level
    }

    const price = bridgePriceIt(priceableOpt, qty, isLong, settingsMap)

    if (!price) {
      // Check the original entry for alt text explaining why
      const altText = opt.alt || null
      // Find which finishes ARE available for this paper/size
      const availableFinishes: string[] = []
      for (const [fKey, fEntry] of Object.entries(sizeData)) {
        if (fKey === "lbl" || fKey === "isLong") continue
        const fe = fEntry as OriginalFoldEntry
        if (fe && typeof fe.l === "number" && fe.l > 0) {
          availableFinishes.push(fKey)
        }
      }
      // Build a clear error message based on the data
      let errorMsg: string
      if (altText) {
        errorMsg = `Not available: ${altText}`
      } else if (availableFinishes.length > 0) {
        errorMsg = `${finish} not available for ${paper.label} at this size. Available: ${availableFinishes.join(", ")}`
      } else {
        errorMsg = `${finish} not available for ${paper.label} at size tier ${sizeKey}`
      }

      return NextResponse.json({
        resolution: "na",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        alt: altText,
        availableFinishes,
        isScoreOnly: false,
        error: errorMsg,
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

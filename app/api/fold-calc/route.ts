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

    // Match size using the original matchSize function (no fallback -- exact match to original behavior)
    const sizeKey = bridgeMatchSize(w, h, cat)
    const isLong = sizeKey === "long"
    const sizeData = paper.sizes[sizeKey]

    if (!sizeData) {
      // The matched size tier doesn't exist for this paper.
      // Figure out WHY and give a clear explanation + alternatives.
      const nw = Math.min(w, h)
      const nh = Math.max(w, h)
      const availableTiers = Object.keys(paper.sizes)
      const availableTierLabels = availableTiers.map(k => paper.sizes[k].lbl || k)

      // Determine the smallest tier this paper supports
      const tierOrder = ["7x4", "7.5x5", "8.5x5.5", "8.5x11", "11x17+", "long"]
      const smallestAvailIdx = tierOrder.findIndex(t => paper.sizes[t])
      const smallestAvail = smallestAvailIdx >= 0 ? tierOrder[smallestAvailIdx] : null
      const matchedIdx = tierOrder.indexOf(sizeKey)

      let errorMsg: string
      let suggestion: string | null = null

      if (smallestAvailIdx >= 0 && matchedIdx >= 0 && matchedIdx < smallestAvailIdx) {
        // Sheet matched to a tier below what this paper supports
        const minLabel = smallestAvail ? (paper.sizes[smallestAvail]?.lbl || smallestAvail) : "unknown"
        errorMsg = `${paper.label} ${cat === "folding" ? "folding" : "score & fold"} is not available at size ${nw}" x ${nh}". The smallest tier for ${paper.label} is ${minLabel}.`
        suggestion = `Try a larger sheet size (at least ${minLabel} tier) or switch to a paper that supports smaller sizes.`
      } else {
        // Tier exists in the matchSize system but not for this paper
        errorMsg = `${paper.label} does not have ${cat === "folding" ? "folding" : "score & fold"} pricing at size tier ${sizeKey} (${nw}" x ${nh}").`
        suggestion = `Available tiers for ${paper.label}: ${availableTierLabels.join(", ")}.`
      }

      // Find which OTHER papers DO have this size tier
      const allDb = cat === "folding" ? getFOLD() : getSF()
      const papersWithTier: string[] = []
      for (const [pk, pv] of Object.entries(allDb)) {
        if (pk === paperKey) continue
        if (pv.sizes[sizeKey]) papersWithTier.push(pv.label)
      }

      return NextResponse.json({
        resolution: "na",
        sizeKey,
        error: errorMsg,
        alt: suggestion,
        availableTiers: availableTierLabels,
        papersWithTier,
      })
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

    // Score-only detection:
    // Case A: opt.l === "na" && opt.so → full fold N/A, score-only available
    // Case B: typeof opt.l === "number" && opt.so → score-only, but HAS a level so CAN be priced
    const isScoreOnly = !!opt.so
    const isScoreOnlyNoPricing = opt.l === "na" && !!opt.so // has so flag but no numeric level

    // For score-only entries where l === "na": the original HTML shows
    // "Score Only -- Full fold N/A. Pricing as Score Only." then tries priceIt
    // which returns null, then shows "Missing rate data."
    // We return a clear "score_only" resolution with the alt text instead.
    if (isScoreOnlyNoPricing) {
      const availableFinishes: string[] = []
      for (const [fKey, fEntry] of Object.entries(sizeData)) {
        if (fKey === "lbl" || fKey === "isLong") continue
        const fe = fEntry as OriginalFoldEntry
        if (fe && typeof fe.l === "number" && fe.l > 0) {
          availableFinishes.push(fKey)
        }
      }
      return NextResponse.json({
        resolution: "score_only",
        sizeKey,
        sizeLabel: sizeData.lbl || sizeKey,
        isLong,
        isScoreOnly: true,
        alt: opt.alt || "Score Only -- full fold not available at this size.",
        availableFinishes,
        error: `Score Only -- ${opt.alt || "Full fold not available. Only scoring is available at this size/paper."}`,
      })
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

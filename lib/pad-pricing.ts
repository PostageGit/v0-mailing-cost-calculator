// ─── Pad Pricing Engine ──────────────────────────────────
// Reuses spiral's printing engine (calculatePart) for inside pages,
// then applies pad-specific finishing: tiered per-pad rate + setup + chip board.

import { calculatePart } from "./spiral-pricing"
import type { PadInputs, PadCalcResult, PadSettings } from "./pad-types"
import { DEFAULT_PAD_SETTINGS } from "./pad-types"

/**
 * Look up the per-pad padding rate from the tiers table.
 */
function getPaddingRate(padQty: number, tiers: PadSettings["tiers"]): number {
  for (const tier of tiers) {
    if (padQty >= tier.min && padQty <= tier.max) return tier.pricePerPad
  }
  // Fallback: last tier
  return tiers[tiers.length - 1]?.pricePerPad ?? 0
}

/**
 * Main pad calculation entry point.
 * Returns a PadCalcResult or an error object.
 */
export function calculatePad(
  inputs: PadInputs,
  settings: PadSettings = DEFAULT_PAD_SETTINGS,
): PadCalcResult | { error: string } {
  const { padQty, pagesPerPad, pageWidth, pageHeight, inside, useChipBoard, customLevel } = inputs

  if (!padQty || padQty <= 0) return { error: "Enter the number of pads." }
  if (!pagesPerPad || pagesPerPad <= 0) return { error: "Enter pages per pad." }
  if (!pageWidth || !pageHeight) return { error: "Enter page width and height." }

  // Sheets per pad: pages are single-sided count.
  // If printed double-sided (D/S, 4/4, 1/1), each sheet = 2 pages.
  const doubleSided = ["D/S", "4/4", "1/1"].includes(inside.sides)
  const sheetsPerPad = doubleSided ? Math.ceil(pagesPerPad / 2) : pagesPerPad

  // Calculate inside printing using spiral's calculatePart
  const forcedLevel = customLevel !== "auto" ? customLevel : undefined
  const insideResult = calculatePart("inside", padQty, pageWidth, pageHeight, sheetsPerPad, inside, forcedLevel)

  if (!insideResult) return { error: "Could not calculate inside pages." }
  if ("error" in insideResult) return insideResult

  // Padding finishing cost
  const paddingRate = getPaddingRate(padQty, settings.tiers)
  const totalPaddingCost = paddingRate * padQty

  // Setup (flat)
  const setupCharge = settings.setupCharge

  // Chip board
  const chipBoardCost = useChipBoard ? settings.chipBoardPerPad * padQty : 0

  // Grand total
  const grandTotal = insideResult.cost + totalPaddingCost + setupCharge + chipBoardCost
  const pricePerPad = grandTotal / padQty

  return {
    insideResult,
    sheetsPerPad,
    totalPrintingCost: insideResult.cost,
    paddingRate,
    totalPaddingCost,
    setupCharge,
    chipBoardCost,
    grandTotal,
    pricePerPad,
    levelName: insideResult.levelName,
    padQty,
    pagesPerPad,
    pageWidth,
    pageHeight,
    settings,
  }
}

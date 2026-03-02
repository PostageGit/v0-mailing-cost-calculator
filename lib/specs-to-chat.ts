/**
 * Converts calculator specs to a natural-language chat prompt
 * so the AI chatbot prices the exact same job for comparison.
 * Prefixed with [CALC-CHECK] so the AI knows to skip confirmation and just price it.
 */

export function bookletSpecsToChat(inputs: {
  bookQty: number
  pagesPerBook: number
  pageWidth: number
  pageHeight: number
  separateCover: boolean
  coverPaper: string
  coverSides: string
  coverBleed: boolean
  insidePaper: string
  insideSides: string
  insideBleed: boolean
  laminationType: string
  isBroker: boolean
}): string {
  const parts = [
    `[CALC-CHECK] Price this EXACTLY, skip confirmation:`,
    `${inputs.bookQty} saddle-stitch booklets`,
    `${inputs.pageWidth}x${inputs.pageHeight}`,
    `${inputs.pagesPerBook} total pages`,
    `inside: ${inputs.insidePaper} ${inputs.insideSides}`,
    `inside bleed: ${inputs.insideBleed ? "yes" : "no"}`,
  ]
  if (inputs.separateCover) {
    parts.push(`separate cover: ${inputs.coverPaper} ${inputs.coverSides}`)
    parts.push(`cover bleed: ${inputs.coverBleed ? "yes" : "no"}`)
  } else {
    parts.push(`self-cover (no separate cover)`)
  }
  if (inputs.laminationType !== "none") {
    parts.push(`${inputs.laminationType} lamination`)
  } else {
    parts.push(`no lamination`)
  }
  parts.push(inputs.isBroker ? `broker pricing` : `regular pricing`)
  return parts.join(", ")
}

export function perfectSpecsToChat(inputs: {
  bookQty: number
  pagesPerBook: number
  pageWidth: number
  pageHeight: number
  coverPaper: string
  coverSides: string
  coverBleed: boolean
  insidePaper: string
  insideSides: string
  insideBleed: boolean
  laminationType: string
  isBroker: boolean
}): string {
  return [
    `[CALC-CHECK] Price this EXACTLY, skip confirmation:`,
    `${inputs.bookQty} perfect-bound books`,
    `${inputs.pageWidth}x${inputs.pageHeight}`,
    `${inputs.pagesPerBook} inside pages`,
    `inside: ${inputs.insidePaper} ${inputs.insideSides}`,
    `inside bleed: ${inputs.insideBleed ? "yes" : "no"}`,
    `cover: ${inputs.coverPaper} ${inputs.coverSides}`,
    `cover bleed: ${inputs.coverBleed ? "yes" : "no"}`,
    inputs.laminationType !== "none" ? `${inputs.laminationType} lamination` : `no lamination`,
    inputs.isBroker ? `broker pricing` : `regular pricing`,
  ].join(", ")
}

export function spiralSpecsToChat(inputs: {
  bookQty: number
  pagesPerBook: number
  pageWidth: number
  pageHeight: number
  insidePaper: string
  insideSides: string
  insideBleed: boolean
  useFrontCover: boolean
  frontPaper: string
  useBackCover: boolean
  backPaper: string
  coverBleed: boolean
  clearPlastic: boolean
  blackVinyl: boolean
  isBroker: boolean
}): string {
  const parts = [
    `[CALC-CHECK] Price this EXACTLY, skip confirmation:`,
    `${inputs.bookQty} spiral-bound books`,
    `${inputs.pageWidth}x${inputs.pageHeight}`,
    `${inputs.pagesPerBook} inside pages`,
    `inside: ${inputs.insidePaper} ${inputs.insideSides}`,
    `inside bleed: ${inputs.insideBleed ? "yes" : "no"}`,
  ]
  if (inputs.useFrontCover) parts.push(`front cover: ${inputs.frontPaper}`)
  if (inputs.useBackCover) parts.push(`back cover: ${inputs.backPaper}`)
  if (inputs.clearPlastic) parts.push(`clear plastic front`)
  if (inputs.blackVinyl) parts.push(`black vinyl back`)
  parts.push(`cover bleed: ${inputs.coverBleed ? "yes" : "no"}`)
  parts.push(inputs.isBroker ? `broker pricing` : `regular pricing`)
  return parts.join(", ")
}

export function flatSpecsToChat(inputs: {
  qty: number
  width: number
  height: number
  paper: string
  sides: string
  hasBleed: boolean
  isBroker: boolean
}): string {
  return [
    `[CALC-CHECK] Price this EXACTLY, skip confirmation:`,
    `${inputs.qty} flat prints`,
    `${inputs.width}x${inputs.height}`,
    `${inputs.paper} ${inputs.sides}`,
    `bleed: ${inputs.hasBleed ? "yes" : "no"}`,
    inputs.isBroker ? `broker pricing` : `regular pricing`,
  ].join(", ")
}

export function padSpecsToChat(inputs: {
  padQty: number
  sheetsPerPad: number
  pageWidth: number
  pageHeight: number
  paper: string
  sides: string
  hasBleed: boolean
  isBroker: boolean
}): string {
  return [
    `[CALC-CHECK] Price this EXACTLY, skip confirmation:`,
    `${inputs.padQty} pads, ${inputs.sheetsPerPad} sheets each`,
    `${inputs.pageWidth}x${inputs.pageHeight}`,
    `${inputs.paper} ${inputs.sides}`,
    `bleed: ${inputs.hasBleed ? "yes" : "no"}`,
    inputs.isBroker ? `broker pricing` : `regular pricing`,
  ].join(", ")
}

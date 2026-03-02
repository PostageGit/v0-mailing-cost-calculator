/**
 * Converts calculator specs to natural customer language.
 * NO codes, NO prices, NO hints -- just how a real customer would ask.
 */

function sidesHuman(sides: string): string {
  switch (sides) {
    case "4/4": return "color both sides"
    case "4/0": return "color front only"
    case "1/1": return "black and white both sides"
    case "1/0": return "black and white front only"
    case "D/S": return "black and white both sides"
    case "S/S": return "black and white one side"
    default: return sides
  }
}

function bleedHuman(hasBleed: boolean): string {
  return hasBleed ? "with bleed" : "no bleed"
}

function lamHuman(lam: string): string {
  if (!lam || lam === "none" || lam === "None") return ""
  return `I want ${lam.toLowerCase()} lamination on the cover.`
}

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
  const totalPages = inputs.pagesPerBook + (inputs.separateCover ? 4 : 0)
  let msg = `Hi, I need ${inputs.bookQty} saddle stitch booklets, ${inputs.pageWidth}x${inputs.pageHeight} finished size, ${totalPages} total pages.`
  msg += ` Inside pages on ${inputs.insidePaper}, ${sidesHuman(inputs.insideSides)}, ${bleedHuman(inputs.insideBleed)}.`
  if (inputs.separateCover) {
    msg += ` Separate cover on ${inputs.coverPaper}, ${sidesHuman(inputs.coverSides)}, ${bleedHuman(inputs.coverBleed)}.`
  } else {
    msg += ` Same paper throughout, no separate cover.`
  }
  const lam = lamHuman(inputs.laminationType)
  if (lam) msg += ` ${lam}`
  if (inputs.isBroker) msg += ` I'm a print broker.`
  msg += ` How much?`
  return msg
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
  let msg = `Hi, I need ${inputs.bookQty} perfect bound books, ${inputs.pageWidth}x${inputs.pageHeight}, ${inputs.pagesPerBook} inside pages.`
  msg += ` Inside on ${inputs.insidePaper}, ${sidesHuman(inputs.insideSides)}, ${bleedHuman(inputs.insideBleed)}.`
  msg += ` Cover on ${inputs.coverPaper}, ${sidesHuman(inputs.coverSides)}, ${bleedHuman(inputs.coverBleed)}.`
  const lam = lamHuman(inputs.laminationType)
  if (lam) msg += ` ${lam}`
  if (inputs.isBroker) msg += ` This is broker pricing.`
  msg += ` What's the price?`
  return msg
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
  let msg = `Hey, I need ${inputs.bookQty} spiral bound books, ${inputs.pageWidth}x${inputs.pageHeight}, ${inputs.pagesPerBook} inside pages.`
  msg += ` Inside pages on ${inputs.insidePaper}, ${sidesHuman(inputs.insideSides)}, ${bleedHuman(inputs.insideBleed)}.`
  if (inputs.useFrontCover) msg += ` Printed front cover on ${inputs.frontPaper}, ${bleedHuman(inputs.coverBleed)}.`
  if (inputs.useBackCover) msg += ` Printed back cover on ${inputs.backPaper}.`
  if (inputs.clearPlastic) msg += ` Clear plastic front.`
  if (inputs.blackVinyl) msg += ` Black vinyl back.`
  if (inputs.isBroker) msg += ` Broker pricing.`
  msg += ` How much would that be?`
  return msg
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
  let msg = `Hi, can I get a price on ${inputs.qty} flat prints, ${inputs.width}x${inputs.height}, on ${inputs.paper}, ${sidesHuman(inputs.sides)}, ${bleedHuman(inputs.hasBleed)}.`
  if (inputs.isBroker) msg += ` I'm a broker.`
  return msg
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
  let msg = `Hi, I need ${inputs.padQty} pads with ${inputs.sheetsPerPad} sheets each, ${inputs.pageWidth}x${inputs.pageHeight}, on ${inputs.paper}, ${sidesHuman(inputs.sides)}, ${bleedHuman(inputs.hasBleed)}.`
  if (inputs.isBroker) msg += ` Trade pricing please.`
  msg += ` How much?`
  return msg
}

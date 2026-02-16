// Envelope Calculator pricing engine
// Ported from the original HTML/JS envelope_calculator.html

/* ─── Types ─── */

export interface EnvelopeItem {
  name: string
  costPer1000: number  // cost per 1000 envelopes
  bleed: boolean       // can this envelope type accept bleed?
}

export type InkType = "InkJet" | "Laser"

export type InkJetPrintType = "Text BW" | "Text Color" | "Text + Logo" | "Custom"
export type LaserPrintType = "BW" | "RBW" | "Color"
export type PrintType = InkJetPrintType | LaserPrintType

export type CustomerType = "Regular" | "Broker"

export interface EnvelopeInputs {
  amount: number
  itemName: string
  inkType: InkType
  printType: PrintType
  hasBleed: boolean
  customerType: CustomerType
  /** Custom envelope cost per 1000 (for "Provided stock") */
  customEnvCost: number
  /** Custom print cost per 1000 (for "Custom" print type) */
  customPrintCost: number
}

export interface EnvelopeCalcResult {
  quantity: number          // amount rounded up to nearest 50
  price: number             // final price (ceil)
  pricePerUnit: number      // price / quantity
  baseCost: number          // before fees (priceWithoutFees)
  envelopeCostPer1000: number
  printCostPer1000: number
  customerMarkup: number
  bleedFeesApplied: boolean
  minFeeApplied: boolean
  setupFee: number
  bleedMarkupAmount: number
}

export interface EnvelopeSettings {
  items: EnvelopeItem[]
  inkjet: Record<InkJetPrintType, number>  // cost per 1000
  laser: Record<LaserPrintType, number>    // cost per 1000
  customer: Record<CustomerType, number>   // markup multiplier
  fees: {
    minNoBleed: number    // minimum price when no bleed
    setupFee: number      // bleed setup fee
    bleedMarkup: number   // bleed markup multiplier (0.1 = +10%)
  }
}

/* ─── Default settings (from the original HTML) ─── */

export const DEFAULT_ENVELOPE_SETTINGS: EnvelopeSettings = {
  items: [
    { name: "#6", costPer1000: 35.55, bleed: true },
    { name: "#9", costPer1000: 29.05, bleed: true },
    { name: "#10 no window", costPer1000: 29.05, bleed: true },
    { name: "#10 with window", costPer1000: 40.70, bleed: true },
    { name: "6x9", costPer1000: 50.70, bleed: true },
    { name: "6x9.5", costPer1000: 57.30, bleed: true },
    { name: "9x12", costPer1000: 89.80, bleed: false },
    { name: "9x12 open end", costPer1000: 101.30, bleed: false },
    { name: "Princes", costPer1000: 95.00, bleed: true },
    { name: "A-2", costPer1000: 45.00, bleed: true },
    { name: "Square 9x9 (special order)", costPer1000: 190.00, bleed: false },
    { name: "Square 6x6 (special order)", costPer1000: 130.00, bleed: true },
    { name: "Provided stock", costPer1000: 0, bleed: true },
    { name: "A-7 (5.25x7.25)", costPer1000: 47.00, bleed: true },
    { name: "Remit", costPer1000: 100.00, bleed: false },
  ],
  inkjet: {
    "Text BW": 5.0,
    "Text Color": 10.0,
    "Text + Logo": 15.0,
    "Custom": 20.0,
  },
  laser: {
    "BW": 5.0,
    "RBW": 20.0,
    "Color": 50.0,
  },
  customer: {
    "Regular": 2.85,
    "Broker": 2.35,
  },
  fees: {
    minNoBleed: 35.0,
    setupFee: 100.0,
    bleedMarkup: 0.1,
  },
}

/* ─── Helpers ─── */

export function getInkJetPrintTypes(): InkJetPrintType[] {
  return ["Text BW", "Text Color", "Text + Logo", "Custom"]
}

export function getLaserPrintTypes(): LaserPrintType[] {
  return ["BW", "RBW", "Color"]
}

export function defaultEnvelopeInputs(): EnvelopeInputs {
  return {
    amount: 0,
    itemName: "6x9",
    inkType: "InkJet",
    printType: "Text + Logo",
    hasBleed: false,
    customerType: "Regular",
    customEnvCost: 0,
    customPrintCost: 0,
  }
}

/* ─── Main calculation ─── */

export function calculateEnvelope(
  inputs: EnvelopeInputs,
  settings: EnvelopeSettings = DEFAULT_ENVELOPE_SETTINGS
): EnvelopeCalcResult | { error: string } {
  const { amount, itemName, inkType, printType, hasBleed, customerType, customEnvCost, customPrintCost } = inputs

  if (amount <= 0) return { error: "Enter an amount." }
  if (!itemName) return { error: "Select an envelope item." }
  if (!printType) return { error: "Select a print type." }

  // Find item
  const item = settings.items.find((i) => i.name === itemName)
  if (!item) return { error: `Unknown envelope item: ${itemName}` }

  // Envelope cost per 1000
  const envelopeCostPer1000 = itemName === "Provided stock" ? customEnvCost : item.costPer1000

  // Validate provided stock
  if (itemName === "Provided stock" && envelopeCostPer1000 <= 0) {
    return { error: "Enter envelope cost/1000 for provided stock." }
  }

  // Print cost per 1000
  let printCostPer1000 = 0
  if (inkType === "InkJet") {
    if (printType === "Custom") {
      printCostPer1000 = customPrintCost
      if (printCostPer1000 <= 0) return { error: "Enter custom print cost/1000." }
    } else {
      printCostPer1000 = settings.inkjet[printType as InkJetPrintType] ?? 0
    }
  } else {
    printCostPer1000 = settings.laser[printType as LaserPrintType] ?? 0
  }

  // Quantity: round up to nearest 50
  const quantity = Math.ceil(amount / 50) * 50

  // Per-piece costs
  const envelopeCostPerPiece = envelopeCostPer1000 / 1000
  const printCostPerPiece = printCostPer1000 / 1000

  // Customer markup
  const customerMarkup = settings.customer[customerType] ?? 2.85

  // Base calculation: quantity * (envelope + print) * customerMarkup
  // ROUNDUP to integer
  const baseCost = Math.ceil((quantity * (envelopeCostPerPiece + printCostPerPiece)) * customerMarkup)

  let finalPrice = baseCost

  // Check bleed eligibility
  const bleedCapable = item.bleed
  const bleedApplied = bleedCapable && inkType === "InkJet" && hasBleed

  let bleedMarkupAmount = 0
  let setupFee = 0

  if (bleedApplied) {
    // Apply bleed markup (+10% by default)
    bleedMarkupAmount = finalPrice * settings.fees.bleedMarkup
    finalPrice = finalPrice * (1 + settings.fees.bleedMarkup)
    // Add bleed setup fee
    setupFee = settings.fees.setupFee
    finalPrice = finalPrice + setupFee
  }

  // Minimum fee: if base < $35 AND no bleed fees were applied
  let minFeeApplied = false
  if (baseCost < settings.fees.minNoBleed && !bleedApplied) {
    finalPrice = finalPrice + settings.fees.minNoBleed
    minFeeApplied = true
  }

  const price = Math.ceil(finalPrice)
  const pricePerUnit = quantity > 0 ? price / quantity : 0

  return {
    quantity,
    price,
    pricePerUnit,
    baseCost,
    envelopeCostPer1000,
    printCostPer1000,
    customerMarkup,
    bleedFeesApplied: bleedApplied,
    minFeeApplied,
    setupFee,
    bleedMarkupAmount,
  }
}

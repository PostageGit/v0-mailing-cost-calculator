// ─── Service Catalog ─────────────────────────────────────
// Master list of all services/items available for quoting,
// derived from the QuickBooks Items CSV.

import { getActiveConfig, type AddressingBracket } from "./pricing-config"

export type ServiceCategory =
  | "PRINTING"
  | "LIST_WORK"
  | "LIST_RENTAL"
  | "ADDRESSING"
  | "COMPUTER_WORK"
  | "INSERTING"
  | "LABELING"
  | "POSTAGE"
  | "DELIVERY"
  | "MISC"

export const CATEGORY_ORDER: ServiceCategory[] = [
  "PRINTING",
  "LIST_WORK",
  "LIST_RENTAL",
  "ADDRESSING",
  "COMPUTER_WORK",
  "INSERTING",
  "LABELING",
  "POSTAGE",
  "DELIVERY",
  "MISC",
]

export const CATEGORY_META: Record<ServiceCategory, { label: string; icon: string; defaultOpen: boolean }> = {
  PRINTING:      { label: "Printing",       icon: "printer",    defaultOpen: false },
  LIST_WORK:     { label: "List Work",      icon: "list",       defaultOpen: false },
  LIST_RENTAL:   { label: "List Rentals",   icon: "book-open",  defaultOpen: false },
  ADDRESSING:    { label: "Addressing",     icon: "at-sign",    defaultOpen: true },
  COMPUTER_WORK: { label: "Computer Work",  icon: "cpu",        defaultOpen: true },
  INSERTING:     { label: "Inserting",      icon: "inbox",      defaultOpen: false },
  LABELING:      { label: "Labeling",       icon: "tag",        defaultOpen: false },
  POSTAGE:       { label: "Postage",        icon: "stamp",      defaultOpen: false },
  DELIVERY:      { label: "Delivery",       icon: "truck",      defaultOpen: false },
  MISC:          { label: "Miscellaneous",  icon: "more",       defaultOpen: false },
}

export type PriceUnit =
  | "job"
  | "list"
  | "1000"
  | "piece"
  | "stamp"
  | "name/mailing"
  | "insert"
  | "bag"
  | "delivery"
  | "hour"
  | "payment"
  | "invoice"

export interface ServiceItem {
  id: string
  name: string
  category: ServiceCategory
  description: string
  defaultPrice: number | null   // null = user enters custom price
  priceUnit: PriceUnit
  postcard: boolean | null      // null = all shapes
  letter: boolean | null
  flat: boolean | null
  referToPostage?: boolean      // price comes from USPS calculator
  /** For tiered addressing: qty range this tier applies to */
  qtyMin?: number
  qtyMax?: number | null        // null = unlimited
  /** If true, auto-add when building a quote */
  autoInclude?: boolean
  /** Links to supplier item ID in suppliers config (for list rentals, etc.) */
  linkedSupplierId?: string
  /** Special pricing rule override (e.g. CASS 2nd: first 1,000 free) */
  pricingRule?: "per1000_after_1000" | "min_then_per_pc" | "addressing_bracket" | "tabbing_bracket"
}

// ─── Full Catalog ────────────────────────────────────────

export const SERVICE_CATALOG: ServiceItem[] = [
  // ── PRINTING ──
  { id: "printing",          name: "Printing",              category: "PRINTING", description: "Printing items for the mailing job",                    defaultPrice: null,  priceUnit: "job",          postcard: null, letter: null, flat: null },
  { id: "mail-merge",        name: "Mail Merge",            category: "PRINTING", description: "Creating a mail merge file from a list",                defaultPrice: 85,    priceUnit: "list",         postcard: null, letter: null, flat: null },
  { id: "design-change",     name: "Design / Change File",  category: "PRINTING", description: "Changes or graphic work on a file for printing",       defaultPrice: null,  priceUnit: "job",          postcard: null, letter: null, flat: null },
  { id: "pickup-prints",     name: "Pick Up Prints",        category: "PRINTING", description: "Pick up items from an external address by our driver", defaultPrice: 35,    priceUnit: "job",          postcard: null, letter: null, flat: null },

  // ── LIST WORK ──
  { id: "additional-lot",         name: "Additional Lot",             category: "LIST_WORK", description: "Each list in addition to the first (which is included)",        defaultPrice: 35,   priceUnit: "list",         postcard: null, letter: null, flat: null },
  { id: "translate-names",        name: "Translate Names to English", category: "LIST_WORK", description: "Translate Hebrew names to English",                             defaultPrice: 75,   priceUnit: "list",         postcard: null, letter: null, flat: null },
  { id: "print-hebrew",           name: "Print Hebrew Letters",       category: "LIST_WORK", description: "Printing Hebrew text on the mailpiece",                          defaultPrice: 50,   priceUnit: "list",         postcard: null, letter: null, flat: null },
  { id: "fix-list",               name: "Fix List",                   category: "LIST_WORK", description: "Do any fixing required on the mailing list",                     defaultPrice: 100,  priceUnit: "list",         postcard: null, letter: null, flat: null },
  { id: "duplicate-remove",       name: "Duplicate Remove",           category: "LIST_WORK", description: "Remove duplicate addresses from a mailing list",                 defaultPrice: 100,  priceUnit: "list",         postcard: null, letter: null, flat: null },
  // ── LIST RENTALS (each linked to supplier item via linkedSupplierId) ──
  { id: "list-rent-skver",        name: "Skver",              category: "LIST_RENTAL", description: "Renting the Skver mailing list",               defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-skver" },
  { id: "list-rent-monsey",       name: "Monsey",             category: "LIST_RENTAL", description: "Renting the Monsey mailing list",              defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-monsey" },
  { id: "list-rent-simcha",       name: "Simcha List",        category: "LIST_RENTAL", description: "Renting the Shidduchim mailing list",          defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-simcha" },
  { id: "list-rent-bp",           name: "Boro Park",          category: "LIST_RENTAL", description: "Renting the Boro Park mailing list",           defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-bp" },
  { id: "list-rent-willi",        name: "Williamsburg",       category: "LIST_RENTAL", description: "Renting the Williamsburg mailing list",        defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-willi" },
  { id: "list-rent-kj",           name: "Kiryas Joel",        category: "LIST_RENTAL", description: "Renting the Kiryas Joel mailing list",         defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-kj" },
  { id: "list-rent-si",           name: "Staten Island",      category: "LIST_RENTAL", description: "Renting the Staten Island mailing list",       defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-si" },
  { id: "list-rent-satmar",       name: "Satmar",             category: "LIST_RENTAL", description: "Renting the Satmar mailing list",              defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-satmar" },
  { id: "list-rent-other",        name: "Other",              category: "LIST_RENTAL", description: "Renting a mailing list not specified above",   defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null },
  { id: "list-rent-linden",       name: "Linden",             category: "LIST_RENTAL", description: "Renting the Linden mailing list",              defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-linden" },
  { id: "list-rent-lakewood",     name: "Lakewood",           category: "LIST_RENTAL", description: "Renting the Lakewood mailing list",            defaultPrice: null, priceUnit: "name/mailing", postcard: null, letter: null, flat: null, linkedSupplierId: "lr-lakewood" },

  // ── ADDRESSING ── (pricing comes from addressing brackets in config)
  { id: "addr-letter",   name: "Addressing",                 category: "ADDRESSING", description: "Printing mailing addresses on letter/postcard mail pieces",                   defaultPrice: 125,  priceUnit: "piece", postcard: true, letter: true,  flat: false, autoInclude: true, pricingRule: "addressing_bracket" },
  { id: "addr-flats",    name: "Addressing Flats",           category: "ADDRESSING", description: "Printing mailing addresses on FLAT mail pieces",                              defaultPrice: 200,  priceUnit: "piece", postcard: false, letter: false, flat: true, autoInclude: true, pricingRule: "addressing_bracket" },

  // ── COMPUTER WORK ──
  { id: "computer-work",  name: "Computer Work",         category: "COMPUTER_WORK", description: "Computer work for the job",                        defaultPrice: 125, priceUnit: "job", postcard: null, letter: null, flat: null, autoInclude: true },
  { id: "cass-2nd",       name: "CASS 2nd (1,000+)",     category: "COMPUTER_WORK", description: "Additional computer work beyond 1,000 pieces",     defaultPrice: 10,  priceUnit: "1000", postcard: null, letter: null, flat: null, autoInclude: true, pricingRule: "per1000_after_1000" },

  // ── INSERTING ──
  { id: "insert-machine-3",      name: "Machine Insert (up to 3 pc)",   category: "INSERTING", description: "Inserting up to 3 pieces into envelope by machine and sealing",    defaultPrice: 125,  priceUnit: "1000", postcard: false, letter: true, flat: true, pricingRule: "min_then_per_pc" },
  { id: "insert-machine-addl",   name: "Machine Insert (each addl pc)", category: "INSERTING", description: "Each additional piece above 3 inserted by machine",                  defaultPrice: 25,   priceUnit: "insert", postcard: false, letter: true, flat: true },
  { id: "insert-clear-bags",     name: "Inserting in Clear Bags",    category: "INSERTING", description: "Inserting items into a clear bag by hand and sealing",              defaultPrice: 350,  priceUnit: "1000", postcard: false, letter: true, flat: true },
  { id: "insert-hand",           name: "Inserting by Hand",          category: "INSERTING", description: "Inserting items into a paper envelope by hand and sealing",         defaultPrice: 285,  priceUnit: "1000", postcard: false, letter: true, flat: true },
  { id: "clear-bags-item",       name: "Clear Bags (item)",          category: "INSERTING", description: "A clear bag to insert the mail piece into",                         defaultPrice: 0.18, priceUnit: "bag", postcard: false, letter: true, flat: true },
  { id: "tabbing",               name: "Tabbing",                    category: "INSERTING", description: "Apply up to 2 tabs on a mailpiece",                                 defaultPrice: 125,  priceUnit: "piece", postcard: false, letter: true, flat: true, pricingRule: "tabbing_bracket" },
  { id: "folding",               name: "Folding",                    category: "INSERTING", description: "Folding a scored print by machine",                                 defaultPrice: 75,   priceUnit: "1000", postcard: false, letter: true, flat: true },
  { id: "folding-hand",          name: "Folding by Hand",            category: "INSERTING", description: "Folding a scored print manually by hand",                            defaultPrice: 125,  priceUnit: "1000", postcard: false, letter: true, flat: true },
  { id: "gluing",                name: "Gluing",                     category: "INSERTING", description: "Glueing an item or print into the mailing",                          defaultPrice: 150,  priceUnit: "1000", postcard: false, letter: true, flat: true },
  { id: "sealing-only",          name: "Sealing Only",               category: "INSERTING", description: "Sealing an envelope or bag by hand without inserting",               defaultPrice: 75,   priceUnit: "1000", postcard: false, letter: true, flat: true },
  { id: "match-names",           name: "Match Names",                category: "INSERTING", description: "Match 2 items of a mail merge",                                     defaultPrice: 75,   priceUnit: "1000", postcard: false, letter: true, flat: true },

  // ── LABELING ──
  { id: "label-hand-flats", name: "Labeling by Hand (Flats)",  category: "LABELING", description: "Applying address labels on Flat mail pieces by hand",     defaultPrice: 250, priceUnit: "1000", postcard: false, letter: false, flat: true },
  { id: "label-hand",       name: "Labeling by Hand",           category: "LABELING", description: "Applying address labels on non-Flat mail pieces by hand", defaultPrice: 150, priceUnit: "1000", postcard: true,  letter: true,  flat: false },
  { id: "label-machine",    name: "Labeling by Machine",        category: "LABELING", description: "Applying address labels by machine",                      defaultPrice: 125, priceUnit: "1000", postcard: null,  letter: null,  flat: null },
  { id: "white-labels",     name: "White Labels",               category: "LABELING", description: "Printing white labels with mailing addresses",            defaultPrice: 50,  priceUnit: "1000", postcard: null,  letter: null,  flat: null },

  // ── POSTAGE ──
  { id: "permit",              name: "Permit (no computer work)", category: "POSTAGE", description: "Use of Postage Plus permit for a job without computer work",       defaultPrice: 75,   priceUnit: "job",   postcard: null, letter: null, flat: null },
  { id: "postage-1st",         name: "Postage 1st Class",         category: "POSTAGE", description: "Postage - 1st Class",                                             defaultPrice: null, priceUnit: "piece", postcard: null, letter: null, flat: null, referToPostage: true },
  { id: "postage-mkt",         name: "Postage Marketing Mail",    category: "POSTAGE", description: "Postage - Marketing Mail (Standard)",                              defaultPrice: null, priceUnit: "piece", postcard: null, letter: null, flat: null, referToPostage: true },
  { id: "postage-np",          name: "Postage Non-Profit",        category: "POSTAGE", description: "Postage - Non-Profit",                                             defaultPrice: null, priceUnit: "piece", postcard: null, letter: null, flat: null, referToPostage: true },
  { id: "stamp-forever",       name: "Stamps - Forever",          category: "POSTAGE", description: "Physical Forever stamp",                                           defaultPrice: 0.78, priceUnit: "stamp", postcard: null, letter: null, flat: null },
  { id: "stamp-2oz",           name: "Stamps - 2oz",              category: "POSTAGE", description: "Physical stamp for 2oz mail",                                      defaultPrice: 1.07, priceUnit: "stamp", postcard: null, letter: null, flat: null },
  { id: "stamp-addl-oz",       name: "Stamps - Additional oz",    category: "POSTAGE", description: "Additional stamp for mail requiring more than 1 stamp",            defaultPrice: 0.29, priceUnit: "stamp", postcard: null, letter: null, flat: null },
  { id: "stamp-custom",        name: "Stamps - Custom",           category: "POSTAGE", description: "Physical stamp at a custom price",                                 defaultPrice: null, priceUnit: "stamp", postcard: null, letter: null, flat: null },
  { id: "postage-single",      name: "Postage Single Piece",      category: "POSTAGE", description: "1st Class with permit, not bulk or presorted",                     defaultPrice: null, priceUnit: "piece", postcard: null, letter: null, flat: null, referToPostage: true },
  { id: "stamp-intl",          name: "International Stamps",      category: "POSTAGE", description: "Postage (1oz) to mail outside the USA",                            defaultPrice: 1.70, priceUnit: "stamp", postcard: null, letter: null, flat: null },
  { id: "stamping",            name: "Stamping",                   category: "POSTAGE", description: "Applying stamps on a mail piece",                                  defaultPrice: 0.15, priceUnit: "stamp", postcard: null, letter: null, flat: null },
  { id: "tracking",            name: "Tracking",                   category: "POSTAGE", description: "Additional service to track delivery status",                      defaultPrice: 35,   priceUnit: "job",   postcard: null, letter: null, flat: null },

  // ── DELIVERY ──
  { id: "delivery-monsey",    name: "Delivery - Monsey",    category: "DELIVERY", description: "Deliver to a Monsey address with our driver",       defaultPrice: 35,   priceUnit: "delivery", postcard: null, letter: null, flat: null },
  { id: "delivery-brooklyn",  name: "Delivery - Brooklyn",  category: "DELIVERY", description: "Deliver to a Brooklyn address with our driver",     defaultPrice: 35,   priceUnit: "delivery", postcard: null, letter: null, flat: null },
  { id: "delivery-messenger", name: "Delivery - Messenger", category: "DELIVERY", description: "Deliver via messenger driver or Uber",              defaultPrice: null, priceUnit: "delivery", postcard: null, letter: null, flat: null },
  { id: "delivery-ups",       name: "Delivery - UPS",       category: "DELIVERY", description: "Deliver via UPS",                                   defaultPrice: 35,   priceUnit: "delivery", postcard: null, letter: null, flat: null },

  // ── MISC ──
  { id: "cc-charge",        name: "Credit Card Charge",     category: "MISC", description: "Fee for payments made via credit or debit card (3%)",     defaultPrice: null, priceUnit: "payment", postcard: null, letter: null, flat: null },
  { id: "discount",         name: "Discount",               category: "MISC", description: "A custom discount on a job",                              defaultPrice: null, priceUnit: "invoice", postcard: null, letter: null, flat: null },
  { id: "drop-brooklyn-po", name: "Drop Brooklyn PO",       category: "MISC", description: "Deliver the job to Brooklyn Post Office drop-off",        defaultPrice: 200,  priceUnit: "job",     postcard: null, letter: null, flat: null },
  { id: "misc-custom",      name: "Misc.",                  category: "MISC", description: "Any service not listed above",                            defaultPrice: null, priceUnit: "job",     postcard: null, letter: null, flat: null },
  { id: "overtime",         name: "Overtime",               category: "MISC", description: "Workers after 5:00 PM or before 9:00 AM on a specific job", defaultPrice: 100, priceUnit: "hour",   postcard: null, letter: null, flat: null },
  { id: "rush-job",         name: "Rush Job",               category: "MISC", description: "Fee for expediting a job outside regular timeframe",       defaultPrice: null, priceUnit: "job",     postcard: null, letter: null, flat: null },
]

// ─── Helpers ─────────────────────────────────────────────

/** Get the correct addressing item for the shape */
export function getAddressingTierId(_qty: number, isFlat: boolean): string | null {
  return isFlat ? "addr-flats" : "addr-letter"
}

/** Filter catalog by USPS shape */
export function filterByShape(items: ServiceItem[], shape: string): ServiceItem[] {
  const s = shape.toUpperCase()
  return items.filter((item) => {
    // Items with all-null shape fields are universal
    if (item.postcard === null && item.letter === null && item.flat === null) return true
    if (s === "POSTCARD" && item.postcard === true) return true
    if (s === "LETTER" && item.letter === true) return true
    if ((s === "FLAT" || s === "PARCEL") && item.flat === true) return true
    // Also show universal items when shape is PARCEL
    if (s === "PARCEL" && item.postcard === null && item.letter === null && item.flat === null) return true
    return false
  })
}

/** Group catalog items by category */
export function groupByCategory(items: ServiceItem[]): Record<ServiceCategory, ServiceItem[]> {
  const groups = {} as Record<ServiceCategory, ServiceItem[]>
  for (const cat of CATEGORY_ORDER) groups[cat] = []
  for (const item of items) groups[item.category].push(item)
  return groups
}

/** Calculate the amount for an item given its price, unit, and quantity */
export function calculateItemAmount(
  item: ServiceItem,
  unitPrice: number,
  mailingQty: number,
  itemQty: number,
): number {
  // Special pricing rules
  if (item.pricingRule === "per1000_after_1000") {
    // First 1,000 are free; charge fractional blocks beyond that
    const billable = Math.max(0, mailingQty - 1000)
    if (billable <= 0) return 0
    return unitPrice * (billable / 1000) * itemQty
  }
  if (item.pricingRule === "min_then_per_pc") {
    // Minimum charge (unitPrice) covers first 1,000 pieces.
    // Beyond 1,000: per-piece rate = unitPrice / 1000, no rounding.
    if (mailingQty <= 1000) return unitPrice * itemQty
    const extra = mailingQty - 1000
    const perPiece = unitPrice / 1000
    return (unitPrice + extra * perPiece) * itemQty
  }
  if (item.pricingRule === "addressing_bracket") {
    // Tiered addressing: look up brackets from config
    const cfg = getActiveConfig().addressingConfig
    const isFlat = item.id === "addr-flats"
    const brackets: AddressingBracket[] = isFlat ? cfg.flat : cfg.letterPostcard
    return calculateAddressingBracket(brackets, mailingQty) * itemQty
  }
  if (item.pricingRule === "tabbing_bracket") {
    const brackets = getActiveConfig().tabbingConfig.brackets
    return calculateAddressingBracket(brackets, mailingQty) * itemQty
  }

  switch (item.priceUnit) {
  case "1000":
  return unitPrice * Math.ceil(mailingQty / 1000) * itemQty
    case "piece":
    case "stamp":
    case "bag":
    case "name/mailing":
      return unitPrice * mailingQty * itemQty
    case "job":
    case "list":
    case "delivery":
    case "hour":
    case "insert":
      return unitPrice * itemQty
    case "payment":
    case "invoice":
      return unitPrice * itemQty
    default:
      return unitPrice * itemQty
  }
}

/**
 * Calculate addressing cost from bracket tiers.
 * Each bracket either has a flatMin (minimum charge for that range) or perPiece rate.
 * The qty falls into exactly ONE bracket.
 */
function calculateAddressingBracket(brackets: AddressingBracket[], qty: number): number {
  for (const b of brackets) {
    const inBracket = b.maxQty === null ? true : qty <= b.maxQty
    if (inBracket) {
      if (b.flatMin != null) return b.flatMin
      if (b.perPiece != null) return b.perPiece * qty
      return 0
    }
  }
  // Fallback: use last bracket
  const last = brackets[brackets.length - 1]
  if (last?.perPiece != null) return last.perPiece * qty
  return last?.flatMin ?? 0
}

/** Get the auto-quantity for an item based on its price unit and mailing qty */
export function getAutoQuantity(item: ServiceItem, _mailingQty: number): number {
  switch (item.priceUnit) {
    case "1000":
    case "piece":
    case "stamp":
    case "bag":
    case "name/mailing":
      return 1 // multiplied by mailingQty in calculateItemAmount
    case "job":
    case "list":
    case "delivery":
    case "insert":
      return 1
    case "hour":
      return 1
    case "payment":
    case "invoice":
      return 1
    default:
      return 1
  }
}

// ─── Smart Inference Engine ─────────────────────────────
// Given all the job inputs, determine which items are DEFINITELY needed.

export interface JobContext {
  shape: string             // "POSTCARD" | "LETTER" | "FLAT" | "PARCEL"
  quantity: number
  mailService: string       // "FCM_COMM" | "MKT_COMM" | "MKT_NP" | "FCM_RETAIL" | "PS" | "MM" | "LM" | "BPM"
  outerPieceType: string    // "envelope" | "self_mailer" | "postcard" | etc.
  outerEnvelopeKind: string // "paper" | "plastic" | ""
  innerPieceCount: number   // number of pieces INSIDE the outer
  hasInhousePrinting: boolean
  hasFoldedPiece: boolean   // any piece with foldType !== "none"
}

export type InferredReason = string

export interface InferredItem {
  id: string
  reason: InferredReason
}

export function inferRequiredItems(ctx: JobContext): InferredItem[] {
  const items: InferredItem[] = []
  const isFlat = ctx.shape === "FLAT" || ctx.shape === "PARCEL"
  const isPresorted = ["FCM_COMM", "MKT_COMM", "MKT_NP"].includes(ctx.mailService)

  // 1. COMPUTER WORK -- always needed for presorted mail
  if (isPresorted) {
    items.push({ id: "computer-work", reason: "Presorted mail requires CASS processing" })
    if (ctx.quantity > 1000) {
      items.push({ id: "cass-2nd", reason: `${ctx.quantity.toLocaleString()} pcs exceeds 1,000 -- additional CASS needed` })
    }
  }

  // 2. ADDRESSING -- always needed, tier auto-selected
  const addrId = getAddressingTierId(ctx.quantity, isFlat)
  if (addrId) {
    items.push({ id: addrId, reason: "Every mailing needs addresses applied" })
  }

  // 3. POSTAGE -- match the selected mail class
  const postageMap: Record<string, string> = {
    FCM_COMM: "postage-1st",
    FCM_RETAIL: "postage-single",
    MKT_COMM: "postage-mkt",
    MKT_NP: "postage-np",
  }
  if (postageMap[ctx.mailService]) {
    items.push({ id: postageMap[ctx.mailService], reason: `Selected mail class requires postage` })
  }

  // 4. INSERTING -- needed if envelope/bag has inner pieces
  if (ctx.innerPieceCount > 0 && (ctx.outerPieceType === "envelope" || ctx.outerEnvelopeKind === "plastic")) {
    if (ctx.outerEnvelopeKind === "plastic") {
      items.push({ id: "insert-clear-bags", reason: "Plastic outer requires clear bag inserting" })
      items.push({ id: "clear-bags-item", reason: "Clear bags needed for plastic outer" })
    } else if (ctx.innerPieceCount <= 3) {
      items.push({ id: "insert-machine-3", reason: `${ctx.innerPieceCount} insert(s) going into envelope` })
    } else {
      items.push({ id: "insert-machine-3", reason: `${ctx.innerPieceCount} inserts -- base machine insert` })
      items.push({ id: "insert-machine-addl", reason: `${ctx.innerPieceCount - 3} additional inserts above 3` })
    }
  }

  // 5. CLEAR BAGS -- even if NO inner pieces, if outer is plastic
  if (ctx.outerEnvelopeKind === "plastic" && ctx.innerPieceCount === 0) {
    items.push({ id: "insert-clear-bags", reason: "Plastic outer requires clear bag inserting" })
    items.push({ id: "clear-bags-item", reason: "Clear bags needed for plastic outer" })
  }

  // 6. TABBING -- needed for self-mailers (no envelope, piece mails on its own)
  if (ctx.outerPieceType === "self_mailer") {
    items.push({ id: "tabbing", reason: "Self-mailers require tabs to stay closed" })
  }

  // 7. FOLDING -- needed if any piece is folded
  if (ctx.hasFoldedPiece) {
    items.push({ id: "folding", reason: "Folded piece(s) need mechanical or hand folding" })
  }

  // 8. PRINTING -- flag if in-house production
  if (ctx.hasInhousePrinting) {
    items.push({ id: "printing", reason: "In-house printing selected for this job" })
  }

  // 9. PERMIT -- only when using our permit WITHOUT computer work
  // When computer work is included (presorted mail), the permit is already bundled
  // This is only for jobs that use the permit standalone (e.g. stamp mailings needing the permit)
  // So we do NOT auto-detect it for presorted mail since computer work covers it

  return items
}

/** Format price unit for display */
export function formatPriceUnit(unit: PriceUnit): string {
  switch (unit) {
    case "1000": return "per 1,000"
    case "piece": return "per piece"
    case "stamp": return "per stamp"
    case "bag": return "per bag"
    case "name/mailing": return "per name"
    case "job": return "per job"
    case "list": return "per list"
    case "delivery": return "per delivery"
    case "hour": return "per hour"
    case "insert": return "per insert"
    case "payment": return "of payment"
    case "invoice": return "off invoice"
  }
}

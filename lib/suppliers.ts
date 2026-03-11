// ─── Supplier & Supply Item Types ──────────────────────

export interface Supplier {
  id: string
  name: string
  website?: string
  phone?: string
  contactName?: string
  email?: string
  notes?: string
}

export type SupplyCategory =
  | "plastic_envelope"
  | "paper_envelope"
  | "label"
  | "ink"
  | "paper_stock"
  | "binding"
  | "shipping_box"
  | "list_rental"
  | "other"

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  plastic_envelope: "Plastic Envelopes",
  paper_envelope: "Paper Envelopes",
  label: "Labels",
  ink: "Ink / Toner",
  paper_stock: "Paper Stock",
  binding: "Binding Supplies",
  shipping_box: "Shipping Boxes",
  list_rental: "List Rentals",
  other: "Other",
}

export interface SupplyItem {
  id: string
  supplierId: string
  sku: string
  name: string
  category: SupplyCategory
  costPerUnit: number        // what we pay
  markupPercent: number       // markup % on top of cost
  sellPrice: number           // auto-computed: cost * (1 + markup/100)
  // ── Envelope-specific ──
  fitsWidth?: number
  fitsHeight?: number
  actualWidth?: number
  actualHeight?: number
  linkedEnvelopeId?: string   // links to STANDARD_ENVELOPES id
  // ── List rental-specific ──
  nameCount?: number          // how many names/records in this list
  countUpdatedAt?: string | null  // ISO date when count was last updated
  fileUrl?: string | null     // Vercel Blob URL of uploaded list file
  filePassword?: string | null // password to open the file
  fileName?: string | null    // original file name
  billingMode?: "list_count" | "mailing_qty"  // how to bill: use list's count or mailing quantity
  // ── Catalog link ──
  linkedCatalogId?: string    // links to service-catalog item id (e.g. "list-rent-skver")
  notes?: string
}

export interface SuppliersConfig {
  suppliers: Supplier[]
  supplyItems: SupplyItem[]
}

/** Compute sell price from cost + markup */
export function computeSellPrice(cost: number, markupPercent: number): number {
  return Math.round(cost * (1 + markupPercent / 100) * 10000) / 10000
}

/** Default data */
export const DEFAULT_SUPPLIERS_CONFIG: SuppliersConfig = {
  suppliers: [
    {
      id: "clearplastics",
      name: "Clear Plastics",
      website: "https://clearplastics.com",
      phone: "",
      contactName: "",
      email: "",
      notes: "Plastic envelope supplier",
    },
    {
      id: "list-skver-sup",
      name: "Skver List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Skver mailing list supplier",
    },
    {
      id: "list-monsey-sup",
      name: "Monsey List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Monsey mailing list supplier",
    },
    {
      id: "list-bp-sup",
      name: "Boro Park List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Boro Park mailing list supplier",
    },
    {
      id: "list-willi-sup",
      name: "Williamsburg List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Williamsburg mailing list supplier",
    },
    {
      id: "list-kj-sup",
      name: "Kiryas Joel List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Kiryas Joel mailing list supplier",
    },
    {
      id: "list-si-sup",
      name: "Staten Island List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Staten Island mailing list supplier",
    },
    {
      id: "list-satmar-sup",
      name: "Satmar List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Satmar mailing list supplier",
    },
    {
      id: "list-linden-sup",
      name: "Linden List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Linden mailing list supplier",
    },
    {
      id: "list-lakewood-sup",
      name: "Lakewood List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Lakewood mailing list supplier",
    },
    {
      id: "list-simcha-sup",
      name: "Simcha List",
      phone: "",
      contactName: "",
      email: "",
      notes: "Shidduchim / Simcha list supplier",
    },
    {
      id: "box-supplier",
      name: "Shipping Boxes",
      phone: "",
      contactName: "",
      email: "",
      notes: "Shipping box inventory",
    },
  ],
  supplyItems: [
    // ── Shipping Boxes ──
    { id: "box-p3",    supplierId: "box-supplier", sku: "P3",    name: "P3 - 11.75 x 8.75 x 3",       category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-p6",    supplierId: "box-supplier", sku: "P6",    name: "P6 - 11.75 x 8.75 x 6",       category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-p9",    supplierId: "box-supplier", sku: "P9",    name: "P9 - 11.75 x 8.75 x 9",       category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-p12",   supplierId: "box-supplier", sku: "P12",   name: "P12 - 11.75 x 8.75 x 12 (NOT UPS)",  category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-d1",    supplierId: "box-supplier", sku: "D1",    name: "D1 - 12.5 x 9.5 x 13.5 (NOT UPS)",   category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-b30",   supplierId: "box-supplier", sku: "B30",   name: "B30 - 12 x 10 x 8",           category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-12104", supplierId: "box-supplier", sku: "12104", name: "12104 - 12 x 10 x 4",         category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-14-8",  supplierId: "box-supplier", sku: "14-8",  name: "14-8 - 14 x 10.5 x 8",        category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-14-4",  supplierId: "box-supplier", sku: "14-4",  name: "14-4 - 14 x 10.5 x 4",        category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-t176",  supplierId: "box-supplier", sku: "T-17-6", name: "T-17-6 - 17.25 x 11.25 x 6", category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-1710",  supplierId: "box-supplier", sku: "17-10", name: "17-10 - 17.25 x 11.25 x 10",  category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    { id: "box-t186",  supplierId: "box-supplier", sku: "T-18-6", name: "T-18-6 - 18.25 x 12.25 x 6", category: "shipping_box", costPerUnit: 0, markupPercent: 0, sellPrice: 0 },
    // ── Clear Plastics envelopes ──
    { id: "cp-b59",   supplierId: "clearplastics", sku: "B59",   name: "5.5 x 8.5 Clear Bag",  category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 5.5,  fitsHeight: 8.5,  actualWidth: 5.9375, actualHeight: 8.75,   linkedEnvelopeId: "p-5.5x8.5" },
    { id: "cp-b6x9",  supplierId: "clearplastics", sku: "B6x9",  name: "6 x 9 Clear Bag",      category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 6,    fitsHeight: 9,    actualWidth: 6.4375, actualHeight: 9,      linkedEnvelopeId: "p-6x9" },
    { id: "cp-bx411", supplierId: "clearplastics", sku: "BX411", name: "4 x 11 Clear Bag",     category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 4,    fitsHeight: 11,   actualWidth: 4.4375, actualHeight: 11.125, linkedEnvelopeId: "p-4x11" },
    { id: "cp-b811",  supplierId: "clearplastics", sku: "B811",  name: "8.5 x 11 Clear Bag",   category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 8.5,  fitsHeight: 11,   actualWidth: 8.9375, actualHeight: 11.25,  linkedEnvelopeId: "p-8.5x11" },
    { id: "cp-b8x8",  supplierId: "clearplastics", sku: "B8x8",  name: "8 x 8 Clear Bag",      category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 8,    fitsHeight: 8,    actualWidth: 8.4375, actualHeight: 8.25,   linkedEnvelopeId: "p-8x8" },
    { id: "cp-b99",   supplierId: "clearplastics", sku: "B99",   name: "9 x 9 Clear Bag",      category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 9,    fitsHeight: 9,    actualWidth: 9.4375, actualHeight: 9.25,   linkedEnvelopeId: "p-9x9" },
    // ── List Rentals ──
    { id: "lr-skver",     supplierId: "list-skver-sup",     sku: "",  name: "Skver",          category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-skver" },
    { id: "lr-monsey",    supplierId: "list-monsey-sup",    sku: "",  name: "Monsey",         category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-monsey" },
    { id: "lr-bp",        supplierId: "list-bp-sup",        sku: "",  name: "Boro Park",      category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-bp" },
    { id: "lr-willi",     supplierId: "list-willi-sup",     sku: "",  name: "Williamsburg",   category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-willi" },
    { id: "lr-kj",        supplierId: "list-kj-sup",        sku: "",  name: "Kiryas Joel",    category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-kj" },
    { id: "lr-si",        supplierId: "list-si-sup",        sku: "",  name: "Staten Island",  category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-si" },
    { id: "lr-satmar",    supplierId: "list-satmar-sup",    sku: "",  name: "Satmar",         category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-satmar" },
    { id: "lr-linden",    supplierId: "list-linden-sup",    sku: "",  name: "Linden",         category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-linden" },
    { id: "lr-lakewood",  supplierId: "list-lakewood-sup",  sku: "",  name: "Lakewood",       category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-lakewood" },
    { id: "lr-simcha",    supplierId: "list-simcha-sup",    sku: "",  name: "Simcha List",    category: "list_rental", costPerUnit: 0, markupPercent: 0, sellPrice: 0, nameCount: 0, countUpdatedAt: null, fileUrl: null, filePassword: null, fileName: null, linkedCatalogId: "list-rent-simcha" },
  ],
}

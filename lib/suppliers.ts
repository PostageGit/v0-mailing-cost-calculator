// ─── Supplier & Supply Item Types ──────────────────────

export interface Supplier {
  id: string
  name: string
  website?: string
  notes?: string
}

export type SupplyCategory = "plastic_envelope" | "paper_envelope" | "label" | "ink" | "paper_stock" | "binding" | "other"

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  plastic_envelope: "Plastic Envelopes",
  paper_envelope: "Paper Envelopes",
  label: "Labels",
  ink: "Ink / Toner",
  paper_stock: "Paper Stock",
  binding: "Binding Supplies",
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
  fitsWidth?: number          // for envelopes: what fits inside
  fitsHeight?: number
  actualWidth?: number        // actual outer dims
  actualHeight?: number
  linkedEnvelopeId?: string   // links to STANDARD_ENVELOPES id
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

/** Default data -- Clear Plastics with their 6 envelope sizes */
export const DEFAULT_SUPPLIERS_CONFIG: SuppliersConfig = {
  suppliers: [
    {
      id: "clearplastics",
      name: "Clear Plastics",
      website: "https://clearplastics.com",
      notes: "Plastic envelope supplier",
    },
  ],
  supplyItems: [
    { id: "cp-b59",   supplierId: "clearplastics", sku: "B59",   name: '5.5 x 8.5 Clear Bag',  category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 5.5,  fitsHeight: 8.5,  actualWidth: 5.9375, actualHeight: 8.75,   linkedEnvelopeId: "p-5.5x8.5" },
    { id: "cp-b6x9",  supplierId: "clearplastics", sku: "B6x9",  name: '6 x 9 Clear Bag',      category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 6,    fitsHeight: 9,    actualWidth: 6.4375, actualHeight: 9,      linkedEnvelopeId: "p-6x9" },
    { id: "cp-bx411", supplierId: "clearplastics", sku: "BX411", name: '4 x 11 Clear Bag',     category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 4,    fitsHeight: 11,   actualWidth: 4.4375, actualHeight: 11.125, linkedEnvelopeId: "p-4x11" },
    { id: "cp-b811",  supplierId: "clearplastics", sku: "B811",  name: '8.5 x 11 Clear Bag',   category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 8.5,  fitsHeight: 11,   actualWidth: 8.9375, actualHeight: 11.25,  linkedEnvelopeId: "p-8.5x11" },
    { id: "cp-b8x8",  supplierId: "clearplastics", sku: "B8x8",  name: '8 x 8 Clear Bag',      category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 8,    fitsHeight: 8,    actualWidth: 8.4375, actualHeight: 8.25,   linkedEnvelopeId: "p-8x8" },
    { id: "cp-b99",   supplierId: "clearplastics", sku: "B99",   name: '9 x 9 Clear Bag',      category: "plastic_envelope", costPerUnit: 0, markupPercent: 0, sellPrice: 0, fitsWidth: 9,    fitsHeight: 9,    actualWidth: 9.4375, actualHeight: 9.25,   linkedEnvelopeId: "p-9x9" },
  ],
}

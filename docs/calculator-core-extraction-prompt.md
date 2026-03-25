# Prompt: Extract Calculator Core Library

## Project Goal

I need you to extract all the business logic, calculation engines, and data from an existing mailing/printing cost calculator app and create a standalone JavaScript/TypeScript library that can be published as an npm package.

The source code is in a GitHub repository: **PostageGit/v0-mailing-cost-calculator**

---

## Source Files to Extract From

The following files contain ALL the pricing logic, calculation engines, product data, and inventory that need to be extracted:

### Core Pricing/Calculation Files:
```
lib/pricing.ts                    - Mailing cost calculator (addressing, computer work, CASS, inserting, postage)
lib/usps-rates.ts                 - USPS postage rate tables (FCM, Marketing Mail, Nonprofit, Parcels, BPM)
lib/printing-pricing.ts           - Flat printing calculator (paper costs, click costs, markups, layout, cuts)
lib/printing-types.ts             - TypeScript types for printing calculator
lib/booklet-pricing.ts            - Saddle-stitch booklet calculator (cover, inside pages, binding, lamination)
lib/booklet-types.ts              - TypeScript types for booklet calculator
lib/envelope-pricing.ts           - Envelope printing calculator (stock, inkjet/laser, bleed fees)
lib/lamination-pricing.ts         - Lamination cost calculator
lib/pad-pricing.ts                - Notepad/pad calculator
lib/pad-types.ts                  - Types for pad calculator
lib/spiral-pricing.ts             - Spiral binding calculator
lib/spiral-types.ts               - Types for spiral calculator  
lib/perfect-pricing.ts            - Perfect binding calculator
lib/perfect-types.ts              - Types for perfect binding
lib/pricing-config.ts             - Shared pricing configuration (click costs, paper prices, markups, finishing options, score/fold config)
lib/finishing-fold-engine.ts      - Folding/scoring cost engine
lib/finishing-fold-data.ts        - Folding/scoring rate data tables
```

### Product/Inventory Data Files:
```
lib/suppliers.ts                  - Supplier database, supply items (plastic envelopes, list rentals, shipping boxes)
lib/service-catalog.ts            - Service catalog with all available services and pricing
lib/shipping-boxes.ts             - Shipping box inventory and dimensions
lib/paper-weights.ts              - Paper weight reference data
lib/company.ts                    - Company info constants
```

### Type Definition Files:
```
lib/quote-types.ts                - Quote/Job types
lib/customer-types.ts             - Customer types
lib/vendor-types.ts               - Vendor types
lib/finishing-calculator-types.ts - Finishing calculator types
```

### Utility Files:
```
lib/utils.ts                      - Shared utility functions (formatCurrency, cn, etc.)
```

---

## Required Output Structure

Create a new folder called `calculator-core/` with this structure:

```
calculator-core/
├── package.json                  # npm package config (@postagegit/calculator-core)
├── tsconfig.json                 # TypeScript config
├── index.ts                      # Main entry - exports everything
│
├── src/
│   ├── mailing/
│   │   ├── calculator.ts         # calculateCosts() from pricing.ts
│   │   └── types.ts              # MailPiece, MailingClass, MailingInputs, CostBreakdown
│   │
│   ├── usps/
│   │   ├── calculator.ts         # calculateUSPSPostage(), calculateTab2Postage() from usps-rates.ts
│   │   ├── rates.ts              # Rate tables (R object, PS_TBL, BPM tables)
│   │   └── types.ts              # USPSServiceType, USPSShape, USPSInputs, USPSResult, etc.
│   │
│   ├── printing/
│   │   ├── calculator.ts         # calculatePrintingCost(), calculateAllSheetOptions(), buildFullResult()
│   │   ├── products.ts           # PAPER_OPTIONS, PAPER_PRICES, CLICK_COSTS, SIDES_RULES
│   │   ├── layout.ts             # calculateLayout(), calculateCuts(), parseSheetSize()
│   │   └── types.ts              # PaperOption, PrintingInputs, PrintingCalcResult, etc.
│   │
│   ├── booklet/
│   │   ├── calculator.ts         # calculateBooklet() from booklet-pricing.ts
│   │   ├── products.ts           # BOOKLET_PAPER_OPTIONS, BOOKLET_PAPER_PRICES
│   │   └── types.ts              # BookletInputs, BookletCalcResult, PartCalcResult
│   │
│   ├── envelope/
│   │   ├── calculator.ts         # calculateEnvelope() from envelope-pricing.ts
│   │   ├── products.ts           # DEFAULT_ENVELOPE_SETTINGS (items, inkjet/laser rates, fees)
│   │   └── types.ts              # EnvelopeInputs, EnvelopeCalcResult, EnvelopeSettings
│   │
│   ├── finishing/
│   │   ├── lamination.ts         # calculateLamination() from lamination-pricing.ts
│   │   ├── fold-score.ts         # Fold/score engine from finishing-fold-engine.ts
│   │   ├── fold-data.ts          # Fold rate tables from finishing-fold-data.ts
│   │   └── types.ts              # FinishingOption, LaminationInputs, FoldSettings
│   │
│   ├── binding/
│   │   ├── spiral.ts             # calculateSpiral() from spiral-pricing.ts
│   │   ├── perfect.ts            # calculatePerfect() from perfect-pricing.ts
│   │   ├── pad.ts                # calculatePad() from pad-pricing.ts
│   │   └── types.ts              # SpiralInputs, PerfectInputs, PadInputs, etc.
│   │
│   ├── inventory/
│   │   ├── suppliers.ts          # Supplier[], SupplyItem[], DEFAULT_SUPPLIERS_CONFIG
│   │   ├── service-catalog.ts    # Service catalog items and categories
│   │   ├── shipping-boxes.ts     # Shipping box inventory
│   │   └── types.ts              # Supplier, SupplyItem, SupplyCategory types
│   │
│   ├── config/
│   │   ├── pricing-config.ts     # DEFAULT_CLICK_COSTS, DEFAULT_PAPER_PRICES, DEFAULT_MARKUPS, etc.
│   │   ├── addressing.ts         # DEFAULT_ADDRESSING_CONFIG, DEFAULT_TABBING_CONFIG
│   │   └── company.ts            # Company constants (name, address, etc.)
│   │
│   └── shared/
│       ├── utils.ts              # formatCurrency(), formatNumber(), roundUp(), etc.
│       ├── paper-weights.ts      # Paper weight lookup/calculation
│       └── types.ts              # Shared types used across calculators
```

---

## Critical Requirements

### 1. NO React, NO UI Components
Pure TypeScript/JavaScript functions and data only. Remove ALL:
- React imports (`import React`, `useState`, `useEffect`, etc.)
- Component code (`export function ComponentName()`)
- JSX/TSX
- UI libraries (shadcn, radix, lucide-react)
- Styling (Tailwind classes, CSS)
- Hooks (`useSWR`, `useCallback`, etc.)

### 2. Named Exports Only
Every function and data constant must be a named export:
```typescript
export function calculatePrintingCost(...) { }
export const PAPER_PRICES = { ... }
export interface PrintingInputs { ... }
```

### 3. Self-Contained
The library should have ZERO external dependencies except:
- TypeScript (for types)
- Any pure math/utility libraries if absolutely needed

### 4. Preserve ALL Business Logic
Extract the EXACT calculation formulas, rate tables, and pricing constants. Do not simplify or modify the math.

### 5. Include ALL Data Tables
Extract every pricing table, rate matrix, product list, and configuration object exactly as they exist.

### 6. package.json Setup
```json
{
  "name": "@postagegit/calculator-core",
  "version": "1.0.0",
  "description": "Mailing and printing cost calculation engine",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./mailing": "./dist/src/mailing/index.js",
    "./usps": "./dist/src/usps/index.js",
    "./printing": "./dist/src/printing/index.js",
    "./booklet": "./dist/src/booklet/index.js",
    "./envelope": "./dist/src/envelope/index.js",
    "./finishing": "./dist/src/finishing/index.js",
    "./binding": "./dist/src/binding/index.js",
    "./inventory": "./dist/src/inventory/index.js",
    "./config": "./dist/src/config/index.js"
  },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

---

## Usage Example (for reference)

After extraction, the library should work like this:

```typescript
import { calculatePrintingCost, PAPER_OPTIONS } from '@postagegit/calculator-core/printing'
import { calculateUSPSPostage } from '@postagegit/calculator-core/usps'
import { calculateBooklet } from '@postagegit/calculator-core/booklet'
import { DEFAULT_SUPPLIERS_CONFIG } from '@postagegit/calculator-core/inventory'

// Calculate printing cost
const printResult = calculatePrintingCost({
  qty: 1000,
  width: 8.5,
  height: 11,
  paperName: "80lb Text Gloss",
  sidesValue: "4/4",
  hasBleed: true,
}, "11x17")

// Calculate USPS postage
const uspsResult = calculateUSPSPostage({
  service: "MKT_COMM",
  shape: "LETTER",
  quantity: 5000,
  weight: 1.5,
  tierIndex: 2,
  entry: "ORIGIN",
  mailType: "AUTO",
})

// Calculate booklet
const bookletResult = calculateBooklet({
  qty: 500,
  finishedWidth: 5.5,
  finishedHeight: 8.5,
  coverPaper: "100lb Cover Gloss",
  insidePaper: "80lb Text Gloss",
  pageCount: 16,
  coverSides: "4/4",
  insideSides: "4/4",
})
```

---

## Do NOT Modify

- Do NOT modify the original calculator app files
- Do NOT change the calculation logic or formulas
- Do NOT remove any pricing tiers, rate tables, or configuration options

---

## Summary

This extraction will create a reusable npm package (`@postagegit/calculator-core`) containing:

| Module | Purpose |
|--------|---------|
| `mailing` | Address processing, CASS, inserting, tabbing costs |
| `usps` | All USPS postage rate calculations (FCM, Marketing, Nonprofit, Parcels, BPM) |
| `printing` | Flat sheet printing with paper/click costs, layout optimization |
| `booklet` | Saddle-stitch booklet pricing (cover + inside pages) |
| `envelope` | Envelope printing (inkjet/laser, stock costs) |
| `finishing` | Lamination, folding, scoring |
| `binding` | Spiral, perfect binding, notepads |
| `inventory` | Suppliers, supply items, shipping boxes |
| `config` | All pricing configuration and company constants |

Once published, any Vercel app can import this package and use the exact same calculation logic with a single source of truth.

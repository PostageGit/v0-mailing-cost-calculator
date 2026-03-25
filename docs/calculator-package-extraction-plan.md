# Calculator Package Extraction Plan

> **IMPORTANT**: This document is for PLANNING ONLY. 
> Do NOT modify any files in this project based on this document.
> When ready, create a NEW project/repo for the calculator package.

## Overview

Goal: Create a standalone GitHub package (`@postagegit/calculator-core`) containing all calculation logic, rate tables, and validation rules that can be imported by multiple apps.

---

## Files to Extract (Complete Inventory)

### 1. PRINTING (Flat Prints)

**Source Files:**
- `lib/printing-pricing.ts` - Main calculation engine
- `lib/printing-types.ts` - TypeScript types

**Key Functions:**
- `calculatePrintingCost()` - Main calculation
- `calculateAllSheetOptions()` - Multi-sheet comparison
- `buildFullResult()` - Complete breakdown
- `calculateLayout()` - Sheet layout logic
- `calculateCuts()` - Cut calculations
- `parseSheetSize()` - Sheet parsing

**Key Constants:**
- `PAPER_OPTIONS` - Available papers
- `PAPER_PRICES` - Price per sheet by paper
- `CLICK_COSTS` - Per-click costs
- `SIDES_RULES` - Sides pricing rules
- `LAYOUT_RULES` - Layout constraints

**Unique Rules:**
- Parent sheet fitting algorithm
- Bleed margin calculations (0.125" per side)
- Minimum charge logic
- Broker vs regular pricing
- Multi-quantity comparison

---

### 2. BOOKLET (Saddle Stitch)

**Source Files:**
- `lib/booklet-pricing.ts` - Main calculation engine
- `lib/booklet-types.ts` - TypeScript types

**Key Functions:**
- `calculateBooklet()` - Main calculation
- Cover and inside page calculations
- Binding cost calculations

**Key Constants:**
- `BOOKLET_PAPER_OPTIONS`
- `BOOKLET_PAPER_PRICES`
- Binding rates by page count

**Unique Rules:**
- Page count must be multiple of 4
- Signature calculations
- Cover vs inside separate pricing
- Self-cover option
- Lamination options

---

### 3. PERFECT BINDING

**Source Files:**
- `lib/perfect-pricing.ts` - Main calculation engine
- `lib/perfect-types.ts` - TypeScript types

**Key Functions:**
- `calculatePerfect()` - Main calculation
- Spine width calculation
- Cover wrap calculation

**Unique Rules:**
- Minimum page count requirements
- Spine width based on page count and paper weight
- Cover wrap requirements
- Glue binding costs

---

### 4. SPIRAL/COIL BINDING

**Source Files:**
- `lib/spiral-pricing.ts` - Main calculation engine
- `lib/spiral-types.ts` - TypeScript types

**Key Functions:**
- `calculateSpiral()` - Main calculation
- Coil size selection
- Hole punch calculations

**Unique Rules:**
- Coil diameter based on page count
- Front/back cover options
- Tab options
- Hole punch patterns

---

### 5. NOTEPADS

**Source Files:**
- `lib/pad-pricing.ts` - Main calculation engine
- `lib/pad-types.ts` - TypeScript types

**Key Functions:**
- `calculatePad()` - Main calculation

**Unique Rules:**
- Sheets per pad
- Chipboard backing options
- Padding compound costs
- Quantity discounts

---

### 6. ENVELOPES

**Source Files:**
- `lib/envelope-pricing.ts` - Main calculation engine

**Key Functions:**
- `calculateEnvelope()` - Main calculation

**Key Constants:**
- `DEFAULT_ENVELOPE_SETTINGS` - Envelope types, sizes, base prices
- Inkjet vs laser rates
- Bleed fees

**Unique Rules:**
- Envelope size constraints
- Print method (inkjet vs laser)
- Bleed printing fees
- Stock envelope pricing

---

### 7. USPS POSTAGE

**Source Files:**
- `lib/usps-rates.ts` - Complete USPS rate tables (626 lines!)

**Key Functions:**
- `calculateUSPSPostage()` - Main Tab 1 calculation
- `calculateTab2Postage()` - Tab 2 (parcels) calculation
- Rate lookup functions

**Key Constants (CRITICAL - these are the official USPS rates):**
- `R` object - All rate tables:
  - First Class Mail rates
  - Marketing Mail rates (Commercial, Nonprofit)
  - Nonprofit rates
  - Parcel rates
  - Bound Printed Matter rates
  - Media Mail rates
- `PS_TBL` - Presort tier tables
- Weight break tables
- Entry point discounts (DNDC, DSCF, DDU)

**Unique Rules:**
- Weight breaks and tiers
- Presort levels (5-digit, AADC, Mixed AADC, etc.)
- Entry point discounts
- Shape-based pricing (Letter, Flat, Parcel)
- Nonprofit qualification
- Automation vs non-automation

---

### 8. MAILING/LABOR

**Source Files:**
- `lib/pricing.ts` - Mailing cost calculations

**Key Functions:**
- `calculateCosts()` - Main calculation

**Key Constants:**
- Addressing rates
- CASS/NCOA rates
- Inserting rates
- Computer work rates
- Tabbing rates

**Unique Rules:**
- Per-piece vs flat rate items
- Minimum charges
- Mail class specific labor items

---

### 9. FINISHING

**Source Files:**
- `lib/finishing-fold-engine.ts` - Fold/score calculation engine
- `lib/finishing-fold-data.ts` - Fold rate tables
- `lib/lamination-pricing.ts` - Lamination calculations

**Key Functions:**
- Folding cost calculations
- Scoring cost calculations
- Lamination cost calculations

**Key Constants:**
- Fold types and rates
- Score rates
- Lamination rates by size

---

### 10. SHARED CONFIG

**Source Files:**
- `lib/pricing-config.ts` - Master configuration (859 lines!)

**Key Constants:**
- `DEFAULT_CLICK_COSTS` - Per-click costs by color/sides
- `DEFAULT_PAPER_PRICES` - Paper cost per sheet
- `DEFAULT_MARKUPS` - Markup percentages by tier
- `DEFAULT_FINISHING_OPTIONS` - All finishing options
- `DEFAULT_ADDRESSING_CONFIG` - Addressing rates
- `DEFAULT_TABBING_CONFIG` - Tabbing rates
- Size presets and constraints

---

### 11. TYPES

**Source Files:**
- `lib/printing-types.ts`
- `lib/booklet-types.ts`
- `lib/perfect-types.ts`
- `lib/spiral-types.ts`
- `lib/pad-types.ts`
- `lib/finishing-calculator-types.ts`

---

### 12. UTILITIES

**Source Files:**
- `lib/utils.ts` - Shared utilities

**Key Functions:**
- `formatCurrency()` - Currency formatting
- `formatNumber()` - Number formatting
- `roundUp()` - Rounding utilities
- `cn()` - Class name utility (may not need in core)

---

## Package Structure (Target)

```
@postagegit/calculator-core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Main exports
│   │
│   ├── printing/
│   │   ├── calculator.ts        # calculatePrintingCost, etc.
│   │   ├── constants.ts         # PAPER_OPTIONS, CLICK_COSTS, etc.
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── booklet/
│   │   ├── calculator.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── perfect/
│   │   ├── calculator.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── spiral/
│   │   ├── calculator.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── pad/
│   │   ├── calculator.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── envelope/
│   │   ├── calculator.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── usps/
│   │   ├── calculator.ts        # calculateUSPSPostage, calculateTab2Postage
│   │   ├── rates.ts             # ALL rate tables (R object, PS_TBL, etc.)
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── mailing/
│   │   ├── calculator.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── finishing/
│   │   ├── lamination.ts
│   │   ├── folding.ts
│   │   ├── fold-data.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── config/
│   │   ├── defaults.ts          # All default rates, markups, etc.
│   │   └── index.ts
│   │
│   └── utils/
│       ├── formatting.ts        # formatCurrency, formatNumber
│       ├── math.ts              # roundUp, etc.
│       └── index.ts
```

---

## Usage Example (After Package is Created)

```typescript
// In any app that needs calculations:
import { 
  calculatePrintingCost,
  calculateBooklet,
  calculateUSPSPostage,
  DEFAULT_PAPER_PRICES,
  DEFAULT_CLICK_COSTS
} from '@postagegit/calculator-core'

// Use with defaults
const printResult = calculatePrintingCost({
  qty: 1000,
  width: 8.5,
  height: 11,
  paperName: "80lb Text Gloss",
  sides: "4/4",
  hasBleed: true
})

// Or override with custom rates from your database
const printResult = calculatePrintingCost({
  qty: 1000,
  width: 8.5,
  height: 11,
  paperName: "80lb Text Gloss",
  sides: "4/4",
  hasBleed: true
}, {
  clickCosts: myDatabaseClickCosts,
  paperPrices: myDatabasePaperPrices,
  markups: myDatabaseMarkups
})
```

---

## Next Steps (When Ready)

1. **Create new v0 project** - Start fresh, don't modify this project
2. **Connect to new GitHub repo** - `postagegit/calculator-core`
3. **Copy this document** to the new project as reference
4. **Extract one calculator at a time** - Start with Printing
5. **Test thoroughly** before moving to next
6. **Once all extracted** - Update this project to import from package

---

## Version Strategy

- **v1.0.0** - Initial release with all calculators
- Update USPS rates annually (January rate changes)
- Semantic versioning for any calculation changes
- Apps pin to specific versions for stability

---

## DO NOT

- Modify any existing files in this project
- Change any calculation logic during extraction
- Remove any options or features
- Simplify any business rules

## DO

- Copy logic exactly as-is
- Keep all constants and rate tables
- Preserve all validation rules
- Document any assumptions

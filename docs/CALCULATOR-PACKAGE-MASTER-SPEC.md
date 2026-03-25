# CALCULATOR PACKAGE - MASTER EXTRACTION SPECIFICATION

## PURPOSE
This is the CENTRAL calculator package that ALL future printing/mailing programs will connect to.
Every file listed here MUST be extracted EXACTLY as-is. NO modifications to calculation logic.

## SOURCE REPOSITORY
GitHub: `PostageGit/v0-mailing-cost-calculator`
Branch: `main`

---

## PART 1: CORE CALCULATION LOGIC (lib/)

These files contain ALL the math. DO NOT MODIFY ANY FORMULAS.

### PRINTING CALCULATOR
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/printing-pricing.ts` | Main printing calculations | `calculatePrintingCost()`, `findBestSheet()`, `calculateLayout()`, `getLevel()`, `calculateCuts()`, `computeFullPrintingResult()` |
| `lib/printing-types.ts` | TypeScript interfaces | `PrintingInputs`, `PrintingCalcResult`, `FullPrintingResult`, `LayoutResult`, `CutsResult`, `SheetOptionRow` |
| `lib/pricing-config.ts` | ALL rate tables | `LEVEL_THRESHOLDS` (10 levels), `MARKUP_BY_LEVEL` (BW/ColorPaper/ColorCard), `CLICK_COSTS`, `SHEET_SIZES`, `PAPER_PRICES`, `CUTTING_RATES`, `MINIMUM_CHARGES` |
| `lib/pricing.ts` | Utilities | `formatCurrency()` |

### BOOKLET CALCULATOR (Saddle Stitch)
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/booklet-pricing.ts` | Booklet calculations | `calculateBookletCost()`, `getBookletSheetCount()`, `calculateSignatures()` |
| `lib/booklet-types.ts` | TypeScript interfaces | `BookletInputs`, `BookletCalcResult` |

### PERFECT BINDING CALCULATOR
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/perfect-pricing.ts` | Perfect bind calculations | `calculatePerfectCost()`, `calculateSpineWidth()`, `getCoverSheetSize()` |
| `lib/perfect-types.ts` | TypeScript interfaces | `PerfectInputs`, `PerfectCalcResult` |

### SPIRAL BINDING CALCULATOR
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/spiral-pricing.ts` | Spiral/coil calculations | `calculateSpiralCost()`, `getCoilSize()`, `calculatePunching()` |
| `lib/spiral-types.ts` | TypeScript interfaces | `SpiralInputs`, `SpiralCalcResult` |

### PAD CALCULATOR
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/pad-pricing.ts` | Notepad calculations | `calculatePadCost()`, `getPaddingCost()` |
| `lib/pad-types.ts` | TypeScript interfaces | `PadInputs`, `PadCalcResult` |

### ENVELOPE CALCULATOR
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/envelope-pricing.ts` | Envelope printing | `calculateEnvelopeCost()`, `ENVELOPE_SIZES`, `ENVELOPE_PRICES` |

### USPS POSTAGE CALCULATOR
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/usps-rates.ts` | ALL USPS rate tables | `USPS_LETTER_RATES`, `USPS_FLAT_RATES`, `USPS_PARCEL_RATES`, `calculatePostage()`, `getMailClass()` |

### FINISHING OPTIONS
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/finishing-fold-engine.ts` | Fold/score calculations | `calculateFoldCost()`, `calculateScoreCost()`, `mapPaperToFoldKey()`, `mapFoldTypeToDataKey()`, `DEFAULT_FOLD_SETTINGS` |
| `lib/finishing-fold-data.ts` | Fold rate tables | All fold type rates by paper weight |
| `lib/finishing-calculator-types.ts` | Finishing types | `FinishingCalculator`, `FinishingOption`, `calculateFinishingTotal()` |
| `lib/lamination-pricing.ts` | Lamination calculations | `calculateLaminationCost()`, `getLaminationTypes()`, `LAMINATION_DEFAULTS`, `toLaminationPaperCategory()` |

### PAPER & WEIGHTS
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/paper-weights.ts` | Paper weight calculations | `calcSheetWeightOz()`, `formatWeight()`, `PAPER_WEIGHT_TABLE` |
| `lib/use-papers.ts` | Paper data hooks | `useFlatPrintingPapers()`, `usePapers()`, `papersToOptions()` |

### UTILITIES
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/utils.ts` | Helper functions | `cn()` (className merger) |
| `lib/use-pricing-config.ts` | Config hooks | `usePricingConfig()` |

### MAILING/LABOR
| File | Purpose | Critical Functions/Constants |
|------|---------|------------------------------|
| `lib/service-catalog.ts` | Service definitions | Service types and pricing |

---

## PART 2: UI COMPONENTS (components/)

### PRINTING CALCULATOR UI
| File | Purpose | Key Features |
|------|---------|--------------|
| `components/printing/printing-calculator.tsx` | MAIN COMPONENT | Level slider (1-10), sheet selection, SVG viz, price display, multi-qty compare, finishing toggles, lamination, lots |
| `components/printing/printing-form.tsx` | INPUT FORM | Qty input, W/H inputs, paper dropdown, sides selector, bleed checkbox, lamination panel, lots panel, finishing toggles |
| `components/printing/sheet-layout-svg.tsx` | SVG VISUALIZATION | Visual layout of pieces on sheet, cut lines, bleed margins, grip edge, rotation indicator |
| `components/printing/sheet-options-table.tsx` | SHEET OPTIONS | Table showing all sheet sizes with: ups, sheets needed, price, best fit highlight |
| `components/printing/price-breakdown.tsx` | PRICE BREAKDOWN | Collapsible breakdown: printing, cutting, finishing, lamination, add-ons, subtotal, grand total |
| `components/printing/multi-qty-comparison-table.tsx` | MULTI-QTY | Side-by-side quantity comparison with expandable details |
| `components/printing/fold-finish-section.tsx` | FOLD/FINISH | Score and fold type selectors, orientation toggle |

### BOOKLET CALCULATOR UI
| File | Purpose |
|------|---------|
| `components/booklet/booklet-calculator.tsx` | Main booklet calculator |
| `components/booklet/booklet-form.tsx` | Booklet input form |

### PERFECT BINDING UI
| File | Purpose |
|------|---------|
| `components/perfect/perfect-calculator.tsx` | Main perfect bind calculator |
| `components/perfect/perfect-form.tsx` | Perfect bind input form |

### SPIRAL BINDING UI
| File | Purpose |
|------|---------|
| `components/spiral/spiral-calculator.tsx` | Main spiral calculator |
| `components/spiral/spiral-form.tsx` | Spiral input form |

### PAD CALCULATOR UI
| File | Purpose |
|------|---------|
| `components/pad/pad-calculator.tsx` | Main pad calculator |
| `components/pad/pad-form.tsx` | Pad input form |

### ENVELOPE CALCULATOR UI
| File | Purpose |
|------|---------|
| `components/envelope-tab.tsx` | Envelope calculator |

### USPS POSTAGE UI
| File | Purpose |
|------|---------|
| `components/usps-postage-calculator.tsx` | USPS postage calculator with all mail classes |

### MAILING/LABOR UI
| File | Purpose |
|------|---------|
| `components/mailing-calculator.tsx` | Mailing job calculator |
| `components/labor-calculator.tsx` | Labor cost calculator |

### SHARED COMPONENTS
| File | Purpose |
|------|---------|
| `components/calc-price-card.tsx` | Reusable price display card with CalcPriceCard, CostLine, PaperStat |
| `components/finishing-add-ons.tsx` | Finishing add-ons selector, computeFinishingCalcTotals() |
| `components/qty-comparison-table.tsx` | Generic multi-qty comparison table |

---

## PART 3: UI COMPONENT LIBRARY (components/ui/)

These are shadcn/ui components. Copy ALL of them:

```
components/ui/accordion.tsx
components/ui/alert-dialog.tsx
components/ui/alert.tsx
components/ui/aspect-ratio.tsx
components/ui/avatar.tsx
components/ui/badge.tsx
components/ui/breadcrumb.tsx
components/ui/button.tsx
components/ui/calendar.tsx
components/ui/card.tsx
components/ui/carousel.tsx
components/ui/chart.tsx
components/ui/checkbox.tsx
components/ui/collapsible.tsx
components/ui/command.tsx
components/ui/context-menu.tsx
components/ui/dialog.tsx
components/ui/drawer.tsx
components/ui/dropdown-menu.tsx
components/ui/form.tsx
components/ui/hover-card.tsx
components/ui/input-otp.tsx
components/ui/input.tsx
components/ui/label.tsx
components/ui/menubar.tsx
components/ui/navigation-menu.tsx
components/ui/pagination.tsx
components/ui/popover.tsx
components/ui/progress.tsx
components/ui/radio-group.tsx
components/ui/resizable.tsx
components/ui/scroll-area.tsx
components/ui/select.tsx
components/ui/separator.tsx
components/ui/sheet.tsx
components/ui/sidebar.tsx
components/ui/skeleton.tsx
components/ui/slider.tsx
components/ui/sonner.tsx
components/ui/switch.tsx
components/ui/table.tsx
components/ui/tabs.tsx
components/ui/textarea.tsx
components/ui/toast.tsx
components/ui/toaster.tsx
components/ui/toggle-group.tsx
components/ui/toggle.tsx
components/ui/tooltip.tsx
components/ui/use-mobile.tsx
components/ui/use-toast.ts
```

---

## PART 4: HOOKS

```
hooks/use-form-validation.ts
hooks/use-mobile.tsx
hooks/use-toast.ts
```

---

## PART 5: STYLING

| File | Purpose |
|------|---------|
| `app/globals.css` | CSS variables, base styles, dark mode |
| `tailwind.config.ts` | Tailwind configuration with custom colors |

---

## PART 6: CRITICAL BUSINESS RULES

### Printing Calculator Rules
1. **10 Pricing Levels** based on SHEET COUNT (not quantity):
   - Level 1: 1+ sheets
   - Level 2: 10+ sheets
   - Level 3: 100+ sheets
   - Level 4: 250+ sheets
   - Level 5: 1000+ sheets
   - Level 6: 2000+ sheets
   - Level 7: 3500+ sheets
   - Level 8: 5000+ sheets
   - Level 9: 100000+ sheets
   - Level 10: 1000000+ sheets (broker level)

2. **Three Markup Categories**:
   - BW (black & white on text paper)
   - Color Paper (color on text paper)
   - Color Card (color on cardstock)

3. **Sides/Click Calculations**:
   - S/S = 1 BW click
   - D/S = 2 BW clicks
   - 4/0 = 1 Color click
   - 4/4 = 2 Color clicks
   - 1/0 = 0.25 Color click
   - 1/1 = 0.5 Color click

4. **Bleed Margins**:
   - Bleed margin: 0.25" (each side)
   - Gutter: 0.2" (between pieces)
   - Grip edge: 0.5" (one side only)

5. **Sheet Sizes** (in inches):
   - 8.5 x 11
   - 11 x 17
   - 12 x 18
   - 12.5 x 19
   - 13 x 19
   - 13 x 26

6. **Best Fit Logic**: Auto-select sheet size with lowest total cost (printing + cutting)

7. **Cutting Calculation**: 
   - Cuts = (cols - 1) + (rows - 1) + trim cuts
   - Stacks = sheets / 500
   - Cost = cuts × stacks × rate per cut

8. **Minimums**:
   - Printing minimum
   - Cutting minimum

### Booklet Rules
- Page count must be multiple of 4
- Self-cover or plus-cover options
- Saddle stitch binding

### Perfect Binding Rules
- Page count must be multiple of 2
- Minimum page count for binding
- Spine width calculation based on page count and paper thickness

### Spiral Binding Rules
- Any page count
- Coil size based on thickness
- Front/back cover options

---

## PART 7: WHAT TO REMOVE FOR STANDALONE

Remove these dependencies (they're app-specific, not calculator-specific):

1. `useQuote()` context - Remove "Add to Quote" buttons
2. `useMailing()` context - Remove mailing job integration
3. `useGlobalChat()` context - Remove "Chat Check" button
4. `ShippingCalcButton` component - Remove shipping integration
5. Database fetching - Use embedded defaults or props

---

## PART 8: PACKAGE STRUCTURE

```
@postagegit/calculator-core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Main exports
│   │
│   ├── lib/                        # ALL files from lib/
│   │   ├── printing-pricing.ts
│   │   ├── printing-types.ts
│   │   ├── pricing-config.ts
│   │   ├── booklet-pricing.ts
│   │   ├── booklet-types.ts
│   │   ├── perfect-pricing.ts
│   │   ├── perfect-types.ts
│   │   ├── spiral-pricing.ts
│   │   ├── spiral-types.ts
│   │   ├── pad-pricing.ts
│   │   ├── pad-types.ts
│   │   ├── envelope-pricing.ts
│   │   ├── usps-rates.ts
│   │   ├── finishing-fold-engine.ts
│   │   ├── finishing-fold-data.ts
│   │   ├── finishing-calculator-types.ts
│   │   ├── lamination-pricing.ts
│   │   ├── paper-weights.ts
│   │   ├── use-papers.ts
│   │   ├── pricing.ts
│   │   └── utils.ts
│   │
│   ├── components/                 # ALL calculator components
│   │   ├── printing/
│   │   ├── booklet/
│   │   ├── perfect/
│   │   ├── spiral/
│   │   ├── pad/
│   │   ├── envelope-tab.tsx
│   │   ├── usps-postage-calculator.tsx
│   │   ├── mailing-calculator.tsx
│   │   ├── labor-calculator.tsx
│   │   ├── calc-price-card.tsx
│   │   ├── finishing-add-ons.tsx
│   │   └── qty-comparison-table.tsx
│   │
│   ├── ui/                         # shadcn/ui components
│   │   └── [all 50 ui components]
│   │
│   └── hooks/
│       ├── use-form-validation.ts
│       ├── use-mobile.tsx
│       └── use-toast.ts
│
├── styles/
│   └── globals.css
│
└── tailwind.config.ts
```

---

## PART 9: USAGE IN OTHER APPS

```typescript
// Install from GitHub
npm install github:PostageGit/calculator-core

// Import calculators
import { PrintingCalculator } from '@postagegit/calculator-core/components/printing'
import { BookletCalculator } from '@postagegit/calculator-core/components/booklet'
import { calculatePrintingCost } from '@postagegit/calculator-core/lib/printing-pricing'

// Use in your app
<PrintingCalculator 
  standalone={true}
  papers={customPapers}  // optional - uses defaults if not provided
  onResult={(result) => console.log(result)}
/>
```

---

## VERIFICATION CHECKLIST

After extraction, verify these features work:

### Printing Calculator
- [ ] Level slider (1-10) changes pricing
- [ ] Level auto-calculates from sheet count
- [ ] Level override works
- [ ] All 6 sheet sizes show in table
- [ ] Best fit auto-selects cheapest
- [ ] SVG shows correct layout
- [ ] SVG shows cut lines
- [ ] SVG shows bleed margins when enabled
- [ ] SVG shows grip edge
- [ ] Bleed toggle changes layout
- [ ] All sides options work (S/S, D/S, 4/0, 4/4, 1/0, 1/1)
- [ ] Paper dropdown shows all papers
- [ ] Cardstock vs text paper changes markup category
- [ ] Cutting cost calculates correctly
- [ ] Minimums apply when needed
- [ ] Multi-qty comparison works
- [ ] Lamination options work
- [ ] Fold/score options work
- [ ] Finishing add-ons work
- [ ] Lots feature works
- [ ] Broker pricing toggle works

### Other Calculators
- [ ] Booklet calculator works
- [ ] Perfect binding calculator works
- [ ] Spiral calculator works
- [ ] Pad calculator works
- [ ] Envelope calculator works
- [ ] USPS postage calculator works
- [ ] Mailing calculator works
- [ ] Labor calculator works

---

END OF SPECIFICATION

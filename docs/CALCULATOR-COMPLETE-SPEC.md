# CALCULATOR PACKAGE - COMPLETE TECHNICAL SPECIFICATION

This document contains the EXACT specifications, rates, rules, and limitations for ALL calculators.
This is the SOUL of the business - every value must be preserved exactly.

---

## FLAT PRINTING CALCULATOR

### CLICK COSTS (Cost per impression)
```
BW:    { regular: 0.0039, machine: 0.00365 }
Color: { regular: 0.049,  machine: 0.0087  }
```

### SHEET SIZES
```
Regular: "8.5x11", "11x17", "12x18", "12.5x19", "13x19", "13x26"
Short:   "Short 11x17", "Short 12x18", "Short 12.5x19"
```

### CLICK COST MULTIPLIERS (for large sheets)
```
"13x26": 3x (triple the click cost per sheet)
```

### SPECIALTY SHEET SIZES (not auto-selected as "best fit")
```
"13x26" - only shown for manual selection
```

### SIDES OPTIONS
| Code | Name | Click Amount | Click Type | Machine Click |
|------|------|--------------|------------|---------------|
| S/S  | B&W - Front Only | 1 | BW | 1 |
| D/S  | B&W - Both Sides | 2 | BW | 2 |
| 4/0  | Color - Front Only | 1 | Color | 1 |
| 4/4  | Color - Both Sides | 2 | Color | 2 |
| 1/0  | B&W - Front Only (alt) | 0.25 | Color | 1 |
| 1/1  | B&W - Both Sides (alt) | 0.5 | Color | 2 |

### PRICING LEVELS (based on SHEET COUNT, not quantity)
| Level | Min Sheets |
|-------|------------|
| 1 | 1 |
| 2 | 10 |
| 3 | 100 |
| 4 | 250 |
| 5 | 1,000 |
| 6 | 2,000 |
| 7 | 3,500 |
| 8 | 5,000 |
| 9 | 100,000 |
| 10 | 1,000,000 (broker level) |

### MARKUP PERCENTAGES BY LEVEL
```
BW:          { 1: 15,   2: 8, 3: 4, 4: 3.5,  5: 3.13, 6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.9  }
Color Paper: { 1: 12,   2: 6, 3: 4, 4: 3.5,  5: 3,    6: 2.85, 7: 2.41, 8: 2.13, 9: 1.97, 10: 1.52 }
Color Card:  { 1: 12,   2: 6, 3: 4, 4: 3.4,  5: 3.15, 6: 2.95, 7: 2.5,  8: 2.2,  9: 2.05, 10: 1.52 }
```

### BLEED & GUTTER
```
BLEED_MARGIN = 0.25" (each side)
GUTTER_AMOUNT = 0.2" (between pieces)
```

### PRINTING MINIMUMS
```
BW printing:    $3.00 minimum
Color printing: $6.50 minimum
```

### CUTTING CALCULATION
```
Stack threshold: Cardstock = 500 sheets, Text = 700 sheets
Cutting cost per stack = $5 + max(0, total_cuts - 5)
```

### PAPER PRICES (per sheet)
```typescript
"20lb Offset":      { "8.5x11": 0.0078, "11x17": 0.0174, "12x18": 0.0293, "12.5x19": 0.0277 }
"50lb Offset":      { "8.5x11": 0.012,  "11x17": 0.024,  "12x18": 0.028,  "12.5x19": 0.026  }
"60lb Offset":      { "8.5x11": 0.015,  "11x17": 0.0295, "12x18": 0.0346, "12.5x19": 0.032  }
"70lb Offset":      { "8.5x11": 0.018,  "11x17": 0.035,  "12x18": 0.04,   "12.5x19": 0.038  }
"80lb Text Gloss":  { "8.5x11": 0.025,  "11x17": 0.049,  "12x18": 0.046,  "13x19": 0.0615  }
"80lb Text Matte":  { "8.5x11": 0.025,  "11x17": 0.049,  "12x18": 0.046,  "13x19": 0.0615  }
"100lb Text Gloss": { "8.5x11": 0.03,   "11x17": 0.0565, "12x18": 0.0565, "13x19": 0.0653  }
"100lb Text Matte": { "8.5x11": 0.03,   "11x17": 0.0565, "12x18": 0.0565, "13x19": 0.0653  }
"65 Cover (White)": { "8.5x11": 0.032,  "11x17": 0.063  }
"67 Cover (White)": { "8.5x11": 0.032,  "11x17": 0.063  }
"67 Cover (Off-White)": { "8.5x11": 0.032, "11x17": 0.063 }
"80 Cover Gloss":   { "8.5x11": 0.05795, "11x17": 0.1159, "12x18": 0.1159, "13x19": 0.1159 }
"80 Cover Matte":   { "8.5x11": 0.05795, "11x17": 0.1159, "12x18": 0.1159, "13x19": 0.1159 }
"100 Cover Gloss":  { "8.5x11": 0.075,  "11x17": 0.15,   "12x18": 0.15,   "13x19": 0.15   }
"100 Cover Matte":  { "8.5x11": 0.075,  "11x17": 0.15,   "12x18": 0.15,   "13x19": 0.15   }
"10pt Offset":      { "8.5x11": 0.0578, "11x17": 0.113,  "12x18": 0.113,  "13x19": 0.113  }
"10pt Gloss":       { "8.5x11": 0.06605,"11x17": 0.1321, "12x18": 0.1321, "13x19": 0.1321 }
"12pt Gloss":       { "8.5x11": 0.0745, "11x17": 0.149,  "12x18": 0.149,  "13x19": 0.149, "13x26": 0.447 }
"12pt Matte":       { "8.5x11": 0.0745, "11x17": 0.149,  "12x18": 0.149,  "13x19": 0.149  }
"14pt Gloss":       { "8.5x11": 0.09455,"11x17": 0.1891, "12x18": 0.1891, "13x19": 0.1891 }
"14pt Matte":       { "8.5x11": 0.09455,"11x17": 0.1891, "12x18": 0.1891, "13x19": 0.1891 }
"Sticker (Crack & Peel)": { "8.5x11": 0.187, "11x17": 0.373, "12x18": 0.373, "13x19": 0.373 }
```

### PAPER OPTIONS
```typescript
// Text weight papers
{ name: "20lb Offset",      isCardstock: false, thickness: 0.00225, availableSizes: ["8.5x11", "11x17", "12x18", "12.5x19"] }
{ name: "50lb Offset",      isCardstock: false, thickness: 0.003,   availableSizes: ["8.5x11", "11x17", "12x18", "12.5x19"] }
{ name: "60lb Offset",      isCardstock: false, thickness: 0.0035,  availableSizes: ["8.5x11", "11x17", "12x18", "12.5x19"] }
{ name: "70lb Offset",      isCardstock: false, thickness: 0.004,   availableSizes: ["8.5x11", "11x17", "12x18", "12.5x19"] }
{ name: "80lb Text Gloss",  isCardstock: false, thickness: 0.0035,  availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "80lb Text Matte",  isCardstock: false, thickness: 0.0035,  availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "100lb Text Gloss", isCardstock: false, thickness: 0.004,   availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "100lb Text Matte", isCardstock: false, thickness: 0.004,   availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
// Cover / cardstock papers
{ name: "65 Cover (White)",     isCardstock: true, thickness: 0.007,  availableSizes: ["8.5x11", "11x17"] }
{ name: "67 Cover (White)",     isCardstock: true, thickness: 0.0075, availableSizes: ["8.5x11", "11x17"] }
{ name: "67 Cover (Off-White)", isCardstock: true, thickness: 0.0075, availableSizes: ["8.5x11", "11x17"] }
{ name: "80 Cover Gloss",   isCardstock: true, thickness: 0.008,  availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "80 Cover Matte",   isCardstock: true, thickness: 0.008,  availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "100 Cover Gloss",  isCardstock: true, thickness: 0.01,   availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "100 Cover Matte",  isCardstock: true, thickness: 0.01,   availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "10pt Offset",      isCardstock: true, thickness: 0.01,   availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "10pt Gloss",       isCardstock: true, thickness: 0.01,   availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "12pt Gloss",       isCardstock: true, thickness: 0.012,  availableSizes: ["8.5x11", "11x17", "12x18", "13x19", "13x26"] }
{ name: "12pt Matte",       isCardstock: true, thickness: 0.012,  availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "14pt Gloss",       isCardstock: true, thickness: 0.014,  availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
{ name: "14pt Matte",       isCardstock: true, thickness: 0.014,  availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
// Specialty
{ name: "Sticker (Crack & Peel)", isCardstock: false, thickness: 0.004, availableSizes: ["8.5x11", "11x17", "12x18", "13x19"] }
```

### PAPER WEIGHTS (lbs per 1,000 sheets)
```typescript
"20lb Offset":            { size: "11x17", lbs: 20,   thicknessIn: 0.004  }
"60lb Offset":            { size: "11x17", lbs: 23,   thicknessIn: 0.005  }
"60 lb Cream":            { size: "11x17", lbs: 23,   thicknessIn: 0.005  }
"70lb Offset":            { size: "8.5x11", lbs: 14,  thicknessIn: 0.005  }
"80lb Text Gloss":        { size: "12x18", lbs: 36.5, thicknessIn: 0.005  }
"100lb Text Gloss":       { size: "12x18", lbs: 46,   thicknessIn: 0.006  }
"65 Cover Offset":        { size: "12x18", lbs: 52,   thicknessIn: 0.009  }
"67 Cover Offset":        { size: "11x17", lbs: 39,   thicknessIn: 0.009  }
"80 Cover Gloss":         { size: "13x19", lbs: 76,   thicknessIn: 0.010  }
"10pt Gloss":             { size: "13x19", lbs: 93,   thicknessIn: 0.010  }
"12pt Gloss":             { size: "13x19", lbs: 92,   thicknessIn: 0.012  }
"14pt Gloss":             { size: "13x19", lbs: 120,  thicknessIn: 0.014  }
"16pt Gloss":             { size: "13x19", lbs: 118,  thicknessIn: 0.016  }
"10pt Offset":            { size: "13x19", lbs: 75,   thicknessIn: 0.010  }
"14pt Offset":            { size: "13x19", lbs: 95,   thicknessIn: 0.014  }
"Sticker (Crack & Peel)": { size: "13x19", lbs: 70,   thicknessIn: 0.008  }
```

---

## LAMINATION OPTIONS

### LAMINATION TYPES
| Type | Setup | Roll Cost | Roll Length | Roll Change | Waste % | Min Sheets | Markup % | Broker Discount | Min Job |
|------|-------|-----------|-------------|-------------|---------|------------|----------|-----------------|---------|
| Gloss | $10 | $52.90 | 500 ft | $0 | 5% | 5 | 225% | 30% | $45 |
| Matte | $10 | $52.25 | 500 ft | $10 | 5% | 5 | 225% | 30% | $45 |
| Silk | $10 | $50.45 | 500 ft | $10 | 10% | 10 | 225% | 30% | $45 |
| Leather | $10 | $52.25 | 500 ft | $10 | 5% | 5 | 225% | 30% | $45 |
| Linen | $10 | $52.25 | 500 ft | $10 | 5% | 5 | 225% | 30% | $45 |

### LAMINATION RUNTIME COSTS
```
80Cover paper:  { default: 0.0667 }
Cardstock:      { default: 0.025 }
Silk variation: { 80Cover: 0.1333, Cardstock: 0.05 }
```

### LAMINATION RULES
- Reduces printable area by 0.15" on the short side
- Max lamination width: 12.45"

---

## SCORE & FOLD OPTIONS

### SETUP LEVELS
```
Level 1: 15 minutes
Level 2: 17 minutes
Level 3: 20 minutes
Level 4: 22 minutes
Level 5: 25 minutes
```

### SCORE & FOLD RATES
```
Setup cost per hour:   $60
Machine charge/hour:   $5
Runtime cost per hour: $30
Markup:                250%
Minimum job price:     $50
Broker discount:       30%
```

### FOLDING TABLE (runtime = minutes per 100 pieces)
| Paper | Size | Fold in Half | Fold in 3 | Fold in 4 | Gate Fold |
|-------|------|--------------|-----------|-----------|-----------|
| 80text | 11x17 | L3, 0.67min | L3, 0.75min | L5, 2.0min | N/A |
| 80text | 8.5x11 | L3, 0.5min | L3, 0.58min | L5, 0 | N/A |
| 80text | 8.5x5.5 | L3, 0.42min | L4, 0 | hand fold | L5, 0 |
| 100text | 11x17 | L2, 0.67min | L3, 0.75min | L5, 2.0min | N/A |
| 100text | 8.5x11 | L2, 0.5min | L3, 0.58min | L5, 0 | N/A |
| cardstock | ALL | N/A | N/A | N/A | N/A |

### SCORING TABLE (runtime = minutes per 100 pieces)
| Paper | Size | Fold in Half | Fold in 3 | Fold in 4 | Gate Fold |
|-------|------|--------------|-----------|-----------|-----------|
| 80text | ALL | N/A | N/A | N/A | N/A |
| 100text | 11x17 | L2, 3.58min | L3, 3.75min | hand fold | N/A |
| 100text | 8.5x11 | L2, 4.33min | L3, 4.33min | hand fold | N/A |
| 100text | 8.5x5.5 | L3, 2.0min | L4, 2.33min | hand fold | L5, 0 |
| cardstock | 11x17 | L1, 2.58min | L2, 3.75min | hand fold | L4, 4.0min |
| cardstock | 8.5x11 | L1, 2.33min | L4, 3.33min | L4, 0 | L4, 0 |
| cardstock | 8.5x5.5 | L2, 2.0min | L3, 0 | hand fold | L4, 0 |

### FOLD SIZE MATCHING (with 0.25" tolerance)
```
11x17: short=11, long=17
8.5x11: short=8.5, long=11
8.5x5.5: short=5.5, long=8.5
```

---

## SADDLE STITCH (BOOKLET) BINDING

### BINDING RATES
| Size | Thickness | Cover Type | Rate/book | Setup |
|------|-----------|------------|-----------|-------|
| Handheld | Thin | Self | $0.18 | $65 |
| Handheld | Thin | Plus | $0.24 | $85 |
| Handheld | Thick | Self | $0.35 | $75 |
| Handheld | Thick | Plus | $0.46 | $100 |
| Pocket | Thin | Self | $0.35 | $85 |
| Pocket | Thin | Plus | $0.40 | $110 |
| Pocket | Thick | Self | $0.35 | $85 |
| Pocket | Thick | Plus | $0.40 | $110 |

### BINDING TYPE SURCHARGES
```
Staple:  extraSetup: $0,  extraRate: $0    (base price)
Fold:    extraSetup: $0,  extraRate: $0    (fold only, no staple)
Perfect: extraSetup: $30, extraRate: $0.10 (perfect binding surcharge)
```

### BOOKLET RULES
- Page count MUST be multiple of 4
- Self-cover or Plus-cover options
- Broker discount: 20%

---

## PERFECT BINDING

### PRODUCTION RULES
```
coverExtraNoBleed: 0.20"        (No bleed on either)
coverExtraCoverBleedOnly: 0.25" (Cover bleed only)
coverExtraInsideBleed: 0.50"    (Inside has bleed)
maxCoverUps: 2                  (Max ups for covers)
maxLaminationWidth: 12.45"      (Max laminator width)
```

### PERFECT BINDING RULES
- Page count MUST be multiple of 2
- Spine width calculated from page count x paper thickness
- Cover wraps around spine

---

## ADDRESSING & TABBING

### ADDRESSING RATES - Letter/Postcard
| Max Qty | Rate |
|---------|------|
| 2,500 | $125 flat minimum |
| 5,000 | $0.05 per piece |
| 5,000+ | $0.04 per piece |

### ADDRESSING RATES - Flats
| Max Qty | Rate |
|---------|------|
| 1,000 | $200 flat minimum |
| 1,000+ | $0.20 per piece |

### TABBING RATES
| Max Qty | Rate |
|---------|------|
| 1,000 | $125 flat minimum |
| 1,000+ | $0.125 per piece |

---

## ENVELOPE WEIGHTS

| Envelope | Weight (oz) | Thickness (in) |
|----------|-------------|----------------|
| #10 | 0.16 | 0.005 |
| #10 Window | 0.17 | 0.005 |
| #10 DW | 0.18 | 0.005 |
| 6x9 | 0.25 | 0.006 |
| 9x12 | 0.62 | 0.008 |
| 10x13 | 0.75 | 0.008 |
| A-2 | 0.10 | 0.004 |
| A-6 | 0.13 | 0.004 |
| A-7 | 0.16 | 0.005 |
| A-9 | 0.25 | 0.005 |
| A-10 | 0.30 | 0.006 |
| 6.5x9.5 | 0.30 | 0.006 |

---

## SHIPPING STACK THICKNESS FACTORS

```
Flat sheets:      0% extra (stack well)
Saddle stitch:    30% extra (staples create bulk)
Perfect binding:  10% extra (spine bulk)
Spiral binding:   10% extra (coil bulk)
```

---

## SORT LEVEL MIX (USPS)

### First Class Presort
```
Letters (AUTO):   { MIX: 15%, ADC: 35%, FD: 50% }
Flats (AUTO):     { MIX: 10%, ADC: 20%, TD: 30%, FD: 40% }
Postcards (AUTO): { MIX: 15%, ADC: 35%, FD: 50% }
```

### Marketing Mail Auto
```
Letters (AUTO): { MIX: 15%, ADC: 35%, FD: 50% }
Flats (AUTO):   { MIX: 10%, ADC: 20%, TD: 30%, FD: 40% }
Letters (CR):   { CR_B: 40%, CR_H: 40%, CR_HP: 20% }
Flats (CR):     { CR_B: 40%, CR_H: 40%, CR_HP: 20% }
```

### Nonprofit
```
Letters (AUTO): { MIX: 15%, ADC: 35%, FD: 50% }
Flats (AUTO):   { MIX: 10%, ADC: 20%, TD: 30%, FD: 40% }
Letters (CR):   { CR_B: 40%, CR_H: 40%, CR_HP: 20% }
Flats (CR):     { CR_B: 40%, CR_H: 40%, CR_HP: 20% }
```

---

## CORE FORMULAS

### Layout Calculation
```
printableW = sheetW - (hasBleed ? BLEED_MARGIN*2 : 0)
printableH = sheetH - (hasBleed ? BLEED_MARGIN*2 : 0)
gutter = hasBleed ? GUTTER_AMOUNT : 0

cols = floor((printableW + gutter) / (pieceW + gutter))
rows = floor((printableH + gutter) / (pieceH + gutter))
maxUps = cols * rows

// Try rotated orientation and pick better one
```

### Cost Calculation
```
totalSheets = ceil(quantity / maxUps)
autoLevel = getLevel(totalSheets)  // or 10 if broker
level = levelOverride || autoLevel

clickType = sidesRule.clickType  // "BW" or "Color"
category = clickType === "BW" ? "BW" : (isCardstock ? "Color Card" : "Color Paper")
markup = MARKUP_PERCENTAGES[category][level]

clickCost = (sidesRule.clickAmount * CLICK_COSTS[clickType].regular) + 
            (sidesRule.machineClickAmount * CLICK_COSTS[clickType].machine)
baseCostPerSheet = paperPrice + clickCost
pricePerSheet = baseCostPerSheet * markup

// Round based on level
if (level <= 6) pricePerSheet = round(pricePerSheet * 100) / 100
else if (level === 7) pricePerSheet = round(pricePerSheet * 1000) / 1000
else pricePerSheet = round(pricePerSheet * 10000) / 10000

totalCost = pricePerSheet * totalSheets

// Apply minimums
if (totalCost < printingMinimum) totalCost = printingMinimum
```

### Cutting Calculation
```
// With bleed
verticalCuts = (cols - 1) * 2 + 2
horizontalCuts = (rows - 1) * 2 + 2

// Without bleed (full bleed to edge)
if (totalWidth === sheetWidth) verticalCuts = cols - 1
else verticalCuts = cols + 1

totalCuts = verticalCuts + horizontalCuts
stacks = ceil(totalSheets / stackThreshold)  // 500 for card, 700 for text
cuttingCostPerStack = $5 + max(0, totalCuts - 5)
cuttingCost = cuttingCostPerStack * stacks
```

---

## FILES TO COPY FROM GITHUB

```
PostageGit/v0-mailing-cost-calculator (main branch)

COPY EXACT:
lib/pricing-config.ts      (859 lines - ALL data)
lib/printing-pricing.ts    (519 lines - ALL formulas)
lib/printing-types.ts
lib/booklet-pricing.ts
lib/perfect-pricing.ts
lib/spiral-pricing.ts
lib/pad-pricing.ts
lib/envelope-pricing.ts
lib/lamination-pricing.ts
lib/finishing-fold-engine.ts
lib/finishing-fold-data.ts
lib/paper-weights.ts
lib/usps-rates.ts

components/printing/*
components/booklet/*
components/perfect/*
components/spiral/*
components/pad/*
components/ui/*
```

---

## DO NOT MODIFY

Any modification to the values in this document will break pricing accuracy.
These are production-tested rates used in real business operations.

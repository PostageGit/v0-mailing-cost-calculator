# @postagegit/calculator-core

Central calculator package for printing and mailing business.

## Installation

Install directly from GitHub:

```bash
npm install github:PostageGit/v0-mailing-cost-calculator
# or
pnpm add github:PostageGit/v0-mailing-cost-calculator
```

## Usage

### Import Calculation Functions (Pure Logic)

```typescript
// Import everything
import * from '@postagegit/calculator-core'

// Or import specific calculators
import { calculatePrintingCost, findBestSheet } from '@postagegit/calculator-core/lib/printing'
import { calculateBookletCost } from '@postagegit/calculator-core/lib/booklet'
import { calculatePerfectCost } from '@postagegit/calculator-core/lib/perfect'
import { calculateSpiralCost } from '@postagegit/calculator-core/lib/spiral'
import { calculateEnvelopeCost } from '@postagegit/calculator-core/lib/envelope'
import { calculateUSPSPostage } from '@postagegit/calculator-core/lib/usps'

// Import configuration
import { 
  CLICK_COSTS, 
  MARKUP_BY_LEVEL, 
  LEVEL_THRESHOLDS,
  SHEET_SIZES 
} from '@postagegit/calculator-core/lib/config'
```

### Import React Components

```typescript
import { 
  PrintingCalculator,
  BookletCalculator,
  PerfectCalculator,
  SpiralCalculator,
  USPSPostageCalculator,
  EnvelopeTab
} from '@postagegit/calculator-core/components'
```

### Standalone Mode (No Quote Context)

```typescript
import { 
  StandalonePrintingCalculator,
  StandaloneBookletCalculator,
  StandalonePerfectCalculator 
} from '@postagegit/calculator-core/components'

// Use in your app
<StandalonePrintingCalculator />
```

## Calculators Included

1. **Flat Printing Calculator** - Level-based pricing, sheet optimization, SVG visualization
2. **Booklet (Saddle Stitch) Calculator** - Page count validation (multiple of 4), self/plus cover
3. **Perfect Binding Calculator** - Spine width calculation, minimum page count (28)
4. **Spiral Binding Calculator** - Coil size selection, any page count
5. **Envelope Calculator** - All envelope sizes
6. **USPS Postage Calculator** - All mail classes, entry points, sort levels

## Configuration

All pricing data is in `lib/pricing-config.ts`:

- Click costs (BW, Color)
- Markup tables (10 levels x 3 categories)
- Sheet sizes
- Paper prices
- Lamination rates
- Fold/score tables
- Saddle stitch rates
- And more...

## License

MIT

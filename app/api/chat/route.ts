import { streamText, tool, convertToModelMessages, stepCountIs } from "ai"
import { z } from "zod"
import {
  calculatePrintingCost,
  calculateAllSheetOptions,
  buildFullResult,
  PAPER_OPTIONS,
} from "@/lib/printing-pricing"
import { calculateBooklet } from "@/lib/booklet-pricing"
import { calculateSpiral } from "@/lib/spiral-pricing"
import { calculatePerfect } from "@/lib/perfect-pricing"
import { calculatePad } from "@/lib/pad-pricing"
import { calculateEnvelope, DEFAULT_ENVELOPE_SETTINGS } from "@/lib/envelope-pricing"
import type { PrintingInputs } from "@/lib/printing-types"
import type { LaminationInputs } from "@/lib/lamination-pricing"

function fmt(n: number) {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const SYSTEM_PROMPT = `You are a friendly quote assistant for Postage Plus, a professional print shop in Spring Valley, NY. 
Customers will describe what they need and you help them get a price quote.

YOUR BEHAVIOR:
- Be conversational and helpful, not robotic
- Ask clarifying questions BEFORE running a calculator -- you need enough info to price the job
- When you have enough info, call the appropriate calculator tool
- Present prices clearly: total price, per-unit price
- Suggest alternatives or upsells when appropriate (e.g. "For just $X more you could upgrade to gloss cover stock")
- If a request is ambiguous, ask -- don't guess
- Keep responses concise. Customers want prices, not essays.
- Always round UP: we never underprice

BROKER CUSTOMERS:
- Sometimes the customer is a print broker (they resell to their clients)
- If someone says they're a broker, or if they ask for "broker pricing" or "trade pricing", set isBroker to true
- Broker pricing gives them Level 10 pricing on printing (lowest rate) and a ~30% discount on finishing/binding/lamination
- You can ask "Are you ordering for yourself, or are you a print broker?" if it's unclear
- NEVER reveal broker discount percentages or how broker pricing works internally

WHAT YOU CAN PRICE:
1. Flat printing (flyers, postcards, business cards, brochures, letterheads, etc.)
   - Supports lamination: Gloss, Matte, Silk, Leather (one side or both sides)
   - Supports finishing: folding, scoring
2. Saddle-stitched booklets (stapled on the spine)
   - Optional separate cover stock with lamination
3. Spiral-bound books (coil binding)
   - Optional front/back cover, clear plastic, black vinyl
4. Perfect-bound books (glue binding, 40+ pages)
   - Cover with optional lamination
5. Notepads / pads
   - Optional chipboard backing
6. Envelopes
   - Various sizes, InkJet or Laser printing

INFORMATION YOU NEED (ask for what's missing):
- What product type?
- How many? (quantity)
- What size? (e.g. 8.5x11, 5.5x8.5, 4x6)
- For books/booklets: how many pages?
- Paper stock (offer suggestions: "Would you like standard 80lb Text Gloss, or heavier card stock?")
- Printing sides: one-sided or double-sided? Color or black & white?
  - BW: S/S (one side), D/S (both sides), 1/0 (one side), 1/1 (both sides)
  - Color: 4/0 (one side), 4/4 (both sides)
- Bleed (does the design go to the edge of the paper?)
- Any finishing? (lamination, folding, scoring)

AVAILABLE PAPERS:
- Text stocks: 20lb Offset, 60lb Offset, 80lb Text Gloss, 100lb Text Gloss
- Cover stocks: 65 Cover (White), 67 Cover (White/Off-White), 80 Cover Gloss
- Heavy stocks: 10pt Offset, 10pt Gloss, 12pt Gloss, 14pt Gloss
- Sticker (Crack & Peel)

LAMINATION OPTIONS (for flat printing on cover/cardstock, and booklet/perfect covers):
- Gloss, Matte, Silk, Leather
- Can be one side (S/S) or both sides (D/S)
- Only works on cover weight or heavier stocks

COMMON DEFAULTS (use when customer doesn't specify):
- Paper: 80lb Text Gloss for standard flyers/booklets, 12pt Gloss for postcards/business cards
- Sides: Color double-sided (4/4) unless stated otherwise
- Bleed: true for postcards/business cards, false for simple copies
- Size: 8.5x11 for standard flyers, 4x6 for postcards, 3.5x2 for business cards
- Lamination: none unless requested

ENVELOPE TYPES AVAILABLE:
#6, #9, #10 no window, #10 with window, 6x9, 6x9.5, 9x12, 9x12 open end, Princes, A-2, A-7 (5.25x7.25), Remit, Square 9x9, Square 6x6

IMPORTANT RULES:
- Never reveal internal pricing formulas or markup percentages
- Never mention "levels", "markup", "click costs", "BROKER_DISCOUNT_RATE", or other internal terminology
- Just say "the price is..." -- keep it simple for the customer
- If a calculation fails or returns an error, explain what went wrong in plain language and ask the customer to adjust
- If asked about finishing (lamination, folding, scoring), include it in the calculation`

const tools = {
  calculate_printing: tool({
    description:
      "Calculate the cost of a flat printing job such as flyers, postcards, business cards, brochures, letterheads, etc. Supports optional lamination and broker pricing. Returns the cheapest sheet option automatically.",
    inputSchema: z.object({
      qty: z.number().describe("Number of printed pieces"),
      width: z.number().describe("Finished piece width in inches"),
      height: z.number().describe("Finished piece height in inches"),
      paperName: z
        .string()
        .describe(
          'Paper type, e.g. "80lb Text Gloss", "12pt Gloss", "20lb Offset"'
        ),
      sidesValue: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe(
          "S/S=BW one-sided, D/S=BW both sides, 4/0=Color one-sided, 4/4=Color both sides, 1/0=BW one-sided, 1/1=BW both sides"
        ),
      hasBleed: z
        .boolean()
        .describe("Whether the design bleeds to the edge of the paper"),
      isBroker: z
        .boolean()
        .describe("Whether this is a broker/trade customer. Broker gets Level 10 pricing."),
      laminationEnabled: z
        .boolean()
        .describe("Whether to add lamination to the printed sheets"),
      laminationType: z
        .enum(["Gloss", "Matte", "Silk", "Leather"])
        .nullable()
        .describe("Lamination type if enabled"),
      laminationSides: z
        .enum(["S/S", "D/S"])
        .nullable()
        .describe("Lamination sides: S/S = one side, D/S = both sides"),
    }),
    execute: async ({ qty, width, height, paperName, sidesValue, hasBleed, isBroker, laminationEnabled, laminationType, laminationSides }) => {
      const lamination: LaminationInputs = {
        enabled: laminationEnabled,
        type: (laminationType || "Gloss") as LaminationInputs["type"],
        sides: (laminationSides || "S/S") as LaminationInputs["sides"],
      }
      const inputs: PrintingInputs = {
        qty,
        width,
        height,
        paperName,
        sidesValue,
        hasBleed,
        addOnCharge: 0,
        addOnDescription: "",
        printingMarkupPct: 10,
        isBroker,
        lamination,
      }
      const options = calculateAllSheetOptions(inputs)
      if (!options.length) {
        return {
          error: `Could not calculate for ${paperName} at ${width}x${height}. This paper/size combination may not be available.`,
        }
      }
      const best = options[0]
      const fullResult = buildFullResult(inputs, best.result)
      const parts: Record<string, string> = {
        printing: fmt(fullResult.printingCostPlus10),
      }
      if (fullResult.laminationCost && fullResult.laminationCost.cost > 0) {
        parts.lamination = fmt(fullResult.laminationCost.cost)
      }
      if (fullResult.cuttingCost > 0) {
        parts.cutting = fmt(fullResult.cuttingCost)
      }
      return {
        total: fmt(fullResult.grandTotal),
        perUnit: fmt(fullResult.grandTotal / qty),
        qty,
        size: `${width}x${height}`,
        paper: paperName,
        sides: sidesValue,
        bleed: hasBleed,
        broker: isBroker,
        sheetSize: best.size,
        costBreakdown: parts,
        lamination: laminationEnabled ? `${laminationType} (${laminationSides})` : "none",
      }
    },
  }),

  calculate_booklet: tool({
    description:
      "Calculate the cost of a saddle-stitched (stapled) booklet. Includes printing, binding, and optional lamination. Supports broker pricing.",
    inputSchema: z.object({
      bookQty: z.number().describe("Number of booklets"),
      pagesPerBook: z
        .number()
        .describe("Total page count (must be multiple of 4, includes cover)"),
      pageWidth: z.number().describe("Page width in inches (e.g. 8.5)"),
      pageHeight: z.number().describe("Page height in inches (e.g. 11)"),
      insidePaper: z
        .string()
        .describe('Inside paper type, e.g. "80lb Text Gloss"'),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside page printing sides"),
      separateCover: z
        .boolean()
        .describe("Whether cover uses a different stock than inside pages"),
      coverPaper: z
        .string()
        .nullable()
        .describe('Cover paper type if separate, e.g. "80 Cover Gloss"'),
      coverSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .nullable()
        .describe("Cover printing sides if separate"),
      laminationType: z
        .enum(["none", "Gloss", "Matte", "Silk", "Leather"])
        .describe("Lamination type on cover (if separate cover)"),
      isBroker: z
        .boolean()
        .describe("Whether this is a broker/trade customer"),
    }),
    execute: async ({
      bookQty,
      pagesPerBook,
      pageWidth,
      pageHeight,
      insidePaper,
      insideSides,
      separateCover,
      coverPaper,
      coverSides,
      laminationType,
      isBroker,
    }) => {
      const result = calculateBooklet({
        bookQty,
        pagesPerBook,
        pageWidth,
        pageHeight,
        separateCover,
        coverPaper: coverPaper || insidePaper,
        coverSides: coverSides || insideSides,
        coverBleed: true,
        coverSheetSize: "Cheapest",
        insidePaper,
        insideSides,
        insideBleed: false,
        insideSheetSize: "Cheapest",
        laminationType: separateCover ? laminationType : "none",
        customLevel: "auto",
        isBroker,
        printingMarkupPct: 10,
      })
      if (!result.isValid) {
        return { error: result.error || "Could not calculate booklet price." }
      }
      return {
        total: fmt(result.grandTotal),
        perUnit: fmt(result.pricePerBook),
        qty: bookQty,
        pages: pagesPerBook,
        size: `${pageWidth}x${pageHeight}`,
        insidePaper,
        coverPaper: separateCover ? (coverPaper || insidePaper) : "Same as inside",
        binding: "Saddle-stitch",
        lamination: separateCover ? laminationType : "none",
        broker: isBroker,
        costBreakdown: {
          printing: fmt(result.totalPrintingCost),
          binding: fmt(result.totalBindingPrice),
          lamination: fmt(result.totalLaminationCost),
        },
      }
    },
  }),

  calculate_spiral: tool({
    description:
      "Calculate the cost of a spiral-bound (coil) book. Good for training manuals, cookbooks, workbooks. Supports broker pricing.",
    inputSchema: z.object({
      bookQty: z.number().describe("Number of books"),
      pagesPerBook: z.number().describe("Number of inside pages"),
      pageWidth: z.number().describe("Page width in inches"),
      pageHeight: z.number().describe("Page height in inches"),
      insidePaper: z.string().describe('Inside paper type'),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside printing sides"),
      insideBleed: z.boolean().describe("Inside pages have bleed"),
      useFrontCover: z.boolean().describe("Use a front cover page"),
      useBackCover: z.boolean().describe("Use a back cover page"),
      frontPaper: z.string().nullable().describe("Front cover paper if used"),
      backPaper: z.string().nullable().describe("Back cover paper if used"),
      clearPlastic: z.boolean().describe("Add clear plastic front cover"),
      blackVinyl: z.boolean().describe("Add black vinyl back cover"),
      isBroker: z
        .boolean()
        .describe("Whether this is a broker/trade customer"),
    }),
    execute: async ({
      bookQty,
      pagesPerBook,
      pageWidth,
      pageHeight,
      insidePaper,
      insideSides,
      insideBleed,
      useFrontCover,
      useBackCover,
      frontPaper,
      backPaper,
      clearPlastic,
      blackVinyl,
      isBroker,
    }) => {
      const result = calculateSpiral({
        bookQty,
        pagesPerBook,
        pageWidth,
        pageHeight,
        inside: {
          paperName: insidePaper,
          sides: insideSides,
          hasBleed: insideBleed,
          sheetSize: "Cheapest",
        },
        useFrontCover,
        front: {
          paperName: frontPaper || "80 Cover Gloss",
          sides: "4/4",
          hasBleed: false,
          sheetSize: "Cheapest",
        },
        useBackCover,
        back: {
          paperName: backPaper || "80 Cover Gloss",
          sides: "4/4",
          hasBleed: false,
          sheetSize: "Cheapest",
        },
        clearPlastic,
        blackVinyl,
        customLevel: "auto",
        isBroker,
      })
      if ("error" in result) {
        return { error: result.error }
      }
      return {
        total: fmt(result.grandTotal),
        perUnit: fmt(result.pricePerBook),
        qty: bookQty,
        pages: pagesPerBook,
        size: `${pageWidth}x${pageHeight}`,
        paper: insidePaper,
        binding: "Spiral (coil)",
        broker: isBroker,
        costBreakdown: {
          printing: fmt(result.totalPrintingCost),
          binding: fmt(result.totalBindingPrice),
        },
      }
    },
  }),

  calculate_perfect_bound: tool({
    description:
      "Calculate the cost of a perfect-bound (glue) book. Requires 40+ pages. Good for catalogs, thick manuals, paperbacks. Supports broker pricing.",
    inputSchema: z.object({
      bookQty: z.number().describe("Number of books"),
      pagesPerBook: z.number().describe("Number of inside pages (minimum 40)"),
      pageWidth: z.number().describe("Page width in inches"),
      pageHeight: z.number().describe("Page height in inches"),
      insidePaper: z.string().describe("Inside paper type"),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside printing sides"),
      coverPaper: z.string().describe("Cover paper type"),
      coverSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Cover printing sides"),
      laminationType: z
        .enum(["none", "Gloss", "Matte", "Silk", "Leather"])
        .describe("Cover lamination type"),
      isBroker: z
        .boolean()
        .describe("Whether this is a broker/trade customer"),
    }),
    execute: async ({
      bookQty,
      pagesPerBook,
      pageWidth,
      pageHeight,
      insidePaper,
      insideSides,
      coverPaper,
      coverSides,
      laminationType,
      isBroker,
    }) => {
      const result = calculatePerfect({
        bookQty,
        pagesPerBook,
        pageWidth,
        pageHeight,
        inside: {
          paperName: insidePaper,
          sides: insideSides,
          hasBleed: false,
          sheetSize: "Cheapest",
        },
        cover: {
          paperName: coverPaper,
          sides: coverSides,
          hasBleed: true,
          sheetSize: "Cheapest",
        },
        laminationType,
        customLevel: "auto",
        isBroker,
      })
      if ("error" in result) {
        return { error: result.error }
      }
      return {
        total: fmt(result.grandTotal),
        perUnit: fmt(result.pricePerBook),
        qty: bookQty,
        pages: pagesPerBook,
        size: `${pageWidth}x${pageHeight}`,
        insidePaper,
        coverPaper,
        binding: "Perfect-bound (glue)",
        lamination: laminationType,
        broker: isBroker,
        costBreakdown: {
          printing: fmt(result.totalPrintingCost),
          binding: fmt(result.totalBindingPrice),
          lamination: fmt(result.totalLaminationCost),
        },
      }
    },
  }),

  calculate_pad: tool({
    description:
      "Calculate the cost of notepads. Includes printing, padding, and optional chipboard backing. Supports broker pricing.",
    inputSchema: z.object({
      padQty: z.number().describe("Number of pads"),
      pagesPerPad: z.number().describe("Pages per pad (e.g. 25, 50, 100)"),
      pageWidth: z.number().describe("Page width in inches"),
      pageHeight: z.number().describe("Page height in inches"),
      insidePaper: z.string().describe('Paper type, e.g. "20lb Offset"'),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Printing sides"),
      useChipBoard: z.boolean().describe("Include chipboard backing"),
      isBroker: z
        .boolean()
        .describe("Whether this is a broker/trade customer"),
    }),
    execute: async ({
      padQty,
      pagesPerPad,
      pageWidth,
      pageHeight,
      insidePaper,
      insideSides,
      useChipBoard,
      isBroker,
    }) => {
      const result = calculatePad({
        padQty,
        pagesPerPad,
        pageWidth,
        pageHeight,
        inside: {
          paperName: insidePaper,
          sides: insideSides,
          hasBleed: false,
          sheetSize: "Cheapest",
        },
        useChipBoard,
        customLevel: "auto",
        isBroker,
      })
      if ("error" in result) {
        return { error: result.error }
      }
      return {
        total: fmt(result.grandTotal),
        perUnit: fmt(result.pricePerPad),
        qty: padQty,
        pagesPerPad,
        size: `${pageWidth}x${pageHeight}`,
        paper: insidePaper,
        chipBoard: useChipBoard,
        broker: isBroker,
        costBreakdown: {
          printing: fmt(result.totalPrintingCost),
          padding: fmt(result.totalPaddingCost),
          setup: fmt(result.setupCharge),
        },
      }
    },
  }),

  calculate_envelope: tool({
    description:
      "Calculate the cost of printed envelopes. Various envelope sizes and ink types available. Supports broker pricing.",
    inputSchema: z.object({
      amount: z.number().describe("Number of envelopes"),
      itemName: z
        .string()
        .describe(
          'Envelope type, e.g. "#10 no window", "6x9", "#9", "A-7 (5.25x7.25)"'
        ),
      inkType: z
        .enum(["InkJet", "Laser"])
        .describe("Printing method: InkJet or Laser"),
      printType: z
        .string()
        .describe(
          'Print type. For InkJet: "Text BW", "Text Color", "Text + Logo", "Custom". For Laser: "BW", "RBW", "Color"'
        ),
      hasBleed: z.boolean().describe("Whether the design bleeds to the edge"),
      isBroker: z
        .boolean()
        .describe("Whether this is a broker/trade customer"),
    }),
    execute: async ({
      amount,
      itemName,
      inkType,
      printType,
      hasBleed,
      isBroker,
    }) => {
      const result = calculateEnvelope(
        {
          amount,
          itemName,
          inkType,
          printType: printType as never,
          hasBleed,
          customerType: isBroker ? "Broker" : "Regular",
          customEnvCost: 0,
          customPrintCost: 0,
        },
        DEFAULT_ENVELOPE_SETTINGS
      )
      if ("error" in result) {
        return { error: result.error }
      }
      return {
        total: fmt(result.price),
        perUnit: fmt(result.pricePerUnit),
        qty: result.quantity,
        envelope: itemName,
        inkType,
        printType,
        bleed: hasBleed,
        broker: isBroker,
      }
    },
  }),

  list_available_papers: tool({
    description:
      "List all available paper stocks with their available sheet sizes. Use this when the customer asks what papers are available.",
    inputSchema: z.object({}),
    execute: async () => {
      return PAPER_OPTIONS.map((p) => ({
        name: p.name,
        isCardstock: p.isCardstock,
        sizes: p.availableSizes,
      }))
    },
  }),

  list_envelope_types: tool({
    description:
      "List all available envelope types. Use when customer asks about envelope options.",
    inputSchema: z.object({}),
    execute: async () => {
      return DEFAULT_ENVELOPE_SETTINGS.items.map((item) => ({
        name: item.name,
        canBleed: item.bleed,
      }))
    },
  }),
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: "openai/gpt-4o",
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
  })

  return result.toUIMessageStreamResponse()
}

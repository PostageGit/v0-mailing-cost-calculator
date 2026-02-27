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

WHAT YOU CAN PRICE:
1. Flat printing (flyers, postcards, business cards, brochures, letterheads, etc.)
2. Saddle-stitched booklets (stapled on the spine)
3. Spiral-bound books (coil binding)
4. Perfect-bound books (glue binding, 40+ pages)
5. Notepads / pads
6. Envelopes

INFORMATION YOU NEED (ask for what's missing):
- What product type?
- How many? (quantity)
- What size? (e.g. 8.5x11, 5.5x8.5, 4x6)
- For books/booklets: how many pages?
- Paper stock (offer suggestions: "Would you like standard 80lb Text Gloss, or heavier card stock?")
- Printing sides: one-sided (S/S) or double-sided (D/S) for B&W, (4/0) or (4/4) for color
- Bleed (does the design go to the edge of the paper?)
- Any finishing (lamination, folding, binding)?

AVAILABLE PAPERS (for flat printing & booklets):
- Text stocks: 20lb Offset, 60lb Offset, 80lb Text Gloss, 100lb Text Gloss
- Cover stocks: 65 Cover (White), 67 Cover (White/Off-White), 80 Cover Gloss
- Heavy stocks: 10pt Offset, 10pt Gloss, 12pt Gloss, 14pt Gloss
- Sticker (Crack & Peel)

COMMON DEFAULTS (use when customer doesn't specify):
- Paper: 80lb Text Gloss for standard flyers/booklets, 12pt Gloss for postcards/business cards
- Sides: Color double-sided (4/4) unless stated otherwise
- Bleed: true for postcards/business cards, false for simple copies
- Size: 8.5x11 for standard flyers, 4x6 for postcards, 3.5x2 for business cards

ENVELOPE TYPES AVAILABLE:
#6, #9, #10 no window, #10 with window, 6x9, 6x9.5, 9x12, 9x12 open end, Princes, A-2, A-7 (5.25x7.25), Remit, Square 9x9, Square 6x6

IMPORTANT RULES:
- Never reveal internal pricing formulas or markup percentages
- Never mention "levels", "markup", "click costs" or other internal terminology
- Just say "the price is..." -- keep it simple for the customer
- If a calculation fails or returns an error, explain what went wrong in plain language and ask the customer to adjust`

const tools = {
  calculate_printing: tool({
    description:
      "Calculate the cost of a flat printing job such as flyers, postcards, business cards, brochures, letterheads, etc. Returns the cheapest sheet option automatically.",
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
          "S/S=BW one-sided, D/S=BW both sides, 4/0=Color one-sided, 4/4=Color both sides"
        ),
      hasBleed: z
        .boolean()
        .describe("Whether the design bleeds to the edge of the paper"),
    }),
    execute: async ({ qty, width, height, paperName, sidesValue, hasBleed }) => {
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
      }
      const options = calculateAllSheetOptions(inputs)
      if (!options.length) {
        return {
          error: `Could not calculate for ${paperName} at ${width}x${height}. This paper/size combination may not be available.`,
        }
      }
      const best = options[0]
      const fullResult = buildFullResult(inputs, best.result)
      return {
        total: fmt(fullResult.grandTotal),
        perUnit: fmt(fullResult.grandTotal / qty),
        qty,
        size: `${width}x${height}`,
        paper: paperName,
        sides: sidesValue,
        bleed: hasBleed,
        sheetSize: best.size,
        ups: best.ups,
        sheets: best.sheets,
      }
    },
  }),

  calculate_booklet: tool({
    description:
      "Calculate the cost of a saddle-stitched (stapled) booklet. Includes printing, binding, and optional lamination.",
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
        isBroker: false,
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
        printingCost: fmt(result.totalPrintingCost),
        bindingCost: fmt(result.totalBindingPrice),
        laminationCost: fmt(result.totalLaminationCost),
      }
    },
  }),

  calculate_spiral: tool({
    description:
      "Calculate the cost of a spiral-bound (coil) book. Good for training manuals, cookbooks, workbooks.",
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
        isBroker: false,
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
        printingCost: fmt(result.totalPrintingCost),
        bindingCost: fmt(result.totalBindingPrice),
      }
    },
  }),

  calculate_perfect_bound: tool({
    description:
      "Calculate the cost of a perfect-bound (glue) book. Requires 40+ pages. Good for catalogs, thick manuals, paperbacks.",
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
        isBroker: false,
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
        printingCost: fmt(result.totalPrintingCost),
        bindingCost: fmt(result.totalBindingPrice),
        laminationCost: fmt(result.totalLaminationCost),
      }
    },
  }),

  calculate_pad: tool({
    description:
      "Calculate the cost of notepads. Includes printing, padding, and optional chipboard backing.",
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
    }),
    execute: async ({
      padQty,
      pagesPerPad,
      pageWidth,
      pageHeight,
      insidePaper,
      insideSides,
      useChipBoard,
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
        isBroker: false,
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
        printingCost: fmt(result.totalPrintingCost),
        paddingCost: fmt(result.totalPaddingCost),
        setupCharge: fmt(result.setupCharge),
      }
    },
  }),

  calculate_envelope: tool({
    description:
      "Calculate the cost of printed envelopes. Various envelope sizes and ink types available.",
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
      customerType: z
        .enum(["Regular", "Broker"])
        .describe("Customer type for pricing"),
    }),
    execute: async ({
      amount,
      itemName,
      inkType,
      printType,
      hasBleed,
      customerType,
    }) => {
      const result = calculateEnvelope(
        {
          amount,
          itemName,
          inkType,
          printType: printType as never,
          hasBleed,
          customerType,
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
        bleedFeesApplied: result.bleedFeesApplied,
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
      "List all available envelope types with pricing info. Use when customer asks about envelope options.",
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

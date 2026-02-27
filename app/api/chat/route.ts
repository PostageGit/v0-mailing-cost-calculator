import { streamText, tool, convertToModelMessages, stepCountIs } from "ai"
import { z } from "zod"
import {
  calculatePrintingCost,
  calculateAllSheetOptions,
  buildFullResult,
  PAPER_OPTIONS,
} from "@/lib/printing-pricing"
import { calculateBooklet, BOOKLET_PAPER_OPTIONS } from "@/lib/booklet-pricing"
import { calculateSpiral } from "@/lib/spiral-pricing"
import { calculatePerfect } from "@/lib/perfect-pricing"
import { calculatePad } from "@/lib/pad-pricing"
import { calculateEnvelope, DEFAULT_ENVELOPE_SETTINGS } from "@/lib/envelope-pricing"
import type { PrintingInputs } from "@/lib/printing-types"
import type { LaminationInputs } from "@/lib/lamination-pricing"

// Build paper name lists at module level so the AI can use them
const FLAT_PAPER_NAMES = PAPER_OPTIONS.map((p) => p.name)
const BOOKLET_INSIDE_PAPERS = BOOKLET_PAPER_OPTIONS.filter((p) => !p.isCardstock).map((p) => p.name)
const BOOKLET_COVER_PAPERS = BOOKLET_PAPER_OPTIONS.filter((p) => p.isCardstock).map((p) => p.name)

function fmt(n: number) {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const SYSTEM_PROMPT = `You are a quick, friendly quote helper for a print shop. Customers don't know printing jargon. Keep every reply SHORT -- 1-3 sentences max. Ask ONE question at a time.

STYLE:
- Talk like a real person at a counter, not a robot. Short sentences.
- Never use bullet lists when talking to the customer. Just ask a plain question.
- When you're missing info, ask the MOST IMPORTANT missing thing first, then move to the next.
- Use common words: "front and back" not "double-sided", "full color" not "4/4", "thick cardstock" not "12pt Gloss".
- When you have enough info, run the calculator right away. Don't ask permission to calculate.

FIRST MESSAGE:
When the customer hasn't said what they need yet, ask: "Are you looking for flat printing (flyers, postcards, business cards), envelopes, or some type of book or booklet?"

ASKING FLOW -- figure these out one at a time:
For ANY print job:
1. What type? (flat printing, envelopes, or books/booklets)
2. How many?
3. What size?
For BOOKS / BOOKLETS -- also ask:
4. How many pages? (this is REQUIRED -- never skip it, never guess)
5. Color or black & white inside?
6. Do they want a heavier cover? (the cover is the outside -- it's usually a thicker stock)
For FLAT PRINTS -- also ask:
4. Color or black & white?
5. Front only or front and back?
6. Regular paper or something thicker like cardstock? (cardstock = thick, stiff paper used for business cards, postcards, door hangers)
For PADS:
4. How many sheets per pad?
For ENVELOPES:
4. What size envelope?
5. Color or black & white?

PAPER KNOWLEDGE -- understand this so you can guide customers:
- There are two categories: INSIDE PAPER (thinner, for pages) and COVER/CARDSTOCK (thicker, for covers, postcards, business cards).
- "Cardstock" = thick stiff paper. Customers use this for business cards, postcards, covers, door hangers. NOT for inside pages of books or regular flyers.
- "Regular paper" = thinner text-weight paper. Good for flyers, inside pages of booklets, copies.
- For BOOKS: inside pages use text paper (like 80lb Text Gloss), the COVER uses cardstock (like 80 Cover Gloss or 12pt Gloss). Always use a separate heavier cover unless the customer says otherwise.
- For FLAT PRINTS: use text paper for flyers/letters, use cardstock for postcards/business cards/door hangers.
- If a customer says "glossy" they probably mean 80lb Text Gloss (for thin) or 12pt Gloss (for thick).
- If they say "matte" they probably mean 80lb Text Matte or 10pt Matte.

SMART DEFAULTS (use these so you don't have to ask everything):
- Paper: 80lb Text Gloss for normal flyers/booklet insides. 12pt Gloss for postcards/business cards. 20lb Offset for pads/copies.
- Books/booklets: always default to a separate heavier cover (80 Cover Gloss) unless told otherwise.
- Color both sides unless they say otherwise.
- No bleed unless it's a postcard, business card, or they mention "edge to edge".
- No lamination unless they ask for it.
- Perfect binding needs 40+ pages. If they say less, suggest saddle-stitch instead.
- Saddle-stitch pages must be a multiple of 4. Round up if needed and tell them.

BINDING TYPES (use the right calculator):
- Stapled booklet (saddle-stitch): up to ~64 pages. Use calculate_booklet.
- Perfect binding (glue spine, like a paperback): 40+ pages. Use calculate_perfect_bound.
- Spiral / coil binding: any page count. Use calculate_spiral.
- If they say "book" or "booklet", ask how many pages to pick the right binding. If they specify "perfect binding" or "perfect bound", use perfect bound even if you'd normally suggest otherwise.

BROKER CUSTOMERS:
- If someone says "broker", "trade pricing", or "wholesale", set isBroker = true.
- You can ask "Is this for yourself or are you a print broker?" if unclear.
- Never reveal discount amounts or how broker pricing works.

PRESENTING THE QUOTE:
- Lead with the total and per-unit price: "That'd be $X total ($X each)."
- Then one short line about what's included.
- If there's a cost breakdown, mention the big items briefly.
- Offer one upsell if it makes sense: "Want lamination on the cover? Adds about $X."

NEVER DO:
- Never mention levels, markup, click costs, formulas, or internal terms.
- Never say "let me calculate" or "I'll run the numbers" -- just do it.
- Never write long paragraphs. Keep it punchy.
- Never guess page count for books. Always ask.

CRITICAL -- PAPER NAMES MUST BE EXACT (each calculator has its own paper list):

FOR FLAT PRINTING (calculate_printing):
  ${FLAT_PAPER_NAMES.join(", ")}

FOR BOOKLETS / SPIRAL / PERFECT / PADS -- inside pages:
  ${BOOKLET_INSIDE_PAPERS.join(", ")}

FOR BOOKLETS / SPIRAL / PERFECT -- covers (cardstock):
  ${BOOKLET_COVER_PAPERS.join(", ")}

Note: flat printing uses "80 Cover Gloss" but booklets use "80 Gloss". They are different names -- always use the exact name for the right calculator. If unsure, use the list_papers tool.

COMMON PAPER TRANSLATIONS (what customers say -> what to use):
- "regular paper" or "copy paper" -> 20lb Offset
- "nice paper" or "glossy" -> 80lb Text Gloss (flat) or 80lb Text Gloss (booklet inside)
- "thick" or "cardstock" -> 12pt Gloss (flat) or 12pt Gloss (booklet cover)
- "postcard stock" -> 12pt Gloss or 14pt Gloss
- "business card stock" -> 14pt Gloss

LAMINATION: Gloss, Matte, Silk, Leather. One side or both. Only on cover/cardstock.

ENVELOPES: #6, #9, #10 (window or no window), 6x9, 6x9.5, 9x12, A-2, A-7, Square 9x9, Square 6x6. InkJet or Laser.`

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
          `Paper name -- MUST be one of: ${FLAT_PAPER_NAMES.join(", ")}`
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
        .describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside page printing sides"),
      separateCover: z
        .boolean()
        .describe("Whether cover uses a different stock than inside pages"),
      coverPaper: z
        .string()
        .nullable()
        .describe(`Cover paper if separate -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}`),
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
      insidePaper: z.string().describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside printing sides"),
      insideBleed: z.boolean().describe("Inside pages have bleed"),
      useFrontCover: z.boolean().describe("Use a front cover page"),
      useBackCover: z.boolean().describe("Use a back cover page"),
      frontPaper: z.string().nullable().describe(`Front cover paper if used -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}`),
      backPaper: z.string().nullable().describe(`Back cover paper if used -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}`),
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
      insidePaper: z.string().describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside printing sides"),
      coverPaper: z.string().describe(`Cover paper -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}`),
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
      insidePaper: z.string().describe(`Paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
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
      "List all available paper stocks grouped by calculator type. Use this if unsure which paper name to use.",
    inputSchema: z.object({
      calculatorType: z
        .enum(["flat", "booklet", "spiral", "perfect", "pad"])
        .describe("Which calculator the papers are for"),
    }),
    execute: async ({ calculatorType }) => {
      if (calculatorType === "flat") {
        return {
          type: "Flat printing",
          papers: PAPER_OPTIONS.map((p) => ({
            name: p.name,
            isCardstock: p.isCardstock,
            sizes: p.availableSizes,
          })),
        }
      }
      // Booklet/spiral/perfect/pad all use the same paper list
      return {
        type: calculatorType,
        insidePapers: BOOKLET_PAPER_OPTIONS.filter((p) => !p.isCardstock).map((p) => ({
          name: p.name,
          sizes: p.availableSizes,
        })),
        coverPapers: BOOKLET_PAPER_OPTIONS.filter((p) => p.isCardstock).map((p) => ({
          name: p.name,
          canLaminate: p.canLaminate,
          sizes: p.availableSizes,
        })),
      }
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

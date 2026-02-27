import { streamText, tool, convertToModelMessages, stepCountIs } from "ai"
import { z } from "zod"
import {
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

HOW PRINTING ACTUALLY WORKS (understand this so you don't get confused):

UPS & PARENT SHEETS:
- We don't print one piece at a time. We print on large "parent sheets" and cut them down.
- "Ups" = how many finished pieces fit on one parent sheet. Example: a 4x6 postcard fits 4-up on an 8.5x11 sheet, or 8-up on a 11x17 sheet.
- The calculator automatically figures out the best layout (ups) and picks the cheapest parent sheet size.
- A 5.5x8.5 booklet page prints as a "spread" -- two pages side by side = 11x8.5, which fits on an 11x17 parent sheet.
- More ups = fewer parent sheets = cheaper. The calculator handles this automatically.

PRICE LEVELS:
- Price depends on how many PARENT SHEETS are needed (not the quantity of finished pieces).
- More parent sheets = higher level = lower price per sheet. The levels go from 1 (most expensive, under 10 sheets) to 10 (cheapest, 1M+ sheets).
- Broker pricing always uses Level 10 (the cheapest rate).
- You never mention "levels" to the customer. The calculator handles this automatically.

HOW SADDLE-STITCH BOOKLETS WORK:
- Saddle-stitch = stapled on the spine (like a magazine).
- Minimum 8 pages. Maximum ~64 pages (too thick to staple beyond that).
- Pages MUST be a multiple of 4. The tool auto-rounds up and tells you if it adjusted.
- An 8.5x11 booklet page is NOT printed on 8.5x11 paper. Two pages print side by side as a "spread" = 11x17. The tool handles this automatically.
- Always default to a separate heavier cover (cardstock "80 Gloss"). The cover uses 4 pages (front, inside-front, inside-back, back).
- PAGE COUNT: Pass the TOTAL page count the customer says (e.g. "20 pages" = pass 20). The tool automatically subtracts 4 cover pages when separateCover is true. Do NOT subtract yourself.
- The tool auto-picks the cheapest parent sheet size. You never need to specify sheet size.

HOW PERFECT BINDING WORKS:
- Perfect binding = glue spine (like a paperback). Needs 40+ inside pages minimum.
- pagesPerBook = INSIDE pages only (NOT counting the cover). If customer says "100 page book", pass 96 inside pages (100 minus 4 cover pages).
- Cover wraps around the spine. Spine width is auto-calculated from page count and paper thickness.
- Cover always uses cardstock (default "80 Gloss"). Inside uses text paper (default "80lb Text Gloss").
- Tool auto-picks cheapest parent sheet.

HOW SPIRAL BINDING WORKS:
- Spiral / coil binding. Any page count up to ~290 sheets (~580 pages double-sided).
- Inside pages print flat (not spreads like saddle-stitch). Tool auto-picks cheapest parent sheet.
- pagesPerBook = inside pages only (not counting covers).
- Optional extras: clear plastic front ($0.50/book), black vinyl back ($0.50/book).
- Front and back covers default to "80 Gloss" cardstock. Can skip covers entirely.

HOW FLAT PRINTING WORKS:
- Flyers, postcards, business cards, etc. Printed on parent sheets and cut down.
- The tool tries all available parent sheet sizes and auto-picks the cheapest (most efficient ups).
- Example: 500 postcards 4x6 on 12pt Gloss. 13x19 parent = 6 ups = 84 sheets. 8.5x11 = 2 ups = 250 sheets. 13x19 wins even though paper costs more per sheet.
- width/height = FINISHED piece size (e.g. 8.5 and 11 for a flyer). NOT the parent sheet.

SMART DEFAULTS (use these so you don't have to ask everything):
- Paper: 80lb Text Gloss for normal flyers/booklet insides. 12pt Gloss for postcards/business cards. 20lb Offset for pads/copies.
- Books/booklets: always default to a separate heavier cover (80 Gloss for booklet/perfect, 12pt Gloss for spiral front cover) unless told otherwise.
- Color both sides unless they say otherwise.
- No bleed unless it's a postcard, business card, or they mention "edge to edge".
- No lamination unless they ask for it.
- Perfect binding needs 40+ pages. If they say less, suggest saddle-stitch instead.
- Saddle-stitch pages must be a multiple of 4. Round up if needed and tell them.
- Spiral: default to no clear plastic, no black vinyl unless asked. Suggest them as add-ons.

BINDING TYPES (use the right calculator):
- Stapled booklet (saddle-stitch): up to ~64 pages. Use calculate_booklet.
- Perfect binding (glue spine, like a paperback): 40+ pages. Use calculate_perfect_bound.
- Spiral / coil binding: any page count up to ~580 pages (290 sheets double-sided). Use calculate_spiral.
- If they say "book" or "booklet", ask how many pages to pick the right binding. If they specify "perfect binding" or "perfect bound", use perfect bound even if you'd normally suggest otherwise.
- If page count is 40-64, they could do either saddle-stitch or perfect bound. Ask which they prefer or suggest saddle-stitch (cheaper).

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
- Never mention levels, markup, click costs, formulas, ups, parent sheets, or internal terms to the customer.
- Never say "let me calculate" or "I'll run the numbers" -- just do it.
- Never write long paragraphs. Keep it punchy.
- Never guess page count for books. Always ask.
- Never try different paper names if one fails. If a paper name fails, check the exact list from the tool description. The paper names for booklet/spiral/perfect are DIFFERENT from flat printing.
- Never manually subtract cover pages for saddle-stitch. The tool does it. Pass the customer's total page count.
- If a calculator errors, read the error message carefully, fix the ONE thing that's wrong, and try again. Don't randomly change multiple parameters.

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

LAMINATION (available on flat printing, booklet covers, and perfect-bound covers -- NOT available on spiral-bound):
- Only works on cardstock or cover-weight paper, not thin text paper.
- Can be applied to one side (S/S) or both sides (D/S).
- If a customer says "glossy finish", "protective coating", "coated", "shiny finish", or "soft touch", that's lamination.
- When a customer asks about lamination types, explain the differences like this:

LAMINATION TYPES -- explain these in simple terms when asked:
- Gloss: Shiny, reflective finish. Makes colors pop. Great for photos, menus, flyers. The most popular and affordable option.
- Matte: Smooth, non-reflective finish. Elegant, professional look. Easy to write on. Good for business cards, reports, upscale materials.
- Silk (Soft-Touch): Velvety, smooth feel. Premium look and feel. Popular for high-end business cards and luxury branding. Costs a bit more.
- Leather: Textured finish that looks and feels like leather. Very premium. Used for special presentations, VIP materials, high-end menus.

LAMINATION RECOMMENDATIONS (suggest these when appropriate):
- Business cards -> Matte or Silk for professional, Gloss for vibrant colors
- Postcards/flyers -> Gloss for eye-catching, Matte for classy
- Book/booklet covers -> Gloss is standard, Matte for a premium feel
- Menus -> Gloss (wipes clean easily)
- Presentation folders -> Silk or Matte for premium feel

FOLDING & SCORING (for flat printing only):
- Folding = physically folding the paper. Works on text-weight paper (80lb Text Gloss, 100lb Text Gloss, etc.)
- Scoring = creasing the paper first so it folds cleanly. REQUIRED for cardstock -- you can't just fold thick paper without scoring it first.
- If someone asks for a "brochure" or "tri-fold flyer", that's a fold in 3 (tri-fold).
- If someone asks for something "folded in half", that's fold in half.
- Fold types: foldInHalf (1 fold), foldIn3 (tri-fold, 2 folds), foldIn4 (3 folds), gateFold
- For text paper: use operation "folding"
- For cardstock: use operation "scoring" (score & fold)
- Common combos:
  - Tri-fold brochure: 8.5x11, foldIn3, 80lb Text Gloss, color both sides
  - Folded flyer: 8.5x11, foldInHalf, 80lb Text Gloss
  - Scored greeting card: 8.5x11, foldInHalf, 12pt Gloss, scoring
- If a customer wants folding on cardstock, tell them it needs to be scored first (we do that automatically).
- Not all paper/size/fold combos are available. If the calculator returns an error, explain and suggest alternatives.

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
      scoreFoldOperation: z
        .enum(["folding", "scoring", ""])
        .nullable()
        .describe("Folding = fold only (text-weight paper). Scoring = score then fold (cardstock/thick paper). Empty or null = no fold."),
      scoreFoldType: z
        .enum(["foldInHalf", "foldIn3", "foldIn4", "gateFold", ""])
        .nullable()
        .describe("foldInHalf = fold in half (1 fold), foldIn3 = tri-fold / letter fold (2 folds), foldIn4 = fold in 4 (3 folds), gateFold = gate fold. Empty or null = no fold."),
    }),
    execute: async ({ qty, width, height, paperName, sidesValue, hasBleed, isBroker, laminationEnabled, laminationType, laminationSides, scoreFoldOperation, scoreFoldType }) => {
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
        scoreFoldOperation: (scoreFoldOperation || "") as PrintingInputs["scoreFoldOperation"],
        scoreFoldType: (scoreFoldType || "") as PrintingInputs["scoreFoldType"],
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
      if (fullResult.scoreFoldCost && fullResult.scoreFoldCost.cost > 0) {
        parts.scoreFold = `${fmt(fullResult.scoreFoldCost.cost)} (${fullResult.scoreFoldCost.operation} - ${fullResult.scoreFoldCost.foldType})`
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
        scoreFold: scoreFoldOperation ? `${scoreFoldOperation} - ${scoreFoldType}` : "none",
      }
    },
  }),

  calculate_booklet: tool({
    description:
      `Calculate saddle-stitched (stapled) booklet cost. Includes printing, binding, optional lamination.
IMPORTANT: pagesPerBook is the TOTAL page count the customer wants (e.g. 20 pages). Must be a multiple of 4, minimum 8.
The tool automatically handles: subtracting cover pages, picking the cheapest parent sheet size, calculating spreads (an 8.5x11 page prints on 11x17 spreads).
pageWidth/pageHeight = the FINISHED page size (e.g. 8.5 and 11 for letter, 5.5 and 8.5 for half-letter). NOT the parent sheet.`,
    inputSchema: z.object({
      bookQty: z.number().describe("Number of booklets"),
      pagesPerBook: z
        .number()
        .describe("TOTAL page count including cover (must be multiple of 4, minimum 8). Example: customer says 20 pages = pass 20. The tool auto-subtracts 4 cover pages when separateCover is true."),
      pageWidth: z.number().describe("FINISHED page width in inches (e.g. 8.5 for letter, 5.5 for half-letter)"),
      pageHeight: z.number().describe("FINISHED page height in inches (e.g. 11 for letter, 8.5 for half-letter)"),
      insidePaper: z
        .string()
        .describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside page printing sides"),
      separateCover: z
        .boolean()
        .describe("Use a different (thicker) stock for the cover? Default true."),
      coverPaper: z
        .string()
        .nullable()
        .describe(`Cover paper if separate -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}. Default "80 Gloss".`),
      coverSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .nullable()
        .describe("Cover printing sides if separate. Default 4/4."),
      laminationType: z
        .enum(["none", "Gloss", "Matte", "Silk", "Leather"])
        .describe("Lamination type on cover (if separate cover). Default none."),
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
      // Validate minimum and multiple of 4
      if (pagesPerBook < 8) {
        return { error: "Saddle-stitch booklets need at least 8 pages. Did you mean a different product?" }
      }
      const adjustedPages = Math.ceil(pagesPerBook / 4) * 4
      const pagesNote = adjustedPages !== pagesPerBook
        ? `Rounded up from ${pagesPerBook} to ${adjustedPages} pages (must be a multiple of 4).`
        : null

      // When separateCover, the calculator wants INSIDE page count (total minus 4 cover pages)
      const insidePages = separateCover ? adjustedPages - 4 : adjustedPages

      const result = calculateBooklet({
        bookQty,
        pagesPerBook: insidePages,
        pageWidth,
        pageHeight,
        separateCover,
        coverPaper: coverPaper || "80 Gloss",
        coverSides: coverSides || "4/4",
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
        return { error: result.error || "Could not calculate booklet price. Check paper name and size." }
      }
      return {
        total: fmt(result.grandTotal),
        perUnit: fmt(result.pricePerBook),
        qty: bookQty,
        totalPages: adjustedPages,
        insidePages,
        size: `${pageWidth}x${pageHeight}`,
        insidePaper,
        coverPaper: separateCover ? (coverPaper || "80 Gloss") : "Same as inside",
        binding: "Saddle-stitch",
        lamination: separateCover ? laminationType : "none",
        broker: isBroker,
        parentSheetUsed: result.insideResult.sheetSize,
        upsPerSheet: result.insideResult.ups,
        costBreakdown: {
          printing: fmt(result.totalPrintingCost),
          binding: fmt(result.totalBindingPrice),
          lamination: fmt(result.totalLaminationCost),
        },
        ...(pagesNote ? { note: pagesNote } : {}),
      }
    },
  }),

  calculate_spiral: tool({
    description:
      `Calculate spiral-bound (coil) book cost. Good for manuals, cookbooks, workbooks. Any page count.
Pages print flat (not spreads). Tool auto-picks cheapest parent sheet. 
Optional: clear plastic front, black vinyl back ($0.50 each per book).`,
    inputSchema: z.object({
      bookQty: z.number().describe("Number of books"),
      pagesPerBook: z.number().describe("Number of inside pages (not counting covers)"),
      pageWidth: z.number().describe("FINISHED page width in inches (e.g. 8.5)"),
      pageHeight: z.number().describe("FINISHED page height in inches (e.g. 11)"),
      insidePaper: z.string().describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside printing sides"),
      insideBleed: z.boolean().describe("Inside pages have bleed. Default false."),
      useFrontCover: z.boolean().describe("Use a printed front cover page (cardstock). Default true."),
      useBackCover: z.boolean().describe("Use a printed back cover page (cardstock). Default true."),
      frontPaper: z.string().nullable().describe(`Front cover paper -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}. Default "80 Gloss".`),
      backPaper: z.string().nullable().describe(`Back cover paper -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}. Default "80 Gloss".`),
      clearPlastic: z.boolean().describe("Add clear plastic front cover ($0.50/book). Default false."),
      blackVinyl: z.boolean().describe("Add black vinyl back cover ($0.50/book). Default false."),
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
          paperName: frontPaper || "80 Gloss",
          sides: "4/4",
          hasBleed: false,
          sheetSize: "Cheapest",
        },
        useBackCover,
        back: {
          paperName: backPaper || "80 Gloss",
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
        insidePaper,
        frontCover: useFrontCover ? (frontPaper || "80 Gloss") : "none",
        backCover: useBackCover ? (backPaper || "80 Gloss") : "none",
        clearPlastic,
        blackVinyl,
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
      `Calculate perfect-bound (glue spine, like a paperback) book cost. Minimum 40 inside pages.
The cover wraps around the spine -- spine width is auto-calculated from page count and paper thickness.
Tool auto-picks cheapest parent sheet. pageWidth/pageHeight = FINISHED page size.`,
    inputSchema: z.object({
      bookQty: z.number().describe("Number of books"),
      pagesPerBook: z.number().describe("Number of INSIDE pages only (not counting cover). Minimum 40. Must be even number."),
      pageWidth: z.number().describe("FINISHED page width in inches (e.g. 8.5)"),
      pageHeight: z.number().describe("FINISHED page height in inches (e.g. 11)"),
      insidePaper: z.string().describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Inside printing sides"),
      coverPaper: z.string().describe(`Cover paper (cardstock) -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}. Default "80 Gloss".`),
      coverSides: z
        .enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"])
        .describe("Cover printing sides. Default 4/4."),
      laminationType: z
        .enum(["none", "Gloss", "Matte", "Silk", "Leather"])
        .describe("Cover lamination type. Default none."),
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
      if (pagesPerBook < 40) {
        return { error: `Perfect binding needs at least 40 inside pages. You said ${pagesPerBook}. Try saddle-stitch (calculate_booklet) for fewer pages.` }
      }
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
          paperName: coverPaper || "80 Gloss",
          sides: coverSides || "4/4",
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
        insidePages: pagesPerBook,
        size: `${pageWidth}x${pageHeight}`,
        insidePaper,
        coverPaper: coverPaper || "80 Gloss",
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

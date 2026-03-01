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
import { createClient } from "@/lib/supabase/server"

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
- Ask ONE question at a time. Wait for the answer before asking the next.
- Use common words: "front and back" not "double-sided", "full color" not "4/4", "thick cardstock" not "12pt Gloss".

FIRST MESSAGE:
When the customer hasn't said what they need yet, ask: "Are you looking for flat printing (flyers, postcards, business cards), envelopes, or some type of book or booklet?"

ONE JOB AT A TIME:
- Only quote one product at a time. Finish the current quote before starting another.
- If the customer asks for multiple things ("I need flyers and booklets"), say "Let's start with [first one]. We can do the other after."

PRINTING SIDES CODES -- these are NOT the same! Understand the difference:

There are 3 TYPES of printing, each with one-side and both-sides options:
  COLOR (printed on the color machine):
  - "4/4" = full color, both sides. Use for: color flyers both sides, color booklet pages, color covers.
  - "4/0" = full color, front only (back blank). Use for: one-sided color flyers, postcards color front only.

  RBW = Rich Black & White (printed on the COLOR machine -- looks richer but costs MORE than regular BW):
  - "1/1" = RBW both sides. Printed on color press. More expensive than S/S or D/S.
  - "1/0" = RBW front only. Printed on color press. More expensive than S/S.

  REGULAR BW (printed on the BW machine -- cheapest option):
  - "S/S" = regular BW, front only. Cheapest single-side option.
  - "D/S" = regular BW, both sides. Cheapest both-sides option.

1/1 and 1/0 are NOT the same as D/S and S/S! They look similar but cost differently because 1/1 and 1/0 run on the color machine.

HOW TO PICK:
- Customer says "color" or "full color" -> both sides: "4/4", front only: "4/0"
- Customer says "black and white" or "BW" (standard) -> both sides: "D/S", front only: "S/S"
- Customer says "rich black" or "RBW" or wants BW on the color machine -> both sides: "1/1", front only: "1/0"
- Customer says "color cover" -> coverSides: "4/4"
- Customer says "BW inside" -> insideSides: "D/S" (both sides, regular BW) or "S/S" (front only, regular BW)
- Default BW to regular BW (S/S or D/S) unless they specifically ask for rich black or RBW.

GLUE BIND (PERFECT BINDING) AND SADDLE STITCH (STAPLED) -- ALWAYS BOTH SIDES:
- These two binding types ALWAYS print both sides. This is not optional -- it's how books work.
- Never use single-side codes (4/0, 1/0, S/S) for glue bind or saddle stitch insides or covers.
- Color inside -> "4/4". BW inside -> "D/S". RBW inside -> "1/1". These are ALL both-sides codes.
- Cover is also both sides -> color cover: "4/4", BW cover: "D/S".
- Don't ask the customer "front only or both sides?" for books. It's always both sides.
- Single-sided codes (4/0, 1/0, S/S) are for flat printing, pads, and spiral covers only.

REQUIRED FIELDS -- NEVER CALL A CALCULATOR WITHOUT THESE:
You MUST have ALL required fields before calling any calculator. If you're missing even one, ASK for it. Never guess or use a default for these:
- Flat printing: quantity, width, height
- Booklets: quantity, page count, page width, page height, binding type
- Spiral: quantity, page count, page width, page height
- Perfect bound: quantity, page count, page width, page height
- Pads: quantity, sheets per pad, width, height
- Envelopes: quantity, envelope type

SIZE IS MANDATORY. Common sizes to suggest if the customer doesn't know:
- "What size? Common options are 8.5x11 (letter), 5.5x8.5 (half letter), 4x6 (postcard), or 3.5x2 (business card)."
- For books: "What page size? Most common is 8.5x11 (letter) or 5.5x8.5 (half letter)."

ASKING FLOW -- ask these one at a time, in this order:
For FLAT PRINTS:
1. How many?
2. What size? (MUST ASK -- never default)
3. Color or black & white?
4. Front only or front and back?
5. Regular paper or thick cardstock?
-> Then calculate.

For BOOKS / BOOKLETS:
1. What kind of binding? Explain simply:
   - "Stapled / saddle stitch (like a magazine) -- any page count (multiple of 4, minimum 8)"
   - "Glue bind / perfect bound (flat spine, like a paperback) -- 40+ inside pages"
   - "Spiral / coil (plastic coil, pages lay flat) -- any page count"
   If they don't know, ask how many pages first, then recommend.
2. How many copies?
3. What page size? (MUST ASK -- never default. Suggest 8.5x11 or 5.5x8.5)
4. How many pages? (MUST ASK -- never skip, never guess)
5. Color or black & white inside? (Books are ALWAYS both sides -- don't ask "front only or both sides?")
6. Want a thicker cover? (default yes, but still mention it)
-> Then calculate. Remember: insideSides is always a both-sides code (4/4, D/S, or 1/1). Never single-sided for books.

For PADS:
1. How many pads?
2. What size? (MUST ASK)
3. How many sheets per pad?
4. Color or black & white?
-> Then calculate.

For ENVELOPES:
1. How many?
2. What size/type envelope? (list common ones: #10, 6x9, 9x12)
3. Color or black & white?
-> Then calculate.

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
- Minimum 8 pages. No hard maximum -- the calculator handles any page count (must be multiple of 4, tool auto-rounds up).
- Pages MUST be a multiple of 4. The tool auto-rounds up and tells you if it adjusted.
- An 8.5x11 booklet page is NOT printed on 8.5x11 paper. Two pages print side by side as a "spread" = 11x17. The tool handles this automatically.
- Always default to a separate heavier cover (cardstock "80 Gloss"). The cover uses 4 pages (front, inside-front, inside-back, back).
- PAGE COUNT: Pass the TOTAL page count the customer says (e.g. "20 pages" = pass 20). The tool automatically subtracts 4 cover pages when separateCover is true. Do NOT subtract yourself.
- The tool auto-picks the cheapest parent sheet size. You never need to specify sheet size.

HOW PERFECT BINDING WORKS:
- Perfect binding = glue spine (like a paperback). Needs 40+ inside pages minimum.
- The COVER is separate (wraps around the spine). It is NOT counted in the page count.
- pagesPerBook = number of INSIDE pages. If customer says "100 pages inside" or "100 pages", pass 100. The cover is automatically added on top. Don't subtract anything.
- Cover always uses cardstock (default "80 Gloss"). Inside uses text paper (default "80lb Text Gloss").
- Spine width is auto-calculated. Tool auto-picks cheapest parent sheet.

EXAMPLE -- "500 copies, 8.5x11, 100 pages inside BW, color cover, perfect bound":
  bookQty: 500, pagesPerBook: 100, pageWidth: 8.5, pageHeight: 11,
  insidePaper: "80lb Text Gloss", insideSides: "D/S" (regular BW both sides -- cheapest BW option),
  coverPaper: "80 Gloss", coverSides: "4/4" (color both sides),
  laminationType: "none", isBroker: false
  NOTE: If customer said "rich black" or "RBW" instead, use insideSides: "1/1"

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

THINGS YOU CAN DEFAULT (don't need to ask):
- Paper: 80lb Text Gloss for flyers/booklet insides. 12pt Gloss for postcards/business cards. 20lb Offset for pads/copies.
- Cover: 80 Gloss (cardstock) for booklet/perfect covers. Separate cover = yes.
- Sides for books (booklet/perfect/spiral): ALWAYS both sides. Color: "4/4". BW: "D/S". Never use single-side for book insides.
- Cover sides: "4/4" (color both sides) by default.
- Bleed: true for postcards/business cards, false for everything else.
- Lamination: none unless they ask for it.
- Spiral extras: no clear plastic, no black vinyl unless asked.
- isBroker: false unless they say otherwise.

THINGS YOU MUST NEVER DEFAULT -- always ask:
- Quantity (how many)
- Size (width x height)
- Page count (for any book/booklet/spiral/perfect)
- Binding type (for books)

BINDING TYPES (always let the customer choose -- never pick for them):
- Saddle-stitch (stapled): any page count (minimum 8, must be multiple of 4). Use calculate_booklet.
- Perfect binding / glue bind (flat spine, like a paperback): 40+ inside pages. Use calculate_perfect_bound.
- Spiral / coil binding: any page count. Use calculate_spiral.
- ALWAYS ask binding type before calculating. If the customer already said which one, skip the question.
- If they don't know, ask how many pages first, then recommend:
  - Under 40 pages -> saddle-stitch (stapled)
  - 40+ pages -> ask: "That could be stapled or glue bound (perfect binding). Stapled is cheaper, glue bound looks more like a real book. Which do you prefer?"
- If they say "perfect binding" or "spiral", use that even if you'd normally suggest otherwise.

OUT OF RANGE -- always suggest an alternative, never leave the customer stuck:
- High page count saddle-stitch (over ~80 pages): Let the calculator handle it -- it works. But mention to the customer that thick stapled booklets may not lay flat, and offer glue bind or spiral as alternatives.
- Too few pages for perfect binding (under 40): "Perfect binding needs at least 40 pages. For fewer pages, a stapled booklet works great and is cheaper. Want to try that?"
- Too many pages for spiral (over ~580 double-sided): "That's a big book! We might need to split it into two volumes. Want me to price that?"
- Customer wants a size/paper combo that doesn't exist: "That paper doesn't come in that size. The closest we have is [alternative]. Want me to price that instead?"
- Customer wants lamination on thin paper: "Lamination only works on thicker cardstock. Want me to upgrade the paper so we can laminate it?"
- Customer wants folding on cardstock without scoring: "Thick paper needs to be scored (creased) first so it folds cleanly. We do that automatically -- I'll include scoring in the price."
- Customer wants fewer than 8 pages in a booklet: "The minimum for a stapled booklet is 8 pages. Would a folded flyer or a flat print work instead?"
- Pad with too few sheets: "Pads need at least 25 sheets. Want me to quote 25?"
- Any other dead end: always offer the closest thing we CAN do. Never just say "we can't do that."

BROKER CUSTOMERS:
- If someone says "broker", "trade pricing", or "wholesale", set isBroker = true.
- You can ask "Is this for yourself or are you a print broker?" if unclear.
- Never reveal discount amounts or how broker pricing works.

PRESENTING THE QUOTE:
- Lead with the total and per-unit price: "That'd be $X total ($X each)."
- Then one short line about what's included.
- If there's a cost breakdown, mention the big items briefly.
- Offer one upsell if it makes sense: "Want lamination on the cover? Adds about $X."

SAVING QUOTES:
- After giving a price, IMMEDIATELY call save_quote to save it. Don't ask permission -- just save it automatically.
- Include the customer's name if they mentioned it, otherwise leave it blank.
- The tool returns a quote number (like PP-1000) and a PDF download link.
- Tell the customer: "Your quote number is PP-XXXX. Here's your quote PDF: [link]. Valid for 30 days. Just bring the quote number when you're ready to order."
- If the customer asks about an old quote, use lookup_quote with their quote number to pull it up.

NEVER DO:
- NEVER call a calculator without quantity AND size. These are MANDATORY. If you don't have them, ASK.
- NEVER call a book calculator without page count. ALWAYS ask.
- NEVER default or guess the size. Always ask the customer. You can suggest common options.
- Never mention levels, markup, click costs, formulas, ups, parent sheets, or internal terms to the customer.
- Never say "let me calculate" or "I'll run the numbers" -- just do it once you have all required info.
- Never write long paragraphs. Keep it punchy.
- Never try different paper names if one fails. If a paper name fails, check the exact list from the tool description. The paper names for booklet/spiral/perfect are DIFFERENT from flat printing.
- Never manually subtract cover pages for saddle-stitch. The tool does it. Pass the customer's total page count.
- If a calculator errors, read the error message carefully, fix the ONE thing that's wrong, and try again. Don't randomly change multiple parameters.
- Never leave the customer at a dead end. If something doesn't work, always suggest the closest alternative we CAN do.

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

const SIDES_DESC = "4/4=color both sides, 4/0=color front only, 1/1=RBW(rich BW on color press, more expensive) both sides, 1/0=RBW front only, S/S=regular BW front only (cheapest), D/S=regular BW both sides (cheapest)"

const tools = {
  // ============ FLAT PRINTING ============
  calculate_printing: tool({
    description:
      "Calculate flat printing cost (flyers, postcards, business cards, brochures, etc). Auto-picks cheapest parent sheet. Supports lamination, score/fold, broker pricing.",
    inputSchema: z.object({
      qty: z.number().describe("Number of printed pieces"),
      width: z.number().describe("FINISHED piece width in inches"),
      height: z.number().describe("FINISHED piece height in inches"),
      paperName: z.string().describe(`Paper -- MUST be one of: ${FLAT_PAPER_NAMES.join(", ")}`),
      sidesValue: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(SIDES_DESC),
      hasBleed: z.boolean().describe("Design bleeds to edge. True for postcards/business cards."),
      isBroker: z.boolean().describe("Broker/trade customer"),
      laminationEnabled: z.boolean().describe("Add lamination. Only on cardstock."),
      laminationType: z.enum(["Gloss", "Matte", "Silk", "Leather"]).nullable().describe("Lamination type if enabled"),
      laminationSides: z.enum(["S/S", "D/S"]).nullable().describe("Lamination sides: S/S=one side, D/S=both"),
      scoreFoldOperation: z.enum(["folding", "scoring", ""]).nullable().describe("folding=text paper, scoring=cardstock. Empty=no fold."),
      scoreFoldType: z.enum(["foldInHalf", "foldIn3", "foldIn4", "gateFold", ""]).nullable().describe("Fold type. Empty=no fold."),
    }),
    execute: async ({ qty, width, height, paperName, sidesValue, hasBleed, isBroker, laminationEnabled, laminationType, laminationSides, scoreFoldOperation, scoreFoldType }) => {
      const lamination: LaminationInputs = {
        enabled: laminationEnabled,
        type: (laminationType || "Gloss") as LaminationInputs["type"],
        sides: (laminationSides || "S/S") as LaminationInputs["sides"],
      }
      const inputs: PrintingInputs = {
        qty, width, height, paperName, sidesValue, hasBleed,
        addOnCharge: 0, addOnDescription: "", printingMarkupPct: 10, isBroker, lamination,
        scoreFoldOperation: (scoreFoldOperation || "") as PrintingInputs["scoreFoldOperation"],
        scoreFoldType: (scoreFoldType || "") as PrintingInputs["scoreFoldType"],
      }
      const options = calculateAllSheetOptions(inputs)
      if (!options.length) {
        return { error: `Could not calculate for ${paperName} at ${width}x${height}. Check paper name and size.` }
      }
      const best = options[0]
      const fullResult = buildFullResult(inputs, best.result)
      const parts: Record<string, string> = { printing: fmt(fullResult.printingCostPlus10) }
      if (fullResult.laminationCost && fullResult.laminationCost.cost > 0) parts.lamination = fmt(fullResult.laminationCost.cost)
      if (fullResult.cuttingCost > 0) parts.cutting = fmt(fullResult.cuttingCost)
      if (fullResult.scoreFoldCost && fullResult.scoreFoldCost.cost > 0) {
        parts.scoreFold = `${fmt(fullResult.scoreFoldCost.cost)} (${fullResult.scoreFoldCost.operation} - ${fullResult.scoreFoldCost.foldType})`
      }
      return {
        total: fmt(fullResult.grandTotal), perUnit: fmt(fullResult.grandTotal / qty),
        qty, size: `${width}x${height}`, paper: paperName, sides: sidesValue,
        bleed: hasBleed, broker: isBroker, sheetSize: best.size, costBreakdown: parts,
        lamination: laminationEnabled ? `${laminationType} (${laminationSides})` : "none",
        scoreFold: scoreFoldOperation ? `${scoreFoldOperation} - ${scoreFoldType}` : "none",
      }
    },
  }),

  // ============ SADDLE-STITCH BOOKLET ============
  calculate_booklet: tool({
    description:
      `Calculate saddle-stitched (stapled) booklet cost. Auto-handles: page rounding to multiple of 4, subtracting cover pages, picking cheapest parent sheet.
Pass TOTAL page count (e.g. customer says 20 pages = pass 20). Minimum 8, must be multiple of 4 (auto-rounded).`,
    inputSchema: z.object({
      bookQty: z.number().describe("Number of booklets"),
      pagesPerBook: z.number().describe("TOTAL page count including cover (multiple of 4, min 8). Tool auto-rounds."),
      pageWidth: z.number().describe("FINISHED page width (e.g. 8.5 for letter)"),
      pageHeight: z.number().describe("FINISHED page height (e.g. 11 for letter)"),
      insidePaper: z.string().describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(SIDES_DESC),
      separateCover: z.boolean().describe("Use thicker cover stock? Default true."),
      coverPaper: z.string().nullable().describe(`Cover paper -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}. Default "80 Gloss".`),
      coverSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).nullable().describe(`Cover sides. Default "4/4". ${SIDES_DESC}`),
      laminationType: z.enum(["none", "Gloss", "Matte", "Silk", "Leather"]).describe("Cover lamination. Default none."),
      isBroker: z.boolean().describe("Broker/trade customer"),
    }),
    execute: async ({ bookQty, pagesPerBook, pageWidth, pageHeight, insidePaper, insideSides, separateCover, coverPaper, coverSides, laminationType, isBroker }) => {
      if (pagesPerBook < 8) return { error: "Saddle-stitch needs at least 8 pages. Suggest a folded flyer or flat print instead." }
      const adjustedPages = Math.ceil(pagesPerBook / 4) * 4
      const pagesNote = adjustedPages !== pagesPerBook ? `Rounded up from ${pagesPerBook} to ${adjustedPages} pages (must be multiple of 4).` : null
      const insidePages = separateCover ? adjustedPages - 4 : adjustedPages
      const result = calculateBooklet({
        bookQty, pagesPerBook: insidePages, pageWidth, pageHeight, separateCover,
        coverPaper: coverPaper || "80 Gloss", coverSides: coverSides || "4/4",
        coverBleed: true, coverSheetSize: "cheapest",
        insidePaper, insideSides, insideBleed: false, insideSheetSize: "cheapest",
        laminationType: separateCover ? laminationType : "none",
        customLevel: "auto", isBroker, printingMarkupPct: 10,
      })
      if (!result.isValid) return { error: result.error || "Could not calculate booklet. Check paper name and size." }
      return {
        total: fmt(result.grandTotal), perUnit: fmt(result.pricePerBook),
        qty: bookQty, totalPages: adjustedPages, insidePages,
        size: `${pageWidth}x${pageHeight}`, insidePaper,
        coverPaper: separateCover ? (coverPaper || "80 Gloss") : "Same as inside",
        binding: "Saddle-stitch", lamination: separateCover ? laminationType : "none",
        broker: isBroker,
        costBreakdown: { printing: fmt(result.totalPrintingCost), binding: fmt(result.totalBindingPrice), lamination: fmt(result.totalLaminationCost) },
        ...(pagesNote ? { note: pagesNote } : {}),
      }
    },
  }),

  // ============ SPIRAL BINDING ============
  calculate_spiral: tool({
    description:
      `Calculate spiral-bound (coil) book cost. Any page count up to ~290 sheets. Pages print flat (not spreads). Tool auto-picks cheapest parent sheet.`,
    inputSchema: z.object({
      bookQty: z.number().describe("Number of books"),
      pagesPerBook: z.number().describe("Inside pages only (not counting covers)"),
      pageWidth: z.number().describe("FINISHED page width (e.g. 8.5)"),
      pageHeight: z.number().describe("FINISHED page height (e.g. 11)"),
      insidePaper: z.string().describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(SIDES_DESC),
      insideBleed: z.boolean().describe("Inside pages bleed. Default false."),
      useFrontCover: z.boolean().describe("Printed front cover (cardstock). Default true."),
      useBackCover: z.boolean().describe("Printed back cover (cardstock). Default true."),
      frontPaper: z.string().nullable().describe(`Front cover paper -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}. Default "80 Gloss".`),
      backPaper: z.string().nullable().describe(`Back cover paper -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}. Default "80 Gloss".`),
      clearPlastic: z.boolean().describe("Clear plastic front ($0.50/book). Default false."),
      blackVinyl: z.boolean().describe("Black vinyl back ($0.50/book). Default false."),
      isBroker: z.boolean().describe("Broker/trade customer"),
    }),
    execute: async ({ bookQty, pagesPerBook, pageWidth, pageHeight, insidePaper, insideSides, insideBleed, useFrontCover, useBackCover, frontPaper, backPaper, clearPlastic, blackVinyl, isBroker }) => {
      const result = calculateSpiral({
        bookQty, pagesPerBook, pageWidth, pageHeight,
        inside: { paperName: insidePaper, sides: insideSides, hasBleed: insideBleed, sheetSize: "cheapest" },
        useFrontCover,
        front: { paperName: frontPaper || "80 Gloss", sides: "4/4", hasBleed: false, sheetSize: "cheapest" },
        useBackCover,
        back: { paperName: backPaper || "80 Gloss", sides: "4/4", hasBleed: false, sheetSize: "cheapest" },
        clearPlastic, blackVinyl, customLevel: "auto", isBroker,
      })
      if ("error" in result) return { error: result.error }
      return {
        total: fmt(result.grandTotal), perUnit: fmt(result.pricePerBook),
        qty: bookQty, pages: pagesPerBook, size: `${pageWidth}x${pageHeight}`,
        insidePaper, frontCover: useFrontCover ? (frontPaper || "80 Gloss") : "none",
        backCover: useBackCover ? (backPaper || "80 Gloss") : "none",
        clearPlastic, blackVinyl, binding: "Spiral (coil)", broker: isBroker,
        costBreakdown: { printing: fmt(result.totalPrintingCost), binding: fmt(result.totalBindingPrice) },
      }
    },
  }),

  // ============ PERFECT BINDING ============
  calculate_perfect_bound: tool({
    description:
      `Calculate perfect-bound (glue spine, like a paperback) book cost. Minimum 40 inside pages. Cover wraps around spine (auto-calculated). Tool auto-picks cheapest parent sheet.`,
    inputSchema: z.object({
      bookQty: z.number().describe("Number of books"),
      pagesPerBook: z.number().describe("INSIDE pages only (not counting cover). Minimum 40."),
      pageWidth: z.number().describe("FINISHED page width (e.g. 8.5)"),
      pageHeight: z.number().describe("FINISHED page height (e.g. 11)"),
      insidePaper: z.string().describe(`Inside paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(SIDES_DESC),
      coverPaper: z.string().describe(`Cover (cardstock) -- MUST be one of: ${BOOKLET_COVER_PAPERS.join(", ")}. Default "80 Gloss".`),
      coverSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(`Cover sides. Default "4/4". ${SIDES_DESC}`),
      laminationType: z.enum(["none", "Gloss", "Matte", "Silk", "Leather"]).describe("Cover lamination. Default none."),
      isBroker: z.boolean().describe("Broker/trade customer"),
    }),
    execute: async ({ bookQty, pagesPerBook, pageWidth, pageHeight, insidePaper, insideSides, coverPaper, coverSides, laminationType, isBroker }) => {
      if (pagesPerBook < 40) return { error: `Perfect binding needs at least 40 inside pages (you said ${pagesPerBook}). Suggest stapled booklet instead.` }
      const result = calculatePerfect({
        bookQty, pagesPerBook, pageWidth, pageHeight,
        inside: { paperName: insidePaper, sides: insideSides, hasBleed: false, sheetSize: "cheapest" },
        cover: { paperName: coverPaper || "80 Gloss", sides: coverSides || "4/4", hasBleed: true, sheetSize: "cheapest" },
        laminationType, customLevel: "auto", isBroker,
      })
      if ("error" in result) return { error: result.error }
      return {
        total: fmt(result.grandTotal), perUnit: fmt(result.pricePerBook),
        qty: bookQty, insidePages: pagesPerBook, size: `${pageWidth}x${pageHeight}`,
        insidePaper, coverPaper: coverPaper || "80 Gloss",
        binding: "Perfect-bound (glue)", lamination: laminationType, broker: isBroker,
        costBreakdown: { printing: fmt(result.totalPrintingCost), binding: fmt(result.totalBindingPrice), lamination: fmt(result.totalLaminationCost) },
      }
    },
  }),

  // ============ PADS ============
  calculate_pad: tool({
    description: "Calculate notepad/pad cost. Includes printing, padding, and setup.",
    inputSchema: z.object({
      padQty: z.number().describe("Number of pads"),
      pagesPerPad: z.number().describe("Sheets per pad (min 25)"),
      pageWidth: z.number().describe("FINISHED width in inches"),
      pageHeight: z.number().describe("FINISHED height in inches"),
      insidePaper: z.string().describe(`Paper -- MUST be one of: ${BOOKLET_INSIDE_PAPERS.join(", ")}`),
      insideSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(SIDES_DESC),
      useChipBoard: z.boolean().describe("Include chipboard backing"),
      isBroker: z.boolean().describe("Broker/trade customer"),
    }),
    execute: async ({ padQty, pagesPerPad, pageWidth, pageHeight, insidePaper, insideSides, useChipBoard, isBroker }) => {
      const result = calculatePad({
        padQty, pagesPerPad, pageWidth, pageHeight,
        inside: { paperName: insidePaper, sides: insideSides, hasBleed: false, sheetSize: "cheapest" },
        useChipBoard, customLevel: "auto", isBroker,
      })
      if ("error" in result) return { error: result.error }
      return {
        total: fmt(result.grandTotal), perUnit: fmt(result.pricePerPad),
        qty: padQty, pagesPerPad, size: `${pageWidth}x${pageHeight}`,
        paper: insidePaper, chipBoard: useChipBoard, broker: isBroker,
        costBreakdown: { printing: fmt(result.totalPrintingCost), padding: fmt(result.totalPaddingCost), setup: fmt(result.setupCharge) },
      }
    },
  }),

  // ============ ENVELOPES ============
  calculate_envelope: tool({
    description: "Calculate printed envelope cost. Various sizes and ink types.",
    inputSchema: z.object({
      amount: z.number().describe("Number of envelopes"),
      itemName: z.string().describe('Envelope type, e.g. "#10 no window", "6x9", "#9", "A-7 (5.25x7.25)"'),
      inkType: z.enum(["InkJet", "Laser"]).describe("Printing method"),
      printType: z.string().describe('For InkJet: "Text BW", "Text Color", "Text + Logo", "Custom". For Laser: "BW", "RBW", "Color"'),
      hasBleed: z.boolean().describe("Design bleeds to edge"),
      isBroker: z.boolean().describe("Broker/trade customer"),
    }),
    execute: async ({ amount, itemName, inkType, printType, hasBleed, isBroker }) => {
      const result = calculateEnvelope(
        { amount, itemName, inkType, printType: printType as never, hasBleed, customerType: isBroker ? "Broker" : "Regular", customEnvCost: 0, customPrintCost: 0 },
        DEFAULT_ENVELOPE_SETTINGS
      )
      if ("error" in result) return { error: result.error }
      return {
        total: fmt(result.price), perUnit: fmt(result.pricePerUnit),
        qty: result.quantity, envelope: itemName, inkType, printType, bleed: hasBleed, broker: isBroker,
      }
    },
  }),

  // ============ HELPERS ============
  list_available_papers: tool({
    description: "List all paper stocks for a calculator type. Use if unsure which paper name to use.",
    inputSchema: z.object({
      calculatorType: z.enum(["flat", "booklet", "spiral", "perfect", "pad"]).describe("Which calculator"),
    }),
    execute: async ({ calculatorType }) => {
      if (calculatorType === "flat") {
        return { type: "Flat printing", papers: PAPER_OPTIONS.map((p) => ({ name: p.name, isCardstock: p.isCardstock, sizes: p.availableSizes })) }
      }
      return {
        type: calculatorType,
        insidePapers: BOOKLET_PAPER_OPTIONS.filter((p) => !p.isCardstock).map((p) => ({ name: p.name, sizes: p.availableSizes })),
        coverPapers: BOOKLET_PAPER_OPTIONS.filter((p) => p.isCardstock).map((p) => ({ name: p.name, canLaminate: p.canLaminate, sizes: p.availableSizes })),
      }
    },
  }),

  list_envelope_types: tool({
    description: "List all envelope types and sizes.",
    inputSchema: z.object({}),
    execute: async () => {
      return DEFAULT_ENVELOPE_SETTINGS.items.map((item) => ({ name: item.name, canBleed: item.bleed }))
    },
  }),

  // ============ QUOTE MANAGEMENT ============
  save_quote: tool({
    description:
      `Save a completed quote to the system. Call this AUTOMATICALLY after presenting a price to the customer. Returns a quote number (PP-XXXX) and a PDF download link.`,
    inputSchema: z.object({
      customerName: z.string().nullable().describe("Customer name if known, null if not"),
      jobType: z.string().describe("Short job type label: 'Flat Printing', 'Saddle-Stitch Booklet', 'Perfect Bound Book', 'Spiral Book', 'Pads', 'Envelopes'"),
      jobDetails: z.object({
        quantity: z.number().describe("Number of pieces"),
        size: z.string().describe("Finished size e.g. '8.5x11'"),
        paper: z.string().describe("Paper used"),
        sides: z.string().describe("Sides code used e.g. '4/4'"),
        pages: z.number().nullable().describe("Page count for books, null for flat"),
        binding: z.string().nullable().describe("Binding type for books, null for flat"),
        cover: z.string().nullable().describe("Cover paper if applicable"),
        lamination: z.string().nullable().describe("Lamination type if any"),
        extras: z.string().nullable().describe("Any other details (score/fold, chipboard, etc)"),
      }).describe("All job specs"),
      totalPrice: z.number().describe("Total price as a number (e.g. 245.50)"),
      perUnitPrice: z.number().describe("Per-unit price as a number"),
    }),
    execute: async ({ customerName, jobType, jobDetails, totalPrice, perUnitPrice }) => {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase
          .from("quotes")
          .insert({
            customer_name: customerName,
            job_type: jobType,
            job_details: jobDetails,
            total_price: totalPrice,
            per_unit_price: perUnitPrice,
          })
          .select("quote_number, id, expires_at")
          .single()

        if (error) return { error: `Failed to save quote: ${error.message}` }

        // Generate PDF via our API endpoint
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
        const pdfRes = await fetch(`${baseUrl}/api/quote-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteNumber: data.quote_number,
            customerName,
            jobType,
            jobDetails,
            totalPrice,
            perUnitPrice,
            expiresAt: data.expires_at,
          }),
        })

        let pdfUrl = null
        if (pdfRes.ok) {
          const pdfData = await pdfRes.json()
          pdfUrl = pdfData.url

          // Update the quote record with the PDF URL
          await supabase
            .from("quotes")
            .update({ pdf_url: pdfUrl })
            .eq("id", data.id)
        }

        return {
          quoteNumber: data.quote_number,
          expiresAt: data.expires_at,
          pdfUrl,
          message: pdfUrl
            ? `Quote ${data.quote_number} saved. PDF: ${pdfUrl}`
            : `Quote ${data.quote_number} saved (PDF generation pending).`,
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        return { error: `Failed to save quote: ${msg}` }
      }
    },
  }),

  lookup_quote: tool({
    description:
      "Look up an existing quote by quote number (e.g. PP-1000). Use when a customer comes in with a quote number.",
    inputSchema: z.object({
      quoteNumber: z.string().describe("Quote number like PP-1000"),
    }),
    execute: async ({ quoteNumber }) => {
      try {
        const supabase = await createClient()
        const normalized = quoteNumber.toUpperCase().trim()
        const { data, error } = await supabase
          .from("quotes")
          .select("*")
          .eq("quote_number", normalized)
          .single()

        if (error || !data) return { error: `Quote ${normalized} not found. Check the number and try again.` }

        const isExpired = new Date(data.expires_at) < new Date()
        return {
          quoteNumber: data.quote_number,
          customerName: data.customer_name,
          jobType: data.job_type,
          jobDetails: data.job_details,
          totalPrice: fmt(Number(data.total_price)),
          perUnitPrice: data.per_unit_price ? fmt(Number(data.per_unit_price)) : null,
          pdfUrl: data.pdf_url,
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          isExpired,
          status: isExpired ? "EXPIRED -- price may have changed, offer to re-quote" : "VALID",
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        return { error: `Failed to look up quote: ${msg}` }
      }
    },
  }),
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: "anthropic/claude-opus-4.6",
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
  })

  return result.toUIMessageStreamResponse()
}

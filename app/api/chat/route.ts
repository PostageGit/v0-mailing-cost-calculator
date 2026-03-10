import { streamText, tool, convertToModelMessages, stepCountIs } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
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
import { createClient } from "@supabase/supabase-js"

// Fallback paper lists (used if database is unavailable)
const FALLBACK_FLAT_PAPERS = PAPER_OPTIONS.map((p: { name: string }) => p.name)
const FALLBACK_INSIDE_PAPERS = BOOKLET_PAPER_OPTIONS.filter((p: { isCardstock: boolean }) => !p.isCardstock).map((p: { name: string }) => p.name)
const FALLBACK_COVER_PAPERS = BOOKLET_PAPER_OPTIONS.filter((p: { isCardstock: boolean }) => p.isCardstock).map((p: { name: string }) => p.name)

// Fetch papers from database dynamically
async function fetchPaperLists() {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    
    const [flatRes, insideRes, coverRes] = await Promise.all([
      fetch(`${baseUrl}/api/papers?active=true&use_for=flat_printing`),
      fetch(`${baseUrl}/api/papers?active=true&use_for=book_inside`),
      fetch(`${baseUrl}/api/papers?active=true&use_for=book_cover`),
    ])
    
    const flatPapers = flatRes.ok ? await flatRes.json() : []
    const insidePapers = insideRes.ok ? await insideRes.json() : []
    const coverPapers = coverRes.ok ? await coverRes.json() : []
    
    return {
      flatPaperNames: flatPapers.length > 0 ? flatPapers.map((p: { name: string }) => p.name) : FALLBACK_FLAT_PAPERS,
      insidePaperNames: insidePapers.length > 0 ? insidePapers.map((p: { name: string }) => p.name) : FALLBACK_INSIDE_PAPERS,
      coverPaperNames: coverPapers.length > 0 ? coverPapers.map((p: { name: string }) => p.name) : FALLBACK_COVER_PAPERS,
    }
  } catch {
    // Fallback to hardcoded lists if fetch fails
    return {
      flatPaperNames: FALLBACK_FLAT_PAPERS,
      insidePaperNames: FALLBACK_INSIDE_PAPERS,
      coverPaperNames: FALLBACK_COVER_PAPERS,
    }
  }
}

function fmt(n: number) {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const SYSTEM_PROMPT = `You are a quick, friendly quote helper for a print shop. Customers don't know printing jargon. Keep every reply SHORT -- 1-3 sentences max. Ask ONE question at a time.

RULE #1 -- THE GOLDEN RULE (overrides everything else):
NEVER change a spec the customer explicitly gave you. If they said "4/0", you pass "4/0". If they said "S/S", you pass "S/S" (but ask if they meant D/S for book insides). If they said "no bleed", pass false. If they said "80lb Offset", pass "80lb Offset". Your job is to calculate what they asked for, not what you think is better. The ONLY values you fill in are ones the customer did NOT mention -- and those follow the defaults listed below.

RULE #2 -- NEVER MAKE UP NUMBERS:
NEVER estimate, guess, or make up a price, cost, or add-on amount. Every dollar amount you tell the customer MUST come from a calculator tool. If you want to suggest an option like "want lamination?", say "Want me to price it with matte lamination?" -- do NOT say "that'd add about $X" unless you actually ran the calculator with and without it and got real numbers. If you haven't calculated it, you don't know the price. Period.

STYLE:
- Talk like a real person at a counter, not a robot. Short sentences.
- Never use bullet lists when talking to the customer. Just ask a plain question.
- Ask ONE question at a time. Wait for the answer before asking the next.
- Use common words when ASKING questions, but when SHOWING A QUOTE always include the exact technical specs.
- When presenting a price, ALWAYS show the exact specs you sent to the calculator so the customer can verify:
  qty, size, pages, inside paper + sides code, cover paper + sides code, bleed (yes/no for inside and cover), lamination, binding, broker (yes/no).
  Example: "100 copies, 8x10, 40 inside pages, 20lb Offset D/S, 12pt Matte cover 4/4, bleed on inside and cover, matte lamination, fold & staple, regular pricing."

FIRST MESSAGE:
When the customer hasn't said what they need yet, ask: "Are you looking for flat printing (flyers, postcards, business cards), envelopes, or some type of book or booklet?"

CONFIRM BEFORE CALCULATING -- THIS IS MANDATORY:
- Before calling ANY calculator tool, you MUST echo back the EXACT specs you are about to use and ask "Sound right?"
- Example: "OK so that's 1050 copies, 8.5x11, 16 pages, 20lb Offset D/S inside, 10pt Gloss 4/0 cover, matte lam, bleed on both, fold & staple, regular pricing. Sound right?"
- Wait for the customer to confirm. If they say yes, THEN call the tool with those EXACT specs. Do NOT change any value between the confirmation and the tool call.
- If the customer corrects something, update and confirm again.
- NEVER assume, guess, or "improve" a spec the customer gave you. If they said 4/0, use 4/0. If they said S/S, ask "just to confirm, S/S is single-sided BW -- books need both sides on the inside, did you mean D/S?"
- The ONLY exception: if the customer says "just give me a quick price" or "skip confirmation", you can calculate directly.

CRITICAL -- DO NOT INVENT RESTRICTIONS:
- NEVER tell the customer a size, paper, or product is "not available" or "too large" unless the calculator tool actually returns an error.
- NEVER make up equipment limitations, size limits, or paper restrictions that are not in this prompt.
- If you're unsure whether something is possible, TRY the calculator first. Only report limitations if the tool returns an actual error.
- You are a pricing assistant, not a production expert. Let the calculator decide what's possible.

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

SIDES CODES FOR BOOK INSIDES -- DEPENDS ON BINDING TYPE:
1. SADDLE-STITCH (fold & staple): Uses folded signatures. Inside pages ALWAYS print both sides -- it's physically impossible to print single-sided on a folded sheet. Only allow D/S, 4/4, 1/1. If customer asks for S/S on saddle-stitch, explain: "Saddle-stitch uses folded sheets so both sides always print. If you need single-sided, we'd use spiral or padding instead."
2. SPIRAL / PADDING / NOTEPAD: Binds individual leaves. Single-sided (S/S, 4/0, 1/0) IS possible -- each content page uses one full leaf with the back blank. This DOUBLES the paper usage. The tool doubles the page count automatically. S/S is most common for pads/notepads, then spiral. Warn the customer: "Single-sided uses twice the paper, so it'll cost more."
3. PERFECT BINDING: Binds individual signatures. S/S is technically possible but very uncommon. If customer asks, warn them it doubles the paper and suggest D/S instead, but price it if they insist.
- SADDLE-STITCH (FOLD & STAPLE) COVER: CAN be one-sided OR both-sided. RESPECT what the customer says.
  - If they say "4/0" or "front only" or "one side" -> coverSides: "4/0". Do NOT override to 4/4.
  - If they say "4/4" or "both sides" -> coverSides: "4/4".
  - BW front only -> coverSides: "S/S". BW both sides -> coverSides: "D/S".
  - ONLY default to "4/4" if the customer says NOTHING about cover sides. If they specify ANY sides code, USE IT exactly as given.
- PERFECT BINDING COVER: CAN be one-sided (4/0 = color outside only, very common) or both-sided (4/4). Not every cover has printing on the inside. RESPECT what the customer says. Default "4/4" only if they don't specify.
- Don't ask "front only or both sides?" for saddle-stitch INSIDE pages -- they're folded signatures so always both sides. For spiral/perfect/padding insides, S/S is valid (doubles paper).

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
6. Does it have bleed? (design prints to the edge with no white border). Postcards, business cards, door hangers = almost always YES. Text-heavy flyers/letters = usually NO. If unsure, ASK.
-> Then calculate.

For BOOKS / BOOKLETS:
1. What kind of binding? Explain simply:
   - "Fold & Staple / saddle stitch (like a magazine) -- minimum 8 pages, multiple of 4, max about 140 pages plus cover"
   - "Glue bind / perfect bound (flat spine, like a paperback) -- minimum 40 inside pages, no hard max"
   - "Spiral / coil (plastic coil, pages lay flat) -- any size including 8.5x11, up to 290 sheets (~580 pages double-sided)"
   If they don't know, ask how many pages first, then recommend.
2. How many copies?
3. What page size? (MUST ASK -- never default. Suggest common sizes: 6x9, 8.5x5.5, 8.5x11. See BOOK SIZE PRICING below.)
4. How many pages? (MUST ASK -- never skip, never guess)
5. Color or black & white inside? (Books are ALWAYS both sides -- don't ask "front only or both sides?")
6. Cover? For perfect binding, always a separate cover (suggest 12pt or 10pt Gloss). For saddle-stitch, ask: "Do you want a separate heavier cover (like 10pt or 12pt Gloss) or self-cover (same paper as inside)?"
7. Bleed? MUST ASK for inside pages: "Do the inside pages bleed to the edge or have a white border?" This changes the price. Covers default to bleed (don't need to ask). If they don't know, quote both options.
-> Then calculate. Remember: insideSides is always a both-sides code (4/4, D/S, or 1/1). Never single-sided for books.

For PADS:
1. How many pads?
2. What size? (MUST ASK) -- Pads can be ANY size that fits on a parent sheet (up to 12x18). Common sizes: 8.5x11, 5.5x8.5, 4.25x5.5, 4x6, 3.5x5. NEVER tell the customer a size is "too large" unless it literally exceeds 12x18.
3. How many sheets per pad?
4. Color or black & white?
5. Does it have bleed? (design prints to the edge -- adds ~0.25" per side, meaning fewer fit per parent sheet = higher cost). Default no bleed.
6. Chipboard backing? (default yes)
-> Then calculate. Do NOT invent size restrictions or equipment limitations that don't exist.

For ENVELOPES:
1. How many?
2. What size/type envelope? (list common ones: #10, 6x9, 9x12)
3. Color or black & white?
4. Does it have bleed? (full coverage printing to the edge). Most envelopes are NO bleed (just a logo/return address). Full-color printed envelopes = YES bleed.
-> Then calculate.

PAPER KNOWLEDGE -- understand this so you can guide customers:
- There are two categories: INSIDE PAPER (thinner, for pages) and COVER/CARDSTOCK (thicker, for covers, postcards, business cards).
- "Cardstock" = thick stiff paper. Customers use this for business cards, postcards, covers, door hangers. NOT for inside pages of books or regular flyers.
- "Regular paper" = thinner text-weight paper. Good for flyers, inside pages of booklets, copies.
- For FLAT PRINTS: use text paper for flyers/letters, use cardstock for postcards/business cards/door hangers.
- If a customer says "glossy" they probably mean 80lb Text Gloss (for thin) or 12pt Gloss (for thick).
- If they say "matte" they probably mean 80lb Text Matte or 10pt Matte.

COVER PAPER FOR BOOKS -- important:
- SELF-COVER vs SEPARATE COVER:
  - "Self-cover" means the ENTIRE book (cover AND inside) uses the EXACT SAME paper. Example: everything is 20lb Offset. Set separateCover = false.
  - "Separate cover" means the cover is a DIFFERENT paper from the inside pages. Example: cover is 10pt Offset, inside is 20lb Offset. These are TWO DIFFERENT papers, so separateCover = true.
  - Even if the cover is NOT cardstock (e.g. 10pt Offset, 60lb Offset), if it's a different paper from the inside, it IS a separate cover.
- PERFECT BINDING: ALWAYS has a separate cover. Most popular cover is 12pt Gloss or 10pt Gloss. Default to 12pt Gloss if they don't specify.
- SADDLE-STITCH: Can have a separate cover OR self-cover.
  - Separate cover: most popular is 10pt or 12pt Gloss. Some use 80 Cover Gloss or even 10pt Offset. Suggest 10pt Gloss as a good middle ground.
  - Self-cover: all pages (including the outer 4) are the same paper. Set separateCover = false.
  - Default: ask if they want a separate cover. If unsure, recommend a separate cover.
- SPIRAL: covers vary -- can be clear plastic front, black vinyl back, or printed card covers. The calculator handles these separately.

HOW PRINTING ACTUALLY WORKS (understand this so you don't get confused):

UPS & PARENT SHEETS:
- We don't print one piece at a time. We print on large "parent sheets" and cut them down.
- "Ups" = how many finished pieces fit on one parent sheet. Example: a 4x6 postcard fits 4-up on an 8.5x11 sheet, or 8-up on a 11x17 sheet.
- The calculator automatically figures out the best layout (ups) and picks the cheapest parent sheet size.
- A 5.5x8.5 booklet page prints as a "spread" -- two pages side by side = 11x8.5, which fits on an 11x17 parent sheet.
- More ups = fewer parent sheets = cheaper. The calculator handles this automatically.

BLEED -- important for accurate pricing:
- "Bleed" means the design extends to the very edge of the page (no white border). It affects parent-sheet layout and pricing.
- Bleed changes the price because it affects how many pages fit on a parent press sheet (fewer ups with bleed = more sheets = higher cost).
- IMPORTANT: 8.5x11 pages with bleed do NOT fit on 8.5x11 sheets -- they need 11x17 sheets. So bleed on full-size pages costs significantly more.
- COVERS: almost always YES bleed (coverBleed: true). Most covers have full-bleed designs.
- FLAT PRINTS: postcards, business cards, door hangers = YES bleed. Text-heavy flyers/letters = usually NO bleed.
- INSIDE PAGES of books: YOU MUST ASK. Do NOT assume. Ask the customer: "Do the inside pages have bleed (design goes to the edge) or no bleed (white border around the page)?" This makes a real price difference.
- If the customer doesn't know or doesn't specify bleed, quote BOTH options so they can compare: "With bleed: $X / Without bleed: $Y" -- run the calculator twice if needed.

BOOK SIZE PRICING -- important for quoting books:
- The most popular book size is 6x9 (for both saddle-stitch and perfect binding).
- 8.5x5.5 (landscape half-letter) results in the SAME price as 6x9 because the parent sheet layout fits the same number of ups.
- 6.5x9.5 or 7x10 fit only HALF as many ups on the parent sheet, resulting in roughly DOUBLE the click cost. Warn customers about this.
- If a customer asks for 6.5x9.5 or 7x10, let them know: "That size costs noticeably more than 6x9 because we get half as many pages per press sheet. Want to stick with 6x9 to save money, or go with the larger size?"
- 8.5x11 is common for manuals, catalogs, and workbooks but NOT typical for "books" (novels, guides, etc).

PRICE LEVELS:
- Price depends on how many PARENT SHEETS are needed (not the quantity of finished pieces).
- More parent sheets = higher level = lower price per sheet. The levels go from 1 (most expensive, under 10 sheets) to 10 (cheapest, 1M+ sheets).
- You never mention "levels" to the customer. The calculator handles this automatically.

HOW BROKER PRICING WORKS (internal -- never explain this to the customer):
- PRINTING: Broker forces Level 10 (cheapest per-sheet rate). The calculator does this automatically when isBroker=true.
- FINISHING (binding, lamination): Broker gets a PERCENTAGE DISCOUNT on these costs. The calculator applies:
  - A lower markup multiplier on binding (e.g. 2.5x instead of 3.5x for saddle-stitch, 2.25x instead of 3x for perfect).
  - A 30% reduction on lamination markup.
  - An additional 15% discount on the total non-printing costs (binding + lamination combined).
- All of this happens automatically when you pass isBroker=true. Just set the flag correctly and the calculator handles everything.
- Broker minimum: if the broker printing total is under $250, the calculator applies either a $25 setup fee or Level 5 pricing (whichever is higher) as a minimum.

HOW SADDLE-STITCH BOOKLETS WORK:
- Saddle-stitch = stapled on the spine (like a magazine).
- Minimum 8 pages, maximum about 140 pages plus cover. Must be multiple of 4 (tool auto-rounds up). Over 140 pages, suggest perfect binding instead.
- Pages MUST be a multiple of 4. The tool auto-rounds up and tells you if it adjusted.
- An 8.5x11 booklet page is NOT printed on 8.5x11 paper. Two pages print side by side as a "spread" = 11x17. The tool handles this automatically.
- Separate cover uses 4 pages (front, inside-front, inside-back, back). Self-cover = no separate cover, the EXACT SAME paper for every page.
- IMPORTANT: If cover paper is different from inside paper in ANY way (different weight, different coating, different type), it's a SEPARATE cover, even if both are offset stock.
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
- Spiral / coil binding. Maximum 290 sheets (~580 pages double-sided). Binding price tiers: 5-80, 81-100, 101-150, 151-200, 201-290 sheets.
- Inside pages print flat (not spreads like saddle-stitch). Tool auto-picks cheapest parent sheet.
- pagesPerBook = inside pages only (not counting covers).
- Optional extras: clear plastic front ($0.50/book), black vinyl back ($0.50/book).
- Front and back covers default to "80 Gloss" cardstock. Can skip covers entirely.
- VALID SIZES: 8.5x11 IS a valid spiral book size. Also 8.5x5.5, 6x9, and any size that fits on available sheets (8.5x11, 11x17, 12x18, 13x19).
- BLEED WARNING: An 8.5x11 page with bleed does NOT fit on an 8.5x11 sheet (bleed adds margins). If the customer wants 8.5x11 with bleed, it prints on 11x17 sheets (more expensive). Without bleed, it fits on 8.5x11 sheets (cheaper). ALWAYS ask about bleed -- do not assume.

HOW FLAT PRINTING WORKS:
- Flyers, postcards, business cards, etc. Printed on parent sheets and cut down.
- The tool tries all available parent sheet sizes and auto-picks the cheapest (most efficient ups).
- Example: 500 postcards 4x6 on 12pt Gloss. 13x19 parent = 6 ups = 84 sheets. 8.5x11 = 2 ups = 250 sheets. 13x19 wins even though paper costs more per sheet.
- width/height = FINISHED piece size (e.g. 8.5 and 11 for a flyer). NOT the parent sheet.

THINGS YOU CAN DEFAULT (don't need to ask):
- Paper: 80lb Text Gloss for flyers/booklet insides. 12pt Gloss for postcards/business cards. 20lb Offset for pads/copies.
- Cover: 80 Gloss (cardstock) for booklet/perfect covers. Separate cover = yes.
- Sides for saddle-stitch insides: ALWAYS both sides (D/S, 4/4, 1/1). For spiral/padding/perfect: default to both sides, but S/S is valid if customer requests it (doubles paper).
- Cover sides: ONLY default to "4/4" if the customer said NOTHING about cover sides. If they specify a sides code (like "4/0"), USE IT.
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
 - Fold & Staple (saddle-stitch): minimum 8 pages, multiple of 4, max ~140 pages plus cover. Use calculate_booklet.
- Perfect binding / glue bind (flat spine, like a paperback): minimum 40 inside pages. Use calculate_perfect_bound. SUPPORTS SECTIONS: A perfect bound book can have multiple inside sections with different papers (e.g., 100 pages BW text + 16 pages color photos). Use the "sections" array parameter when the customer wants different papers for different parts of the book.
- Spiral / coil binding: max 290 sheets (~580 pages double-sided). Use calculate_spiral.
- ALWAYS ask binding type before calculating. If the customer already said which one, skip the question.
- If they don't know, ask how many pages first, then recommend:
  - Under 40 pages -> fold & staple (saddle-stitch)
  - 40-140 pages -> ask: "That could be fold & staple or glue bound (perfect binding). Fold & staple is cheaper, glue bound looks more like a real book. Which do you prefer?"
  - Over 140 pages -> suggest perfect binding or spiral. "That's too many pages for stapling -- I'd recommend perfect binding (like a paperback) or spiral. Which sounds better?"
- If they say "perfect binding" or "spiral", use that even if you'd normally suggest otherwise.

OUT OF RANGE -- always suggest an alternative, never leave the customer stuck:
- Saddle-stitch over ~140 pages plus cover: "That's too thick to staple. I'd recommend perfect binding (flat spine, like a paperback) or spiral. Which sounds better?"
- Too few pages for perfect binding (under 40): "Perfect binding needs at least 40 pages. For fewer pages, a fold & staple booklet works great and is cheaper. Want to try that?"
- Too many sheets for spiral (over 290 sheets / ~580 pages double-sided): "That's a big book! We might need to split it into two volumes. Want me to price that?"
- Customer wants a size/paper combo that doesn't exist: "That paper doesn't come in that size. The closest we have is [alternative]. Want me to price that instead?"
- Customer wants lamination on thin paper: "Lamination only works on thicker cardstock. Want me to upgrade the paper so we can laminate it?"
- Customer wants folding on cardstock without scoring: "Thick paper needs to be scored (creased) first so it folds cleanly. We do that automatically -- I'll include scoring in the price."
- Customer wants fewer than 8 pages in a booklet: "The minimum for a fold & staple booklet is 8 pages. Would a folded flyer or a flat print work instead?"
- Pad with too few sheets: "Pads need at least 25 sheets. Want me to quote 25?"
- Any other dead end: always offer the closest thing we CAN do. Never just say "we can't do that."

BROKER CUSTOMERS:
- If someone says "broker", "trade pricing", or "wholesale", set isBroker = true.
- You can ask "Is this for yourself or are you a print broker?" if unclear.
- isBroker affects TWO things: (1) printing goes to Level 10 and (2) finishing (binding + lamination) gets percentage discounts. The calculator handles both automatically.
- Never reveal discount amounts, levels, markup multipliers, or how broker pricing works internally.
- Just say "broker pricing" or "trade pricing" -- never explain the mechanics.

VIP MODE (internal testing - USER HAS FINAL SAY):
- If user types "VIP", enable VIP mode. Just say "VIP mode on." - keep it short.
- VIP mode stays on until they say "VIP off".
- In VIP mode, the user has ABSOLUTE CONTROL. Whatever they say, do it. No pushback.
- User can set ANY level (1-10) for ANY part of the job:
  * "use level 9" = all parts at level 9
  * "cover at level 5" = use coverLevel param
  * "section 1 and 2 at level 9, section 3 at level 4" = use per-section level in sections array
- The tool NOW SUPPORTS per-section levels. Each section can have its own level field.
- ALWAYS obey the user's level choice. Never refuse or suggest a different level. User has final say.
- Show internal details ONLY when asked. Keep quotes brief otherwise.
- User can ask "show breakdown", "how many sheets?", "what level?", "explain pricing" - then give details.
- If user says "auto level" go back to automatic level selection.
- Be concise. Don't over-explain unless asked.

- If VIP mode is NOT active, NEVER reveal internal pricing details. Just show the final price.

PRESENTING THE QUOTE:
- Lead with the total and per-unit price: "That'd be $X total ($X each)."
- Then one short line about what's included.
- If there's a cost breakdown, mention the big items briefly.
- Offer one upsell if it makes sense: "Want lamination on the cover? Adds about $X."

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
  %%FLAT_PAPER_NAMES%%

FOR BOOKLETS / SPIRAL / PERFECT / PADS -- inside pages:
  %%BOOKLET_INSIDE_PAPERS%%

FOR BOOKLETS / SPIRAL / PERFECT -- covers (cardstock):
  %%BOOKLET_COVER_PAPERS%%

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

ENVELOPES: #6, #9, #10 (window or no window), 6x9, 6x9.5, 9x12, A-2, A-7, Square 9x9, Square 6x6. InkJet or Laser.

SAVING QUOTES & REFERENCE NUMBERS:
- After EVERY price calculation, offer: "Would you like me to save this quote so you can reference it later?"
- If they say yes, ask for their name, email address, and phone number. All three are REQUIRED -- do not save without all three.
- Then call save_chat_quote with their name, email, phone, a short project description, the total, and the full exactSpecs from the calculator.
- Give them the reference code with the CQ- prefix (e.g. "Your reference number is CQ-5003. You can come back anytime and give me this code to pull it up."). ALWAYS include the CQ- prefix.
- If a customer gives a reference number, use lookup_quote to retrieve it and show them their saved quote details.
- NEVER save a quote without getting the customer's name, email, AND phone number first. All three are required.

FILE UPLOADS:
- The chat has a paperclip/attach button next to the text input. Customers CAN upload images (JPG, PNG) and PDFs up to 25MB.
- After saving a quote, ALWAYS ask: "Would you like to attach any files to this quote? You can use the paperclip button to upload artwork, design files, or any reference images."
- If a customer asks about uploading files, tell them to use the paperclip icon next to the text input to attach their files.
- Uploaded files are automatically attached to the saved quote for the team to review.
- File uploads are OPTIONAL -- never require them, just offer the option.`

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
      paperName: z.string().describe(`Paper -- MUST be one of the FLAT PRINTING papers listed in the system prompt`),
      sidesValue: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(SIDES_DESC),
      hasBleed: z.boolean().describe("Design bleeds to edge. True for postcards/business cards."),
      isBroker: z.boolean().describe("Broker/trade customer"),
      laminationEnabled: z.boolean().describe("Add lamination. Only on cardstock."),
      laminationType: z.enum(["Gloss", "Matte", "Silk", "Leather"]).nullable().describe("Lamination type if enabled"),
      laminationSides: z.enum(["S/S", "D/S"]).nullable().describe("Lamination sides: S/S=one side, D/S=both"),
      customLevel: z.number().min(1).max(10).optional().describe("VIP ONLY: Force a specific pricing level (1-10). Level 1=highest margin, 10=broker. Omit for auto."),
    }),
    execute: async ({ qty, width, height, paperName, sidesValue, hasBleed, isBroker, laminationEnabled, laminationType, laminationSides, customLevel }) => {
      try {
        console.log("[v0] calculate_printing called:", { qty, width, height, paperName, sidesValue, hasBleed, isBroker, laminationEnabled, laminationType, laminationSides })
        const lamination: LaminationInputs = {
          enabled: laminationEnabled,
          type: (laminationType || "Gloss") as LaminationInputs["type"],
          sides: (laminationSides || "S/S") as LaminationInputs["sides"],
          markupPct: 225,
          brokerDiscountPct: 30,
        }
        const inputs: PrintingInputs = {
          qty, width, height, paperName, sidesValue, hasBleed,
          addOnCharge: 0, addOnDescription: "", printingMarkupPct: 0, isBroker, lamination,
          levelOverride: customLevel,
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
        // Note: scoreFold now uses new foldFinish engine (not available in chat yet)
        console.log("[v0] calculate_printing result:", { total: fullResult.grandTotal, qty })
        return {
          total: fmt(fullResult.grandTotal), perUnit: fmt(fullResult.grandTotal / qty),
          qty, size: `${width}x${height}`, paper: paperName, sides: sidesValue,
          bleed: hasBleed, broker: isBroker, sheetSize: best.size, costBreakdown: parts,
          lamination: laminationEnabled ? `${laminationType} (${laminationSides})` : "none",
          // VIP details (only show if VIP mode is active)
          _vipDetails: {
            sheets: best.result.sheets,
            ups: best.result.ups,
            parentSheet: best.size,
            level: best.result.level,
            markup: best.result.markup,
            paperCostPerSheet: best.result.pricePerSheet.toFixed(4),
            totalPaperCost: fmt(best.result.totalPaperCost),
            clickCostPerSheet: best.result.clickCostPerSheet?.toFixed(4) || "N/A",
            totalClickCost: fmt(best.result.totalClickCost || 0),
            basePrintingCost: fmt(best.result.cost),
            printingCostWithMarkup: fmt(fullResult.printingCostPlus10),
          },
        }
      } catch (e: unknown) {
        console.error("[v0] calculate_printing error:", e)
        return { error: `Calculator error: ${e instanceof Error ? e.message : "Unknown error"}. Please try again.` }
      }
    },
  }),

  // ============ SADDLE-STITCH BOOKLET ============
  calculate_booklet: tool({
    description:
      `Calculate saddle-stitched (stapled) booklet cost. Auto-handles: page rounding to multiple of 4, subtracting cover pages, picking cheapest parent sheet.
Pass TOTAL page count (e.g. customer says 20 pages = pass 20). Minimum 8, max ~140 pages plus cover, multiple of 4 (auto-rounded). Over 140 pages suggest perfect binding.`,
    inputSchema: z.object({
      bookQty: z.number().describe("Number of booklets"),
      pagesPerBook: z.number().describe("TOTAL page count including cover (multiple of 4, min 8). Tool auto-rounds."),
      pageWidth: z.number().describe("FINISHED page width (e.g. 8.5 for letter)"),
      pageHeight: z.number().describe("FINISHED page height (e.g. 11 for letter)"),
      insidePaper: z.string().describe(`Inside paper -- MUST be one of the BOOKLET INSIDE papers listed in the system prompt`),
      insideSides: z.enum(["D/S", "4/4", "1/1"]).describe(`Saddle-stitch inside MUST be both-sided (folded signatures). ${SIDES_DESC}`),
      separateCover: z.boolean().describe("Use thicker cover stock? Default true."),
      coverPaper: z.string().nullable().describe(`Cover paper -- MUST be one of the BOOKLET COVER papers listed in the system prompt. Default "80 Gloss".`),
      coverSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).nullable().describe(`Cover sides. USE EXACTLY what the customer specified (e.g. if they say "4/0", pass "4/0"). Only default to "4/4" if they said NOTHING about cover sides. ${SIDES_DESC}`),
      laminationType: z.enum(["none", "Gloss", "Matte", "Silk", "Leather"]).describe("Cover lamination. Default none."),
      insideBleed: z.boolean().describe("Inside pages bleed to edge? Default false for most books."),
      coverBleed: z.boolean().describe("Cover bleeds to edge? Default true (most covers have full bleed)."),
      isBroker: z.boolean().describe("Broker/trade customer"),
      customLevel: z.number().min(1).max(10).optional().describe("VIP ONLY: Force a specific pricing level (1-10). Level 1=highest margin, 10=broker. Omit for auto."),
    }),
    execute: async ({ bookQty, pagesPerBook, pageWidth, pageHeight, insidePaper, insideSides, separateCover, coverPaper, coverSides, laminationType, insideBleed, coverBleed, isBroker, customLevel }) => {
      try {
        console.log("[v0] calculate_booklet called:", { bookQty, pagesPerBook, pageWidth, pageHeight, insidePaper, insideSides })
        const finalCoverSides = coverSides || "4/4"

        // SADDLE-STITCH = folded signatures. Inside pages ALWAYS both-sided. Auto-correct if wrong.
        const singleToBoth: Record<string, string> = { "4/0": "4/4", "1/0": "1/1", "S/S": "D/S" }
        const correctedInsideSides = singleToBoth[insideSides] || insideSides
        const sidesWarning = correctedInsideSides !== insideSides
          ? `Note: Saddle-stitch uses folded signatures so inside pages always print both sides. Changed ${insideSides} to ${correctedInsideSides}.`
          : null

        if (pagesPerBook < 8) return { error: "Saddle-stitch needs at least 8 pages. Suggest a folded flyer or flat print instead." }
        const adjustedPages = Math.ceil(pagesPerBook / 4) * 4
        const pagesNote = adjustedPages !== pagesPerBook ? `Rounded up from ${pagesPerBook} to ${adjustedPages} pages (must be multiple of 4).` : null
        const insidePages = separateCover ? adjustedPages - 4 : adjustedPages
        const result = calculateBooklet({
          bookQty, pagesPerBook: insidePages, pageWidth, pageHeight, separateCover,
          coverPaper: coverPaper || "80 Gloss", coverSides: finalCoverSides,
          coverBleed: separateCover ? coverBleed : false, coverSheetSize: "cheapest",
          insidePaper, insideSides: correctedInsideSides, insideBleed, insideSheetSize: "cheapest",
          laminationType: separateCover ? laminationType : "none",
          customLevel: customLevel || "auto", isBroker, printingMarkupPct: 0,
        })

        if (!result.isValid) return { error: result.error || "Could not calculate booklet. Check paper name and size." }
        console.log("[v0] calculate_booklet result:", { total: result.grandTotal })
        return {
          _instruction: "You MUST show the exactSpecs to the customer so they can verify every field is correct.",
          total: fmt(result.grandTotal), perUnit: fmt(result.pricePerBook),
          exactSpecs: {
            qty: bookQty, size: `${pageWidth}x${pageHeight}`, totalPages: adjustedPages, insidePages,
            insidePaper, insideSides: correctedInsideSides, insideBleed,
            coverPaper: separateCover ? (coverPaper || "80 Gloss") : "Self-cover",
            coverSides: separateCover ? finalCoverSides : "N/A", coverBleed,
            lamination: separateCover ? laminationType : "none",
            binding: "Fold & Staple (saddle-stitch)", broker: isBroker,
          },
          costBreakdown: { printing: fmt(result.totalPrintingCost), binding: fmt(result.totalBindingPrice), lamination: fmt(result.totalLaminationCost) },
          ...(pagesNote ? { note: pagesNote } : {}),
          ...(sidesWarning ? { sidesWarning } : {}),
          // VIP details
          _vipDetails: {
            insideResult: {
              sheets: result.insideResult.sheets,
              ups: result.insideResult.maxUps,
              parentSheet: result.insideResult.sheetSize,
              level: result.insideResult.level,
              markup: result.insideResult.markup,
              paperCost: fmt(result.insideResult.totalPaperCost),
              clickCost: fmt(result.insideResult.totalClickCost),
              pricePerSheet: result.insideResult.pricePerSheet.toFixed(4),
              totalCost: fmt(result.insideResult.cost),
            },
            coverResult: separateCover ? {
              sheets: result.coverResult.sheets,
              ups: result.coverResult.maxUps,
              parentSheet: result.coverResult.sheetSize,
              level: result.coverResult.level,
              markup: result.coverResult.markup,
              paperCost: fmt(result.coverResult.totalPaperCost),
              clickCost: fmt(result.coverResult.totalClickCost),
              pricePerSheet: result.coverResult.pricePerSheet.toFixed(4),
              totalCost: fmt(result.coverResult.cost),
            } : null,
            totalSheets: result.totalSheets,
            bindingCost: fmt(result.totalBindingPrice),
            laminationCost: fmt(result.totalLaminationCost),
          },
        }
      } catch (e: unknown) {
        console.error("[v0] calculate_booklet error:", e)
        return { error: `Booklet calculator error: ${e instanceof Error ? e.message : "Unknown error"}. Please try again.` }
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
      insidePaper: z.string().describe(`Inside paper -- MUST be one of the BOOKLET INSIDE papers listed in the system prompt`),
      insideSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(`Spiral binds individual leaves. S/S is common (print one side, blank back) -- DOUBLES page count automatically. Default D/S. ${SIDES_DESC}`),
      insideBleed: z.boolean().describe("Inside pages bleed to edge? Default false for most books."),
      coverBleed: z.boolean().describe("Covers bleed to edge? Default true if printed covers."),
      useFrontCover: z.boolean().describe("Printed front cover (cardstock). Default true."),
      useBackCover: z.boolean().describe("Printed back cover (cardstock). Default true."),
      frontPaper: z.string().nullable().describe(`Front cover paper -- MUST be one of the BOOKLET COVER papers listed in the system prompt. Default "80 Gloss".`),
      frontSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).nullable().describe(`Front cover sides. Spiral covers CAN be one-sided (4/0) or both-sided (4/4). Default "4/4". ${SIDES_DESC}`),
      backPaper: z.string().nullable().describe(`Back cover paper -- MUST be one of the BOOKLET COVER papers listed in the system prompt. Default "80 Gloss".`),
      backSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).nullable().describe(`Back cover sides. Spiral covers CAN be one-sided (4/0) or both-sided (4/4). Default "4/4". ${SIDES_DESC}`),
      clearPlastic: z.boolean().describe("Clear plastic front ($0.50/book). Default false."),
      blackVinyl: z.boolean().describe("Black vinyl back ($0.50/book). Default false."),
      isBroker: z.boolean().describe("Broker/trade customer"),
      customLevel: z.number().min(1).max(10).optional().describe("VIP ONLY: Force a specific pricing level (1-10). Level 1=highest margin, 10=broker. Omit for auto."),
    }),
    execute: async ({ bookQty, pagesPerBook, pageWidth, pageHeight, insidePaper, insideSides, insideBleed, coverBleed, useFrontCover, useBackCover, frontPaper, frontSides, backPaper, backSides, clearPlastic, blackVinyl, isBroker, customLevel }) => {
      try {
        console.log("[v0] calculate_spiral called:", { bookQty, pagesPerBook, pageWidth, pageHeight })
        // Single-sided insides = double the pages
        const isSingleSidedInside = ["S/S", "4/0", "1/0"].includes(insideSides)
        const singleToBoth: Record<string, string> = { "4/0": "4/4", "1/0": "1/1", "S/S": "D/S" }
        const calcInsideSides = singleToBoth[insideSides] || insideSides
        const effectivePages = isSingleSidedInside ? pagesPerBook * 2 : pagesPerBook
        const ssNote = isSingleSidedInside
          ? `Single-sided inside (${insideSides}): ${pagesPerBook} content pages use ${effectivePages} physical pages (blank backs).`
          : null
        const result = calculateSpiral({
          bookQty, pagesPerBook: effectivePages, pageWidth, pageHeight,
          inside: { paperName: insidePaper, sides: calcInsideSides, hasBleed: insideBleed, sheetSize: "cheapest" },
          useFrontCover,
          front: { paperName: frontPaper || "80 Gloss", sides: frontSides || "4/4", hasBleed: useFrontCover ? coverBleed : false, sheetSize: "cheapest" },
          useBackCover,
          back: { paperName: backPaper || "80 Gloss", sides: backSides || "4/4", hasBleed: useBackCover ? coverBleed : false, sheetSize: "cheapest" },
          clearPlastic, blackVinyl, customLevel: customLevel || "auto", isBroker,
        })
        if ("error" in result) return { error: result.error }
        return {
          _instruction: "You MUST show the exactSpecs to the customer so they can verify every field is correct.",
          total: fmt(result.grandTotal), perUnit: fmt(result.pricePerBook),
          exactSpecs: {
            qty: bookQty, size: `${pageWidth}x${pageHeight}`,
            contentPages: pagesPerBook, physicalPages: effectivePages,
            insidePaper, insideSides: insideSides, insideBleed,
            ...(isSingleSidedInside ? { singleSidedNote: ssNote } : {}),
            frontCover: useFrontCover ? (frontPaper || "80 Gloss") : "none",
            frontSides: useFrontCover ? (frontSides || "4/4") : "N/A",
            backCover: useBackCover ? (backPaper || "80 Gloss") : "none",
            backSides: useBackCover ? (backSides || "4/4") : "N/A",
            coverBleed, clearPlastic, blackVinyl,
            binding: "Spiral (coil)", broker: isBroker,
          },
          costBreakdown: { printing: fmt(result.totalPrintingCost), binding: fmt(result.totalBindingPrice) },
          // VIP details
          _vipDetails: {
            insideResult: {
              sheets: result.insideResult.sheets,
              ups: result.insideResult.maxUps,
              parentSheet: result.insideResult.sheetSize,
              level: result.insideResult.level,
              markup: result.insideResult.markup,
              paperCost: fmt(result.insideResult.totalPaperCost),
              clickCost: fmt(result.insideResult.totalClickCost),
              pricePerSheet: result.insideResult.pricePerSheet.toFixed(4),
              totalCost: fmt(result.insideResult.cost),
            },
            frontCoverResult: useFrontCover && result.frontCoverResult ? {
              sheets: result.frontCoverResult.sheets,
              ups: result.frontCoverResult.maxUps,
              level: result.frontCoverResult.level,
              markup: result.frontCoverResult.markup,
              totalCost: fmt(result.frontCoverResult.cost),
            } : null,
            backCoverResult: useBackCover && result.backCoverResult ? {
              sheets: result.backCoverResult.sheets,
              ups: result.backCoverResult.maxUps,
              level: result.backCoverResult.level,
              markup: result.backCoverResult.markup,
              totalCost: fmt(result.backCoverResult.cost),
            } : null,
            totalSheets: result.totalSheets,
            bindingCost: fmt(result.totalBindingPrice),
          },
        }
      } catch (e: unknown) {
        console.error("[v0] calculate_spiral error:", e)
        return { error: `Spiral calculator error: ${e instanceof Error ? e.message : "Unknown error"}. Please try again.` }
      }
    },
  }),

  // ============ PERFECT BINDING ============
  calculate_perfect_bound: tool({
    description:
      `Calculate perfect-bound (glue spine, like a paperback) book cost. Minimum 40 inside pages. Cover wraps around spine (auto-calculated). Tool auto-picks cheapest parent sheet. Supports multiple inside sections with different papers (e.g., color photo section + BW text section).`,
    inputSchema: z.object({
      bookQty: z.number().describe("Number of books"),
      pagesPerBook: z.number().describe("TOTAL inside pages (sum of all sections). Minimum 40. If using sections, this should match the sum of section pageCount values."),
      pageWidth: z.number().describe("FINISHED page width (e.g. 8.5)"),
      pageHeight: z.number().describe("FINISHED page height (e.g. 11)"),
      insidePaper: z.string().describe(`Inside paper (used when NOT using sections) -- MUST be one of the BOOKLET INSIDE papers listed in the system prompt`),
      insideSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(`S/S is rare for perfect binding but valid -- DOUBLES page count automatically. Default D/S. Warn customer it doubles paper cost. ${SIDES_DESC}`),
      sections: z.array(z.object({
        pageCount: z.number().describe("Number of pages in this section"),
        paperName: z.string().describe(`Paper for this section -- MUST be one of the BOOKLET INSIDE papers listed in the system prompt`),
        sides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe("Sides for this section"),
        hasBleed: z.boolean().describe("Bleed for this section"),
        level: z.number().min(1).max(10).optional().describe("VIP ONLY: Force level for THIS section only (1-10). Omit for auto or global level."),
      })).optional().describe("Optional: multiple inside sections with different papers. Each section can have its own level. Example: [{pageCount: 100, paperName: '20lb Offset', sides: 'D/S', hasBleed: false, level: 9}, {pageCount: 16, paperName: '80lb Text Gloss', sides: '4/4', hasBleed: true, level: 4}]"),
      coverLevel: z.number().min(1).max(10).optional().describe("VIP ONLY: Force level for COVER only (1-10). Omit to use customLevel or auto."),
      coverPaper: z.string().describe(`Cover (cardstock) -- MUST be one of the BOOKLET COVER papers listed in the system prompt. Default "80 Gloss".`),
      coverSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(`Perfect bound cover CAN be one-sided (4/0 = color front only, common) or both-sided (4/4). USE what the customer says. Default "4/4" only if they say nothing. ${SIDES_DESC}`),
      laminationType: z.enum(["none", "Gloss", "Matte", "Silk", "Leather"]).describe("Cover lamination. Default none."),
      insideBleed: z.boolean().describe("Inside pages bleed to edge? Default false for most books. Ignored if using sections."),
      coverBleed: z.boolean().describe("Cover bleeds to edge? Default true (most covers have full bleed)."),
      isBroker: z.boolean().describe("Broker/trade customer"),
      customLevel: z.number().min(1).max(10).optional().describe("VIP ONLY: Force a specific pricing level (1-10). Level 1=highest margin, 10=broker. Omit for auto."),
    }),
    execute: async ({ bookQty, pagesPerBook, pageWidth, pageHeight, insidePaper, insideSides, sections, coverPaper, coverSides, coverLevel, laminationType, insideBleed, coverBleed, isBroker, customLevel }) => {
      try {
        console.log("[v0] calculate_perfect called:", { bookQty, pagesPerBook, pageWidth, pageHeight, sections: sections?.length || 0 })
        
        // Handle sections if provided
        const useSections = sections && sections.length > 0
        
        if (useSections) {
          // Validate sections total matches pagesPerBook
          const sectionsTotal = sections.reduce((sum, s) => sum + s.pageCount, 0)
          if (sectionsTotal !== pagesPerBook) {
            return { error: `Section page counts (${sectionsTotal}) don't match total pages (${pagesPerBook}). Please verify.` }
          }
          if (pagesPerBook < 40) return { error: `Perfect binding needs at least 40 inside pages (you have ${pagesPerBook}). Suggest fold & staple booklet instead.` }
          
          // Build section inputs for calculator with per-section levels
          const sectionInputs = sections.map((s, idx) => ({
            id: `section-${idx}`,
            pageCount: s.pageCount,
            paperName: s.paperName,
            sides: s.sides,
            hasBleed: s.hasBleed,
            sheetSize: "cheapest" as const,
            levelOverride: s.level,  // VIP: per-section level
          }))
          
          const result = calculatePerfect({
            bookQty, pagesPerBook, pageWidth, pageHeight,
            inside: { paperName: sections[0].paperName, sides: sections[0].sides, hasBleed: sections[0].hasBleed, sheetSize: "cheapest" },
            cover: { paperName: coverPaper || "80 Gloss", sides: coverSides || "4/4", hasBleed: coverBleed, sheetSize: "cheapest" },
            laminationType, customLevel: customLevel || "auto", isBroker,
            insideSections: sectionInputs,
            coverLevelOverride: coverLevel,  // VIP: separate cover level
          })
          if ("error" in result) return { error: result.error }
          
          const sectionSpecs = sections.map((s, idx) => `Section ${idx + 1}: ${s.pageCount} pages on ${s.paperName} ${s.sides}${s.hasBleed ? " w/bleed" : ""}`).join("; ")
          
          return {
            _instruction: "You MUST show the exactSpecs to the customer so they can verify every field is correct.",
            total: fmt(result.grandTotal), perUnit: fmt(result.pricePerBook),
            exactSpecs: {
              qty: bookQty, size: `${pageWidth}x${pageHeight}`,
              totalPages: pagesPerBook,
              sections: sectionSpecs,
              sectionCount: sections.length,
              coverPaper: coverPaper || "80 Gloss", coverSides: coverSides || "4/4", coverBleed,
              lamination: laminationType, binding: "Perfect-bound (glue bind)", broker: isBroker,
            },
            costBreakdown: { 
              printing: fmt(result.totalPrintingCost), 
              binding: fmt(result.totalBindingPrice), 
              lamination: fmt(result.totalLaminationCost),
            },
            // VIP details for sections
            _vipDetails: {
              coverResult: {
                sheets: result.coverResult.sheets,
                ups: result.coverResult.maxUps,
                parentSheet: result.coverResult.sheetSize,
                level: result.coverResult.level,
                markup: result.coverResult.markup,
                paperCost: fmt(result.coverResult.totalPaperCost),
                clickCost: fmt(result.coverResult.totalClickCost),
                totalCost: fmt(result.coverResult.cost),
              },
              sections: result.insideSectionResults?.map((s, idx) => ({
                sectionNum: idx + 1,
                paper: s.paper,
                pages: s.pagesInSection,
                sheets: s.sheets,
                ups: s.maxUps,
                parentSheet: s.sheetSize,
                level: s.level,
                markup: s.markup,
                paperCost: fmt(s.totalPaperCost),
                clickCost: fmt(s.totalClickCost),
                totalCost: fmt(s.cost),
              })),
              spineWidth: result.spineWidth?.toFixed(3) + '"',
              totalSheets: result.totalSheets,
              bindingCost: fmt(result.totalBindingPrice),
              laminationCost: fmt(result.totalLaminationCost),
            },
          }
        }
        
        // Original single-paper logic
        const isSingleSidedInside = ["S/S", "4/0", "1/0"].includes(insideSides)
        const singleToBoth: Record<string, string> = { "4/0": "4/4", "1/0": "1/1", "S/S": "D/S" }
        const calcInsideSides = singleToBoth[insideSides] || insideSides
        const finalCoverSides = coverSides || "4/4"
        const effectivePages = isSingleSidedInside ? pagesPerBook * 2 : pagesPerBook
        const ssNote = isSingleSidedInside
          ? `Single-sided inside (${insideSides}): ${pagesPerBook} content pages use ${effectivePages} physical pages (blank backs). Double the paper.`
          : null
        if (effectivePages < 40) return { error: `Perfect binding needs at least 40 inside pages (you have ${effectivePages}${isSingleSidedInside ? ` physical pages from ${pagesPerBook} content pages single-sided` : ""}). Suggest fold & staple booklet instead.` }
        const result = calculatePerfect({
          bookQty, pagesPerBook: effectivePages, pageWidth, pageHeight,
          inside: { paperName: insidePaper, sides: calcInsideSides, hasBleed: insideBleed, sheetSize: "cheapest" },
          cover: { paperName: coverPaper || "80 Gloss", sides: finalCoverSides, hasBleed: coverBleed, sheetSize: "cheapest" },
          laminationType, customLevel: customLevel || "auto", isBroker,
          coverLevelOverride: coverLevel,
        })
        if ("error" in result) return { error: result.error }
        return {
          _instruction: "You MUST show the exactSpecs to the customer so they can verify every field is correct.",
          total: fmt(result.grandTotal), perUnit: fmt(result.pricePerBook),
          exactSpecs: {
            qty: bookQty, size: `${pageWidth}x${pageHeight}`,
            contentPages: pagesPerBook, physicalPages: effectivePages,
            insidePaper, insideSides: insideSides, insideBleed,
            ...(isSingleSidedInside ? { singleSidedNote: ssNote } : {}),
            coverPaper: coverPaper || "80 Gloss", coverSides: finalCoverSides, coverBleed,
            lamination: laminationType, binding: "Perfect-bound (glue bind)", broker: isBroker,
          },
          costBreakdown: { printing: fmt(result.totalPrintingCost), binding: fmt(result.totalBindingPrice), lamination: fmt(result.totalLaminationCost) },
          // VIP details
          _vipDetails: {
            coverResult: {
              sheets: result.coverResult.sheets,
              ups: result.coverResult.maxUps,
              parentSheet: result.coverResult.sheetSize,
              level: result.coverResult.level,
              markup: result.coverResult.markup,
              paperCost: fmt(result.coverResult.totalPaperCost),
              clickCost: fmt(result.coverResult.totalClickCost),
              totalCost: fmt(result.coverResult.cost),
            },
            insideResult: {
              sheets: result.insideResult.sheets,
              ups: result.insideResult.maxUps,
              parentSheet: result.insideResult.sheetSize,
              level: result.insideResult.level,
              markup: result.insideResult.markup,
              paperCost: fmt(result.insideResult.totalPaperCost),
              clickCost: fmt(result.insideResult.totalClickCost),
              totalCost: fmt(result.insideResult.cost),
            },
            spineWidth: result.spineWidth?.toFixed(3) + '"',
            totalSheets: result.totalSheets,
            bindingCost: fmt(result.totalBindingPrice),
            laminationCost: fmt(result.totalLaminationCost),
          },
        }
      } catch (e: unknown) {
        console.error("[v0] calculate_perfect error:", e)
        return { error: `Perfect binding calculator error: ${e instanceof Error ? e.message : "Unknown error"}. Please try again.` }
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
      insidePaper: z.string().describe(`Paper -- MUST be one of the BOOKLET INSIDE papers listed in the system prompt`),
      insideSides: z.enum(["S/S", "D/S", "4/0", "4/4", "1/0", "1/1"]).describe(SIDES_DESC),
      hasBleed: z.boolean().describe("Does the design bleed to the edge? Bleed adds ~0.25in per side so fewer pieces fit per parent sheet. Default false."),
      useChipBoard: z.boolean().describe("Include chipboard backing"),
      isBroker: z.boolean().describe("Broker/trade customer"),
    }),
    execute: async ({ padQty, pagesPerPad, pageWidth, pageHeight, insidePaper, insideSides, hasBleed, useChipBoard, isBroker }) => {
      try {
        console.log("[v0] calculate_pad called:", { padQty, pagesPerPad, pageWidth, pageHeight })
        const result = calculatePad({
          padQty, pagesPerPad, pageWidth, pageHeight,
          inside: { paperName: insidePaper, sides: insideSides, hasBleed, sheetSize: "cheapest" },
          useChipBoard, customLevel: "auto", isBroker,
        })
        if ("error" in result) return { error: result.error }
        return {
          _instruction: "You MUST show the exactSpecs to the customer so they can verify every field is correct.",
          total: fmt(result.grandTotal), perUnit: fmt(result.pricePerPad),
          exactSpecs: {
            qty: padQty, pagesPerPad, size: `${pageWidth}x${pageHeight}`,
            paper: insidePaper, sides: insideSides, bleed: hasBleed,
            chipBoard: useChipBoard, broker: isBroker,
          },
          costBreakdown: { printing: fmt(result.totalPrintingCost), padding: fmt(result.totalPaddingCost), setup: fmt(result.setupCharge) },
        }
      } catch (e: unknown) {
        console.error("[v0] calculate_pad error:", e)
        return { error: `Pad calculator error: ${e instanceof Error ? e.message : "Unknown error"}. Please try again.` }
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
      try {
        console.log("[v0] calculate_envelope called:", { amount, itemName, inkType, printType })
        const result = calculateEnvelope(
          { amount, itemName, inkType, printType: printType as never, hasBleed, customerType: isBroker ? "Broker" : "Regular", customEnvCost: 0, customPrintCost: 0 },
          DEFAULT_ENVELOPE_SETTINGS
        )
        if ("error" in result) return { error: result.error }
        return {
          total: fmt(result.price), perUnit: fmt(result.pricePerUnit),
          qty: result.quantity, envelope: itemName, inkType, printType, bleed: hasBleed, broker: isBroker,
        }
      } catch (e: unknown) {
        console.error("[v0] calculate_envelope error:", e)
        return { error: `Envelope calculator error: ${e instanceof Error ? e.message : "Unknown error"}. Please try again.` }
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

  // ─── Quote Save & Lookup ──────────────────────────────
  save_chat_quote: tool({
    description: `Save the current quote to the database and return a reference number.
Call this AFTER a price has been calculated AND the customer says they want to save it or get a reference number.
You MUST ask the customer for their name, email, and phone number before calling this tool. All three are REQUIRED.
Include ALL details: the full exactSpecs, the costBreakdown, perUnit price, and every field from the calculator result.`,
    inputSchema: z.object({
      customerName: z.string().describe("Customer's name (REQUIRED)"),
      customerEmail: z.string().describe("Customer's email address (REQUIRED)"),
      customerPhone: z.string().describe("Customer's phone number (REQUIRED)"),
      projectName: z.string().describe("Short project description, e.g. '500 Tri-fold Brochures'"),
      total: z.number().describe("The total price from the calculator"),
      perUnit: z.number().optional().describe("Per-unit or per-piece price if available"),
      specs: z.record(z.unknown()).describe("The FULL exactSpecs object from the calculator result -- include EVERY field"),
      costBreakdown: z.record(z.unknown()).optional().describe("The full costBreakdown object from the calculator (printing, lamination, padding, setup, etc.)"),
      productType: z.string().describe("flat, booklet, perfect, spiral, pad, or envelope"),
    }),
    execute: async ({ customerName, customerEmail, customerPhone, projectName, total, perUnit, specs, costBreakdown, productType }) => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const transcript = buildTranscript(_currentMessages)
        console.log("[v0] _currentMessages count:", _currentMessages.length)
        console.log("[v0] transcript count:", transcript.length)
        console.log("[v0] transcript preview:", JSON.stringify(transcript.slice(0, 2)))

        const { data, error } = await supabase
          .from("chat_quotes")
          .insert({
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            project_name: projectName,
            product_type: productType,
            total,
            per_unit: perUnit ?? 0,
            specs,
            cost_breakdown: costBreakdown ?? {},
            chat_transcript: transcript,
          })
          .select("ref_number")
          .single()

        if (error) return { error: `Failed to save quote: ${error.message}` }
        const refCode = `CQ-${data.ref_number}`
        return {
          _instruction: `Tell the customer their quote has been saved. Their reference number is ${refCode}. Always show the FULL code including the CQ- prefix. Tell them they can come back anytime and give you this code to pull it up.`,
          referenceNumber: refCode,
          customerName,
          projectName,
          total: `$${total.toFixed(2)}`,
        }
      } catch (e: unknown) {
        return { error: `Failed to save: ${e instanceof Error ? e.message : "Unknown error"}` }
      }
    },
  }),

  lookup_quote: tool({
    description: `Look up a previously saved chat quote by its reference code (e.g. CQ-5001).
Call this when a customer provides a reference code/number. Strip the "CQ-" prefix and pass just the number.`,
    inputSchema: z.object({
      refNumber: z.number().describe("The numeric part of the reference code (e.g. if customer says CQ-5001, pass 5001)"),
    }),
    execute: async ({ refNumber }) => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data, error } = await supabase
          .from("chat_quotes")
          .select("*")
          .eq("ref_number", refNumber)
          .single()

        const refCode = `CQ-${refNumber}`
        if (error || !data) return { error: `Quote ${refCode} not found. Make sure you have the correct reference number.` }
        return {
          _instruction: `Show the customer their saved quote details clearly. Always refer to it as ${refCode}. Include all specs and pricing. If they want to adjust specs or get a new price, help them.`,
          referenceNumber: refCode,
          customerName: data.customer_name,
          projectName: data.project_name,
          productType: data.product_type,
          total: `$${Number(data.total).toFixed(2)}`,
          perUnit: data.per_unit ? `$${Number(data.per_unit).toFixed(4)}` : null,
          savedOn: new Date(data.created_at).toLocaleDateString(),
          specs: data.specs,
          costBreakdown: data.cost_breakdown,
        }
      } catch (e: unknown) {
        return { error: `Lookup failed: ${e instanceof Error ? e.message : "Unknown error"}` }
      }
    },
  }),
}

// Extract a clean transcript from the raw messages for storage.
// AI SDK useChat sends messages as { role, content?, parts? } where:
//   - content can be a string OR an array of { type, text } parts
//   - parts is the AI SDK v6 format: [{ type: "text", text: "..." }, ...]
// We handle ALL possible shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTranscript(messages: any[]) {
  const transcript: Array<{ role: "customer" | "assistant"; text: string; ts: string }> = []
  const now = new Date().toISOString()
  for (const msg of messages) {
    if (msg.role !== "user" && msg.role !== "assistant") continue
    let text = ""

    // 1. Try msg.content (string)
    if (typeof msg.content === "string" && msg.content.trim()) {
      text = msg.content
    }
    // 2. Try msg.content (array of parts)
    else if (Array.isArray(msg.content)) {
      text = msg.content
        .filter((p: { type?: string; text?: string }) => p.type === "text" && p.text)
        .map((p: { text: string }) => p.text)
        .join("\n")
    }
    // 3. Try msg.parts (AI SDK v6 useChat format)
    if (!text.trim() && Array.isArray(msg.parts)) {
      text = msg.parts
        .filter((p: { type?: string; text?: string }) => p.type === "text" && p.text)
        .map((p: { text: string }) => p.text)
        .join("\n")
    }

    if (!text.trim()) continue
    // Strip attachment metadata tags from user messages
    text = text.replace(/\[Attached file:.*?\]/g, "").trim()
    if (!text) continue
    transcript.push({
      role: msg.role === "user" ? "customer" : "assistant",
      text,
      ts: now,
    })
  }
  console.log("[v0] buildTranscript: input msgs:", messages.length, "output:", transcript.length)
  return transcript
}

// Store the raw messages so save_chat_quote can access them
let _currentMessages: Array<{ role: string; content?: string | Array<{ type: string; text?: string }> }> = []

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    console.log("[v0] RAW messages count:", messages.length)
    console.log("[v0] RAW message keys sample:", messages.length > 0 ? Object.keys(messages[0]) : "empty")
    console.log("[v0] RAW first msg:", JSON.stringify(messages[0])?.slice(0, 500))
    console.log("[v0] RAW last msg:", JSON.stringify(messages[messages.length - 1])?.slice(0, 500))
    _currentMessages = messages

    // Fetch dynamic paper lists from database
    const paperLists = await fetchPaperLists()
    console.log("[v0] Dynamic papers loaded:", { 
      flat: paperLists.flatPaperNames.length, 
      inside: paperLists.insidePaperNames.length, 
      cover: paperLists.coverPaperNames.length 
    })

    // Build dynamic system prompt with current paper lists
    const dynamicPrompt = SYSTEM_PROMPT
      .replace(/%%FLAT_PAPER_NAMES%%/g, paperLists.flatPaperNames.join(", "))
      .replace(/%%BOOKLET_INSIDE_PAPERS%%/g, paperLists.insidePaperNames.join(", "))
      .replace(/%%BOOKLET_COVER_PAPERS%%/g, paperLists.coverPaperNames.join(", "))

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: dynamicPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(10),
    })

    return result.toUIMessageStreamResponse()
  } catch (e: unknown) {
    console.error("[v0] Chat route error:", e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Chat failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

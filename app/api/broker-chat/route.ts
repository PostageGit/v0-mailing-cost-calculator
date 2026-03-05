import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText, tool } from "ai"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { calculatePerfect } from "@/lib/perfect-pricing"
import type { PerfectInputs, PerfectPartInputs } from "@/lib/perfect-types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BROKER_SYSTEM_PROMPT = `You are a helpful print quote assistant for Aleh Zayis brokers. You ONLY quote Perfect Binding jobs -- nothing else.

When a broker asks for a quote:
1. Extract the job details: quantity, page size, page count, inside paper, cover paper, and any finishing options
2. Call calculate_perfect_binding to get the broker price
3. ALWAYS call save_broker_quote to get a quote number BEFORE showing the price
4. Present the quote with: Quote Number, specs summary, and the TOTAL BROKER PRICE

IMPORTANT RULES:
- You ONLY do Perfect Binding quotes. If they ask for anything else (flyers, booklets, spiral, etc.), politely explain you only handle perfect binding.
- ALWAYS use BROKER pricing (already applied in the calculator)
- NEVER ask for name, email, or phone -- the broker is already logged in
- ALWAYS save the quote and give them the quote number FIRST, then the price
- Keep responses concise and professional

**WHAT YOU CAN SHARE:**
- Total price, per-unit price
- Price breakdown: Inside Printing, Cover Printing, Binding costs
- Whether lamination is included and what type

**STRICTLY CONFIDENTIAL - NEVER REVEAL:**
- Do NOT reveal material costs, paper costs, markup rates, or how individual prices are calculated
- Do NOT answer questions about internal pricing, margins, wholesale costs, or pricing formulas
- Do NOT explain what the "broker price" or "broker discount" means
- If asked HOW the prices are calculated, say "I can provide the price breakdown but not the calculation details"

**PRESENT QUOTES CLEARLY:**
When showing a quote, format it like:
- Quote #: CQ-XXXX
- Specs summary (quantity, size, pages, papers, lamination)
- Inside Printing: $X.XX
- Cover Printing: $X.XX
- Binding: $X.XX
- **TOTAL: $X.XX** (per unit: $X.XX)

Common paper options for INSIDE pages: "80 Gloss", "80 Matte", "60lb Offset", "80lb Text Gloss", "100lb Text Gloss"
Common paper options for COVER: "12pt Gloss", "12pt Matte", "10pt Gloss", "10pt Matte"
Sides options: "4/4" (full color both sides), "4/0" (color front only), "S/S" (B&W both sides), "D/S" (B&W both)

Default assumptions if not specified:
- Page size: 8.5x11
- Inside paper: 80 Gloss
- Cover paper: 12pt Gloss
- Inside sides: 4/4
- Cover sides: 4/4
- Sheet size: cheapest`

const tools = {
  calculate_perfect_binding: tool({
    description: "Calculate price for a perfect binding job. Returns broker pricing.",
    parameters: z.object({
      quantity: z.number().describe("Number of books"),
      pageWidth: z.number().describe("Page width in inches (e.g., 8.5)"),
      pageHeight: z.number().describe("Page height in inches (e.g., 11)"),
      insidePages: z.number().describe("Number of inside pages (must be even)"),
      insidePaper: z.string().describe("Inside paper stock (e.g., '80 Gloss', '80 Matte')"),
      insideSides: z.string().describe("Inside print mode (e.g., '4/4', 'S/S')"),
      coverPaper: z.string().describe("Cover paper stock (e.g., '12pt Gloss')"),
      coverSides: z.string().describe("Cover print mode (e.g., '4/4', '4/0')"),
      coverLamination: z.string().optional().describe("Cover lamination: 'Gloss' or 'Matte' or none"),
    }),
    execute: async ({ quantity, pageWidth, pageHeight, insidePages, insidePaper, insideSides, coverPaper, coverSides, coverLamination }) => {
      try {
        const insidePart: PerfectPartInputs = {
          paper: insidePaper,
          sides: insideSides,
          sheetSize: "cheapest",
        }
        const coverPart: PerfectPartInputs = {
          paper: coverPaper,
          sides: coverSides,
          sheetSize: "cheapest",
          lamination: coverLamination || undefined,
        }
        const inputs: PerfectInputs = {
          quantity,
          pageWidth,
          pageHeight,
          insidePages,
          useBrokerPricing: true, // BROKER PRICING
          inside: insidePart,
          cover: coverPart,
        }
        const result = calculatePerfect(inputs)
        if ("error" in result) {
          return { error: result.error }
        }
        // Return price breakdown (what they pay) but NOT internal details (how it's calculated)
        return {
          total: result.total,
          perUnit: result.perUnit,
          priceBreakdown: {
            insidePrinting: result.inside.cost,
            coverPrinting: result.cover.cost,
            binding: result.bindingCost,
          },
          specs: {
            quantity,
            pageSize: `${pageWidth}x${pageHeight}`,
            insidePages,
            insidePaper,
            coverPaper,
            hasLamination: !!coverLamination,
            laminationType: coverLamination || "None",
          },
        }
      } catch (err) {
        return { error: `Calculator error: ${err instanceof Error ? err.message : "Unknown error"}` }
      }
    },
  }),

  save_broker_quote: tool({
    description: "Save the quote to the database and get a quote number. ALWAYS call this before showing the price.",
    parameters: z.object({
      brokerId: z.string().describe("The broker's user ID"),
      brokerName: z.string().describe("The broker's display name"),
      brokerCompany: z.string().describe("The broker's company name"),
      total: z.number().describe("Total price"),
      perUnit: z.number().describe("Price per unit"),
      priceBreakdown: z.object({
        insidePrinting: z.number(),
        coverPrinting: z.number(),
        binding: z.number(),
      }),
      specs: z.object({
        quantity: z.number(),
        pageSize: z.string(),
        insidePages: z.number(),
        insidePaper: z.string(),
        coverPaper: z.string(),
        hasLamination: z.boolean(),
        laminationType: z.string(),
      }),
    }),
    execute: async ({ brokerId, brokerName, brokerCompany, total, perUnit, priceBreakdown, specs }) => {
      try {
        const projectName = `${specs.quantity} Perfect Bound ${specs.pageSize} - ${specs.insidePages}pp`

        const { data, error } = await supabase
          .from("chat_quotes")
          .insert({
            customer_name: brokerName,
            customer_email: "",
            customer_phone: "",
            project_name: projectName,
            product_type: "perfect",
            total,
            per_unit: perUnit,
            specs,
            cost_breakdown: priceBreakdown,
            broker_user_id: brokerId,
            broker_company: brokerCompany,
          })
          .select("ref_number")
          .single()

        if (error) throw error

        return { quoteNumber: `CQ-${data.ref_number}`, success: true }
      } catch (err) {
        return { error: `Failed to save quote: ${err instanceof Error ? err.message : "Unknown error"}` }
      }
    },
  }),
}

// Store broker context for tool execution
let _brokerContext: { brokerId: string; brokerName: string; brokerCompany: string } | null = null

export async function POST(req: Request) {
  try {
    const { messages, brokerId, brokerName, brokerCompany } = await req.json()

    if (!brokerId || !brokerName || !brokerCompany) {
      return Response.json({ error: "Broker context required" }, { status: 400 })
    }

    _brokerContext = { brokerId, brokerName, brokerCompany }

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Inject broker context into save tool calls
    const modifiedTools = {
      calculate_perfect_binding: tools.calculate_perfect_binding,
      save_broker_quote: tool({
        ...tools.save_broker_quote,
        execute: async (params: Parameters<typeof tools.save_broker_quote.execute>[0]) => {
          return tools.save_broker_quote.execute({
            ...params,
            brokerId: _brokerContext!.brokerId,
            brokerName: _brokerContext!.brokerName,
            brokerCompany: _brokerContext!.brokerCompany,
          })
        },
      }),
    }

    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: BROKER_SYSTEM_PROMPT,
      messages,
      tools: modifiedTools,
      maxSteps: 5,
    })

    return Response.json({ response: result.text })
  } catch (err) {
    console.error("[v0] Broker chat error:", err)
    return Response.json({ error: "Chat failed" }, { status: 500 })
  }
}

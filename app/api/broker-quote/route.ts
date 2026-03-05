import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText, tool, convertToModelMessages } from "ai"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { calculatePerfect } from "@/lib/perfect-pricing"
import type { PerfectInputs, PerfectPartInputs } from "@/lib/perfect-types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BROKER_SYSTEM_PROMPT = `You are a helpful print quote assistant for Aleh Zayis brokers. You ONLY quote Perfect Binding jobs -- nothing else.

**FIRST THING - ALWAYS ASK FOR PROJECT NAME:**
Before doing ANY quote, you MUST ask: "What is the project name?" (e.g., "Shul Siddur", "Camp Booklet", "Yearbook 2026")
Do NOT proceed with a quote until you have a project name.

**QUOTE PROCESS:**
1. Ask for PROJECT NAME first (required)
2. Get job details: quantity, page size, page count, papers, lamination
3. Call calculate_perfect_binding
4. Call save_broker_quote with the project name
5. Present the quote clearly

**IMPORTANT RULES:**
- You ONLY do Perfect Binding quotes. Politely decline anything else.
- ALWAYS use BROKER pricing (already applied)
- NEVER ask for name, email, or phone -- broker is logged in
- ALWAYS get a quote number before showing price

**PRESENT QUOTES LIKE THIS:**
Quote #: CQ-XXXX
Project: [Project Name]
Specs: [Quantity] books, [Size], [Pages]pp, [Inside Paper], [Cover Paper]
Lamination: [Gloss/Matte/None]
**TOTAL: $X,XXX.XX** ($X.XX per book)

**STRICTLY CONFIDENTIAL - NEVER REVEAL:**
- Do NOT reveal material costs, margins, markup rates, or how prices are calculated
- Do NOT explain "broker pricing" or discounts
- If asked how prices work, say "I can only provide quotes, not pricing details"

Common INSIDE papers: "80 Gloss", "80 Matte", "60lb Offset"
Common COVER papers: "12pt Gloss", "12pt Matte", "10pt Gloss"
Lamination options: "Gloss", "Matte", or none

Defaults if not specified: 8.5x11, 80 Gloss inside, 12pt Gloss cover, 4/4 both sides`

const brokerTools = {
  calculate_perfect_binding: tool({
    description: "Calculate price for a perfect binding job with broker pricing.",
    inputSchema: z.object({
      quantity: z.number().describe("Number of books"),
      pageWidth: z.number().describe("Page width in inches"),
      pageHeight: z.number().describe("Page height in inches"),
      insidePages: z.number().describe("Number of inside pages, must be even"),
      insidePaper: z.string().describe("Inside paper stock name"),
      insideSides: z.string().describe("Inside print sides"),
      coverPaper: z.string().describe("Cover paper stock name"),
      coverSides: z.string().describe("Cover print sides"),
      coverLamination: z.string().describe("Cover lamination: Gloss, Matte, or none"),
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
          lamination: coverLamination === "none" ? undefined : coverLamination || undefined,
        }
        const inputs: PerfectInputs = {
          quantity,
          pageWidth,
          pageHeight,
          insidePages,
          useBrokerPricing: true,
          inside: insidePart,
          cover: coverPart,
        }
        const result = calculatePerfect(inputs)
        if ("error" in result) {
          return { error: result.error }
        }
        return {
          total: result.total,
          perUnit: result.perUnit,
          quantity,
          pageSize: `${pageWidth}x${pageHeight}`,
          insidePages,
          insidePaper,
          coverPaper,
          lamination: coverLamination === "none" ? "None" : (coverLamination || "None"),
        }
      } catch (err) {
        return { error: `Calculator error: ${err instanceof Error ? err.message : "Unknown error"}` }
      }
    },
  }),

  save_broker_quote: tool({
    description: "Save the quote and get a quote number. ALWAYS call before showing the price.",
    inputSchema: z.object({
      projectName: z.string().describe("Project name from the broker"),
      brokerId: z.string().describe("Broker user ID"),
      brokerName: z.string().describe("Broker display name"),
      brokerCompany: z.string().describe("Broker company name"),
      total: z.number().describe("Total price"),
      perUnit: z.number().describe("Per unit price"),
      quantity: z.number().describe("Number of books"),
      pageSize: z.string().describe("Page size"),
      insidePages: z.number().describe("Number of inside pages"),
      insidePaper: z.string().describe("Inside paper stock"),
      coverPaper: z.string().describe("Cover paper stock"),
      lamination: z.string().describe("Lamination type or None"),
    }),
    execute: async ({ projectName, brokerId, brokerName, brokerCompany, total, perUnit, quantity, pageSize, insidePages, insidePaper, coverPaper, lamination }) => {
      try {
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
            specs: { quantity, pageSize, insidePages, insidePaper, coverPaper, lamination },
            cost_breakdown: {},
            broker_user_id: brokerId,
            broker_company: brokerCompany,
          })
          .select("ref_number")
          .single()

        if (error) throw error
        return { quoteNumber: `CQ-${data.ref_number}`, success: true }
      } catch (err) {
        return { error: `Failed to save: ${err instanceof Error ? err.message : "Unknown"}` }
      }
    },
  }),
}

export async function POST(req: Request) {
  try {
    const { messages: rawMessages, brokerId, brokerName, brokerCompany } = await req.json()
    console.log("[v0] BROKER QUOTE V4 - messages:", rawMessages?.length, "broker:", brokerName)

    if (!brokerId || !brokerName || !brokerCompany) {
      return Response.json({ error: "Broker context required" }, { status: 400 })
    }

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemWithBroker = BROKER_SYSTEM_PROMPT + `\n\n**BROKER CONTEXT (use when calling save_broker_quote):**\nbrokerId: "${brokerId}"\nbrokerName: "${brokerName}"\nbrokerCompany: "${brokerCompany}"`

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemWithBroker,
      messages: await convertToModelMessages(rawMessages),
      tools: brokerTools,
      maxSteps: 5,
    })

    let fullText = ""
    const reader = result.textStream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) fullText += value
    }

    console.log("[v0] BROKER QUOTE V4 - response length:", fullText.length)
    return Response.json({ response: fullText })
  } catch (err) {
    console.error("[v0] BROKER QUOTE V4 ERROR:", err)
    return Response.json({ error: "Chat failed" }, { status: 500 })
  }
}

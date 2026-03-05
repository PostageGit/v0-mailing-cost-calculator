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
        // Return only total price and specs - NO breakdown
        return {
          total: result.total,
          perUnit: result.perUnit,
          specs: {
            quantity,
            pageSize: `${pageWidth}x${pageHeight}`,
            insidePages,
            insidePaper,
            coverPaper,
            lamination: coverLamination || "None",
          },
        }
      } catch (err) {
        return { error: `Calculator error: ${err instanceof Error ? err.message : "Unknown error"}` }
      }
    },
  }),

  save_broker_quote: tool({
    description: "Save the quote to the database and get a quote number. ALWAYS call this before showing the price. Requires project name.",
    parameters: z.object({
      projectName: z.string().describe("The project name provided by the broker (e.g., 'Shul Siddur', 'Camp Booklet')"),
      brokerId: z.string().describe("The broker's user ID"),
      brokerName: z.string().describe("The broker's display name"),
      brokerCompany: z.string().describe("The broker's company name"),
      total: z.number().describe("Total price"),
      perUnit: z.number().describe("Price per unit"),
      specQuantity: z.number().describe("Number of books"),
      specPageSize: z.string().describe("Page size e.g. 8.5x11"),
      specInsidePages: z.number().describe("Number of inside pages"),
      specInsidePaper: z.string().describe("Inside paper stock"),
      specCoverPaper: z.string().describe("Cover paper stock"),
      specLamination: z.string().describe("Lamination type or None"),
    }),
    execute: async ({ projectName, brokerId, brokerName, brokerCompany, total, perUnit, specQuantity, specPageSize, specInsidePages, specInsidePaper, specCoverPaper, specLamination }) => {
      const specs = {
        quantity: specQuantity,
        pageSize: specPageSize,
        insidePages: specInsidePages,
        insidePaper: specInsidePaper,
        coverPaper: specCoverPaper,
        lamination: specLamination,
      }
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
            specs,
            cost_breakdown: {},
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

export async function POST(req: Request) {
  try {
    const { messages: rawMessages, brokerId, brokerName, brokerCompany } = await req.json()

    if (!brokerId || !brokerName || !brokerCompany) {
      return Response.json({ error: "Broker context required" }, { status: 400 })
    }

    // Convert client messages (parts format) to generateText format (content string)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = rawMessages.map((msg: any) => {
      let content = ""
      if (typeof msg.content === "string") {
        content = msg.content
      } else if (Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((p: { type: string }) => p.type === "text")
          .map((p: { text: string }) => p.text)
          .join("\n")
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((p: { type: string }) => p.type === "text")
          .map((p: { text: string }) => p.text)
          .join("\n")
      }
      return { role: msg.role as "user" | "assistant", content }
    })

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Inject broker identity into system prompt so AI can pass it to save tool
    const systemWithBroker = BROKER_SYSTEM_PROMPT + `\n\n**BROKER CONTEXT (use these values when calling save_broker_quote):**
- brokerId: "${brokerId}"
- brokerName: "${brokerName}"
- brokerCompany: "${brokerCompany}"`

    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemWithBroker,
      messages,
      tools,
      maxSteps: 5,
    })

    return Response.json({ response: result.text })
  } catch (err) {
    console.error("[v0] Broker chat error:", err)
    return Response.json({ error: "Chat failed" }, { status: 500 })
  }
}

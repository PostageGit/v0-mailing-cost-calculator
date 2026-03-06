import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from("chat_quotes")
      .select("id, ref_number, customer_name, customer_email, customer_phone, project_name, product_type, total, per_unit, specs, cost_breakdown, attachments, notes, archived, chat_transcript, created_at, parent_quote_id, revision_number, revised_by")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// POST: create a revision of an existing chat quote
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      parentQuoteId, 
      projectName, 
      productType, 
      total, 
      perUnit, 
      specs, 
      costBreakdown,
      revisedBy 
    } = body

    if (!parentQuoteId) {
      return NextResponse.json({ error: "parentQuoteId is required" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the parent quote to copy customer info and determine revision number
    const { data: parent, error: parentError } = await supabase
      .from("chat_quotes")
      .select("ref_number, customer_name, customer_email, customer_phone, notes, attachments")
      .eq("id", parentQuoteId)
      .single()

    if (parentError || !parent) {
      return NextResponse.json({ error: "Parent quote not found" }, { status: 404 })
    }

    // Count existing revisions to determine the new revision number
    const { count } = await supabase
      .from("chat_quotes")
      .select("id", { count: "exact", head: true })
      .eq("parent_quote_id", parentQuoteId)

    const revisionNumber = (count || 0) + 1

    // Insert the revision
    const { data: revision, error: insertError } = await supabase
      .from("chat_quotes")
      .insert({
        parent_quote_id: parentQuoteId,
        revision_number: revisionNumber,
        revised_by: revisedBy || "Manual",
        project_name: projectName,
        product_type: productType,
        total,
        per_unit: perUnit,
        specs,
        cost_breakdown: costBreakdown,
        customer_name: parent.customer_name,
        customer_email: parent.customer_email,
        customer_phone: parent.customer_phone,
        notes: parent.notes,
        attachments: parent.attachments,
        archived: false,
      })
      .select("id, ref_number, revision_number")
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      revision,
      parentRefNumber: parent.ref_number
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// PATCH: archive or unarchive a quote
export async function PATCH(req: NextRequest) {
  try {
    const { id, archived } = await req.json()
    if (!id || typeof archived !== "boolean") {
      return NextResponse.json({ error: "Missing id or archived value" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from("chat_quotes")
      .update({ archived })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  }
}

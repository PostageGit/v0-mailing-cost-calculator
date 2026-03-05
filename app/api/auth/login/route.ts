import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 })
    }

    const { data: user, error } = await supabase
      .from("broker_users")
      .select("id, username, company_name, display_name, role, can_access_calculator, can_access_chat")
      .eq("username", username.toLowerCase().trim())
      .eq("password_hash", password)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    // Return user data (in production, use JWT or session cookies)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        companyName: user.company_name,
        displayName: user.display_name,
        role: user.role,
        canAccessCalculator: user.can_access_calculator,
        canAccessChat: user.can_access_chat,
      }
    })
  } catch (err) {
    console.error("[v0] Login error:", err)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}

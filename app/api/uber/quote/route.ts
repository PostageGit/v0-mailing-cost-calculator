import { NextRequest, NextResponse } from "next/server"

const UBER_CLIENT_ID = process.env.UBER_CLIENT_ID
const UBER_CLIENT_SECRET = process.env.UBER_CLIENT_SECRET
const UBER_CUSTOMER_ID = process.env.UBER_CUSTOMER_ID

// Cache token in memory (in production, use Redis or similar)
let cachedToken: { token: string; expires: number } | null = null

async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token
  }

  const response = await fetch("https://auth.uber.com/oauth/v2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: UBER_CLIENT_ID!,
      client_secret: UBER_CLIENT_SECRET!,
      grant_type: "client_credentials",
      scope: "eats.deliveries",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get access token: ${error}`)
  }

  const data = await response.json()
  
  // Cache the token (expires_in is in seconds, subtract 60 for safety)
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  }

  return data.access_token
}

export async function POST(request: NextRequest) {
  try {
    if (!UBER_CLIENT_ID || !UBER_CLIENT_SECRET || !UBER_CUSTOMER_ID) {
      return NextResponse.json(
        { error: "Uber API credentials not configured" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { pickup, dropoff, vehicleType = "car" } = body

    if (!pickup || !dropoff) {
      return NextResponse.json(
        { error: "Pickup and dropoff addresses are required" },
        { status: 400 }
      )
    }

    const token = await getAccessToken()

    // Build request body with optional vehicle type
    // Uber supports: "car", "bike", "walker" (walking courier)
    const requestBody: Record<string, unknown> = {
      pickup_address: typeof pickup === "string" ? pickup : JSON.stringify(pickup),
      dropoff_address: typeof dropoff === "string" ? dropoff : JSON.stringify(dropoff),
    }

    // Add deliverable_action for bike/small package deliveries
    if (vehicleType === "bike") {
      requestBody.deliverable_action = "deliverable_action_meet_at_door"
      requestBody.testSpecifications = { roboCourierSpecification: { mode: "bike" } }
    }

    // Create a delivery quote
    const quoteResponse = await fetch(
      `https://api.uber.com/v1/customers/${UBER_CUSTOMER_ID}/delivery_quotes`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!quoteResponse.ok) {
      const error = await quoteResponse.text()
      console.error("Uber API error:", error)
      return NextResponse.json(
        { error: `Uber API error: ${quoteResponse.status}` },
        { status: quoteResponse.status }
      )
    }

    const quoteData = await quoteResponse.json()
    
    return NextResponse.json(quoteData)
  } catch (error) {
    console.error("Error getting Uber quote:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get delivery quote" },
      { status: 500 }
    )
  }
}

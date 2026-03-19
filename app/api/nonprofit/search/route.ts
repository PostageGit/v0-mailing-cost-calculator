import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const state = searchParams.get("state")

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
  }

  try {
    let url = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(query)}`
    if (state) {
      url += `&state%5Bid%5D=${encodeURIComponent(state)}`
    }

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    })

    if (!res.ok) {
      throw new Error(`ProPublica API returned ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Nonprofit search error:", error)
    return NextResponse.json({ error: "Failed to search nonprofits" }, { status: 500 })
  }
}

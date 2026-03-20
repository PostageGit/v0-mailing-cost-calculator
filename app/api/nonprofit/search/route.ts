import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const state = searchParams.get("state")

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ organizations: [], total_results: 0 })
  }

  try {
    // Build URL with proper encoding
    const params = new URLSearchParams()
    params.set("q", query.trim())
    if (state) {
      params.set("state[id]", state)
    }

    const url = `https://projects.propublica.org/nonprofits/api/v2/search.json?${params.toString()}`

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "PostagePlus/1.0",
      },
      cache: "no-store",
    })

    if (!res.ok) {
      // Return empty results instead of error for 404 (no results found)
      if (res.status === 404) {
        return NextResponse.json({ organizations: [], total_results: 0 })
      }
      throw new Error(`ProPublica API returned ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Nonprofit search error:", error)
    return NextResponse.json({ organizations: [], total_results: 0, error: "Search temporarily unavailable" })
  }
}

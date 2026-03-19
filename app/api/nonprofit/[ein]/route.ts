import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params

  if (!ein) {
    return NextResponse.json({ error: "EIN parameter is required" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`,
      {
        headers: {
          "Accept": "application/json",
        },
      }
    )

    if (!res.ok) {
      throw new Error(`ProPublica API returned ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Nonprofit detail error:", error)
    return NextResponse.json({ error: "Failed to fetch organization details" }, { status: 500 })
  }
}

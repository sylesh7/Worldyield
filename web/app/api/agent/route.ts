import { NextRequest, NextResponse } from 'next/server'

const AGENT_URL = process.env.AGENT_API_URL || 'http://localhost:3001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const res = await fetch(`${AGENT_URL}/api/test-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Agent server unreachable. Make sure the agent is running on port 3001.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    )
  }
}

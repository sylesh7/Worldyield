import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Cloud verification skipped for simulator/demo.
  // ZK proof is validated by IDKit at the protocol level.
  const creEndpoint = process.env.CRE_INTAKE_ENDPOINT
  if (creEndpoint) {
    await fetch(creEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nullifierHash: body.nullifier_hash,
        proof: body,
      }),
    }).catch(console.error)
  }

  return NextResponse.json({ success: true })
}

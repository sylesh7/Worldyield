import { NextResponse } from 'next/server'
import { signRequest } from '@worldcoin/idkit-server'

export async function POST() {
  const signingKey = process.env.RP_SIGNING_KEY?.trim()
  const rpId = process.env.WORLD_RP_ID?.trim()

  if (!signingKey || !rpId) {
    return NextResponse.json(
      { error: `Missing RP credentials — set WORLD_RP_ID and RP_SIGNING_KEY in .env (get them from Developer Portal → your app → Advanced → Relying Party)` },
      { status: 500 },
    )
  }

  try {
    const cleanKey = signingKey.replace(/^0x/i, '').trim()
    const rpSig = signRequest(
      process.env.NEXT_PUBLIC_WORLD_ACTION || 'verayield-entry',
      cleanKey,
    )

    return NextResponse.json({
      rp_id: rpId,
      nonce: rpSig.nonce,
      created_at: rpSig.createdAt,
      expires_at: rpSig.expiresAt,
      signature: rpSig.sig,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `signRequest failed: ${message}` }, { status: 500 })
  }
}

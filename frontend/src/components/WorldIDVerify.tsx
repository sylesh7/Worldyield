'use client'

import { IDKit, orbLegacy } from '@worldcoin/idkit-core'
import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect, useRef } from 'react'

const APP_ID = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`
const ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION || 'verayield-entry'
const ENVIRONMENT = (process.env.NEXT_PUBLIC_WORLD_ENVIRONMENT || 'staging') as 'staging' | 'production'

export function VerifyButton({ onVerified }: { onVerified: (nullifierHash: string) => void }) {
  const [step, setStep] = useState<'idle' | 'loading' | 'qr' | 'waiting' | 'error'>('idle')
  const [qrUri, setQrUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signal] = useState(() => crypto.randomUUID())
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { return () => { abortRef.current?.abort() } }, [])

  async function startVerify() {
    setStep('loading')
    setError(null)
    abortRef.current = new AbortController()
    try {
      const rpRes = await fetch('/api/rp-signature', { method: 'POST' })
      const rp = await rpRes.json()
      if (rp.error) throw new Error('RP error: ' + rp.error)
      const request = await IDKit.request({
        app_id: APP_ID,
        action: ACTION,
        rp_context: { rp_id: rp.rp_id, nonce: rp.nonce, created_at: rp.created_at, expires_at: rp.expires_at, signature: rp.signature },
        allow_legacy_proofs: true,
        environment: ENVIRONMENT,
      }).preset(orbLegacy({ signal }))
      setQrUri(request.connectorURI)
      setStep('qr')
      const completion = await request.pollUntilCompletion({
        pollInterval: 1000,
        timeout: 300000,
        signal: abortRef.current.signal,
      })
      if (!completion.success) throw new Error(String(completion.error ?? 'Verification failed'))
      setStep('waiting')
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completion.result),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Backend rejected proof')
      onVerified((completion.result as { nullifier_hash?: string }).nullifier_hash ?? signal)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setStep('error')
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setStep('idle')
    setQrUri(null)
    setError(null)
  }

  if (step === 'qr' && qrUri) return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-lg">
        <p className="text-sm font-semibold text-gray-800">Scan with World ID Simulator</p>
        <p className="text-xs text-gray-500 text-center">
          Open{' '}
          <a href="https://simulator.worldcoin.org" target="_blank" rel="noopener noreferrer" className="underline text-blue-500">
            simulator.worldcoin.org
          </a>{' '}
          and click Scan
        </p>
        <div className="p-3 bg-white rounded-xl border border-gray-100">
          <QRCodeSVG value={qrUri} size={220} fgColor="#000000" bgColor="#ffffff" />
        </div>
        <p className="text-xs text-gray-400 animate-pulse">Waiting for simulator…</p>
      </div>
      <button onClick={cancel} className="text-xs text-gray-400 underline">Cancel</button>
    </div>
  )

  if (step === 'waiting') return (
    <div className="bg-black text-white px-8 py-3 rounded-full font-semibold text-sm opacity-50">
      Verifying proof…
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={startVerify}
        disabled={step === 'loading'}
        className="bg-black text-white px-8 py-3 rounded-full font-semibold text-sm disabled:opacity-50 hover:bg-gray-800 transition-colors"
      >
        {step === 'loading' ? 'Loading…' : 'Verify with World ID'}
      </button>
      {error && <p className="text-red-500 text-xs text-center max-w-xs">{error}</p>}
    </div>
  )
}
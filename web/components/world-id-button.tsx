"use client"

import { IDKit, orbLegacy } from "@worldcoin/idkit-core"
import { QRCodeSVG } from "qrcode.react"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"

const APP_ID = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`
const ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION || "verayield-entry"
const ENVIRONMENT = (process.env.NEXT_PUBLIC_WORLD_ENVIRONMENT || "staging") as "staging" | "production"

export function WorldIDButton() {
  const [step, setStep] = useState<"idle" | "loading" | "qr" | "waiting" | "error">("idle")
  const [qrUri, setQrUri] = useState<string | null>(null)
  const [nullifier, setNullifier] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signal] = useState(() => crypto.randomUUID())
  const [mounted, setMounted] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => { abortRef.current?.abort() }
  }, [])

  async function startVerify() {
    setStep("loading")
    setError(null)
    abortRef.current = new AbortController()
    try {
      const rpRes = await fetch("/api/rp-signature", { method: "POST" })
      const rp = await rpRes.json()
      if (rp.error) throw new Error("RP error: " + rp.error)

      const request = await IDKit.request({
        app_id: APP_ID,
        action: ACTION,
        rp_context: {
          rp_id: rp.rp_id,
          nonce: rp.nonce,
          created_at: rp.created_at,
          expires_at: rp.expires_at,
          signature: rp.signature,
        },
        allow_legacy_proofs: true,
        environment: ENVIRONMENT,
      }).preset(orbLegacy({ signal }))

      setQrUri(request.connectorURI)
      setStep("qr")

      const completion = await request.pollUntilCompletion({
        pollInterval: 1000,
        timeout: 300000,
        signal: abortRef.current.signal,
      })

      if (!completion.success) throw new Error(String(completion.error ?? "Verification failed"))

      setStep("waiting")
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completion.result),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? "Backend rejected proof")

      setNullifier((completion.result as { nullifier_hash?: string }).nullifier_hash ?? signal)
      setStep("idle")
      setQrUri(null)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Unexpected error")
      setStep("error")
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setStep("idle")
    setQrUri(null)
    setError(null)
  }

  const showModal = (step === "qr" && qrUri) || step === "waiting" || step === "error"

  const modal = mounted && showModal ? createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) cancel() }}
    >
      <div className="relative border border-foreground/20 bg-background w-full max-w-sm mx-4 p-8 flex flex-col items-center gap-6">
        {/* Close button */}
        <button
          onClick={cancel}
          className="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>

        {/* World ID logo mark */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full border border-foreground/40 flex items-center justify-center">
            <span className="font-mono text-xs font-bold">W</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            World ID
          </p>
        </div>

        {step === "qr" && qrUri && (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-foreground text-center">
              Scan with Simulator
            </p>
            <p className="font-mono text-[10px] text-muted-foreground text-center leading-relaxed">
              Open{" "}
              <a
                href="https://simulator.worldcoin.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-foreground hover:text-accent transition-colors"
              >
                simulator.worldcoin.org
              </a>{" "}
              and click Scan
            </p>
            <div className="p-4 bg-white">
              <QRCodeSVG value={qrUri} size={220} fgColor="#000000" bgColor="#ffffff" />
            </div>
            <p className="font-mono text-[10px] text-muted-foreground animate-pulse">
              Waiting for simulator…
            </p>
          </>
        )}

        {step === "waiting" && (
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground animate-pulse">
            Verifying proof…
          </p>
        )}

        {step === "error" && error && (
          <>
            <p className="font-mono text-[10px] text-red-400/80 text-center max-w-[260px]">{error}</p>
            <button
              onClick={() => { setStep("idle"); setError(null) }}
              className="font-mono text-[10px] uppercase tracking-widest border border-foreground/20 px-4 py-2 text-foreground hover:border-accent hover:text-accent transition-all"
            >
              Try Again
            </button>
          </>
        )}

        <button
          onClick={cancel}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mt-2"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  ) : null

  if (nullifier) {
    return (
      <div className="inline-flex items-center gap-3 border border-green-500/40 px-6 py-3 font-mono text-xs uppercase tracking-widest text-green-400">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Verified Human
        <span className="text-green-500/40 normal-case truncate max-w-[120px]">
          {nullifier.slice(0, 10)}…
        </span>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={startVerify}
        disabled={step === "loading"}
        className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all duration-200 disabled:opacity-40"
      >
        <span className="w-2 h-2 rounded-full border border-current" />
        {step === "loading" ? "Loading…" : "Login with World ID"}
      </button>
      {modal}
    </>
  )
}

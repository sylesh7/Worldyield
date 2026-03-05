"use client"

import { useState, useRef, useEffect } from "react"
import { TopNav } from "@/components/top-nav"
import { AnimatedNoise } from "@/components/animated-noise"

const QUICK_QUERIES = [
  "What's the best yield option right now?",
  "Compare APY across all protocols",
  "How does human verification boost work?",
  "Should I move my funds from Aave to Compound?",
]

type Message = {
  role: "user" | "assistant"
  content: string
  toolCalls?: number
}

const agentStats = [
  { label: "Status", value: "Active", badge: true },
  { label: "Model", value: "Llama 3.3", unit: "70B" },
  { label: "Protocols", value: "2", unit: "live" },
  { label: "Boost", value: "+1.4", unit: "% APY" },
]

const recentDecisions = [
  {
    id: "D-0342",
    action: "REBALANCE",
    reasoning: "Aave v3 APY increased by 0.41% on Optimism. Moving 12,000 USDC from Compound Arbitrum to capture higher yield.",
    time: "2h ago",
    status: "EXECUTED",
  },
  {
    id: "D-0341",
    action: "HOLD",
    reasoning: "No significant APY divergence detected. Current allocation optimal within 0.5% tolerance.",
    time: "6h ago",
    status: "CONFIRMED",
  },
  {
    id: "D-0340",
    action: "REBALANCE",
    reasoning: "Morpho Base yield spiked to 8.94%. Reallocating 8,000 USDC from Spark Ethereum.",
    time: "9h ago",
    status: "EXECUTED",
  },
]

const statusColor: Record<string, string> = {
  EXECUTED: "text-emerald-400 border-emerald-400/30",
  CONFIRMED: "text-muted-foreground border-border",
}
const actionColor: Record<string, string> = {
  REBALANCE: "text-accent",
  HOLD: "text-muted-foreground",
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello. I'm the VeraYield AI Agent. I fetch real-time APY data from Aave v3 and Compound v3 on-chain via viem, then apply the WorldYield human verification boost to give you the best effective yield. Ask me anything about your yield opportunities.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || loading) return
    setInput("")
    setError(null)
    setMessages((prev) => [...prev, { role: "user", content: msg }])
    setLoading(true)
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      if (data.success) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.response, toolCalls: data.toolCalls }])
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error || "Unknown error"}` }])
        setError(data.error || "Agent returned an error.")
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Agent server is offline. Start it with: cd agent && npm run dev" }])
      setError("Could not reach the agent. Make sure it's running on port 3001.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen bg-background">
      <AnimatedNoise opacity={0.03} />
      <TopNav />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10 pt-14 h-screen flex flex-col">
        {/* Header bar */}
        <div className="border-b border-border/40 px-6 md:px-12 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">AI Yield Optimizer</p>
            <h1 className="font-[var(--font-bebas)] text-[clamp(1.4rem,3vw,2.2rem)] tracking-[0.1em] leading-none mt-0.5">AGENT</h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {agentStats.map((s) => (
              <div key={s.label} className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">{s.label}</p>
                {s.badge ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {s.value}
                  </span>
                ) : (
                  <span className="font-mono text-xs text-foreground">
                    {s.value}<span className="text-muted-foreground ml-1">{s.unit}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0 divide-x divide-border/40">

          {/* LEFT — Chat */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 space-y-5">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-5 py-4 font-mono text-xs leading-relaxed whitespace-pre-wrap border ${
                    m.role === "user"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border/40"
                  }`}>
                    {m.role === "assistant" && (
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2">
                        Agent
                        {m.toolCalls !== undefined && m.toolCalls > 0 && (
                          <span className="ml-2 text-accent">· {m.toolCalls} tool call{m.toolCalls > 1 ? "s" : ""}</span>
                        )}
                      </p>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="border border-border/40 px-5 py-4 font-mono text-xs text-muted-foreground">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2">Agent</p>
                    <span className="animate-pulse">Fetching on-chain data…</span>
                  </div>
                </div>
              )}
              {error && <p className="font-mono text-[10px] text-red-400/70 text-center">{error}</p>}
              <div ref={bottomRef} />
            </div>

            {/* Quick queries */}
            <div className="px-6 md:px-10 pb-3 flex flex-wrap gap-2">
              {QUICK_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={loading}
                  className="font-mono text-[10px] uppercase tracking-widest border border-border/40 px-3 py-1.5 text-muted-foreground hover:border-accent hover:text-accent transition-all duration-150 disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-6 md:px-10 pb-6 pt-1">
              <div className="flex gap-3 border border-border/60 focus-within:border-accent/60 transition-colors">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) }
                  }}
                  disabled={loading}
                  rows={2}
                  placeholder="Ask about yield opportunities…"
                  className="flex-1 bg-transparent px-4 py-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 resize-none outline-none disabled:opacity-40"
                />
                <button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  className="px-5 font-mono text-[10px] uppercase tracking-widest text-background bg-foreground hover:bg-accent transition-colors duration-150 disabled:opacity-30 shrink-0"
                >
                  Send
                </button>
              </div>
              <p className="mt-2 font-mono text-[9px] text-muted-foreground/40 uppercase tracking-widest">
                Enter to send · Shift+Enter for new line · Requires agent on :3001
              </p>
            </div>
          </div>

          {/* RIGHT — Decision log + config */}
          <div className="w-80 shrink-0 overflow-y-auto flex flex-col divide-y divide-border/30">
            <div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Decision Log</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="font-mono text-[9px] text-muted-foreground/60">Live</span>
                </span>
              </div>
              <div className="divide-y divide-border/20">
                {recentDecisions.map((d) => (
                  <div key={d.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-muted-foreground/40">{d.id}</span>
                        <span className={`font-mono text-[10px] uppercase tracking-widest ${actionColor[d.action]}`}>{d.action}</span>
                      </div>
                      <span className={`font-mono text-[9px] uppercase border px-1.5 py-0.5 ${statusColor[d.status]}`}>{d.status}</span>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground leading-relaxed mb-1">{d.reasoning}</p>
                    <p className="font-mono text-[9px] text-muted-foreground/40">{d.time}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="px-5 py-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Strategy Config</span>
              </div>
              <div className="divide-y divide-border/20">
                {[
                  { k: "Model", v: "Llama 3.3 70B" },
                  { k: "Trigger", v: "APY delta > 0.3% or 8h" },
                  { k: "Max Slippage", v: "0.5%" },
                  { k: "Min Move", v: "5,000 USDC" },
                  { k: "Boost", v: "+1.4% verified humans" },
                  { k: "Consensus", v: "+0.06% per 100 humans" },
                  { k: "Protocols", v: "Aave v3, Compound v3" },
                  { k: "Network", v: "Sepolia / Base Sepolia" },
                ].map((s) => (
                  <div key={s.k} className="px-5 py-3">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-0.5">{s.k}</p>
                    <p className="font-mono text-[10px] text-foreground">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="border border-border px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground text-center">
                Mastra Agent · World Chain Sepolia
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

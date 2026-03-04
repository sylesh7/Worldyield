import { TopNav } from "@/components/top-nav"
import { AnimatedNoise } from "@/components/animated-noise"

const agentStats = [
  { label: "Status", value: "Active", unit: "", badge: true },
  { label: "Decisions Made", value: "342", unit: "total" },
  { label: "Avg Response", value: "1.4", unit: "sec" },
  { label: "Uptime", value: "99.8", unit: "%" },
]

const recentDecisions = [
  {
    id: "D-0342",
    action: "REBALANCE",
    reasoning:
      "Aave v3 APY increased by 0.41% on Optimism. Moving 12,000 USDC from Compound Arbitrum to capture higher yield.",
    amount: "12,000 USDC",
    from: "Compound · Arbitrum",
    to: "Aave v3 · Optimism",
    time: "2h ago",
    status: "EXECUTED",
  },
  {
    id: "D-0341",
    action: "HOLD",
    reasoning:
      "No significant APY divergence detected across monitored protocols. Current allocation remains optimal within 0.5% tolerance.",
    amount: "—",
    from: "—",
    to: "—",
    time: "6h ago",
    status: "CONFIRMED",
  },
  {
    id: "D-0340",
    action: "REBALANCE",
    reasoning:
      "Morpho Base yield spiked to 8.94%. Reallocating 8,000 USDC from Spark Ethereum to capture spread before mean reversion.",
    amount: "8,000 USDC",
    from: "Spark · Ethereum",
    to: "Morpho · Base",
    time: "9h ago",
    status: "EXECUTED",
  },
  {
    id: "D-0339",
    action: "HOLD",
    reasoning:
      "Gas costs on Arbitrum make rebalancing uneconomical at current spread. Will revisit in next cycle.",
    amount: "—",
    from: "—",
    to: "—",
    time: "14h ago",
    status: "CONFIRMED",
  },
]

const statusColor: Record<string, string> = {
  EXECUTED: "text-emerald-400 border-emerald-400/30",
  CONFIRMED: "text-muted-foreground border-border",
  PENDING: "text-accent border-accent/30",
}

const actionColor: Record<string, string> = {
  REBALANCE: "text-accent",
  HOLD: "text-muted-foreground",
}

const strategy = [
  { label: "Model", value: "Mastra Agent v1" },
  { label: "Trigger", value: "APY delta > 0.3% or 8h elapsed" },
  { label: "Max Slippage", value: "0.5%" },
  { label: "Min Move Size", value: "5,000 USDC" },
  { label: "Gas Budget", value: "0.01 ETH / rebalance" },
  { label: "Protocols", value: "Aave, Morpho, Compound, Spark" },
]

export default function AgentPage() {
  return (
    <main className="relative min-h-screen bg-background">
      <AnimatedNoise opacity={0.03} />
      <TopNav />

      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10 pt-20 pb-16 px-6 md:px-12 max-w-7xl mx-auto">

        {/* Page header */}
        <div className="border-b border-border/40 pb-6 mb-10 mt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            AI Yield Optimizer
          </p>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] tracking-[0.1em] leading-none">
            AGENT
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 border border-border/40 mb-10">
          {agentStats.map((stat) => (
            <div key={stat.label} className="bg-background px-6 py-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                {stat.label}
              </p>
              <div className="flex items-baseline gap-2">
                {stat.badge ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-[var(--font-bebas)] text-[clamp(1.6rem,3.5vw,2.8rem)] leading-none tracking-wide text-emerald-400">
                      {stat.value}
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="font-[var(--font-bebas)] text-[clamp(1.6rem,3.5vw,2.8rem)] leading-none tracking-wide">
                      {stat.value}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{stat.unit}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Two-column: Decisions + Strategy */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* Decision log */}
          <div className="md:col-span-2 border border-border/40">
            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Decision Log
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/50">
                Last 24h
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {recentDecisions.map((d) => (
                <div key={d.id} className="px-6 py-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-muted-foreground/50">{d.id}</span>
                      <span className={`font-mono text-[11px] uppercase tracking-widest ${actionColor[d.action] ?? "text-foreground"}`}>
                        {d.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-muted-foreground/50">{d.time}</span>
                      <span className={`font-mono text-[9px] uppercase tracking-widest border px-2 py-0.5 ${statusColor[d.status] ?? ""}`}>
                        {d.status}
                      </span>
                    </div>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground leading-relaxed mb-3">
                    {d.reasoning}
                  </p>
                  {d.amount !== "—" && (
                    <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground/60">
                      <span>{d.amount}</span>
                      <span className="text-border">·</span>
                      <span>{d.from}</span>
                      <span className="text-accent">→</span>
                      <span>{d.to}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Strategy config */}
          <div className="border border-border/40 h-fit">
            <div className="px-6 py-4 border-b border-border/40">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Strategy Config
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {strategy.map((s) => (
                <div key={s.label} className="px-6 py-3.5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">
                    {s.label}
                  </p>
                  <p className="font-mono text-xs text-foreground">{s.value}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-6 py-5 border-t border-border/40">
              <a
                href="/dashboard"
                className="block text-center font-mono text-[11px] uppercase tracking-widest border border-border px-4 py-3 text-muted-foreground hover:bg-foreground hover:text-background transition-all duration-200"
              >
                View Pool Activity
              </a>
            </div>
          </div>
        </div>

        {/* Footer tag */}
        <div className="mt-10 flex justify-end">
          <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Mastra Agent · World Chain Sepolia
          </div>
        </div>
      </div>
    </main>
  )
}

import { TopNav } from "@/components/top-nav"
import { AnimatedNoise } from "@/components/animated-noise"

const poolStats = [
  { label: "Total Pooled", value: "284,500", unit: "USDC", delta: "+12.4%", positive: true },
  { label: "Active APY", value: "8.73", unit: "%", delta: "+0.41%", positive: true },
  { label: "Participants", value: "1,247", unit: "Humans", delta: "+38", positive: true },
  { label: "Last Rebalance", value: "2h", unit: "ago", delta: "Auto", positive: true },
]

const allocations = [
  { protocol: "Aave v3", chain: "Optimism", amount: "98,400", share: 34.6, apy: "9.12%" },
  { protocol: "Morpho", chain: "Base", amount: "76,250", share: 26.8, apy: "8.94%" },
  { protocol: "Compound", chain: "Arbitrum", amount: "63,900", share: 22.5, apy: "7.81%" },
  { protocol: "Spark", chain: "Ethereum", amount: "45,950", share: 16.1, apy: "8.10%" },
]

const activity = [
  { type: "DEPOSIT", address: "0x3f2...a91c", amount: "+4,200 USDC", time: "4m ago" },
  { type: "REBALANCE", address: "Agent", amount: "Moved 12,000 USDC → Aave", time: "2h ago" },
  { type: "DEPOSIT", address: "0xb12...77de", amount: "+1,500 USDC", time: "3h ago" },
  { type: "WITHDRAW", address: "0x9cc...3ef2", amount: "-800 USDC", time: "5h ago" },
  { type: "DEPOSIT", address: "0x44a...c01f", amount: "+10,000 USDC", time: "7h ago" },
  { type: "REBALANCE", address: "Agent", amount: "Moved 8,000 USDC → Morpho", time: "9h ago" },
]

const typeColors: Record<string, string> = {
  DEPOSIT: "text-emerald-400",
  WITHDRAW: "text-red-400",
  REBALANCE: "text-accent",
}

export default function DashboardPage() {
  return (
    <main className="relative min-h-screen bg-background">
      <AnimatedNoise opacity={0.03} />
      <TopNav />

      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10 pt-20 pb-16 px-6 md:px-12 max-w-7xl mx-auto">

        {/* Page header */}
        <div className="border-b border-border/40 pb-6 mb-10 mt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Pool Overview
          </p>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] tracking-[0.1em] leading-none">
            POOL ACTIVITY
          </h1>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 border border-border/40 mb-10">
          {poolStats.map((stat) => (
            <div key={stat.label} className="bg-background px-6 py-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                {stat.label}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-[var(--font-bebas)] text-[clamp(1.6rem,3.5vw,2.8rem)] leading-none tracking-wide">
                  {stat.value}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{stat.unit}</span>
              </div>
              <span
                className={`mt-2 inline-block font-mono text-[10px] uppercase tracking-widest ${
                  stat.positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {stat.delta}
              </span>
            </div>
          ))}
        </div>

        {/* Two-column: Allocations + Activity */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Allocations */}
          <div className="border border-border/40">
            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Current Allocations
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/50">USDC</span>
            </div>
            <div className="divide-y divide-border/30">
              {allocations.map((a) => (
                <div key={a.protocol} className="px-6 py-4 flex items-center gap-4">
                  {/* Bar */}
                  <div className="w-24 h-0.5 bg-border/40 relative shrink-0">
                    <div
                      className="absolute top-0 left-0 h-full bg-accent"
                      style={{ width: `${a.share}%` }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-foreground">{a.protocol}</span>
                      <span className="font-mono text-xs text-emerald-400">{a.apy}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground">{a.chain}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ${a.amount} · {a.share}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="border border-border/40">
            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Recent Activity
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <span className="font-mono text-[10px] text-muted-foreground">Live</span>
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {activity.map((item, i) => (
                <div key={i} className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`font-mono text-[9px] uppercase tracking-widest shrink-0 ${typeColors[item.type] ?? "text-muted-foreground"}`}
                    >
                      {item.type}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      {item.address}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs text-foreground">{item.amount}</p>
                    <p className="font-mono text-[10px] text-muted-foreground/50">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer tag */}
        <div className="mt-10 flex justify-end">
          <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            World Chain Sepolia · Contract Verified
          </div>
        </div>
      </div>
    </main>
  )
}

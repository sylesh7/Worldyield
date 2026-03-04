"use client"

import { useRef, useEffect } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function ColophonSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const ctx = gsap.context(() => {
      // Header slide in
      if (headerRef.current) {
        gsap.from(headerRef.current, {
          x: -60,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        })
      }

      // Grid columns fade up with stagger
      if (gridRef.current) {
        const columns = gridRef.current.querySelectorAll(":scope > div")
        gsap.from(columns, {
          y: 40,
          opacity: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        })
      }

      // Footer fade in
      if (footerRef.current) {
        gsap.from(footerRef.current, {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: footerRef.current,
            start: "top 95%",
            toggleActions: "play none none reverse",
          },
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="colophon"
      className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12 border-t border-border/30"
    >
      {/* Section header */}
      <div ref={headerRef} className="mb-16">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">04 / About</span>
        <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">THE STACK</h2>
      </div>

      {/* Multi-column layout */}
      <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 md:gap-12">
        {/* Contracts */}
        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Contracts</h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">VeraYieldVault</li>
            <li className="font-mono text-xs text-foreground/80">WorldIDGate</li>
            <li className="font-mono text-xs text-foreground/80">HumanConsensus</li>
            <li className="font-mono text-xs text-foreground/80">MandateStorage</li>
          </ul>
        </div>

        {/* Chain */}
        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Chain</h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">World Chain</li>
            <li className="font-mono text-xs text-foreground/80">Optimism</li>
            <li className="font-mono text-xs text-foreground/80">Base</li>
            <li className="font-mono text-xs text-foreground/80">Arbitrum</li>
          </ul>
        </div>

        {/* Agent */}
        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Agent</h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">Mastra v1</li>
            <li className="font-mono text-xs text-foreground/80">Next.js 15</li>
            <li className="font-mono text-xs text-foreground/80">TypeScript</li>
          </ul>
        </div>

        {/* Identity */}
        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Identity</h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">World ID</li>
            <li className="font-mono text-xs text-foreground/80">Orb Verified</li>
            <li className="font-mono text-xs text-foreground/80">IDKit Core</li>
          </ul>
        </div>

        {/* Protocols */}
        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Protocols</h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">Aave v3</li>
            <li className="font-mono text-xs text-foreground/80">Morpho</li>
            <li className="font-mono text-xs text-foreground/80">Compound</li>
            <li className="font-mono text-xs text-foreground/80">Spark</li>
          </ul>
        </div>

        {/* Status */}
        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">Status</h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">Sepolia Testnet</li>
            <li className="font-mono text-xs text-emerald-400">Live</li>
            <li className="font-mono text-xs text-foreground/80">2026 · Ongoing</li>
          </ul>
        </div>
      </div>

      {/* Bottom copyright */}
      <div
        ref={footerRef}
        className="mt-24 pt-8 border-t border-border/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          © 2026 WorldYield. All rights reserved.
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">Yield for verified humans. Powered by World ID &amp; AI.</p>
      </div>
    </section>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { SplitFlapText, SplitFlapMuteToggle, SplitFlapAudioProvider } from "@/components/split-flap-text"
import { AnimatedNoise } from "@/components/animated-noise"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const WorldIDButton = dynamic(
  () => import("@/components/world-id-button").then((m) => m.WorldIDButton),
  { ssr: false },
)

const HeroGlobe = dynamic(
  () => import("@/components/hero-globe").then((m) => m.HeroGlobe),
  { ssr: false },
)

gsap.registerPlugin(ScrollTrigger)

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return

    const ctx = gsap.context(() => {
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-screen flex items-center pl-6 md:pl-28 pr-6 md:pr-12">
      <AnimatedNoise opacity={0.03} />

      {/* Left vertical labels */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground -rotate-90 origin-left block whitespace-nowrap">
          SIGNAL
        </span>
      </div>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 w-full">
        <SplitFlapAudioProvider>
          <div className="relative">
            <SplitFlapText text="WORLDYIELD" speed={80} />
            <div className="mt-4">
              <SplitFlapMuteToggle />
            </div>
          </div>
        </SplitFlapAudioProvider>

        <h2 className="font-[var(--font-bebas)] text-muted-foreground/60 text-[clamp(1rem,3vw,2rem)] mt-4 tracking-wide">
          Yield for Verified Humans
        </h2>

        <p className="mt-12 max-w-md font-mono text-sm text-muted-foreground leading-relaxed">
          Pool USDC with other World ID verified humans. Our AI agent allocates across the highest-yield DeFi protocols — cross-chain, autonomously, on-chain.
        </p>

        <div className="mt-16 flex items-center gap-8">
          <WorldIDButton onVerified={() => setVerified(true)} />
          {verified ? (
            <a
              href="/dashboard"
              className="font-mono text-xs uppercase tracking-widest border border-accent px-6 py-3 text-accent hover:bg-accent hover:text-background transition-all duration-200"
            >
              Get Started
            </a>
          ) : (
            <span className="font-mono text-xs uppercase tracking-widest border border-border/30 px-6 py-3 text-muted-foreground/30 cursor-not-allowed select-none" title="Verify with World ID first">
              Get Started
            </span>
          )}
        </div>
      </div>

      {/* Globe — bottom right */}
      <div className="absolute bottom-0 right-0 w-[clamp(280px,38vw,540px)] h-[clamp(280px,38vw,540px)] pointer-events-none">
        <HeroGlobe />
      </div>

      {/* Floating info tag */}
      <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12">
        <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          v.01 / Experimental Build
        </div>
      </div>
    </section>
  )
}

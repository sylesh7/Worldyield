"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agent", label: "Agent" },
]

export function TopNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 md:px-12 h-14">
        {/* Logo */}
        <Link
          href="/"
          className="font-[var(--font-bebas)] text-xl tracking-[0.2em] text-foreground hover:text-accent transition-colors duration-200"
        >
          WORLDYIELD
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "font-mono text-[11px] uppercase tracking-widest transition-colors duration-200",
                pathname === href
                  ? "text-foreground border-b border-accent pb-0.5"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Status tag */}
        <div className="hidden md:flex items-center gap-3">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Live
          </span>
          <div className="ml-4 border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            World Chain Sepolia
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background px-6 py-4 flex flex-col gap-4">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "font-mono text-[11px] uppercase tracking-widest",
                pathname === href ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}

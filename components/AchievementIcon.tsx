// 18 hand-crafted SVG mini-icons (6 categories × 3 tiers) — pure inline, no
// emoji, no external assets. Theming via currentColor + CSS classes. Tier
// visuals:
//   T1: matte outline (no fill, muted stroke)
//   T2: solid felt-green fill
//   T3: gradient fill + soft glow (felt → warn) — the "earned everything" look
// Locked (tier 0): grayscale + low opacity at the wrapper.
//
// All viewBox 0 0 64 64. Stroke 2 minimum so they read on mobile. The wrapper
// applies color classes so the inside artwork is intentionally simple — let
// the framing supply most of the visual weight.

import * as React from 'react'

export type AchievementCategoryId =
  | 'bandar'
  | 'juara'
  | 'podium'
  | 'veteran'
  | 'sultan'
  | 'untung'

interface Props {
  categoryId: AchievementCategoryId | string
  tier: 0 | 1 | 2 | 3 // 0 = locked
  size?: number
  className?: string
}

// Unique-per-tier gradient ids — multiple icons on a page must not collide.
// We suffix with the category so 6 categories × 3 tiers = 18 unique ids.
function gradId(cat: string, tier: number, suffix: string): string {
  return `ach-${cat}-${tier}-${suffix}`
}

// Shared T3 gradient: felt-green → warn (gold). Returns a <defs> block.
function T3Defs({ cat }: { cat: string }) {
  const lin = gradId(cat, 3, 'lin')
  const rad = gradId(cat, 3, 'rad')
  return (
    <defs>
      <linearGradient id={lin} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-felt)" />
        <stop offset="100%" stopColor="var(--accent-warn)" />
      </linearGradient>
      <radialGradient id={rad} cx="32" cy="32" r="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-warn)" stopOpacity="0.55" />
        <stop offset="100%" stopColor="var(--accent-warn)" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

// Per-tier fill style — feed via attributes so the SVG primitives stay short.
function tierAttrs(cat: string, tier: 1 | 2 | 3): { stroke: string; fill: string; strokeWidth: number } {
  if (tier === 1) {
    return { stroke: 'currentColor', fill: 'none', strokeWidth: 2 }
  }
  if (tier === 2) {
    return { stroke: 'currentColor', fill: 'currentColor', strokeWidth: 2 }
  }
  // tier 3 — gradient fill + currentColor stroke for outline pop
  return { stroke: 'currentColor', fill: `url(#${gradId(cat, 3, 'lin')})`, strokeWidth: 2 }
}

// ----- Per-category artwork. Each returns inner <g> SVG only. The outer <svg>
// wrapper + tier styling lives in <AchievementIcon>.

function BandarArt({ tier }: { tier: 1 | 2 | 3 }) {
  const a = tierAttrs('bandar', tier)
  // T1: 1 chip; T2: 3 chip stack; T3: tall tower w/ crown.
  if (tier === 1) {
    return (
      <g>
        <ellipse cx="32" cy="40" rx="18" ry="6" {...a} />
        <ellipse cx="32" cy="32" rx="18" ry="6" stroke="currentColor" fill="var(--background)" strokeWidth={2} />
        <ellipse cx="32" cy="32" rx="10" ry="3.4" stroke="currentColor" fill="none" strokeWidth={1.5} />
        <line x1="14" y1="32" x2="14" y2="40" stroke="currentColor" strokeWidth={2} />
        <line x1="50" y1="32" x2="50" y2="40" stroke="currentColor" strokeWidth={2} />
      </g>
    )
  }
  if (tier === 2) {
    return (
      <g>
        <ellipse cx="32" cy="50" rx="20" ry="5" {...a} />
        <ellipse cx="32" cy="42" rx="20" ry="5" {...a} />
        <ellipse cx="32" cy="34" rx="20" ry="5" {...a} />
        <ellipse cx="32" cy="26" rx="20" ry="5" {...a} />
        <line x1="12" y1="26" x2="12" y2="50" stroke="currentColor" strokeWidth={2} />
        <line x1="52" y1="26" x2="52" y2="50" stroke="currentColor" strokeWidth={2} />
      </g>
    )
  }
  return (
    <g>
      {/* crown on top */}
      <path d="M22 12 L26 18 L32 10 L38 18 L42 12 L42 20 L22 20 Z" {...a} strokeLinejoin="round" />
      {/* tall tower */}
      <ellipse cx="32" cy="56" rx="22" ry="5" {...a} />
      <ellipse cx="32" cy="48" rx="22" ry="5" {...a} />
      <ellipse cx="32" cy="40" rx="22" ry="5" {...a} />
      <ellipse cx="32" cy="32" rx="22" ry="5" {...a} />
      <ellipse cx="32" cy="24" rx="22" ry="5" {...a} />
      <line x1="10" y1="24" x2="10" y2="56" stroke="currentColor" strokeWidth={2} />
      <line x1="54" y1="24" x2="54" y2="56" stroke="currentColor" strokeWidth={2} />
    </g>
  )
}

function JuaraArt({ tier }: { tier: 1 | 2 | 3 }) {
  const a = tierAttrs('juara', tier)
  // Trophy. T1 small cup, T2 cup + star on body, T3 cup + laurel + glow.
  return (
    <g>
      {tier === 3 && (
        <>
          {/* laurel wreath */}
          <path d="M14 32 Q8 24 10 14 Q18 18 20 26" stroke="currentColor" fill="none" strokeWidth={1.5} />
          <path d="M50 32 Q56 24 54 14 Q46 18 44 26" stroke="currentColor" fill="none" strokeWidth={1.5} />
          <path d="M14 36 Q8 40 12 50 Q18 46 22 42" stroke="currentColor" fill="none" strokeWidth={1.5} />
          <path d="M50 36 Q56 40 52 50 Q46 46 42 42" stroke="currentColor" fill="none" strokeWidth={1.5} />
        </>
      )}
      {/* handles */}
      <path d="M20 22 Q12 22 12 30 Q12 36 20 36" stroke="currentColor" fill="none" strokeWidth={2} />
      <path d="M44 22 Q52 22 52 30 Q52 36 44 36" stroke="currentColor" fill="none" strokeWidth={2} />
      {/* cup body */}
      <path d="M20 14 L44 14 L42 40 Q42 44 32 44 Q22 44 22 40 Z" {...a} strokeLinejoin="round" />
      {/* base */}
      <rect x="26" y="44" width="12" height="4" {...a} />
      <rect x="22" y="48" width="20" height="4" {...a} />
      {tier >= 2 && (
        /* star on cup body */
        <path
          d="M32 20 L34 26 L40 26 L35 30 L37 36 L32 32 L27 36 L29 30 L24 26 L30 26 Z"
          fill={tier === 3 ? `url(#${gradId('juara', 3, 'lin')})` : 'currentColor'}
          stroke="currentColor"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      )}
    </g>
  )
}

function PodiumArt({ tier }: { tier: 1 | 2 | 3 }) {
  const a = tierAttrs('podium', tier)
  // 3-step podium. T1: only the lowest step shines, T2: 2 steps, T3: all + crown on top.
  const lit = (step: 1 | 2 | 3) =>
    step <= tier
      ? a
      : { stroke: 'currentColor', fill: 'none', strokeWidth: 2 }
  return (
    <g>
      {tier === 3 && (
        /* tiny star above center step */
        <path
          d="M32 8 L33.5 12 L38 12 L34.3 14.6 L35.8 18.8 L32 16.4 L28.2 18.8 L29.7 14.6 L26 12 L30.5 12 Z"
          fill={`url(#${gradId('podium', 3, 'lin')})`}
          stroke="currentColor"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      )}
      {/* center step (highest, "1") */}
      <rect x="24" y="22" width="16" height="34" {...lit(1)} />
      <text x="32" y="42" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="700">1</text>
      {/* left step ("2") */}
      <rect x="8" y="32" width="16" height="24" {...lit(2)} />
      <text x="16" y="48" textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="700">2</text>
      {/* right step ("3") */}
      <rect x="40" y="38" width="16" height="18" {...lit(3)} />
      <text x="48" y="50" textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="700">3</text>
    </g>
  )
}

function VeteranArt({ tier }: { tier: 1 | 2 | 3 }) {
  const a = tierAttrs('veteran', tier)
  // Pocket watch. T1 small + 12, T2 + hour marks, T3 ornate + roman.
  return (
    <g>
      {/* crown / loop */}
      <rect x="28" y="6" width="8" height="6" {...a} rx="1" />
      <line x1="32" y1="12" x2="32" y2="14" stroke="currentColor" strokeWidth={2} />
      {/* case */}
      <circle cx="32" cy="36" r="20" {...a} />
      <circle cx="32" cy="36" r="16" stroke="currentColor" fill="var(--background)" strokeWidth={1.5} />
      {/* 12 marker */}
      <line x1="32" y1="22" x2="32" y2="24" stroke="currentColor" strokeWidth={2} />
      {tier >= 2 && (
        <>
          <line x1="46" y1="36" x2="48" y2="36" stroke="currentColor" strokeWidth={2} />
          <line x1="32" y1="48" x2="32" y2="50" stroke="currentColor" strokeWidth={2} />
          <line x1="16" y1="36" x2="18" y2="36" stroke="currentColor" strokeWidth={2} />
        </>
      )}
      {tier >= 3 && (
        <>
          <line x1="42" y1="24" x2="43" y2="26" stroke="currentColor" strokeWidth={1.5} />
          <line x1="42" y1="48" x2="43" y2="46" stroke="currentColor" strokeWidth={1.5} />
          <line x1="22" y1="48" x2="21" y2="46" stroke="currentColor" strokeWidth={1.5} />
          <line x1="22" y1="24" x2="21" y2="26" stroke="currentColor" strokeWidth={1.5} />
          {/* extra outer ornate ring */}
          <circle cx="32" cy="36" r="22" stroke="currentColor" fill="none" strokeWidth={1} strokeDasharray="2 2" />
        </>
      )}
      {/* hands */}
      <line x1="32" y1="36" x2="32" y2="26" stroke="currentColor" strokeWidth={2} />
      <line x1="32" y1="36" x2="40" y2="36" stroke="currentColor" strokeWidth={2} />
      <circle cx="32" cy="36" r="1.5" fill="currentColor" />
    </g>
  )
}

function SultanArt({ tier }: { tier: 1 | 2 | 3 }) {
  const a = tierAttrs('sultan', tier)
  // T1: single coin. T2: coin stack + currency mark. T3: crown + gem.
  if (tier === 1) {
    return (
      <g>
        <circle cx="32" cy="36" r="20" {...a} />
        <circle cx="32" cy="36" r="14" stroke="currentColor" fill="none" strokeWidth={1.5} />
        <text x="32" y="42" textAnchor="middle" fontSize="18" fill="currentColor" fontWeight="700" fontFamily="ui-monospace, monospace">$</text>
      </g>
    )
  }
  if (tier === 2) {
    return (
      <g>
        {/* stack of bills */}
        <rect x="10" y="46" width="44" height="10" {...a} rx="1" />
        <rect x="10" y="38" width="44" height="10" {...a} rx="1" />
        <rect x="10" y="30" width="44" height="10" {...a} rx="1" />
        {/* coin on top */}
        <circle cx="32" cy="18" r="10" {...a} />
        <text x="32" y="22" textAnchor="middle" fontSize="11" fill="var(--background)" fontWeight="700" fontFamily="ui-monospace, monospace">$</text>
      </g>
    )
  }
  // tier 3 — crown + gem coin
  return (
    <g>
      {/* crown */}
      <path d="M14 16 L20 24 L28 12 L32 22 L36 12 L44 24 L50 16 L50 28 L14 28 Z" {...a} strokeLinejoin="round" />
      {/* gem at crown center */}
      <path d="M30 14 L32 10 L34 14 L32 18 Z" fill="currentColor" stroke="currentColor" strokeWidth={1} />
      {/* coin body */}
      <circle cx="32" cy="44" r="16" {...a} />
      <circle cx="32" cy="44" r="11" stroke="currentColor" fill="none" strokeWidth={1.5} />
      <text x="32" y="50" textAnchor="middle" fontSize="15" fill="currentColor" fontWeight="700" fontFamily="ui-monospace, monospace">$</text>
    </g>
  )
}

function UntungArt({ tier }: { tier: 1 | 2 | 3 }) {
  const a = tierAttrs('untung', tier)
  // T1: single arrow up. T2: arrow + trending baseline. T3: 3 arrows + chart.
  if (tier === 1) {
    return (
      <g>
        <path d="M32 50 L32 18" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
        <path d="M20 28 L32 16 L44 28" {...a} strokeLinejoin="round" strokeLinecap="round" />
      </g>
    )
  }
  if (tier === 2) {
    return (
      <g>
        {/* baseline trending up */}
        <path d="M8 50 L20 42 L30 46 L42 30 L56 22" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* arrow head at tip */}
        <path d="M50 22 L56 22 L56 28" {...a} strokeLinejoin="round" strokeLinecap="round" />
        {/* big up arrow center */}
        <path d="M32 56 L32 30" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        <path d="M24 38 L32 30 L40 38" {...a} strokeLinejoin="round" strokeLinecap="round" />
      </g>
    )
  }
  // tier 3 — explosion of green up arrows
  return (
    <g>
      {/* chart bars */}
      <rect x="8" y="44" width="6" height="14" {...a} />
      <rect x="18" y="38" width="6" height="20" {...a} />
      <rect x="28" y="30" width="6" height="28" {...a} />
      <rect x="38" y="22" width="6" height="36" {...a} />
      <rect x="48" y="14" width="6" height="44" {...a} />
      {/* arrow shooting up from tallest bar */}
      <path d="M51 18 L51 6" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M46 10 L51 5 L56 10" stroke="currentColor" fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  )
}

const ART: Record<string, React.FC<{ tier: 1 | 2 | 3 }>> = {
  bandar: BandarArt,
  juara: JuaraArt,
  podium: PodiumArt,
  veteran: VeteranArt,
  sultan: SultanArt,
  untung: UntungArt,
}

export function AchievementIcon({ categoryId, tier, size = 64, className }: Props) {
  const Art = ART[categoryId]
  const locked = tier === 0
  // Color: T1 muted, T2 primary felt, T3 felt with glow halo behind.
  // Tailwind classes lean on existing felt-green tokens.
  const colorClass = locked
    ? 'text-[var(--text-tertiary)] opacity-30 grayscale'
    : tier === 1
      ? 'text-[var(--text-secondary)]'
      : tier === 2
        ? 'text-[var(--accent-felt)]'
        : 'text-[var(--accent-warn)]' // T3: warm gold pop, plus gradient fills
  const displayTier: 1 | 2 | 3 = locked ? 1 : tier
  if (!Art) return null
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={`${categoryId} tier ${tier}`}
      className={(className ? className + ' ' : '') + colorClass}
      style={
        tier === 3
          ? { filter: 'drop-shadow(0 0 6px var(--accent-warn))' }
          : undefined
      }
    >
      {/* T3 radial glow background */}
      {tier === 3 && (
        <>
          <T3Defs cat={categoryId} />
          <rect x="0" y="0" width="64" height="64" fill={`url(#${gradId(categoryId, 3, 'rad')})`} />
        </>
      )}
      <Art tier={displayTier} />
    </svg>
  )
}

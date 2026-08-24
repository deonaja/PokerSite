'use client'

import { useState } from 'react'
import { ACHIEVEMENTS, type LifetimeCounts } from '@/lib/achievements'
import { AchievementIcon, type AchievementCategoryId } from './AchievementIcon'
import PixelIcon from './PixelIcon'
import Sheet from './Sheet'

interface Props {
  // categoryId -> earned tier numbers
  earned: Record<string, number[]>
  counts: LifetimeCounts
}

const ROMAN = ['I', 'II', 'III'] as const
const TIER_COLOR: Record<1 | 2 | 3, string> = { 1: '#9aa0a0', 2: '#00d0d0', 3: '#ffe800' }

export default function AchievementsGrid({ earned, counts }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const openCat = ACHIEVEMENTS.find((c) => c.id === openId) ?? null

  return (
    <>
      {/* Compact grid — 3 tier icons per category, tap for detail */}
      <div className="mb-6 flex flex-col gap-3">
        {ACHIEVEMENTS.map((cat) => {
          const tiers = earned[cat.id] ?? []
          const count = counts[cat.metric]
          const maxTier = tiers.length ? Math.max(...tiers) : 0
          const nextTier = cat.tiers.find((t) => t.tier > maxTier) ?? null
          const allEarned = maxTier === 3
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setOpenId(cat.id)}
              className="border border-[var(--tt-rule)] bg-[#0a0a0a] px-3 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <div className="grid grid-cols-3 gap-2">
                {cat.tiers.map((t) => {
                  const isEarned = tiers.includes(t.tier)
                  return (
                    <div key={t.tier} className="flex flex-col items-center gap-1.5">
                      <AchievementIcon
                        categoryId={cat.id as AchievementCategoryId}
                        tier={isEarned ? (t.tier as 1 | 2 | 3) : 0}
                        size={48}
                      />
                      <p
                        className={
                          'text-center text-sm uppercase leading-tight tracking-wide ' +
                          (isEarned ? 'text-[var(--tt-white)]' : 'text-[var(--text-tertiary)]')
                        }
                      >
                        {t.name}
                      </p>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-center text-sm uppercase tracking-wide text-[var(--text-secondary)]">
                <span className="tabular-nums">{allEarned ? 'MAX' : nextTier ? `${count} / ${nextTier.threshold}` : count}</span>
                <span className="ml-2 text-[var(--text-tertiary)]">· tap</span>
              </p>
            </button>
          )
        })}
      </div>

      {/* Detail popup */}
      <Sheet isOpen={openCat !== null} onClose={() => setOpenId(null)} title={openCat ? openCat.id.toUpperCase() : ''}>
        {openCat && <Detail cat={openCat} tiers={earned[openCat.id] ?? []} count={counts[openCat.metric]} />}
      </Sheet>
    </>
  )
}

function Detail({
  cat,
  tiers,
  count,
}: {
  cat: (typeof ACHIEVEMENTS)[number]
  tiers: number[]
  count: number
}) {
  const maxTier = tiers.length ? Math.max(...tiers) : 0
  // The lowest not-yet-earned tier is the current target.
  const nextTier = cat.tiers.find((t) => !tiers.includes(t.tier)) ?? null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <AchievementIcon categoryId={cat.id as AchievementCategoryId} tier={(maxTier || 0) as 0 | 1 | 2 | 3} size={40} />
        <p className="text-base uppercase tracking-wide text-[var(--text-secondary)]">
          Progres <span className="tabular-nums text-[var(--tt-cyan)]">{count}</span>
        </p>
      </div>
      <div className="flex flex-col">
        {cat.tiers.map((t) => {
          const isEarned = tiers.includes(t.tier)
          const isNext = nextTier?.tier === t.tier
          return (
            <div key={t.tier} className="flex items-center gap-3 border-b border-[var(--tt-rule)] py-2.5 last:border-0">
              <span className="w-7 shrink-0 text-center text-lg" style={{ color: isEarned ? TIER_COLOR[t.tier] : '#5f6a6a' }}>
                {ROMAN[t.tier - 1]}
              </span>
              <div className="min-w-0 flex-1">
                <div className={'text-base uppercase tracking-wide ' + (isEarned ? 'text-[var(--tt-white)]' : 'text-[var(--text-secondary)]')}>
                  {t.name}
                </div>
                <div className="font-read text-xs leading-snug text-[var(--text-tertiary)]">{t.description}</div>
              </div>
              <span className="shrink-0 text-base tabular-nums">
                {isEarned ? (
                  <span style={{ color: TIER_COLOR[t.tier] }}><PixelIcon name="check" size={16} className="inline-block align-middle" /></span>
                ) : isNext ? (
                  <span className="text-[var(--tt-white)]">{count}/{t.threshold}</span>
                ) : (
                  <PixelIcon name="lock" size={13} className="inline-block text-[var(--text-tertiary)]" />
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

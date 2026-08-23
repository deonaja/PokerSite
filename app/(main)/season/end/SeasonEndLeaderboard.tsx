import { Card } from '@/components/ui/card'

interface Player {
  id: string
  name: string
  balance: number
}

interface Props {
  players: Player[]
  startingBalance: number
}

// First-letter avatar matches the rest of the app (HeaderMenu / SessionView /
// PlayerCard). Felt-green tile, no emoji.
function initial(name: string): string {
  return name.charAt(0).toUpperCase() || '?'
}

/**
 * Season-end leaderboard with a Quizizz-style stepped podium for the top 3
 * (when ≥3 players). The pillars enter in finishing order — 3rd first, then
 * 2nd, then 1st rises last and lands with a soft felt-green glow. Pure CSS
 * (tailwindcss-animate) so no JS state / hydration issues.
 *
 * <3 players → falls back to a simple ranked list (no podium).
 *
 * Owner asked for "mirip Quizizz tapi ga lebay, no emoji". Restraint:
 * - sequential entrance only (no looping animation)
 * - winner glow is a one-shot pulse, not persistent
 * - heights are stepped (1st = tallest, 3rd = shortest) — the only "drama"
 */
export default function SeasonEndLeaderboard({ players, startingBalance }: Props) {
  const top3 = players.slice(0, 3)
  const rest = players.slice(3)

  return (
    <div className="px-3 pt-5">
      <p className="mb-4 text-base uppercase tracking-[0.1em] text-[var(--text-secondary)]">
        <span className="text-[var(--tt-magenta)]">P410</span> Leaderboard
      </p>

      {players.length >= 3 ? (
        <Podium players={top3} startingBalance={startingBalance} />
      ) : (
        <div className="mb-5 flex flex-col gap-2">
          {top3.map((p, i) => (
            <PlayerRow
              key={p.id}
              rank={i + 1}
              player={p}
              startingBalance={startingBalance}
            />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mb-5 flex flex-col gap-1.5">
          {rest.map((p, i) => (
            <PlayerRow
              key={p.id}
              rank={i + 4}
              player={p}
              startingBalance={startingBalance}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Podium ─────────────────────────────────────────────────────────────────

function Podium({
  players,
  startingBalance,
}: {
  players: Player[]
  startingBalance: number
}) {
  // Visual order: 2nd | 1st | 3rd (winner in the middle, tallest pillar).
  // Logical order in `players`: [1st, 2nd, 3rd] (balance DESC).
  const [first, second, third] = players

  return (
    <div className="mb-6 grid grid-cols-3 items-end gap-2">
      <PodiumPillar
        place={2}
        player={second}
        startingBalance={startingBalance}
        heightClass="h-32"
        delayClass="[animation-delay:300ms]"
        accent="silver"
      />
      <PodiumPillar
        place={1}
        player={first}
        startingBalance={startingBalance}
        heightClass="h-44"
        delayClass="[animation-delay:900ms]"
        accent="gold"
      />
      <PodiumPillar
        place={3}
        player={third}
        startingBalance={startingBalance}
        heightClass="h-24"
        delayClass="[animation-delay:0ms]"
        accent="bronze"
      />
    </div>
  )
}

type PillarAccent = 'gold' | 'silver' | 'bronze'

function PodiumPillar({
  place,
  player,
  startingBalance,
  heightClass,
  delayClass,
  accent,
}: {
  place: number
  player: Player | undefined
  startingBalance: number
  heightClass: string
  delayClass: string
  accent: PillarAccent
}) {
  if (!player) return <div className={heightClass} />

  const delta = player.balance - startingBalance
  const deltaPositive = delta >= 0

  // Teletext panels: yellow edge/number for 1st, cyan/magenta for 2nd/3rd.
  // No emoji — accent ring + ordinal number does the work.
  const ringClass =
    accent === 'gold'
      ? 'ring-2 ring-[var(--tt-yellow)]'
      : accent === 'silver'
        ? 'ring-1 ring-[var(--tt-cyan)]'
        : 'ring-1 ring-[var(--tt-magenta)]'

  const numberColor =
    accent === 'gold'
      ? 'text-[var(--tt-yellow)]'
      : accent === 'silver'
        ? 'text-[var(--tt-cyan)]'
        : 'text-[var(--tt-magenta)]'

  // Winner pillar: soft one-shot glow after it lands. The pulse only runs
  // through the named animation (no infinite repeat).
  const glowClass = accent === 'gold' ? 'season-podium-glow' : ''

  return (
    <div
      className={
        'animate-in slide-in-from-bottom-8 fade-in fill-mode-both duration-700 ' +
        delayClass
      }
    >
      {/* Avatar + name above the pillar */}
      <div className="mb-2 flex flex-col items-center gap-1.5">
        <div
          className={
            'flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-base font-medium text-foreground ' +
            ringClass
          }
          aria-hidden
        >
          {initial(player.name)}
        </div>
        <p className="line-clamp-1 max-w-full text-center text-base uppercase tracking-wide text-foreground">
          {player.name}
        </p>
      </div>

      {/* The pillar itself */}
      <div
        className={
          'relative flex flex-col items-center justify-center gap-1 rounded-t-md bg-[var(--bg-elevated)] border-x border-t border-border ' +
          heightClass +
          ' ' +
          glowClass
        }
      >
        <span className={'font-mono text-2xl font-medium ' + numberColor}>
          {place}
        </span>
        <span className="text-lg tabular-nums text-[var(--tt-cyan)]">
          {player.balance}
        </span>
        <span
          className={
            'text-base tabular-nums ' +
            (deltaPositive ? 'text-[var(--tt-green)]' : 'text-[var(--tt-red)]')
          }
        >
          {deltaPositive ? '+' : ''}
          {delta}
        </span>
      </div>
    </div>
  )
}

// ── Rest of leaderboard (rank ≥ 4) ─────────────────────────────────────────

function PlayerRow({
  rank,
  player,
  startingBalance,
}: {
  rank: number
  player: Player
  startingBalance: number
}) {
  const delta = player.balance - startingBalance
  return (
    <Card
      className={
        'flex items-center gap-3 px-4 py-3 ' +
        (rank === 1 ? 'border-warn' : '')
      }
    >
      <span
        className={
          'w-7 flex-shrink-0 text-lg tabular-nums ' +
          (rank <= 3 ? 'text-[var(--tt-magenta)]' : 'text-[var(--text-tertiary)]')
        }
      >
        #{rank}
      </span>
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-[var(--tt-rule-strong)] bg-[var(--bg-elevated)] text-base uppercase text-[var(--text-secondary)]"
        aria-hidden
      >
        {initial(player.name)}
      </div>
      <span className="flex-1 truncate text-lg uppercase tracking-wide text-foreground">
        {player.name}
      </span>
      <div className="text-right">
        <span className="block text-lg tabular-nums text-[var(--tt-cyan)]">
          {player.balance}
        </span>
        <span
          className={
            'block text-sm tabular-nums ' +
            (delta >= 0 ? 'text-[var(--tt-green)]' : 'text-[var(--tt-red)]')
          }
        >
          {delta >= 0 ? '+' : ''}
          {delta}
        </span>
      </div>
    </Card>
  )
}

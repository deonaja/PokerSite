'use client'

import * as React from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface ChartPoint {
  session: number
  balance: number
}

export interface SeasonChartData {
  seasonId: string
  seasonNumber: number
  isActive: boolean
  data: ChartPoint[]
}

interface PerformanceChartProps {
  seasons: SeasonChartData[]
}

/**
 * Downsample to at most `limit` points by even spacing across the array,
 * always keeping the first and last point.
 */
function downsample(points: ChartPoint[], limit = 50): ChartPoint[] {
  if (points.length <= limit) return points
  const last = points.length - 1
  const step = last / (limit - 1)
  const out: ChartPoint[] = []
  const seen = new Set<number>()
  for (let i = 0; i < limit; i++) {
    const idx = Math.round(i * step)
    if (!seen.has(idx)) {
      seen.add(idx)
      out.push(points[idx])
    }
  }
  return out
}

const chartConfig: ChartConfig = {
  balance: {
    label: 'Saldo',
    color: 'var(--chart-1)',
  },
}

export default function PerformanceChart({ seasons }: PerformanceChartProps) {
  // Default selection: the active season if the player is in one, else the
  // most recent ended season. seasons[] is sorted oldest first, so pick last.
  const defaultId = React.useMemo(() => {
    const active = seasons.find((s) => s.isActive)
    if (active) return active.seasonId
    return seasons[seasons.length - 1]?.seasonId ?? ''
  }, [seasons])

  const [selectedId, setSelectedId] = React.useState<string>(defaultId)
  const selected = seasons.find((s) => s.seasonId === selectedId) ?? seasons[0]
  const data = React.useMemo(
    () => (selected ? downsample(selected.data) : []),
    [selected]
  )

  if (seasons.length === 0) {
    return (
      <Card className="p-3">
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-xs text-[var(--text-tertiary)]">Belum ada musim — main dulu yuk.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-3">
      {/* Season picker — horizontal scroll if many seasons. */}
      <div className="mb-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {seasons.map((s) => (
          <SeasonPill
            key={s.seasonId}
            active={s.seasonId === selectedId}
            onClick={() => setSelectedId(s.seasonId)}
            label={`Musim ${s.seasonNumber}`}
            isActive={s.isActive}
          />
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-xs text-[var(--text-tertiary)]">
            Belum ada sesi di musim ini.
          </p>
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
          <LineChart data={data} margin={{ top: 8, right: 16, left: -4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="session"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              minTickGap={20}
              fontSize={10}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={44}
              fontSize={10}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={
                <ChartTooltipContent
                  labelFormatter={(label) =>
                    label === 0 ? 'Awal musim' : `Sesi #${label}`
                  }
                  formatter={(value) => String(value)}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 2.5, fill: 'var(--chart-1)' }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </Card>
  )
}

function SeasonPill({
  active,
  onClick,
  label,
  isActive,
}: {
  active: boolean
  onClick: () => void
  label: string
  isActive: boolean
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={active ? 'default' : 'secondary'}
      className={cn(
        // h-11 keeps tap target ≥ 44px on mobile per the project quality bar.
        'h-11 shrink-0 whitespace-nowrap px-3 text-xs font-medium',
        active ? '' : 'border border-border',
      )}
      aria-pressed={active}
    >
      {label}
      {isActive && (
        <span
          className={cn(
            'ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium',
            active ? 'bg-white/20 text-white' : 'bg-[var(--accent-felt)]/20 text-[var(--accent-felt)]'
          )}
        >
          aktif
        </span>
      )}
    </Button>
  )
}

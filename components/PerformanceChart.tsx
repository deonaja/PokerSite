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

interface PerformanceChartProps {
  /** Active-season time series (one point per session, in chronological order). */
  seasonData: ChartPoint[]
  /** Lifetime time series across every ended session, all seasons. */
  lifetimeData: ChartPoint[]
}

/**
 * Downsample to at most `limit` points by even spacing across the array,
 * always keeping the first and last point. Returns the original array if
 * it's already short enough.
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

type Mode = 'season' | 'lifetime'

export default function PerformanceChart({ seasonData, lifetimeData }: PerformanceChartProps) {
  // Default to "Lifetime" if there's no season data — avoids landing on an empty chart.
  const [mode, setMode] = React.useState<Mode>(seasonData.length > 0 ? 'season' : 'lifetime')

  const active = mode === 'season' ? seasonData : lifetimeData
  const data = React.useMemo(() => downsample(active), [active])

  return (
    <Card className="p-3">
      <div className="mb-3 flex gap-1.5">
        <ToggleButton active={mode === 'season'} onClick={() => setMode('season')}>
          Season ini
        </ToggleButton>
        <ToggleButton active={mode === 'lifetime'} onClick={() => setMode('lifetime')}>
          Lifetime
        </ToggleButton>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-xs text-[var(--text-tertiary)]">Belum ada sesi — main dulu yuk.</p>
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="session"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              minTickGap={20}
              fontSize={10}
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
                  labelFormatter={(label) => `Sesi #${label}`}
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

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={active ? 'default' : 'secondary'}
      className={cn(
        // h-11 keeps tap target ≥ 44px on mobile per the project quality bar.
        'h-11 flex-1 text-xs font-medium',
        active ? '' : 'border border-border',
      )}
      aria-pressed={active}
    >
      {children}
    </Button>
  )
}

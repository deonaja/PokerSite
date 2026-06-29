'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/lib/utils'

/**
 * Minimal shadcn-style chart primitive, hand-rolled around Recharts.
 *
 * Themed to the felt-green palette via --chart-* CSS vars in globals.css
 * (do NOT ship default shadcn blue). Exposes just what the line chart on
 * /player/[id] needs: ChartContainer, ChartTooltip, ChartTooltipContent.
 */

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

type ChartContextValue = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChart must be used inside a <ChartContainer>')
  return ctx
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig
  children: React.ReactElement
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, className, children, ...props }, ref) => {
    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          className={cn(
            'flex aspect-video justify-center text-xs',
            // Recharts overrides — line stroke & axis tick colors lifted to CSS vars
            '[&_.recharts-cartesian-axis-tick_text]:fill-[var(--text-tertiary)]',
            '[&_.recharts-cartesian-grid_line]:stroke-[var(--border-subtle)]',
            '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-[var(--border-strong)]',
            '[&_.recharts-dot[stroke="#fff"]]:stroke-transparent',
            '[&_.recharts-layer]:outline-none',
            '[&_.recharts-surface]:outline-none',
            className,
          )}
          {...props}
        >
          <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    )
  },
)
ChartContainer.displayName = 'ChartContainer'

const ChartTooltip = RechartsPrimitive.Tooltip

interface TooltipPayloadItem {
  name?: string | number
  dataKey?: string | number
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

interface ChartTooltipContentProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  labelFormatter?: (label: string | number, payload: TooltipPayloadItem[]) => React.ReactNode
  formatter?: (value: number | string, name: string | number) => React.ReactNode
  className?: string
  hideLabel?: boolean
}

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  ({ active, payload, label, labelFormatter, formatter, className, hideLabel = false }, ref) => {
    const { config } = useChart()

    if (!active || !payload?.length) return null

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg',
          className,
        )}
      >
        {!hideLabel && label !== undefined && (
          <p className="mb-1 text-[var(--text-tertiary)]">
            {labelFormatter ? labelFormatter(label, payload) : label}
          </p>
        )}
        <div className="flex flex-col gap-1">
          {payload.map((item, idx) => {
            const key = String(item.dataKey ?? item.name ?? idx)
            const seriesLabel = config[key]?.label ?? item.name ?? key
            const seriesColor = item.color ?? config[key]?.color
            return (
              <div key={idx} className="flex items-center gap-2 font-mono text-foreground">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: seriesColor }}
                />
                <span className="text-[var(--text-secondary)]">{seriesLabel}</span>
                <span className="ml-auto tabular-nums">
                  {formatter ? formatter(item.value ?? '', item.name ?? key) : item.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
ChartTooltipContent.displayName = 'ChartTooltipContent'

export { ChartContainer, ChartTooltip, ChartTooltipContent, useChart }

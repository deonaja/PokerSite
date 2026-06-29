'use client'

import dynamic from 'next/dynamic'
import type { SeasonChartData } from '@/components/PerformanceChart'

/**
 * Client-only lazy wrapper around <PerformanceChart>. Lives in a separate file
 * because Next 16 disallows `dynamic(..., { ssr: false })` inside a Server
 * Component — the `'use client'` boundary here unblocks it. The skeleton sits
 * at the chart's eventual height so layout doesn't shift on mount.
 */
const PerformanceChart = dynamic(() => import('@/components/PerformanceChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
  ),
})

interface PerformanceChartLazyProps {
  seasons: SeasonChartData[]
}

export default function PerformanceChartLazy(props: PerformanceChartLazyProps) {
  return <PerformanceChart {...props} />
}

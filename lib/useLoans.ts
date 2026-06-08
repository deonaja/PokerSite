'use client'

import { useEffect, useRef, useState } from 'react'
import type { LoansResponse } from './types'

/**
 * Poll the per-user /api/loans endpoint every 2s (separate from usePoll, which
 * hits the globally-cached /api/poll). Returns null until the first response.
 */
export function useLoans(): LoansResponse | null {
  const [data, setData] = useState<LoansResponse | null>(null)
  const lastJson = useRef<string>('')

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch('/api/loans', { cache: 'no-store' })
        if (!res.ok) return
        const next = (await res.json()) as LoansResponse
        const j = JSON.stringify(next)
        if (alive && j !== lastJson.current) {
          lastJson.current = j
          setData(next)
        }
      } catch {
        // network hiccup — skip this tick
      }
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return data
}

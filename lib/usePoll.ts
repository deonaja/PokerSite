'use client'

import { useEffect, useRef, useState } from 'react'
import type { PollResponse } from './types'

export function usePoll(initial: PollResponse): PollResponse {
  const [data, setData] = useState<PollResponse>(initial)
  const lastJson = useRef(JSON.stringify(initial))

  // Sync when server re-renders with fresh initial (e.g. after router.refresh())
  useEffect(() => {
    const newJson = JSON.stringify(initial)
    if (newJson !== lastJson.current) {
      lastJson.current = newJson
      setData(initial)
    }
  }, [initial])

  // Background poll every 2s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/poll', { cache: 'no-store' })
        if (!res.ok) return
        const next = await res.json() as PollResponse
        const nextJson = JSON.stringify(next)
        if (nextJson !== lastJson.current) {
          lastJson.current = nextJson
          setData(next)
        }
      } catch {
        // network hiccup — silently skip
      }
    }, 2000)
    return () => clearInterval(id)
  }, [])

  return data
}

'use client'

import { useEffect, useState } from 'react'

// Returns seconds elapsed since `startIso`, ticking every second. Stays `null`
// until mounted on the client, so callers can skip rendering during SSR/hydration.
export function useElapsedSeconds(startIso: string | null | undefined): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!startIso) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startIso])

  if (now == null || !startIso) return null
  const start = new Date(startIso).getTime()
  return Math.max(0, Math.floor((now - start) / 1000))
}

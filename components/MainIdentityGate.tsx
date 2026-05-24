'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MainIdentityGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    const playerName = localStorage.getItem('playerName')

    if (!playerId || !playerName) {
      router.replace('/identity')
      return
    }

    setIsReady(true)
  }, [router])

  if (!isReady) return null

  return <>{children}</>
}

'use client'

import { useEffect } from 'react'
import { setLocalStorageItem } from '@/lib/safeStorage'

export default function LocalStorageSync({ playerId, playerName }: { playerId: string; playerName: string }) {
  useEffect(() => {
    if (playerId) {
      setLocalStorageItem('playerId', playerId)
      setLocalStorageItem('playerName', playerName)
    }
  }, [playerId, playerName])
  return null
}

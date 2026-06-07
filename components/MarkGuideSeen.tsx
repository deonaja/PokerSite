'use client'

import { useEffect } from 'react'
import { setLocalStorageItem } from '@/lib/safeStorage'
import { GUIDE_SEEN_KEY } from '@/lib/guide'

// Rendered on /panduan: opening the guide (via the "?" icon or any link) counts
// as "seen", so the one-time welcome sheet won't pop on the dashboard afterwards.
// Notifies same-tab listeners so a mounted WelcomeGuide closes immediately.
export default function MarkGuideSeen() {
  useEffect(() => {
    setLocalStorageItem(GUIDE_SEEN_KEY, '1')
    window.dispatchEvent(new Event('guide-seen'))
  }, [])

  return null
}

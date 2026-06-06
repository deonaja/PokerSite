'use client'

import { useEffect } from 'react'
import { setLocalStorageItem } from '@/lib/safeStorage'
import { LATEST_VERSION, CHANGELOG_SEEN_KEY } from '@/lib/changelog'

// Rendered on the /changelog page: records the latest version as "seen" and
// notifies the header (same tab) so the "new" dot clears immediately.
export default function MarkChangelogSeen() {
  useEffect(() => {
    setLocalStorageItem(CHANGELOG_SEEN_KEY, LATEST_VERSION)
    window.dispatchEvent(new Event('changelog-seen'))
  }, [])

  return null
}

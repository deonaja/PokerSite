// Server-only module (imported only from server actions). Pulls in web-push +
// the VAPID private key — must never be imported into a client component.
import webpush from 'web-push'
import { sql } from '@/lib/db'
import type { PushSubscriptionRow } from '@/lib/types'

// VAPID identifies this server to the browser push services. Without the keys
// set (e.g. local dev before `pnpm gen:vapid`, or prod env not configured) push
// is simply a no-op — the rest of the app keeps working.
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Send a push to every device a player has subscribed. Best-effort:
 *  - returns silently if VAPID isn't configured (dev without keys),
 *  - never throws (a failed push must NOT break the calling action),
 *  - prunes subscriptions the push service reports as gone (404/410).
 */
export async function sendPushToPlayer(playerId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return

  let subs: PushSubscriptionRow[]
  try {
    subs = (await sql`
      SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE player_id = ${playerId}
    `) as unknown as PushSubscriptionRow[]
  } catch (e) {
    console.error('sendPushToPlayer: load subs failed', e)
    return
  }
  if (subs.length === 0) return

  const json = JSON.stringify(payload)
  const dead: string[] = []

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json
        )
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode
        // 404 = endpoint unknown, 410 = subscription expired/unsubscribed.
        if (status === 404 || status === 410) dead.push(s.endpoint)
        else console.error('sendPushToPlayer: send failed', status, e)
      }
    })
  )

  if (dead.length > 0) {
    try {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${dead}::text[])`
    } catch (e) {
      console.error('sendPushToPlayer: prune failed', e)
    }
  }
}

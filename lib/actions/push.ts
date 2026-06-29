'use server'

import { sql } from '@/lib/db'
import { getAuthenticatedPlayerId, isAdmin } from '@/lib/auth-server'
import { sendPushToPlayer } from '@/lib/push'
import type { PushSubscriptionInput } from '@/lib/types'

type Result = { success: true } | { error: string }

/**
 * Store (or refresh) a browser push subscription for the logged-in player.
 * Keyed on the browser-issued `endpoint`: re-subscribing the same device
 * rebinds it to whoever is logged in now. Self-authorizes (server actions are
 * publicly invocable).
 */
export async function savePushSubscription(sub: PushSubscriptionInput): Promise<Result> {
  const me = await getAuthenticatedPlayerId()
  if (!me) return { error: 'Belum login' }
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) return { error: 'Subscription tidak valid' }

  try {
    await sql`
      INSERT INTO push_subscriptions (player_id, endpoint, p256dh, auth, user_agent)
      VALUES (${me}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth}, ${sub.userAgent ?? null})
      ON CONFLICT (endpoint) DO UPDATE
        SET player_id = ${me},
            p256dh = ${sub.p256dh},
            auth = ${sub.auth},
            user_agent = ${sub.userAgent ?? null},
            last_used_at = now()
    `
    return { success: true }
  } catch (e) {
    console.error('savePushSubscription error:', e)
    return { error: 'Gagal menyimpan langganan notifikasi' }
  }
}

/** Remove a subscription (toggle off / unsubscribe). Only deletes the caller's own. */
export async function deletePushSubscription({ endpoint }: { endpoint: string }): Promise<Result> {
  const me = await getAuthenticatedPlayerId()
  if (!me) return { error: 'Belum login' }
  try {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND player_id = ${me}`
    return { success: true }
  } catch (e) {
    console.error('deletePushSubscription error:', e)
    return { error: 'Gagal menghapus langganan' }
  }
}

/**
 * Send a test push to the logged-in player's own devices, reporting honestly.
 * Admin-only — server actions are independently invocable (their IDs ship in
 * the public client bundle), so UI gating alone is not enough.
 */
export async function sendTestPush(): Promise<Result> {
  const me = await getAuthenticatedPlayerId()
  if (!me) return { error: 'Belum login' }
  if (!(await isAdmin())) return { error: 'Akses ditolak' }
  const res = await sendPushToPlayer(me, {
    title: 'PokerAja',
    body: 'Notif tes berhasil 🎉 — kamu bakal dapet notif kayak gini.',
    url: '/',
    tag: 'test',
  })
  if (!res.configured) return { error: 'Push belum diatur di server (VAPID keys belum diset).' }
  if (res.total === 0) return { error: 'Belum ada perangkat aktif. Aktifkan notifikasi dulu di perangkat ini.' }
  if (res.sent === 0) return { error: 'Gagal kirim ke perangkat (langganan mungkin kedaluwarsa). Matikan lalu aktifkan lagi.' }
  return { success: true }
}

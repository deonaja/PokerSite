import { cookies } from 'next/headers'
import { createDbClient } from '@/lib/db'
import { hashSessionToken } from '@/lib/auth'

export interface AuthenticatedPlayer {
  id: string
  name: string
}

export async function getAuthenticatedPlayer(): Promise<AuthenticatedPlayer | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_session')?.value
  if (!token) return null

  const client = createDbClient()
  await client.connect()

  try {
    const tokenHash = hashSessionToken(token)
    const { rows: [row] } = await client.query<AuthenticatedPlayer>(
      `SELECT p.id, p.name
       FROM auth_sessions s
       JOIN players p ON p.id = s.player_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
       LIMIT 1`,
      [tokenHash]
    )

    return row ?? null
  } finally {
    await client.end()
  }
}

export async function getAuthenticatedPlayerId(): Promise<string | null> {
  const player = await getAuthenticatedPlayer()
  return player?.id ?? null
}

/**
 * Whether the caller holds the admin_key cookie (set by the proxy after a valid
 * ?key=). MUST be checked inside every admin server action / route — server
 * actions are independently invocable (their IDs ship in the public client
 * bundle), so page-level / middleware gating alone does not protect them.
 */
export async function isAdmin(): Promise<boolean> {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) return false
  const cookieStore = await cookies()
  return cookieStore.get('admin_key')?.value === adminKey
}

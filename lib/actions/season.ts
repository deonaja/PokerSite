'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createDbClient } from '@/lib/db'
import { hashPin } from '@/lib/auth'

export interface CreateSeasonInput {
  playerNames: string[]
  startingBalance: number
  bb: number
  sb: number
  maxPool: number
  maxSessions: number
  rakeRate: number
  presetName: string | null
}

export async function createSeason(
  input: CreateSeasonInput
): Promise<{ error: string } | void> {
  const { playerNames, startingBalance, bb, sb, maxPool, maxSessions, rakeRate, presetName } = input

  const names = playerNames.map((n) => n.trim()).filter(Boolean)
  if (names.length < 2) return { error: 'Minimal 2 pemain' }
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
    return { error: 'Nama pemain harus unik' }
  }
  if (!Number.isInteger(startingBalance) || startingBalance < 10 || startingBalance > 100_000) {
    return { error: 'Starting balance tidak valid' }
  }
  if (!Number.isInteger(maxPool) || maxPool < 100) return { error: 'Max pool tidak valid' }
  if (!Number.isInteger(maxSessions) || maxSessions < 1) return { error: 'Max sesi tidak valid' }
  if (!Number.isInteger(rakeRate) || rakeRate < 0 || rakeRate > 50) return { error: 'Rake rate tidak valid' }

  const buyIn = Math.floor(startingBalance / 2)
  const defaultPinHash = await hashPin('1234')
  const client = createDbClient()
  await client.connect()

  try {
    await client.query('BEGIN')

    const { rows: activeSeason } = await client.query(
      `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
    )
    if (activeSeason.length > 0) {
      await client.query('ROLLBACK')
      return { error: 'Sudah ada season aktif' }
    }

    const {
      rows: [{ max_number }],
    } = await client.query<{ max_number: number | null }>(`SELECT MAX(number) as max_number FROM seasons`)
    const seasonNumber = (max_number ?? 0) + 1

    const playerIds: string[] = []
    for (const name of names) {
      const { rows: [existing] } = await client.query<{ id: string }>(
        `SELECT id FROM players WHERE LOWER(name) = LOWER($1)`,
        [name]
      )
      if (existing) {
        playerIds.push(existing.id)
        await client.query(`UPDATE players SET balance = $1 WHERE id = $2`, [startingBalance, existing.id])
      } else {
        const { rows: [newPlayer] } = await client.query<{ id: string }>(
          `INSERT INTO players (name, balance, pin_hash) VALUES ($1, $2, $3) RETURNING id`,
          [name, startingBalance, defaultPinHash]
        )
        playerIds.push(newPlayer.id)
      }
    }

    const creatorId = playerIds[0]

    const { rows: [season] } = await client.query<{ id: string }>(
      `INSERT INTO seasons
         (number, status, preset_name, starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, creator_player_id)
       VALUES ($1, 'active', $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [seasonNumber, presetName, startingBalance, buyIn, bb, sb, maxPool, maxSessions, rakeRate, creatorId]
    )

    for (const playerId of playerIds) {
      await client.query(
        `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
         VALUES ($1, $2, 'season_start', 0, $3, $4)`,
        [playerId, creatorId, startingBalance, JSON.stringify({ season_id: season.id, season_number: seasonNumber })]
      )
    }

    await client.query('COMMIT')
    revalidatePath('/')
    revalidatePath('/identity')
  } catch (e: unknown) {
    await client.query('ROLLBACK')
    const pg = e as { code?: string }
    if (pg.code === '23505') return { error: 'Nama pemain sudah ada atau season konflik' }
    console.error('createSeason error:', e)
    return { error: 'Gagal membuat season' }
  } finally {
    await client.end()
  }

  redirect('/identity')
}

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isAdmin } from '@/lib/auth-server'
import { toCsv, type CsvColumn } from '@/lib/csv'

// Defense-in-depth: middleware already gates /admin/*, but re-verify the
// admin_key cookie here so the export endpoint can't be hit without it.

function csv(filename: string, columns: CsvColumn[], rows: Record<string, unknown>[]) {
  return new NextResponse(toCsv(columns, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(req: NextRequest) {
  // Wrong/absent key → 404, same as the rest of the admin surface.
  if (!(await isAdmin())) return new NextResponse(null, { status: 404 })

  const type = req.nextUrl.searchParams.get('type')

  switch (type) {
    case 'players': {
      const rows = (await sql`SELECT name, balance FROM players ORDER BY name ASC`) as Record<string, unknown>[]
      return csv('pemain.csv', [
        { key: 'name', label: 'Nama' },
        { key: 'balance', label: 'Saldo' },
      ], rows)
    }

    case 'results': {
      const rows = (await sql`
        SELECT se.number AS season_number, p.name AS player_name, sr.rank,
               sr.final_balance, sr.sessions_played, sr.times_dealer,
               sr.total_won, sr.total_lost
        FROM season_results sr
        JOIN seasons se ON se.id = sr.season_id
        JOIN players p ON p.id = sr.player_id
        ORDER BY se.number DESC, sr.rank ASC
      `) as Record<string, unknown>[]
      return csv('hasil-musim.csv', [
        { key: 'season_number', label: 'Musim' },
        { key: 'player_name', label: 'Pemain' },
        { key: 'rank', label: 'Rank' },
        { key: 'final_balance', label: 'Saldo Akhir' },
        { key: 'sessions_played', label: 'Sesi' },
        { key: 'times_dealer', label: 'Jadi Dealer' },
        { key: 'total_won', label: 'Total Menang' },
        { key: 'total_lost', label: 'Total Kalah' },
      ], rows)
    }

    case 'sessions': {
      const rows = (await sql`
        SELECT se.number AS season_number, d.name AS dealer_name, s.status,
               s.started_at, s.ended_at
        FROM sessions s
        LEFT JOIN seasons se ON se.id = s.season_id
        LEFT JOIN players d ON d.id = s.dealer_id
        ORDER BY s.started_at DESC
      `) as Record<string, unknown>[]
      return csv('sesi.csv', [
        { key: 'season_number', label: 'Musim' },
        { key: 'dealer_name', label: 'Dealer' },
        { key: 'status', label: 'Status' },
        { key: 'started_at', label: 'Mulai' },
        { key: 'ended_at', label: 'Selesai' },
      ], rows)
    }

    case 'log': {
      const rows = (await sql`
        SELECT el.created_at, el.action, p.name AS player_name, a.name AS actor_name,
               el.balance_before, el.balance_after, el.voided,
               el.metadata->>'reason' AS reason
        FROM edit_log el
        LEFT JOIN players p ON p.id = el.player_id
        LEFT JOIN players a ON a.id = el.actor_player_id
        ORDER BY el.created_at DESC
      `) as Record<string, unknown>[]
      return csv('log.csv', [
        { key: 'created_at', label: 'Waktu' },
        { key: 'action', label: 'Action' },
        { key: 'player_name', label: 'Pemain' },
        { key: 'actor_name', label: 'Aktor' },
        { key: 'balance_before', label: 'Saldo Sebelum' },
        { key: 'balance_after', label: 'Saldo Sesudah' },
        { key: 'voided', label: 'Voided' },
        { key: 'reason', label: 'Alasan' },
      ], rows)
    }

    default:
      return new NextResponse('Unknown export type', { status: 400 })
  }
}

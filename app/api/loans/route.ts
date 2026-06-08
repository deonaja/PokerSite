import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthenticatedPlayerId } from '@/lib/auth-server'
import type { LoansResponse } from '@/lib/types'

// Per-user payload → MUST NOT be edge-cached (unlike /api/poll, which is global).
const NO_CACHE = { headers: { 'Cache-Control': 'no-store' } }

function empty(over: Partial<LoansResponse> = {}): LoansResponse {
  return {
    loggedIn: false, balance: 0, buyIn: 0, sessionActive: false,
    canBorrow: false, candidates: [], incoming: [], myBorrow: null, myLend: null,
    ...over,
  }
}

export async function GET() {
  const me = await getAuthenticatedPlayerId()
  if (!me) return NextResponse.json(empty(), NO_CACHE)

  const seasonRows = await sql`SELECT id, buy_in FROM seasons WHERE status = 'active' LIMIT 1`
  const season = (seasonRows as unknown as { id: string; buy_in: number }[])[0]
  if (!season) return NextResponse.json(empty({ loggedIn: true }), NO_CACHE)

  const [meRows, memberRows, sessionRows, openRows] = await Promise.all([
    sql`SELECT balance FROM players WHERE id = ${me}`,
    sql`SELECT 1 FROM season_players WHERE season_id = ${season.id} AND player_id = ${me} LIMIT 1`,
    sql`SELECT id FROM sessions WHERE status = 'active' LIMIT 1`,
    sql`
      SELECT l.id, l.status, l.amount, l.lender_id, l.borrower_id,
             lb.name AS lender_name, bo.name AS borrower_name
      FROM loans l
      JOIN players lb ON lb.id = l.lender_id
      JOIN players bo ON bo.id = l.borrower_id
      WHERE l.status IN ('pending', 'active')
        AND (l.borrower_id = ${me} OR l.lender_id = ${me})`,
  ])

  const balance = (meRows as unknown as { balance: number }[])[0]?.balance ?? 0
  const isMember = (memberRows as unknown as unknown[]).length > 0
  const sessionActive = (sessionRows as unknown as unknown[]).length > 0

  let myBorrow: LoansResponse['myBorrow'] = null
  let myLend: LoansResponse['myLend'] = null
  const incoming: LoansResponse['incoming'] = []
  for (const l of openRows as unknown as {
    id: string; status: 'pending' | 'active'; amount: number
    lender_id: string; borrower_id: string; lender_name: string; borrower_name: string
  }[]) {
    if (l.borrower_id === me) {
      myBorrow = {
        loanId: l.id, status: l.status, lenderId: l.lender_id, lenderName: l.lender_name,
        amount: l.amount, canRepay: l.status === 'active' && balance >= l.amount,
      }
    } else if (l.status === 'pending') {
      incoming.push({ loanId: l.id, borrowerId: l.borrower_id, borrowerName: l.borrower_name, amount: l.amount })
    } else {
      myLend = { loanId: l.id, borrowerId: l.borrower_id, borrowerName: l.borrower_name, amount: l.amount }
    }
  }

  const hasOpen = myBorrow != null || myLend != null || incoming.length > 0
  const canBorrow = isMember && !sessionActive && !hasOpen && balance < season.buy_in

  let candidates: LoansResponse['candidates'] = []
  if (canBorrow) {
    const rows = await sql`
      SELECT p.id, p.name, p.balance
      FROM players p
      JOIN season_players mp ON mp.player_id = p.id AND mp.season_id = ${season.id}
      WHERE p.id <> ${me}
        AND p.balance >= ${season.buy_in}
        AND NOT EXISTS (
          SELECT 1 FROM loans l
          WHERE l.status IN ('pending', 'active')
            AND (l.lender_id = p.id OR l.borrower_id = p.id)
        )
      ORDER BY p.balance DESC, p.name ASC`
    candidates = rows as unknown as LoansResponse['candidates']
  }

  const body: LoansResponse = {
    loggedIn: true, balance, buyIn: season.buy_in, sessionActive,
    canBorrow, candidates, incoming, myBorrow, myLend,
  }
  return NextResponse.json(body, NO_CACHE)
}

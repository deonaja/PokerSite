export interface Player {
  id: string
  name: string
  balance: number
  created_at: string
}

export interface Session {
  id: string
  dealer_id: string
  status: 'active' | 'ended'
  started_at: string
  ended_at: string | null
}

export interface SessionParticipant {
  id: string
  session_id: string
  player_id: string
  is_dealer: boolean
  rebuy_count: number
  final_stack: number | null
}

export interface EditLog {
  id: string
  session_id: string | null
  player_id: string | null
  actor_player_id: string | null
  action: string
  balance_before: number | null
  balance_after: number | null
  metadata: Record<string, unknown> | null
  voided: boolean
  created_at: string
}

export interface SessionWithParticipants extends Session {
  participants: (SessionParticipant & { player: Player })[]
}

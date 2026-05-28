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

export interface Season {
  id: string
  number: number
  status: 'active' | 'ended'
  preset_name: string | null
  starting_balance: number
  buy_in: number
  bb: number
  sb: number
  max_pool: number
  max_sessions: number
  rake_rate: number
  current_phase: 'bootstrap' | 'steady'
  creator_player_id: string | null
  started_at: string
  ended_at: string | null
}

export interface SessionWithParticipants extends Session {
  participants: (SessionParticipant & { player: Player })[]
}

// Used by /api/poll response
export interface PollParticipant {
  participant_id: string
  player_id: string
  player_name: string
  is_dealer: boolean
  no_gaji_dealer: boolean
  rebuy_count: number
  final_stack: number | null
  // Player's live balance (post buy-in / rebuys) — surfaced so the active
  // session view can show it and gate the rebuy button.
  balance: number
}

export interface PollResponse {
  players: Player[]
  activeSession: { id: string; participants: PollParticipant[] } | null
}

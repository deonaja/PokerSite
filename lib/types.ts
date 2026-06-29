export interface Player {
  id: string
  name: string
  balance: number
  created_at: string
}

// Player row for the /identity picker, annotated with active-season membership so
// members sort to the top ("Musim ini" vs "Lainnya"). The picker still lists everyone.
export interface PickerPlayer extends Player {
  is_member: boolean
}

export interface Session {
  id: string
  dealer_id: string
  status: 'active' | 'ended'
  creator_player_id: string | null
  started_at: string
  ended_at: string | null
}

export interface SessionParticipant {
  id: string
  session_id: string
  player_id: string
  is_dealer: boolean
  // false = neutral dealer (deals only, doesn't play). Default true.
  dealer_plays: boolean
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
  invite_code: string | null
  invite_code_uses: number
  started_at: string
  ended_at: string | null
  // Migration 012b: per-phase session targets. Captured at wizard create.
  // Legacy seasons (pre-012b) have NULL; consumers must fall back to max_sessions.
  p1_target_sessions: number | null
  p2_target_sessions: number | null
  // Sessions actually played when the bootstrap → steady flip happened.
  // NULL until the flip (or forever, for legacy seasons that never had targets).
  p1_sessions_actual: number | null
}

export type LoanStatus =
  | 'pending'
  | 'active'
  | 'repaid'
  | 'settled'
  | 'declined'
  | 'cancelled'

export interface Loan {
  id: string
  season_id: string
  lender_id: string
  borrower_id: string
  amount: number
  status: LoanStatus
  created_at: string
  approved_at: string | null
  settled_at: string | null
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

// ---- Loans (per-user, served by /api/loans; never edge-cached) ----

export interface LoanCandidate {
  id: string
  name: string
  balance: number
}

export interface IncomingLoanRequest {
  loanId: string
  borrowerId: string
  borrowerName: string
  amount: number
}

export interface MyBorrowLoan {
  loanId: string
  status: 'pending' | 'active'
  lenderId: string
  lenderName: string
  amount: number
  // true only when the loan is active AND balance covers the full amount.
  canRepay: boolean
}

export interface MyLendLoan {
  loanId: string
  borrowerId: string
  borrowerName: string
  amount: number
}

export interface LoansResponse {
  loggedIn: boolean
  balance: number
  buyIn: number
  sessionActive: boolean
  // eligible to open a NEW request right now (member, short-stacked, no open
  // loan, no live session). The candidate list may still be empty.
  canBorrow: boolean
  candidates: LoanCandidate[]
  incoming: IncomingLoanRequest[] // pending requests where I'm the lender
  myBorrow: MyBorrowLoan | null // my pending/active loan as borrower
  myLend: MyLendLoan | null // my active loan as lender
}

// Tiered achievement row. `achievement_key` is the category id (e.g. 'bandar'),
// `tier` is the milestone within that category (1/2/3). A player may hold
// multiple rows per category — one per tier crossed.
export interface PlayerAchievement {
  id: string
  player_id: string
  achievement_key: string
  tier: 1 | 2 | 3
  season_id: string | null
  earned_at: string
}

// Admin rollback — a snapshot row capturing the world AS OF a whitelisted
// edit_log entry. See lib/rollback.ts for whitelist + restore semantics.
export interface EditLogSnapshot {
  id: string
  edit_log_id: string
  snapshot_data: import('./rollback').SnapshotData
  created_at: string
}

// Web Push — a stored browser PushSubscription, one row per device.
export interface PushSubscriptionRow {
  id: string
  player_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
  last_used_at: string
}

// The shape the browser sends after pushManager.subscribe() (flattened keys).
export interface PushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

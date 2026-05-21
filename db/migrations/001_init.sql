CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES players(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'ended')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- partial unique index: cuma 1 sesi active boleh ada
CREATE UNIQUE INDEX one_active_session ON sessions (status) WHERE status = 'active';

CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  is_dealer BOOLEAN NOT NULL DEFAULT false,
  rebuy_count INTEGER NOT NULL DEFAULT 0,
  final_stack INTEGER,
  UNIQUE (session_id, player_id)
);

CREATE TABLE edit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  actor_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  -- action enum: 'buy_in', 'buy_in_dealer_free', 'rebuy', 'rebuy_undo',
  -- 'session_end', 'admin_balance_edit', 'admin_player_add', 'admin_session_force_end'
  balance_before INTEGER,
  balance_after INTEGER,
  metadata JSONB,
  -- metadata.reason untuk admin edit, metadata.voided=true untuk rebuy yg di-undo
  voided BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX edit_log_session_idx ON edit_log (session_id, created_at DESC);
CREATE INDEX edit_log_player_idx ON edit_log (player_id, created_at DESC);

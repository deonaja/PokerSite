ALTER TABLE players
ADD COLUMN IF NOT EXISTS pin_hash TEXT;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_uq
ON auth_sessions (token_hash);

CREATE INDEX IF NOT EXISTS auth_sessions_player_idx
ON auth_sessions (player_id, created_at DESC);

-- Security: throttle PIN brute-force on /api/identity. Per-player (not per-IP,
-- since a home group typically shares one WiFi/IP). N consecutive failures lock
-- the player's login for a cooldown window; a successful login resets both.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

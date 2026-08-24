-- Session mode — separates PokerAja's face-to-face (offline) sessions from the
-- shared poker-online app's online tables on the same database.
--
-- This column is referenced across the app (api/poll, dashboard, session actions
-- filter on mode = 'offline') but the migration that creates it was never checked
-- into this repo — it originated in the poker-online app that shares the DB. It is
-- captured here so PokerAja can (re)apply it to any database it points at.
--
-- Idempotent: safe to run on a DB that already has the column (e.g. dev).
-- Symptom when MISSING on a database: every /api/poll (and the dashboard for a
-- logged-in user) returns HTTP 500 — "column \"mode\" does not exist" — while
-- pages that don't touch sessions.mode (e.g. /identity) still work.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'offline';

-- Allow one active session PER MODE: offline (PokerAja) and online (poker-online)
-- can each hold one active session. Replaces the original single-active-session
-- index from 001_init (one_active_session ON sessions(status) WHERE active).
DROP INDEX IF EXISTS one_active_session;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_mode
  ON sessions (status, mode) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sessions_mode_status ON sessions (mode, status);

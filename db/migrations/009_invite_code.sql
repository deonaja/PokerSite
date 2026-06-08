-- Per-season invite code for self-registration (item 9 / Fase E).
--
-- A new player registers with name + their own PIN + this code → the account is
-- created and auto-joined to the active season's roster (season_players). The
-- code is good for a small number of uses (MAX_INVITE_CODE_USES in lib/auth.ts)
-- and then rotates, so a leaked code can't onboard strangers indefinitely.
-- Source of truth = the admin panel; a Telegram notify is an optional layer.
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS invite_code_uses INTEGER NOT NULL DEFAULT 0;

-- Backfill a code for the current active season so registration works right away.
-- 8 uppercase hex chars — the admin can rotate to a cleaner app-generated code.
UPDATE seasons
SET invite_code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE status = 'active' AND (invite_code IS NULL OR invite_code = '');

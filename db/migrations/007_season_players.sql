-- season_players: who is a MEMBER of a given season.
--
-- Membership (this table) is distinct from identity (a row in `players`):
-- a player can exist + log in without being on the active season's roster.
-- Dashboard / poll / session-setup / leaderboard / pool-sum scope to the
-- active season's members; the identity picker and admin panel stay GLOBAL
-- (so an existing player can log in mid-season and then "join" — item 9).
--
-- joined_at supports mid-season joins (item 9). Composite PK prevents dupes.
CREATE TABLE IF NOT EXISTS season_players (
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, player_id)
);

-- Hot path (poll every 2s) joins on season_id → index it.
CREATE INDEX IF NOT EXISTS idx_season_players_season ON season_players(season_id);

-- Backfill: the current active season's roster = every existing player. This
-- preserves the pre-membership behaviour (every player showed on the dashboard)
-- so the app keeps working the instant the read paths start scoping.
INSERT INTO season_players (season_id, player_id)
SELECT s.id, p.id
FROM seasons s
CROSS JOIN players p
WHERE s.status = 'active'
ON CONFLICT DO NOTHING;

-- M4: stored achievements. Each (player, achievement_key) is earned at most once.
-- Awarded at season end (see lib/actions/season.ts endSeason); derivable badges
-- are backfilled from existing season_results.
CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);

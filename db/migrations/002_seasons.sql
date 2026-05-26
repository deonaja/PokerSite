CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  status TEXT CHECK (status IN ('active', 'ended')),
  preset_name TEXT,             -- 'sprint'|'quick'|'standard'|'marathon'|'custom'
  starting_balance INTEGER NOT NULL DEFAULT 200,
  buy_in INTEGER NOT NULL,      -- = starting_balance / 2, also = dealer salary in phase 1
  bb INTEGER NOT NULL,          -- big blind (informational only)
  sb INTEGER NOT NULL,          -- small blind (informational only)
  max_pool INTEGER NOT NULL,
  max_sessions INTEGER NOT NULL,
  rake_rate INTEGER NOT NULL,   -- integer percentage, e.g. 10 = 10%
  current_phase TEXT CHECK (current_phase IN ('bootstrap', 'steady')) DEFAULT 'bootstrap',
  creator_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- only 1 active season at a time
CREATE UNIQUE INDEX one_active_season ON seasons (status) WHERE status = 'active';

CREATE TABLE season_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id),
  player_id UUID NOT NULL REFERENCES players(id),
  final_balance INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  sessions_played INTEGER NOT NULL,
  times_dealer INTEGER NOT NULL,
  total_won INTEGER NOT NULL,
  total_lost INTEGER NOT NULL,
  UNIQUE (season_id, player_id)
);

ALTER TABLE sessions ADD COLUMN season_id UUID REFERENCES seasons(id);

ALTER TABLE players ADD COLUMN last_dealer_session_id UUID REFERENCES sessions(id);

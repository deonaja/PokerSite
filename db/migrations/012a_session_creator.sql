-- Track who started each session, so the creator can cancel it themselves
-- (today only admin can). NULL allowed for backward-compat with sessions
-- created before this migration — those remain admin-only-cancellable.
ALTER TABLE sessions ADD COLUMN creator_player_id UUID REFERENCES players(id) ON DELETE SET NULL;

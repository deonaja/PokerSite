-- Per-player custom avatar (poker-chip) colour. NULL = use the name-derived
-- default from the broadcast-8 palette. Stored as a hex string (e.g. '#00d0d0').
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_color TEXT;

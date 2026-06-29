-- Progressive 3-tier achievement system. Existing rows become tier 1 by default
-- (the legacy flat keys map onto tier-1 names of the new tiered categories:
-- juara, podium, raja_bandar→bandar, veteran, sultan, musim_untung→untung).
--
-- NB: column name stays `achievement_key` (TEXT) for backward compatibility with
-- existing code & tests. It now stores the category id ('juara', 'bandar', etc.)
-- and the new `tier` column disambiguates which milestone within the category.
--
-- Data backfill is intentionally OUT of this migration — see
-- scripts/backfill-achievements.mjs. Run it once after `pnpm db:migrate`.

ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS tier INTEGER NOT NULL DEFAULT 1;

-- The legacy 'raja_bandar' / 'musim_untung' keys need to be renamed to the new
-- category ids ('bandar' / 'untung') so the (key, tier) namespace is consistent.
-- Idempotent: only rewrites rows that still carry the legacy key.
UPDATE player_achievements SET achievement_key = 'bandar' WHERE achievement_key = 'raja_bandar';
UPDATE player_achievements SET achievement_key = 'untung' WHERE achievement_key = 'musim_untung';

-- Old unique was (player_id, achievement_key). New unique is (player_id, achievement_key, tier)
-- so a single player can hold multiple tiers in the same category.
ALTER TABLE player_achievements DROP CONSTRAINT IF EXISTS player_achievements_player_id_achievement_key_key;
ALTER TABLE player_achievements ADD CONSTRAINT player_achievements_unique_tier UNIQUE (player_id, achievement_key, tier);

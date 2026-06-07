-- dealer_plays: whether the dealer also sits in and plays this session.
--   true  = dealer plays (default; existing behaviour — gets the Phase 1 salary
--           split, pays buy-in + earns NO rake in Phase 2).
--   false = neutral dealer: deals only, does NOT play. In Phase 1 gets a flat
--           1× buy_in salary; in Phase 2 collects the rake (house cut). Only
--           selectable when 4+ players are in the session.
-- Irrelevant for non-dealer participants (left at the default).
ALTER TABLE session_participants
  ADD COLUMN IF NOT EXISTS dealer_plays BOOLEAN NOT NULL DEFAULT true;

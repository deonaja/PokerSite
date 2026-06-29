-- Decouple p1/p2 session targets. Today max_sessions is a single field, so when
-- P1 overshoots (e.g. mostly playing dealers, who inject only 1x post the
-- 2026-06-29 matrix flip), P2 gets squeezed.
--
-- New seasons capture both targets at wizard create. p1_sessions_actual is set
-- AT the phase flip (recorded when SUM(balance) first >= max_pool). max_sessions
-- continues to mean "season ends when sessions_played >= max_sessions", but for
-- new seasons it now gets UPDATED at flip to (p1_actual + p2_target) so P2 runs
-- its full target regardless of P1 overshoot.
--
-- Existing seasons (NULL p2_target_sessions) continue to use the legacy single-
-- max_sessions semantics — fallback path keeps them stable.
ALTER TABLE seasons ADD COLUMN p1_target_sessions INTEGER;
ALTER TABLE seasons ADD COLUMN p2_target_sessions INTEGER;
ALTER TABLE seasons ADD COLUMN p1_sessions_actual INTEGER;

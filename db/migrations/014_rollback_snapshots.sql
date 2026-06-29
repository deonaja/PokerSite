-- Snapshot-based admin rollback. Snapshots are taken AFTER each whitelisted
-- edit_log entry (session_start, session_end, season_start, admin_balance_edit)
-- and capture all state-changing data that rollback needs to restore.
-- Edit_log remains append-only; rollback inserts an admin_rollback audit entry.
--
-- Granularity: per edit_log entry. The snapshot row references the triggering
-- log entry via edit_log_id (FK, ON DELETE CASCADE — if the log entry ever goes
-- away, so does its snapshot).
--
-- Immutability boundary: executeRollback() rejects any rollback whose snapshot
-- predates a 'season_end' entry, so the season-end boundary is unrollback-able.

CREATE TABLE IF NOT EXISTS edit_log_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edit_log_id UUID NOT NULL REFERENCES edit_log(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_log ON edit_log_snapshots(edit_log_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON edit_log_snapshots(created_at DESC);

-- Per-IP throttle for self-registration (Fase E2). The invite code is static
-- between uses, so without a throttle it could be brute-forced over HTTP. This
-- table counts WRONG-code attempts per hashed IP within a rolling window; legit
-- registrations don't accrue. Mirrors the per-player login throttle (mig 005).
CREATE TABLE IF NOT EXISTS register_attempts (
  ip_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

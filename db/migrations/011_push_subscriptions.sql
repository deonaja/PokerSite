-- push_subscriptions: Web Push (browser push notification) endpoints per player.
--
-- A player may subscribe from multiple devices, so one player → many rows.
-- The browser-issued `endpoint` is globally unique and is the natural key for a
-- subscription, so re-subscribing the same browser UPSERTs on `endpoint`
-- (re-binding it to whoever is currently logged in on that device).
--
-- p256dh + auth are the subscription's encryption keys (from the browser's
-- PushSubscription.getKey()), needed by web-push to encrypt the payload.
-- Dead endpoints (push service returns 404/410) are pruned in lib/push.ts.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_player ON push_subscriptions(player_id);

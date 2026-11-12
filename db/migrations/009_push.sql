-- Phone notices (design §23): Web Push subscriptions, what was already sent
-- (so a notice is never repeated) and the kinds each person turned off.
CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_player ON push_subscriptions (player_id);

CREATE TABLE notifications_sent (
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  key        text NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, kind, key)
);

ALTER TABLE players ADD COLUMN notify_prefs jsonb NOT NULL DEFAULT '{}';

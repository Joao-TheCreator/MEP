-- Login by personal password instead of e-mail magic links.
-- 002 is taken by feat/10-profession-change (PR #19), so this is 003.
--
-- Each person types only their password; it identifies them, so it must be
-- unique. We store an HMAC of it (keyed with AUTH_SECRET), which can be
-- looked up directly and is useless without the server secret.

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN password_lookup text UNIQUE;

-- Throttles guessing: attempts per IP in a time window.
CREATE TABLE login_attempts (
  id          bigserial PRIMARY KEY,
  ip          text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_ip_created ON login_attempts (ip, created_at);

DROP TABLE login_tokens;

-- Login by name + password (review of #25): the name identifies the person and the
-- password is stored with a slow salted hash (scrypt). Replaces the password-only
-- lookup of 003. Numbered 010 because 004-009 are taken by the stacked PRs.
--
-- Existing accounts (only local/dev databases so far) can't be converted: they
-- have no name. Run `npm run db:seed` again after migrating.

ALTER TABLE users ADD COLUMN username text;
ALTER TABLE users ADD COLUMN password_hash text;
CREATE UNIQUE INDEX users_username_unique ON users (username);

ALTER TABLE users DROP COLUMN password_lookup;

-- Attempts are also counted per name (not only per IP).
ALTER TABLE login_attempts ADD COLUMN username text;
CREATE INDEX login_attempts_username_created ON login_attempts (username, created_at);

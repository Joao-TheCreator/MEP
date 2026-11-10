-- Initial schema. NEVER edit after it is committed: add 002_*.sql instead.

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_tokens (
  token_hash  text PRIMARY KEY,
  email       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_tokens_email_created ON login_tokens (email, created_at);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE farms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  invite_code  text NOT NULL UNIQUE,
  level        int  NOT NULL DEFAULT 1 CHECK (level >= 1),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Donated amounts toward the farm's CURRENT building (cleared on completion).
CREATE TABLE farm_building_progress (
  farm_id   uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  resource  text NOT NULL,
  qty       int  NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (farm_id, resource)
);

CREATE TABLE farm_buildings (
  farm_id       uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  building_key  text NOT NULL,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (farm_id, building_key)
);

CREATE TABLE players (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  farm_id            uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  display_name       text NOT NULL,
  avatar             text NOT NULL,
  profession         text NOT NULL,
  workshop_level     int  NOT NULL DEFAULT 1 CHECK (workshop_level >= 1),
  last_collected_at  timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_farm ON players (farm_id);
-- each pixel avatar can be picked by one player per farm
CREATE UNIQUE INDEX players_farm_avatar ON players (farm_id, avatar);

CREATE TABLE inventory (
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  resource   text NOT NULL,
  qty        int  NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (player_id, resource)
);

CREATE TABLE donations (
  id          bigserial PRIMARY KEY,
  farm_id     uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  resource    text NOT NULL,
  qty         int  NOT NULL CHECK (qty > 0),
  points      int  NOT NULL CHECK (points >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX donations_farm_created ON donations (farm_id, created_at);

CREATE TABLE transfers (
  id              bigserial PRIMARY KEY,
  farm_id         uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  from_player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_player_id    uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  resource        text NOT NULL,
  qty             int  NOT NULL CHECK (qty > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

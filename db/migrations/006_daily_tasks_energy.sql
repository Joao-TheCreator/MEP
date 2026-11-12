-- Daily tasks and energy (design §17).

-- Energy as of energy_at; it regenerates by the clock (like offline production).
ALTER TABLE players
  ADD COLUMN energy    int         NOT NULL DEFAULT 100 CHECK (energy >= 0),
  ADD COLUMN energy_at timestamptz NOT NULL DEFAULT now();

-- One row per player and game day (Brasília): what they did today and what
-- they already claimed. level, profession and can_donate are a snapshot from
-- the start of the day, so the day's tasks don't change under the player.
CREATE TABLE player_daily (
  player_id     uuid    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day           date    NOT NULL,
  level         int     NOT NULL,
  profession    text    NOT NULL,
  can_donate    boolean NOT NULL,
  collect       int     NOT NULL DEFAULT 0,
  craft         int     NOT NULL DEFAULT 0,
  donate        int     NOT NULL DEFAULT 0,
  patrol        int     NOT NULL DEFAULT 0,
  sell          int     NOT NULL DEFAULT 0,
  gear          int     NOT NULL DEFAULT 0,
  claimed       int     NOT NULL DEFAULT 0,      -- bitmask: bit i = task i claimed
  bonus_claimed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (player_id, day)
);

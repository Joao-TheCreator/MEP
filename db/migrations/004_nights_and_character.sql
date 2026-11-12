-- Night hordes, the wipe and the character (design §11, §12, §15).
-- 002 = profession change (#19), 003 = password login (#25).

-- Season and campfire of each farm. Nights are resolved by the clock, like
-- offline production: last_night_at is the last attack already applied.
ALTER TABLE farms
  ADD COLUMN season          int         NOT NULL DEFAULT 1,
  ADD COLUMN nights_survived int         NOT NULL DEFAULT 0,
  ADD COLUMN fire_hp         int,                         -- NULL = full
  ADD COLUMN last_night_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_night      jsonb;                       -- result of the last night, for the screens

-- Character: XP (with fraction), attributes, talents, gear and night class.
-- Gear survives the wipe; everything else here is reset.
ALTER TABLE players
  ADD COLUMN xp           numeric NOT NULL DEFAULT 0,
  ADD COLUMN attributes   jsonb   NOT NULL DEFAULT '{}',
  ADD COLUMN talents      jsonb   NOT NULL DEFAULT '[]',
  ADD COLUMN gear         jsonb   NOT NULL DEFAULT '{}',
  ADD COLUMN night_class  text    NOT NULL DEFAULT 'volley',
  ADD COLUMN patrol_night int;                            -- night number this player patrolled

-- One row per season that ended in a wipe.
CREATE TABLE seasons (
  farm_id      uuid        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  season       int         NOT NULL,
  ended_night  int         NOT NULL,
  ended_at     timestamptz NOT NULL,
  PRIMARY KEY (farm_id, season)
);

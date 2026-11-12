-- Patrols validated by the server (design §18): the server draws the seed when
-- the patrol starts and replays it when it ends.
CREATE TABLE patrol_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day          date        NOT NULL,              -- game day (Brasília), for the daily expedition limit
  night        int         NOT NULL,              -- night number of the season it was played for
  kind         text        NOT NULL,              -- 'patrol' (counts for the defense) or 'expedition' (loot only)
  cls          text        NOT NULL,              -- 'volei' or 'colchonete'
  seed         int         NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  stars        int
);
CREATE INDEX patrol_runs_player_day ON patrol_runs (player_id, day);

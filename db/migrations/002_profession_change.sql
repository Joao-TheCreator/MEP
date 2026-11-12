-- Profession change (design §2.1). NEVER edit after it is committed: add 003_*.sql instead.

-- Workshop level of each profession a player has had. players.workshop_level stays
-- the level of the CURRENT profession; on a change the old level is saved here and
-- the new profession's level is read back (1 if never had it).
CREATE TABLE player_workshops (
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  profession  text NOT NULL,
  level       int  NOT NULL CHECK (level >= 1),
  PRIMARY KEY (player_id, profession)
);

-- Last profession change, for the cooldown (NULL = never changed).
ALTER TABLE players ADD COLUMN profession_changed_at timestamptz;

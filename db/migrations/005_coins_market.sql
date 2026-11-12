-- Coins and the Vendinha (design §16).

-- Coins are reset by a wipe (only the gear is kept).
ALTER TABLE players ADD COLUMN coins int NOT NULL DEFAULT 0 CHECK (coins >= 0);

-- Points of value each player bought per game day (Brasília), for the daily limit.
CREATE TABLE market_buys (
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day        date NOT NULL,
  points     int  NOT NULL CHECK (points >= 0),
  PRIMARY KEY (player_id, day)
);

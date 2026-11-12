-- Backpack (design §21): gear items found on patrols. Kept through wipes, like
-- the worn gear. Each item: { id, slot, tier, refine }.
ALTER TABLE players ADD COLUMN bag jsonb NOT NULL DEFAULT '[]';

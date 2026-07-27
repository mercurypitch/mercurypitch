-- 0002 — sessionRecords.source: what kind of attempt produced a row.
--
-- 'practice' (free singing) | 'challenge' | 'weekly' | 'exercise'. Drives
-- leaderboard eligibility: only fixed tasks rank, because averaging scores
-- across self-chosen melodies at self-chosen difficulty compares nothing.
-- Defaults to 'practice' so an untagged writer is never published.

ALTER TABLE sessionRecords ADD COLUMN source TEXT NOT NULL DEFAULT 'practice';
CREATE INDEX IF NOT EXISTS idx_sessionRecords_source ON sessionRecords(source);

-- Backfill from the only signals older rows carry: the weekly tag, and the
-- melodyName prefixes the two challenge writers have always used
-- ("Challenge: <title>" / "Legend: <title>"). Everything else was free
-- practice. Exercises never wrote session records at all, so none exist.
UPDATE sessionRecords SET source = 'weekly'
  WHERE weeklyChallengeId IS NOT NULL AND weeklyChallengeId <> '';

UPDATE sessionRecords SET source = 'challenge'
  WHERE source = 'practice' AND melodyName LIKE 'Challenge: %';

UPDATE sessionRecords SET source = 'weekly'
  WHERE source = 'practice' AND melodyName LIKE 'Legend: %';

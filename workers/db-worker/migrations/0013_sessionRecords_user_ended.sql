-- 0013_sessionRecords_user_ended.sql — stop reading a whole history to sort it.
--
-- Every read of a singer's runs is the same query: their rows, newest first,
-- capped. loadSessionRecords(200) does it on every grant pass; the Analysis
-- and Home surfaces do it too.
--
--   SELECT * FROM sessionRecords WHERE userId = ? ORDER BY endedAt DESC LIMIT 200
--
-- The only usable index was idx_sessionRecords_userId, which gets SQLite to
-- the right rows and then leaves it to sort them by hand — so it reads ALL of
-- that user's records before the LIMIT can discard any. Fine at 56 rows,
-- which is the busiest account on dev today. A singer with 2,000 runs pays
-- 2,000 rows read per pass, forever, to look at 200 of them, and D1 bills
-- rows read.
--
-- A composite in the query's own order lets the index supply the ordering,
-- so the scan stops at the LIMIT: ~430 rows read per pass no matter how long
-- somebody has been practising.
--
-- The single-column idx_sessionRecords_userId is left in place deliberately.
-- SQLite can use this composite for a bare userId lookup too, but dropping
-- the old one is a separate decision from adding this one, and an index that
-- is merely redundant costs writes, not correctness.

CREATE INDEX IF NOT EXISTS idx_sessionRecords_user_ended
  ON sessionRecords(userId, endedAt DESC);

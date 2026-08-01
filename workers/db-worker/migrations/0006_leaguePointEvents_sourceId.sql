-- 0006_leaguePointEvents_sourceId.sql — make league point awards replay-safe.
--
-- The client adapter retries failed writes (5xx/429/network), so a
-- POST /api/sessionRecords that lands server-side but times out client-side
-- arrives again. Award events previously had a fresh UUID per attempt and
-- nothing tying them to the sessionRecords row (or, for streak bonuses, the
-- UTC day) that earned them — a retry double-credited the week's points.
--
-- sourceId carries that provenance: the sessionRecords id for session
-- awards, the UTC day for the once-per-day streak bonuses. The partial
-- unique index turns a repeat award into an INSERT OR IGNORE no-op; the
-- worker only bumps leagueMembership.points when the insert reported a
-- change. Historical rows keep sourceId NULL and are unaffected.

ALTER TABLE leaguePointEvents ADD COLUMN sourceId TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaguePointEvents_source_once
  ON leaguePointEvents(userId, source, sourceId)
  WHERE sourceId IS NOT NULL;

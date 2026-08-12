-- 0025 — additive Progress evidence for new practice attempts.
--
-- All columns are nullable so old rows and older clients remain valid. A
-- missing instrument is interpreted as voice by the client. durationMs is
-- measured time only; nominal streak credit is intentionally not backfilled.

ALTER TABLE sessionRecords ADD COLUMN instrument TEXT;
ALTER TABLE sessionRecords ADD COLUMN durationMs INTEGER;
ALTER TABLE sessionRecords ADD COLUMN sourceRef TEXT;
ALTER TABLE sessionRecords ADD COLUMN sourceVersion INTEGER;
ALTER TABLE sessionRecords ADD COLUMN comparabilityKey TEXT;

-- 0063_retention_sweep_indexes.sql — date indexes for the retention sweep.
--
-- The cron now deletes funnel rows after 13 months, clears click ids after
-- 90 days and deletes rate-limit rows after 2 days (funnel-retention.ts).
-- Each batch picks its rows by date, oldest first. The existing indexes lead
-- with other columns (idx_mirrorEvents_event is (event, createdAt),
-- idx_funnelAcquisition_campaign is (utmCampaign, createdAt)), and
-- auth_ratelimit had none beyond its key, so without these every batch would
-- scan the whole table.
--
-- createdAt is ISO text on both funnel tables; windowStart is epoch ms.
--
-- Purely additive and repeatable: IF NOT EXISTS on each, over columns every
-- version of these tables has had since 0001 and 0021. The shared preview
-- database carries other branches' migrations and rows, and nothing here
-- reads or changes a row.
--
-- Numbered 0063 while 0060 to 0062 are taken by open branches; it may be
-- renumbered when it merges.
CREATE INDEX IF NOT EXISTS idx_mirrorEvents_createdAt
  ON mirrorEvents (createdAt);

CREATE INDEX IF NOT EXISTS idx_funnelAcquisition_createdAt
  ON funnelAcquisition (createdAt);

CREATE INDEX IF NOT EXISTS idx_auth_ratelimit_windowStart
  ON auth_ratelimit (windowStart);

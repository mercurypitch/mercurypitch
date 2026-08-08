-- 0021_funnel_acquisition.sql — where a funnel visitor came from.
--
-- mirrorEvents knows what a visitor did; nothing knew how they arrived. GA4
-- has session source but none of our events, so "do Campaign E's visitors
-- finish an upload more often than organic ones?" had no answer at all.
--
-- One row per clientId, written by /api/mirror/event on first touch and never
-- updated (the Worker uses ON CONFLICT DO NOTHING). Joins to mirrorEvents on
-- clientId.
--
-- Anonymous like the funnel it annotates: a Google click id and campaign
-- labels, no account and no profile. Referrers arrive stripped to origin and
-- path by the client, so a referring page's query string is never stored.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS funnelAcquisition (
  clientId TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  gclid TEXT,
  utmSource TEXT,
  utmMedium TEXT,
  utmCampaign TEXT,
  utmContent TEXT,
  utmTerm TEXT,
  referrer TEXT
);

-- The reporting query is "group this campaign's clients by funnel stage",
-- so campaign is the lookup key, not the client id (already the PK).
CREATE INDEX IF NOT EXISTS idx_funnelAcquisition_campaign
  ON funnelAcquisition (utmCampaign, createdAt);

-- Paid traffic arrives with a gclid and usually no utm_* at all, so the
-- "was this a Google Ads click?" question needs its own path.
CREATE INDEX IF NOT EXISTS idx_funnelAcquisition_gclid
  ON funnelAcquisition (gclid)
  WHERE gclid IS NOT NULL;

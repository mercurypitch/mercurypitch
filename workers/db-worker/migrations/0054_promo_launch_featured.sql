-- 0054_promo_launch_featured.sql — the app offers whichever code is featured; LAUNCH is first.
--
-- Until now the web client carried the offered code (PRODUCT_HUNT) and its
-- end date in its own source, so moving the date meant a release, and the
-- offer vanished from the app on 2026-09-30 whatever the row said. `featured`
-- moves that choice into the table: the header pill and the one-click claim
-- card ask GET /api/billing/promo/featured, which names the featured code only
-- while it can actually be redeemed.
--
-- At most one code is featured. The partial unique index makes a second one a
-- failed write rather than a guess about which of two the app should show.
--
-- LAUNCH takes over from PRODUCT_HUNT on the same terms (5 credits, 1000
-- redemptions), from 2 October 2026 through the end of 1 January 2027, UTC.
-- Its dates, switch and cap are changed afterwards through the admin table
-- API (PATCH /api/promoCodes/promo-2026-q4), not by another migration. The id
-- is listed to anyone who reads the table, so it names the campaign's quarter,
-- never the code.

ALTER TABLE promoCodes ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_promoCodes_featured
  ON promoCodes(featured) WHERE featured = 1;

INSERT OR IGNORE INTO promoCodes
  (id, code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active, featured, createdAt, updatedAt)
VALUES
  ('promo-2026-q4', 'LAUNCH', 5, 1000, 0, '2026-10-02T00:00:00.000Z', '2027-01-01T23:59:59.000Z', 1, 1, '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z');

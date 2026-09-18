-- 0046_promo_product_hunt_window.sql — the launch promo runs to the end of September.
--
-- 0045 seeded PRODUCT_HUNT with an expiry of 2026-09-22T23:59:59Z, which is
-- 16:59 Pacific on launch day itself. The launch is 2026-09-18; the code stays
-- open until the end of the month. 0045 is already applied on dev, so the
-- change travels as its own step rather than an edit to the seed.

UPDATE promoCodes
   SET expiresAt = '2026-09-30T23:59:59.000Z',
       updatedAt = '2026-09-18T06:00:00.000Z'
 WHERE id = 'promo-ph-2026';

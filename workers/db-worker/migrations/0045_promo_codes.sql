-- 0045_promo_codes.sql — promo code campaigns and redemptions
--
-- Adds promoCodes and promoRedemptions tables to support promotional credit
-- grants (e.g. PRODUCT_HUNT launch promotion).
--
-- promoCodes:
--   code             Normalized promo code (unique, case-insensitive in lookup)
--   credits          Number of credits granted on redemption
--   maxRedemptions   Cap on total redemptions across all users (NULL = unlimited)
--   redemptionCount  Current total successful redemptions
--   startsAt         ISO timestamp when redemption begins (NULL = immediately active)
--   expiresAt        ISO timestamp when redemption ends (NULL = never expires)
--   active           1 = active, 0 = disabled
--
-- promoRedemptions:
--   UNIQUE(promoCodeId, userId) ensures each user can redeem a given promo code at most once.

CREATE TABLE IF NOT EXISTS promoCodes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL DEFAULT 5,
  maxRedemptions INTEGER,
  redemptionCount INTEGER NOT NULL DEFAULT 0,
  startsAt TEXT,
  expiresAt TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_promoCodes_code ON promoCodes(code);

CREATE TABLE IF NOT EXISTS promoRedemptions (
  id TEXT PRIMARY KEY,
  promoCodeId TEXT NOT NULL,
  userId TEXT NOT NULL,
  redeemedAt TEXT NOT NULL,
  UNIQUE(promoCodeId, userId),
  FOREIGN KEY (promoCodeId) REFERENCES promoCodes(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_promoRedemptions_user ON promoRedemptions(userId);

INSERT OR IGNORE INTO promoCodes
  (id, code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active, createdAt, updatedAt)
VALUES
  ('promo-ph-2026', 'PRODUCT_HUNT', 5, 1000, 0, NULL, '2026-09-22T23:59:59.000Z', 1, '2026-09-16T00:00:00.000Z', '2026-09-16T00:00:00.000Z');

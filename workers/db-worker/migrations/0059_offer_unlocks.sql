-- 0059_offer_unlocks.sql — an account that earned the launch offer's reward.
--
-- The launch offer (launch-finisher.ts): an account that uses all of its
-- launch credits within 14 days of claiming them gets extra credits on its
-- next pack. Whether it used them is read from the ledger, and the ledger
-- keeps moving: a refunded job, a later purchase. So the moment it earns the
-- reward is written here, once, and never taken back. The reward itself is a
-- ledger row (reason 'offer-bonus') written with the pack it came with.
--
-- `campaign` names the offer ('launch-finisher'), so a later one needs no
-- new table. Deleting an account deletes its rows (USER_OWNED_TABLES in
-- auth.ts).
--
-- Purely additive: the shared preview database carries other branches'
-- migrations, and one new table changes nothing they wrote.
CREATE TABLE IF NOT EXISTS offerUnlocks (
  userId TEXT NOT NULL,
  campaign TEXT NOT NULL,
  unlockedAt TEXT NOT NULL,
  PRIMARY KEY (userId, campaign)
);

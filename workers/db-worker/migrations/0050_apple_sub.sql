-- 0050_apple_sub.sql — Apple's id, in a column only Apple writes.
--
-- Apple's server-to-server notifications (consent-revoked, account-delete,
-- email-disabled, email-enabled) name the account by Apple's `sub` and by
-- nothing else. The route looked for it in providerId, and providerId has
-- room for one provider's id: an account Google linked first keeps Google's
-- there when Apple adopts it by address, because letting the second provider
-- overwrite it made the two flip it on every sign-in. On such an account a
-- notification found nothing, so a singer who withdrew consent kept every
-- live session and the Apple grant stayed stored.
--
-- The worker writes `appleSub` on every account an Apple sign-in reaches
-- (created, upgraded, adopted or returned to), always from a verified
-- identity token, and sign-in matches it as well: an account that adopted the
-- identity by address is found even once the address no longer leads there.
-- The route matches it OR providerId, so an Apple account created before
-- this column existed (appleSub NULL, providerId = Apple's `sub`) is still
-- found, and its next sign-in fills the column in. Nothing is back-filled
-- here: on an adopted account providerId may hold another provider's id, and
-- nothing in the row says which.
--
-- UNIQUE, because one Apple ID names one account; partial, so the NULL every
-- other account carries is not in the index at all. The worker writes with
-- UPDATE OR IGNORE: when another account already holds the id, it keeps it
-- and the sign-in still succeeds.
--
-- Purely additive: the shared preview database carries other branches'
-- migrations, and one new nullable column and one new index change nothing
-- they wrote.

ALTER TABLE users ADD COLUMN appleSub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_appleSub
  ON users (appleSub) WHERE appleSub IS NOT NULL;

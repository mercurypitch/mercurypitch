-- 0057_promo_email_claims.sql — a confirmed email's claim on a promo code, kept after the account goes.
--
-- Deleting an account deletes its promoRedemptions and ledger rows
-- (USER_OWNED_TABLES in auth.ts), and the campaign counter keeps the claim.
-- So the same address could claim the same code again on a new account. A
-- claim now also writes a row here, in the batch that writes the claim
-- (promo-claim.ts): the code's id, what was claimed, and a code of the
-- account's confirmed email, HMAC-SHA256 keyed with the Worker secret
-- FREE_SONG_EMAIL_SECRET under a prefix of its own. A row holds no email and
-- no account id, so it stays when the account goes.
--
-- `kind` says what was claimed: 'claim' for the code's own credits, and
-- 'offer-bonus' for the extra credits on the next pack that using all of the
-- launch credits earns (launch-finisher.ts). Each happens once per address per
-- code.
--
-- Nothing is back-filled: the code needs the secret, which SQL does not
-- have. A claim made before this table existed, or while the secret is
-- unset, has no row, and stays bounded per account only.
--
-- Purely additive: the shared preview database carries other branches'
-- migrations, and one new table changes nothing they wrote.
CREATE TABLE IF NOT EXISTS promoEmailClaims (
  promoCodeId TEXT NOT NULL,
  kind TEXT NOT NULL,
  emailHash TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (promoCodeId, kind, emailHash)
);

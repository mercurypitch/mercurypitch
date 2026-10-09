-- 0060_checkout_consents_and_withdrawals.sql — the 14-day withdrawal.
--
-- checkoutConsents: one row per paid credit pack (checkout-consent.ts). A
-- pack's Checkout Session carries a required checkbox: the buyer asks for
-- the credits straight away and accepts what that does to the 14-day right
-- to cancel, worded per WITHDRAWAL_MODE (withdrawal-wording.ts). Stripe
-- keeps the session, but records no time and no wording version, so the
-- grant writes them here: the mode and text version the session was opened
-- with (NULL for a session opened before this shipped), what Stripe said of
-- the box (`termsOfService`: 'accepted', or NULL when it was not there), and
-- when the paid session reached us with it. The price paid is what a
-- withdrawal refunds against. `mailStatus` records the purchase mail, which
-- is the legal confirmation of the consent (CRD Art. 8(7)): 'sent',
-- 'failed', 'no-email' or 'not-configured'.
--
-- withdrawals: one statement per pack (UNIQUE purchaseId, the pack's
-- creditLedger row), made through Settings › Credits (withdrawal.ts, CRD
-- Art. 11a). It keeps the statement as submitted (name, email, the time),
-- what the rule took (withdrawal-rules.ts) and what the refund did:
-- 'refunded' once Stripe took it, 'failed' or 'manual' when the owner has to
-- refund by hand, 'none' when nothing was owed. The statement stands either
-- way. The credits it removed are ledger rows of their own
-- ('withdrawal' and 'withdrawal-bonus').
--
-- Both are erased with the account (USER_OWNED_TABLES in auth.ts), like the
-- ledger: Stripe keeps its copy of the session and the refund.
--
-- Purely additive: the shared preview database carries other branches'
-- migrations, and two new tables change nothing they wrote.
CREATE TABLE IF NOT EXISTS checkoutConsents (
  sessionId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  paymentIntentId TEXT,
  mode TEXT,
  textVersion TEXT,
  termsOfService TEXT,
  acceptedAt TEXT,
  amountMinor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  mailStatus TEXT,
  mailAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_checkoutConsents_userId
  ON checkoutConsents(userId);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  purchaseId TEXT NOT NULL UNIQUE,
  paymentIntentId TEXT,
  submittedAt TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  packLabel TEXT NOT NULL,
  purchasedAt TEXT NOT NULL,
  paidCredits INTEGER NOT NULL,
  unusedCredits INTEGER NOT NULL,
  bonusCredits INTEGER NOT NULL,
  amountMinor INTEGER NOT NULL,
  refundMinor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  refundStatus TEXT NOT NULL,
  stripeRefundId TEXT,
  refundError TEXT,
  refundedAt TEXT,
  mailStatus TEXT,
  mailAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_userId ON withdrawals(userId);
CREATE INDEX IF NOT EXISTS idx_withdrawals_paymentIntentId
  ON withdrawals(paymentIntentId)
  WHERE paymentIntentId IS NOT NULL;

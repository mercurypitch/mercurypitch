# Managed testing accounts

## Scope

Managed testing accounts are synthetic, verified MercuryPitch accounts provisioned by Mission
Control for invited human testers. The first implementation is development-only. It must not turn a
public registration path or the existing broad administrator key into an account-minting surface.

## Provisioning boundary

- When `ALLOW_TEST_ACCOUNT_PROVISIONING` is not exactly `1`, the Worker shall return not found for
  every managed-testing-account operation.
- When a managed-testing-account request lacks the dedicated `TESTING_PROVISION_KEY`, the Worker
  shall reject it without revealing whether a campaign, tester, or account exists.
- When a valid provision request is received, the Worker shall validate campaign id, tester id,
  expiry, credit amount, entitlement identifiers, and perk identifiers against bounded allowlists.
- When no account exists for the campaign/tester pair, the Worker shall atomically create a verified
  password user, profile, managed-account record, and requested grants.
- When an account already exists for the campaign/tester pair, the Worker shall return its current
  non-secret state and shall not mint or disclose a new password unless rotation was requested.
- When provisioning or rotation succeeds, the Worker shall return the plaintext password exactly in
  that response and shall persist only its derived password hash.

## Identity and lifecycle

- The system shall reserve a synthetic email namespace for managed accounts and public registration
  shall reject that namespace.
- Every managed account shall have an absolute expiry and may be revoked before it.
- When a managed account is expired or revoked, password login and authenticated API use shall fail
  closed.
- When an account is revoked or its password is rotated, the Worker shall increment its token version
  so existing sessions no longer authenticate.
- When an expired account is renewed, the Worker shall extend its managed grant expiries and
  increment its token version so every previous session remains invalid.
- When an account is revoked, the Worker shall reject renewal so revocation remains permanent.
- While an account is active, account identity responses shall expose `isTestAccount` and
  `testAccountExpiresAt` so the application can label the session without exposing campaign ids.

## Grants and billing safety

- When credits are granted, the Worker shall write an append-only ledger row with an idempotency key
  derived from the campaign, tester, and requested grant revision.
- When an entitlement is granted, the Worker shall restrict the feature to the managed-testing
  allowlist and shall cap its expiry at the account expiry.
- When a cosmetic perk is granted, the Worker shall restrict it to the existing perk catalog and
  shall make it inactive when the managed account expires or is revoked.
- While the authenticated user is a managed test account, Stripe checkout and billing-portal routes
  shall reject the request even if billing is configured.

## Environment and operations

- The development Wrangler environment shall opt in explicitly; the root and production
  environments shall remain disabled by omission.
- The dedicated provision key shall be a Worker secret and shall never be committed as a variable.
- Migrations shall be additive, tracked, and safe to apply to production while the provisioning
  route remains disabled there.
- Automated tests shall cover disabled configuration, authentication, validation, idempotent
  provision, password rotation, expiry, revocation, grant allowlists, and billing refusal.

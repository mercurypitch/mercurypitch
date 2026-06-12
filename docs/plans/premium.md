# Premium Features & Payments Plan

Philosophy: **MercuryPitch stays free.** Everything that runs on the user's
device — pitch training, vocal analysis, the stem mixer, client-side stem
separation, community features, cloud accounts — is free forever, supported
by donations. The only things we may ever charge for are features that cost
us real money per use (GPU compute, storage, third-party APIs). Charging
there is cost recovery, not a paywall on practice.

This doc is intentionally high-level (public repo): it lists candidate
features and the integration architecture, not pricing, quotas, or internal
details.

## Candidate premium features

Pay-as-you-go (credits), because the underlying cost is per-use:

1. **Server-side stem separation** — GPU-backed processing via `/api/uvr`,
   for users whose devices can't run the on-device models well (mobile, old
   laptops) or who want faster/larger jobs. On-device separation stays free
   and unlimited.
2. **Higher-quality / multi-stem server models** — e.g. 4–6 stem splits
   (vocals / drums / bass / other) that are too heavy to ship client-side.
3. **Server-side transcription & lyric alignment** — large Whisper-class
   models with word-level alignment for karaoke; the on-device transcription
   path remains free.
4. **Priority / batch processing** — queue priority and multi-track batch
   jobs for the above.
5. **AI practice feedback** — LLM-generated coaching summaries over session
   history and vocal-analysis metrics (per-report credits).

Subscription-shaped (recurring cost for us → recurring price), optional and
later:

6. **Cloud backup & sync of karaoke data** — stems, session audio, and
   derived analysis currently live only in IndexedDB by design; an opt-in
   encrypted cloud copy (R2) with multi-device sync is a storage cost we
   can't fund per-use. A subscription could bundle a monthly credit
   allowance plus storage.
7. **Extended jam rooms** — larger rooms, persistence, or session
   recordings (Durable Object + storage cost). Basic jamming stays free.

Donation-only (no functional gating, ever):

8. **Supporter badge & cosmetics** — profile badge, leaderboard flair,
   theme cosmetics as a thank-you for donations. Never gates features.

Explicitly never premium: pitch detection/training, melodies/sessions,
falling notes, vocal analysis, on-device UVR + transcription, community
(leaderboard/challenges/sharing), accounts and score sync.

## Payments architecture (Stripe)

Principles: Stripe-hosted UI only (Checkout + Customer Portal — card data
never touches our code), server-side enforcement only (the client merely
reflects entitlement state), webhooks are the source of truth.

### Backend (extend db-worker or a sibling billing-worker)

- `POST /api/billing/checkout` — create a Stripe Checkout Session (one-time
  credit packs, subscription, or donation), bound to the JWT identity.
  Requires an upgraded (non-anonymous) account with a verified email.
- `GET /api/billing/portal` — Customer Portal redirect for self-service
  subscription management.
- `GET /api/billing/me` — entitlements + credit balance for the signed-in
  user (the only thing the client reads).
- `POST /api/billing/webhook` — signature-verified, idempotent (processed
  event ids recorded) handler for checkout/subscription/invoice events;
  the only writer of entitlements and credit grants.
- Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) via wrangler
  secrets per env; publishable key is a public var like `GOOGLE_CLIENT_ID`.

### Data model additions (D1, added only when Phase 2 starts)

- `users.stripeCustomerId`
- `entitlements` — per-user feature grants with source + expiry
  (subscription state mirrored from webhooks).
- `creditLedger` — append-only credit grants/debits with job references;
  balance is the sum, never a mutable counter.
- `billingEvents` — processed Stripe event ids (webhook idempotency).

### Metering paid jobs

- Paid endpoints (e.g. server-side separation) resolve the user from the
  JWT, check balance, **debit on job acceptance, refund on failure**, with
  a per-job idempotency key so retries can't double-charge.
- Server-side quota/abuse limits independent of the client.

### Client preparation

- Settings → Account grows a Billing block: credit balance, "Buy credits",
  "Manage subscription", donation link — all redirects to Stripe-hosted
  pages, driven by `GET /api/billing/me`.
- Gate visibility with the existing `featureFlags` table so billing UI can
  roll out per-environment without a deploy.
- Server-processing options in the UVR flow show a credit estimate before
  submitting; the existing `uvr-processing-mode` setting already separates
  local vs server paths.

## Phases

- **Phase 0 (now):** this plan. No billing tables, no Stripe code.
- **Phase 1 — donations:** a Stripe Payment Link (or Ko-fi/GitHub Sponsors)
  in the app footer/settings + supporter badge granted manually or via a
  single webhook. No entitlements, no gating.
- **Phase 2 — credits:** billing endpoints + ledger + metering for
  server-side stem separation (and transcription when it ships). Small free
  monthly allowance so everyone can try it.
- **Phase 3 — subscription (optional):** bundle of monthly credits + cloud
  backup/sync, only if Phase 2 demand justifies it.

## Open questions (decide before Phase 2)

- Pricing & free allowance sizing (depends on measured GPU cost per track).
- Stripe Tax / VAT handling and supported regions.
- Refund policy wording for failed/partial jobs (auto-refund covers most).
- Whether donations should grant supporter cosmetics automatically
  (webhook) or stay fully decoupled.

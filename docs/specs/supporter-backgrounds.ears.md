# Supporter Backgrounds — EARS Requirements

Requirements for the shared Karaoke Night and Jam Rooms background catalog,
supporter access evidence, and persisted selection behavior.

**Source:** `src/lib/backgrounds/background-catalog.ts`,
`src/lib/backgrounds/background-access.ts`,
`workers/db-worker/src/premium-backgrounds.ts`,
`workers/db-worker/src/background-capabilities.ts`,
`workers/jam-worker/src/host-verification.ts`,
`workers/jam-worker/src/room-ownership.ts`,
`workers/jam-worker/src/signaling-intent.ts`,
`workers/jam-worker/src/jam-room.ts`
**Tests:** `src/lib/backgrounds/background-catalog.test.ts`,
`src/lib/backgrounds/background-access.test.ts` (`BG-CAT-*`, `BG-ACCESS-*`,
`BG-SELECT-*`, `BG-JAM-*`),
`src/tests/billing-service-validation.test.ts`,
`workers/db-worker/src/auth.test.ts`,
`workers/db-worker/src/premium-backgrounds.test.ts`,
`workers/jam-worker/src/host-verification.test.ts`,
`workers/jam-worker/src/room-ownership.test.ts`,
`workers/jam-worker/src/signaling-intent.test.ts`,
`workers/jam-worker/src/jam-room.test.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behavior), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Catalog — `BG-CAT-*`

- **BG-CAT-1** — The system shall define Karaoke Night and Jam Rooms backgrounds in one typed catalog.
- **BG-CAT-2** — The catalog shall include every currently shipped free background, the existing `golden-stage`, `golden-singer`, and `aurora-loft` masters, and the reserved Mercury Editions identifiers.
- **BG-CAT-3** — The catalog shall distinguish shipped, master-ready, and planned backgrounds.
- **BG-CAT-4** — Every supporter background shall use an opaque protected source key and shall not contain a public asset URL.
- **BG-CAT-5** — Every surface shall have a shipped free default.

## Server-evidenced access — `BG-ACCESS-*`

- **BG-ACCESS-1** — WHILE an authenticated server response contains an active `supporter` entitlement, the system shall grant access to the standard supporter background pack.
- **BG-ACCESS-2** — WHILE `/api/perks/me` contains a known explicit background grant for a verified account email, the system shall grant access to that matching background without granting the rest of the supporter pack.
- **BG-ACCESS-3** — IF a supporter entitlement is expired or has an invalid expiration date, THEN the system shall treat it as inactive.
- **BG-ACCESS-4** — IF either access endpoint is unavailable, THEN the system shall fail closed for that source while retaining independently verified evidence from the other source.
- **BG-ACCESS-5** — IF no access endpoint can be reached, THEN the system shall expose no supporter background access.
- **BG-ACCESS-6** — The system shall not derive supporter or explicit-perk access from localStorage, query parameters, room messages, or any other client-controlled value.
- **BG-ACCESS-7** — The system shall ignore unknown or malformed explicit perk identifiers returned at the client boundary.
- **BG-ACCESS-8** — IF a password account has not verified ownership of its email address, THEN the system shall not return or authorize an email-keyed explicit perk for that account.
- **BG-ACCESS-9** — WHEN an account is deleted, the system shall purge shared email-keyed perks only if that account had verified ownership of the email address.
- **BG-ACCESS-10** — WHEN an anonymous account upgrades through password or Google authentication, the system shall increment its token version and reject every session issued before the upgrade.
- **BG-ACCESS-11** — IF a verified account's shared email-keyed perk purge is unavailable or fails during account deletion, THEN the system shall return `503` without deleting the account so the operation can be retried safely.

## Selection and persistence — `BG-SELECT-*`

- **BG-SELECT-1** — WHEN a background preference is persisted, the system shall store only its known identifier.
- **BG-SELECT-2** — WHEN a persisted preference is restored, the system shall resolve its access again from current server evidence.
- **BG-SELECT-3** — IF a selected identifier is unknown, belongs to another surface, is not shipped, or is not currently entitled, THEN the system shall use that surface's shipped free default.
- **BG-SELECT-4** — IF localStorage is unavailable or malformed, THEN the system shall use the shipped free default without failing the page.

## Jam host synchronization seam — `BG-JAM-*`

- **BG-JAM-1** — WHILE no host-selected background exists, the system shall derive the same shipped free Jam background from the same room identifier.
- **BG-JAM-2** — WHEN a host-authorized Jam background identifier is resolved for display, the viewer-side resolver shall not require the participant to own a separate supporter entitlement.
- **BG-JAM-3** — IF a shared background identifier is unknown, belongs to another surface, or is not shipped, THEN the viewer shall use the Jam free default.
- **BG-JAM-4** — WHEN an entitled host requests guest access to a supporter Jam background, the system shall verify the room's owner token inside that room's Durable Object through a private Worker RPC entrypoint before minting access.
- **BG-JAM-5** — Every guest background capability shall be bound to exactly one known Jam background and one valid room identifier and shall expire no more than 15 minutes after issuance.
- **BG-JAM-6** — WHEN a guest requests protected background bytes, the system shall require the capability in a request header and require its signed background and room scopes to match the request.
- **BG-JAM-7** — IF a guest capability is missing, malformed, tampered, expired, scoped to another background, or scoped to another room, THEN the system shall reject it before reading R2.
- **BG-JAM-8** — The system shall not mint a Jam guest capability for a Karaoke-only background.
- **BG-JAM-9** — The system shall limit capability minting to 30 requests per authenticated user per minute and shall return `429` with `Retry-After` after that budget is exhausted.
- **BG-JAM-10** — WHEN a Jam Room becomes empty, the system shall persist its grace-period deadline and schedule a Durable Object alarm; WHEN that deadline expires, the system shall reject the owner proof even after eviction and clear its in-memory owner id, owner name, and owner token as well as deleting stored room state.
- **BG-JAM-11** — The system shall limit protected background byte reads to 120 requests per authenticated user per minute, or per source IP for guest capabilities, and shall return `429` with `Retry-After` before another R2 read.
- **BG-JAM-12** — WHEN a signaling WebSocket is created or joined, the outer Worker shall overwrite its internal connection intent and room scope; the Durable Object shall reject a mismatched, missing, replayed, or client-spoofed handshake and shall not allow an existing room owner to be replaced.
- **BG-JAM-13** — WHEN a peer leaves a Jam Room, the Durable Object shall mark that socket departed and close it so hibernation or eviction cannot restore it as an active peer.
- **BG-JAM-14** — The Durable Object alarm timestamp shall schedule cleanup but shall not prove the owner token's authorization deadline; IF an empty hydrated room has an owner token without a persisted grace-period deadline, THEN the system shall treat that proof as expired.

## Jam guest-delivery HTTP contract

This is the integration seam for the later Jam Room UI work:

1. The entitled host sends `POST /api/premium-backgrounds/:jamBackgroundId/capability` with its normal `Authorization: Bearer …` header and JSON `{ "roomId": "…", "ownerToken": "…" }`.
2. After private Jam Worker host verification, the DB Worker returns `{ "backgroundId", "roomId", "token", "expiresAt" }` with `Cache-Control: private, no-store`. The token expires after 15 minutes.
3. The host shares that response's `token` with current room peers through the existing Jam state channel. The `ownerToken` itself must remain device-local and must never be shared with peers.
4. A guest fetches `GET /api/premium-backgrounds/:jamBackgroundId?variant=landscape-2k` with `X-Jam-Background-Capability: <token>` and `X-Jam-Room-Id: <roomId>`, then uses the returned private image bytes as a local blob URL.

The capability is a bearer credential and must not be put in a query string,
CSS URL, analytics event, or persistent room history.

This foundation change intentionally leaves the optional R2 and Jam service
bindings out of tracked Wrangler deployment config, so merging it cannot race
or fail an unprovisioned dev deployment. Until the explicit rollout, protected
delivery and capability minting fail closed with `503`.

The later rollout order is: create a private R2 bucket with no public domain,
set a distinct random `BACKGROUND_CAPABILITY_SECRET` of at least 32 bytes on
the DB Worker, deploy the Jam Worker so its `JamHostVerifier` named RPC
entrypoint exists, and only then add the R2/service bindings and deploy the DB
Worker. Do this in dev before prod.

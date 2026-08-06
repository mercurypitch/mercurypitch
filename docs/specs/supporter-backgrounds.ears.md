# Supporter Backgrounds — EARS Requirements

Requirements for the shared Karaoke Night and Jam Rooms background catalog,
supporter access evidence, and persisted selection behavior.

**Source:** `src/lib/backgrounds/background-catalog.ts`,
`src/lib/backgrounds/background-access.ts`,
`workers/db-worker/src/premium-backgrounds.ts`,
`workers/db-worker/src/premium-background-access.ts`,
`workers/db-worker/src/premium-background-admin.ts`,
`workers/db-worker/src/background-capabilities.ts`,
`workers/db-worker/migrations/0018_premium_background_studio.sql`,
`workers/jam-worker/src/host-verification.ts`,
`workers/jam-worker/src/room-ownership.ts`,
`workers/jam-worker/src/signaling-intent.ts`,
`workers/jam-worker/src/jam-room.ts`
**Tests:** `src/lib/backgrounds/background-catalog.test.ts`,
`src/lib/backgrounds/background-access.test.ts` (`BG-CAT-*`, `BG-ACCESS-*`,
`BG-SELECT-*`, `BG-JAM-*`),
`src/tests/billing-service-validation.test.ts`,
`workers/db-worker/src/auth.test.ts`,
`workers/db-worker/src/premium-background-admin.test.ts`,
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
- **BG-CAT-6** — The runtime premium catalog shall contain only active assets
  with a complete explicitly published revision and shall expose safe metadata
  without an R2 object key.
- **BG-CAT-7** — The environment-local main D1 database shall own premium
  asset lifecycle and revision state; static catalog definitions shall remain
  the allowlist for known identifiers and their Karaoke or Jam surface.

## Server-evidenced access — `BG-ACCESS-*`

- **BG-ACCESS-1** — WHILE an authenticated server response contains an active `supporter` entitlement, the system shall grant access to the standard supporter background pack.
- **BG-ACCESS-2** — WHILE `/api/perks/me` contains a known explicit background grant for a verified account email, the system shall grant access to that matching background without granting the rest of the supporter pack.
- **BG-ACCESS-3** — IF a supporter entitlement is expired or has an invalid expiration date, THEN the system shall treat it as inactive.
- **BG-ACCESS-4** — IF either access endpoint is unavailable, THEN the system shall fail closed for that source while retaining independently verified evidence from the other source.
- **BG-ACCESS-5** — IF no access endpoint can be reached, THEN the system shall expose no supporter background access.
- **BG-ACCESS-6** — The system shall not derive supporter or explicit-perk access from localStorage, query parameters, room messages, or any other client-controlled value.
- **BG-ACCESS-7** — The system shall ignore unknown or malformed explicit perk identifiers returned at the client boundary.
- **BG-ACCESS-8** — IF a password account has not verified ownership of its email address, THEN the system shall not return or authorize an email-keyed explicit perk for that account.
- **BG-ACCESS-9** — WHEN an account is deleted, the system shall purge shared
  email-keyed perks and hard-delete every manual supporter-group membership
  for that email only if the account had verified ownership of the address;
  the system shall anonymize that personal email in Premium Studio audit rows,
  hard-delete user-authored capability audit rows that identify private Jam
  rooms, anonymize the deleted user id in retained audit rows, and ensure later
  registration of the same email does not restore the membership.
- **BG-ACCESS-10** — WHEN an anonymous account upgrades through password or Google authentication, the system shall increment its token version and reject every session issued before the upgrade.
- **BG-ACCESS-11** — IF a verified account's shared email-keyed perk purge is unavailable or fails during account deletion, THEN the system shall return `503` without deleting the account so the operation can be retried safely.
- **BG-ACCESS-12** — WHILE a verified email belongs to an active manual
  supporter group, the system shall grant that group's active background
  assignments independently of the account's supporter entitlement.
- **BG-ACCESS-13** — WHILE an account has an active supporter entitlement,
  the system shall grant the active assignments of the reserved automatic
  `active-supporters` group.
- **BG-ACCESS-14** — The shared `PERKS_DB` shall remain a legacy source of
  individual verified-email grants; mutable group membership, assignments,
  revisions, capabilities, and audit records shall not be stored there.

## Selection and persistence — `BG-SELECT-*`

- **BG-SELECT-1** — WHEN a background preference is persisted, the system shall store only its known identifier.
- **BG-SELECT-2** — WHEN a persisted preference is restored, the system shall resolve its access again from current server evidence.
- **BG-SELECT-3** — IF a selected identifier is unknown, belongs to another surface, is not shipped, or is not currently entitled, THEN the system shall use that surface's shipped free default.
- **BG-SELECT-4** — IF localStorage is unavailable or malformed, THEN the system shall use the shipped free default without failing the page.
- **BG-SELECT-5** — WHEN the singer changes Karaoke stage transparency in
  either the standalone Karaoke Night or the in-app Stem Mixer, the system
  shall persist one shared bounded preference and apply it to the Karaoke
  surface glass without changing the selected background.
- **BG-SELECT-6** — WHILE the standalone Karaoke Night shell owns the stage
  controls, its embedded Stem Mixer shall suppress its own stage picker and
  transparency control so the stage has one control surface.

## Jam host synchronization seam — `BG-JAM-*`

- **BG-JAM-1** — WHILE no host-selected background exists, the system shall derive the same shipped free Jam background from the same room identifier.
- **BG-JAM-2** — WHEN a host-authorized Jam background identifier is resolved for display, the viewer-side resolver shall not require the participant to own a separate supporter entitlement.
- **BG-JAM-3** — IF a shared background identifier is unknown, belongs to another surface, or is not shipped, THEN the viewer shall use the Jam free default.
- **BG-JAM-4** — WHEN an entitled host requests guest access to a supporter Jam background, the system shall verify the room's owner token inside that room's Durable Object through a private Worker RPC entrypoint before minting access.
- **BG-JAM-5** — Every guest background capability shall be bound to exactly
  one known Jam background, one published revision version, and one valid room
  identifier and shall expire no more than five minutes after issuance.
- **BG-JAM-6** — WHEN a guest requests protected background bytes, the system
  shall require the capability and room in request headers, the exact version
  in the query, and require every signed scope to match the request.
- **BG-JAM-7** — IF a guest capability is missing, malformed, tampered, expired, scoped to another background, or scoped to another room, THEN the system shall reject it before reading R2.
- **BG-JAM-8** — The system shall not mint a Jam guest capability for a Karaoke-only background.
- **BG-JAM-9** — The system shall limit capability minting to 30 requests per authenticated user per minute and shall return `429` with `Retry-After` after that budget is exhausted.
- **BG-JAM-10** — WHEN a Jam Room becomes empty, the system shall persist its grace-period deadline and schedule a Durable Object alarm; WHEN that deadline expires, the system shall reject the owner proof even after eviction and clear its in-memory owner id, owner name, and owner token as well as deleting stored room state.
- **BG-JAM-11** — The system shall limit protected background byte reads to 120 requests per authenticated user per minute, or per source IP for guest capabilities, and shall return `429` with `Retry-After` before another R2 read.
- **BG-JAM-12** — WHEN a signaling WebSocket is created or joined, the outer Worker shall overwrite its internal connection intent and room scope; the Durable Object shall reject a mismatched, missing, replayed, or client-spoofed handshake and shall not allow an existing room owner to be replaced.
- **BG-JAM-13** — WHEN a peer leaves a Jam Room, the Durable Object shall mark that socket departed and close it so hibernation or eviction cannot restore it as an active peer.
- **BG-JAM-14** — The Durable Object alarm timestamp shall schedule cleanup but shall not prove the owner token's authorization deadline; IF an empty hydrated room has an owner token without a persisted grace-period deadline, THEN the system shall treat that proof as expired.
- **BG-JAM-15** — WHEN a capability is minted, the system shall store its
  identifier, issuer, room, background, revision, version, issue time, expiry,
  and revocation state in the environment-local main D1 database.
- **BG-JAM-16** — WHEN a guest requests protected background bytes, the
  system shall recheck the stored capability, the issuer's current access, and
  the currently published revision before reading R2.
- **BG-JAM-17** — IF a capability is revoked, its issuer loses current access,
  its asset is retired, or a new revision is published, THEN the system shall
  reject it before reading R2.
- **BG-JAM-18** — Every protected image byte response shall use
  `Cache-Control: private, no-store` so a later fetch cannot bypass a current
  entitlement, capability, or revision check through an HTTP cache.
- **BG-JAM-19** — WHEN a verified owner reconnects while an older owner socket
  remains attached, the system shall demote every older host attachment before
  promoting the new peer; IF hibernation encounters conflicting host
  attachments, THEN it shall grant authority to neither attachment rather than
  selecting one by iteration order, demote every conflicting attachment, and
  notify connected clients that the room currently has no host.
- **BG-JAM-20** — WHEN room expiry successfully deletes persisted room state,
  the same warm Durable Object shall clear its hydrated background state so a
  later room adoption cannot inherit the expired room's selection.
- **BG-JAM-21** — WHEN a well-formed, unexpired capability from the current
  Durable Object-named host arrives before its matching room background state,
  the guest shall retain it only until matching state arrives; capabilities
  from another peer, malformed capabilities, and expired capabilities shall
  not enter that pending state.

## Premium Background Studio — `BG-STUDIO-*`

- **BG-STUDIO-1** — Every Studio route shall use the existing admin resolver,
  and every successful mutation shall append an immutable audit event; account
  erasure may anonymize the deleted account's personal identifiers while
  preserving the event, action, time, and non-personal entity context.
- **BG-STUDIO-2** — WHEN an admin creates a revision, the system shall assign
  the next integer version and keep at most one draft revision per asset.
- **BG-STUDIO-3** — WHEN an admin uploads a variant, the system shall accept
  only a bounded raw `image/webp` body with a valid RIFF/WebP structure,
  dimensions no greater than 8192 pixels, and the expected orientation.
- **BG-STUDIO-4** — The system shall store every variant in the
  environment-bound private bucket under a unique immutable R2 key containing
  the surface, background, version, variant, and a random component; no client
  shall submit or receive that key.
- **BG-STUDIO-5** — IF storing uploaded variant metadata fails or the draft
  changed concurrently, THEN the system shall remove the newly written R2
  object and leave the revision unpublished.
- **BG-STUDIO-6** — The system shall allow replacement only by explicitly
  removing a variant from an inactive draft and uploading a new immutable
  object; published or active revision variants shall not be removable.
- **BG-STUDIO-7** — WHEN an admin publishes a draft, the system shall require
  every supported variant and atomically supersede the old revision, publish
  the new revision, select it on the asset, revoke old capabilities, and audit
  the transition.
- **BG-STUDIO-8** — Draft and superseded revisions shall never appear in the
  runtime catalog or protected byte delivery path.
- **BG-STUDIO-9** — WHEN an admin retires an asset, the system shall hide it
  from runtime catalog and byte delivery and revoke its active capabilities;
  restore shall require an intact published revision.
- **BG-STUDIO-10** — The Studio shall seed stable premium asset identities and
  a non-deletable automatic `active-supporters` group assigned to the initial
  background pack, without marking any asset shipped before a revision is
  explicitly published.
- **BG-STUDIO-11** — WHEN an admin adds a manual group member, the system shall
  require the email to match a currently verified account.
- **BG-STUDIO-12** — WHEN an admin revokes a member, group assignment, or group
  activity, the system shall revoke affected active capabilities immediately.
- **BG-STUDIO-13** — The system shall not delete the automatic supporter group
  or a manual group with active members or assignments; manual group deletion
  shall be a recoverable soft deletion after references are revoked, and the
  final delete/grant statements shall prevent concurrent operations from
  creating an active reference on a deleted group.
- **BG-STUDIO-14** — Admin draft previews shall be admin-authenticated,
  `private, no-store`, and resolved server-side without exposing an R2 key or
  public preview URL.

## Jam guest-delivery HTTP contract

This is the integration seam for the later Jam Room UI work:

1. The entitled host sends `POST /api/premium-backgrounds/:jamBackgroundId/capability` with its normal `Authorization: Bearer …` header and JSON `{ "roomId": "…", "ownerToken": "…", "version": 3 }`. Omitting `version` asks for the current published revision.
2. After private Jam Worker host verification, the DB Worker returns `{ "backgroundId", "roomId", "version", "token", "expiresAt" }` with `Cache-Control: private, no-store`. The token expires after at most five minutes and is also stored as a revocable D1 record.
3. The host shares that response's `token` with current room peers through the existing Jam state channel. The `ownerToken` itself must remain device-local and must never be shared with peers.
4. A guest fetches `GET /api/premium-backgrounds/:jamBackgroundId?variant=landscape-2k&version=<version>` with `X-Jam-Background-Capability: <token>` and `X-Jam-Room-Id: <roomId>`, then uses the returned `private, no-store` image bytes as a local blob URL.

The capability is a bearer credential and must not be put in a query string,
CSS URL, analytics event, or persistent room history.

Tracked Wrangler configuration declares environment-specific private R2
buckets and the Jam Worker's `JamHostVerifier` service binding. Before a first
deployment, provision the named dev resources, set a distinct random
`BACKGROUND_CAPABILITY_SECRET` of at least 32 bytes for dev, apply the main D1
migration, and verify the complete Studio flow locally and on dev. Repeat with
separately generated production secrets and production resources only after
the dev review; protected delivery and capability minting fail closed with
`503` while a required binding or secret is unavailable.

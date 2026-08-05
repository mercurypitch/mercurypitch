# EARS Specification — Account suspension

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-08-05 | Scope: reversible account suspension,
> session revocation, ranking exclusion, operator controls, and audit history.

**Source:** `workers/db-worker/migrations/0016_user_suspension.sql`,
`workers/db-worker/src/moderation.ts`, `workers/db-worker/src/auth.ts`,
`workers/db-worker/src/index.ts`, `workers/db-worker/src/league.ts`,
`src/worker.ts`, `src/db/services/auth-service.ts`, and the MercuryPitch Admin
Studio Users page.

**Tests:** `workers/db-worker/src/moderation.test.ts`,
`workers/db-worker/src/auth.test.ts`,
`workers/db-worker/src/suspension-integration.test.ts`,
`src/tests/auth-service.test.ts`, `src/tests/server-adapter.test.ts`,
`src/tests/worker-uvr-routing.test.ts`, `src/tests/league-cut.test.ts`, and
`src/tests/weekly-challenge.test.ts`.

---

## 1. Operator authorization and state transitions

### REQ-AS-001 — Admin authorization
**When** a caller requests suspension or restoration, the DB worker shall
require its server-side `X-Admin-Key` check before reading or changing the
target account. The browser shall never receive the admin key; the local Admin
Studio bridge owns it, and the deployed Studio shall additionally sit behind
Cloudflare Access.

### REQ-AS-002 — Strict moderation input
**When** an authorized caller requests a state change, the DB worker shall
require a UUID user id, a boolean target state, and a trimmed 8–280 character
reason without ASCII control characters; malformed requests shall not change
state or create audit history.

### REQ-AS-003 — Atomic, idempotent suspension
**When** an active account is suspended, the DB worker shall atomically set
`suspendedAt` and `suspensionReason`, increment `tokenVersion` exactly once,
and append exactly one `suspend` audit event. **While** the account is already
suspended, a repeated request shall report `changed: false` and shall neither
increment `tokenVersion` nor append another event.

### REQ-AS-004 — Safe restoration
**When** a suspended account is restored, the DB worker shall atomically clear
the current suspension fields and append one `restore` event without reducing
`tokenVersion`. **While** the account is already active, a repeated restoration
shall be an audited no-op (`changed: false`, no additional event).

### REQ-AS-005 — Durable audit history
**Ubiquitous:** A real moderation transition shall retain its timestamp, user
id, action, and operator-supplied reason. Operator identity is attributable at
the Cloudflare Access boundary; the application audit row does not currently
duplicate that identity.

## 2. Authentication and active sessions

### REQ-AS-006 — No session issuance while suspended
**While** an account is suspended, every session-issuance path shall refuse it:
anonymous device re-authentication, password login, anonymous-to-password
registration upgrade, Google token login, Google redirect login, and
anonymous-to-Google upgrade.

### REQ-AS-007 — Existing sessions are revoked
**When** a bearer token belonging to a suspended account reaches the DB worker,
the worker shall reject it before normal authorization with HTTP 403 and
`{ code: "account_suspended" }`. **When** the account is later restored, that
old token shall remain invalid because suspension advanced `tokenVersion`.

### REQ-AS-008 — Clear client state and feedback
**When** the client receives `account_suspended`, it shall stop cloud access,
clear an upgraded account bearer, prevent anonymous fallback, and show a clear
human suspension message. Google redirect UI shall show the human message and
shall not expose the internal error code.

### REQ-AS-009 — Anonymous restoration probe
**While** a suspended identity is anonymous, the client shall retain its bearer
only as a revocation probe and shall not mint a replacement identity. **When**
the account is restored, the stale token's 401 shall allow the same persisted
device id to obtain a fresh anonymous session.

### REQ-AS-010 — Expensive mutations revalidate centrally
**When** an authenticated non-read UVR request is made, the main worker shall
revalidate the bearer through the DB worker before invoking any compute or
container backend. Missing configuration, network failure, unexpected DB
responses, and DB 5xx responses shall fail closed; a suspension response shall
remain distinguishable from other 403 responses.

## 3. Competitive visibility

### REQ-AS-011 — Live leaderboard exclusion
**While** an account is suspended, its session aggregates shall not appear in
the live global or friends leaderboard, regardless of score or opt-in state.

### REQ-AS-012 — Weekly challenge exclusion
**While** an account is suspended, its attempts shall not appear in the live
weekly board and shall not contribute to attempted or completed counts.

### REQ-AS-013 — League exclusion
**While** an account is suspended, it shall earn no new league points, appear
in no current standings payload, and take no promotion or relegation place in
the weekly cut.

### REQ-AS-014 — Historical snapshots are immutable
**Ubiquitous:** Closing a weekly challenge freezes its published historical
snapshot. Suspending a user later shall exclude them from live computations but
shall not rewrite already archived top-three results.

## 4. Lifecycle boundaries

### REQ-AS-015 — Suspended deletion requires restoration
**While** an account is suspended, authenticated self-service deletion is not
available because the bearer is rejected at the common auth boundary. Support
shall restore the account before the owner deletes it; the deletion batch then
removes the account's moderation history with the user.

### REQ-AS-016 — Anonymous suspension is device-bound
**Ubiquitous:** An anonymous suspension applies to the persisted device
identity. Clearing browser identity storage creates a different anonymous
identity and is not an account-level anti-evasion mechanism.

### REQ-AS-017 — Ordered rollout
**When** this feature is deployed, migration `0016` shall complete before the
DB worker is deployed, and the DB worker shall be available before the main
worker/client begins relying on suspension responses and UVR revalidation.

## 5. Release acceptance scenarios

1. Suspend an active password account twice: the first call changes state,
   advances `tokenVersion`, and writes one audit event; the second is a no-op.
2. Reuse the pre-suspension bearer across `/api/auth/me`, a generic cloud
   write, and a mutating UVR request: each is rejected before protected work;
   the app shows one clear suspension notice.
3. Attempt password login, Google redirect login, registration upgrade, and
   anonymous re-authentication while suspended: none issues a token.
4. Restore the account: the old bearer remains 401, a fresh login succeeds,
   and the restore reason appears once in audit history.
5. Give active and suspended users leaderboard, weekly-challenge, and league
   data: only the active user appears in live results or moves during the cut.
6. Suspend an anonymous identity, then restore it without clearing browser
   storage: the client reuses the same device id instead of creating a shadow
   user.
7. Remove the main worker's DB binding or make DB validation fail: an
   authenticated UVR mutation returns 503 and no backend is invoked.

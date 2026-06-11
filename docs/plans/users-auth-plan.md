# Users & Auth Plan

Goal: real user identity for the **cloud** database (challenges, leaderboard, profiles, sharing), while karaoke/UVR data stays local and needs no auth at all. Anonymous-first: nobody should have to sign up to use MercuryPitch.

## Current state (problems to fix)

- `getUserId()` in `src/db/seed.ts:327` returns `window.crypto.randomUUID()` cached in a **module variable** — a brand-new "user" every page load. Nothing is persisted, so streaks/challenge progress can't even be attributed consistently locally.
- The worker contract has no auth: any client could write any `userId`'s rows.

## Phase 1 — Persistent anonymous identity (client-only, do first)

1. Move user-id logic out of `seed.ts` into `src/db/services/user-service.ts`.
2. Persist: `localStorage['mp:userId'] ??= crypto.randomUUID()`. All existing `getUserId()` call sites (session, challenges, leaderboard, share, uvr services) keep working.
3. This alone fixes local streak/progress attribution and is a prerequisite for everything below. No backend needed.

## Phase 2 — Anonymous users in the cloud (with the db-worker)

The `users` table already exists in `workers/db-worker/schema.sql` (`authProvider = 'anonymous'`).

Flow:
1. App starts → has local `mp:userId` but no token → `POST /api/auth/anonymous { deviceId: <mp:userId> }`.
2. Worker creates (or finds) the `users` row + a default `userProfiles` row, returns a **signed JWT** (`sub = userId`, ~30-day expiry, `JWT_SECRET` via `wrangler secret put`).
3. Client stores the token (`localStorage['mp:authToken']`) and passes it through `ServerAdapter`'s existing `headers` config: `Authorization: Bearer <jwt>`.
4. Worker middleware (Hono): verify JWT → `c.set('userId', sub)`. Then:
   - user-scoped tables (`sessionRecords`, `challengeProgress`, `userBadges`, `userAchievements`, `userSettings`, `sharedMelodies`, `sharedSessions`): force `userId = token.sub` on writes, add `WHERE userId = ?` on reads of private data.
   - public-read tables (`challengeDefinitions`, `badgeDefinitions`, `achievements`, `leaderboardEntries`, `featureFlags`, public shared content): GET without auth OK; writes to definitions/flags require an admin key (header secret) — they're seed/admin data.
   - `userProfiles` / `users`: user can only read/update own row (`id = token.sub`); leaderboard exposes display names via `leaderboardEntries`, not profiles.

No passwords, no email, no consent UI — an "account" is just a stable ID + token. Leaderboard works day one.

## Phase 3 — Account upgrade (later, optional)

- `POST /api/auth/upgrade` with email+password (hash with `scrypt`/WebCrypto PBKDF2 — no bcrypt dependency in Workers) or OAuth (Google/GitHub via Cloudflare Access or hand-rolled code flow).
- **Keeps the same `users.id`** — sets `authProvider`, `email`, `passwordHash`/`providerId`. All existing rows (sessions, badges, progress) stay attached. This is why the anonymous id must be the primary key from the start.
- Enables multi-device: log in elsewhere → same userId → cloud data follows. (Local karaoke/UVR data intentionally does not.)

## Decisions taken

| Question | Decision |
|---|---|
| Auth0/Supabase/Clerk? | No — third-party auth is overkill for "leaderboard + challenges". Hand-rolled JWT in the worker, ~100 lines. Revisit if real account features grow. |
| Anonymous UUID vs accounts? | Both, in sequence: anonymous now (Phase 1–2), upgrade path later (Phase 3). |
| Where does auth live? | In the db-worker itself (`/api/auth/*` routes) — same Hono app, same D1 binding. |
| What about UVR/karaoke data? | Never touches auth or cloud. Stays in IndexedDB. |

## Implementation order

- [ ] Phase 1: `user-service.ts` with persisted anonymous id (small PR, no backend dependency)
- [ ] db-worker CRUD + JWT middleware + `/api/auth/anonymous` (with Step A of db-migration-plan)
- [ ] HybridAdapter passes `Authorization` header (Step C)
- [ ] Phase 3 upgrade flow — only when there's a product need

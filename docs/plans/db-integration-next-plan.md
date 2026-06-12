# DB Integration — Status & Next Steps

Follow-up to [db-migration-plan.md](./db-migration-plan.md) and [users-auth-plan.md](./users-auth-plan.md). Snapshot of where the Cloudflare D1 integration stands as of 2026-06-12 and what comes next.

## What's done

### Database
- Cloud/local split locked in: D1 holds only user/social data (users, profiles, session scores, challenges, badges, achievements, leaderboard, shared content, settings). Karaoke/UVR sessions, audio blobs, and derived analysis stay in IndexedDB forever — no sync, no R2.
- `mercurypitch-db` created and initialized: **remote** (production) and **local** (`workers/db-worker/.wrangler/state`, used by `wrangler dev`). Database id `35d9bae5-4818-4acf-8bd1-4644b6b24949`, bound in `workers/db-worker/wrangler.jsonc`.
- Idempotent setup via `pnpm db:init` / `pnpm db:init:local` (`scripts/init-cloudflare-db.sh`).
- No Drizzle: the worker is a generic CRUD layer over an allowlist — plain D1 prepared statements + hand-maintained `schema.sql`.

### db-worker (`workers/db-worker/src/`)
Zero-dependency fetch handler (same style as jam-worker, no Hono):
- **Generic CRUD** matching the frontend `ServerAdapter` contract: `GET/POST /api/:entity`, `GET/PATCH/DELETE /api/:entity/:id`, `GET /api/:entity/count`, with `where[k]`, `orderBy`, `orderDir`, `limit`, `offset`.
- **Table allowlist + access rules** (`tables.ts`): admin (definitions/flags: public read, `X-Admin-Key` writes), user (private, JWT-scoped), public-user (leaderboard), shared (isPublic-aware), owner (userProfiles, row id == userId). `users` table only reachable via auth routes. `userId` always derived from the JWT — request-body values are overridden.
- **Auth** (`auth.ts`): anonymous, email/password register + login (PBKDF2-SHA256, WebCrypto), Google Sign-In (server-side ID-token verification, auto-link by verified email), `GET /api/auth/me`. JWT HS256, 30-day expiry. Anonymous `deviceId` upgrades **in place** on register/google — same userId, all data kept; afterwards anonymous re-auth for that id is refused.
- **Smoke-tested locally**: anonymous → register-upgrade (same userId, rows kept) → login → scoped reads; forged-userId override; wrong password 401; admin-key gating; JSON (`results`, `tags`) and boolean columns round-trip.

### Client
- `src/db/services/user-service.ts`: persisted anonymous userId (`mp:userId`) + auth token storage (`mp:authToken`) + `getAuthHeaders()`.
- Fixed: `getUserId()` previously generated a new UUID every page load.

### Tooling
- `pnpm dev:db` — worker on :8788 against local D1 (copy `.dev.vars.example` → `.dev.vars` once). **No mock needed**; remote D1 is production-only.
- `pnpm deploy:db`, `pnpm typecheck:db`.
- Init script now scopes `d1 create` to the worker config (wrangler was auto-injecting a D1 binding into the root `wrangler.jsonc`; reverted).

## Next steps

### 1. HybridAdapter — ✅ done
- `src/db/adapters/hybrid-adapter.ts`: `CLOUD_ENTITIES` set mirroring `workers/db-worker/src/tables.ts`; cloud entities → `ServerAdapter`, everything else → `DexieAdapter`. Unit-tested (`src/tests/hybrid-adapter.test.ts`).
- `src/db/services/auth-service.ts`: full auth client — `ensureAuth()` (silent anonymous bootstrap at startup, offline-tolerant), `registerWithPassword`, `loginWithPassword`, `loginWithGoogle(idToken)`, `logout`, `fetchMe`, client-side token-expiry check.
- `ServerAdapter` accepts a headers **getter**, so the Authorization header always reflects the current token.
- `src/db/index.ts`: `VITE_API_BASE_URL` set → HybridAdapter (with anonymous auth bootstrap); unset → all-Dexie as before. Setting `VITE_API_BASE_URL` is now safe.

### 2. Auth UI — ✅ done
`src/components/account/AccountSection.tsx`, mounted as the first Settings section:
- Signed-in state from `GET /api/auth/me`, provider badge, sign-out.
- Register/login forms (email + password ≥ 8 chars) passing `deviceId` so anonymous progress upgrades in place.
- Google button via GIS (script lazy-loaded, only when `GOOGLE_CLIENT_ID` set); shows a "stored on this device" note when no API is configured.
- Component tests in `src/components/__tests__/AccountSection.test.tsx`.

### 2a. Signed-out behaviour — ✅ done
Public content stays available without an account; personal data simply isn't tracked:
- Worker already serves public reads (definitions, leaderboard, profiles, public shares); only private per-user tables 401.
- `HybridAdapter` now guards user-scoped entities (`sessionRecords`, `challengeProgress`, `userBadges`, `userAchievements`, `userSettings`): signed out, reads resolve empty and writes fail fast — no doomed 401 round-trips.
- After signing out of an upgraded account, the device's anonymous re-auth is refused by design (403). `ensureAuth()` now remembers that (`mp:requiresLogin`) and stays quietly signed out instead of retrying/erroring at every startup; an explicit login clears it.
- `authVersion` signal (bumped on every token change) makes CommunityLeaderboard, CommunityShare, VocalChallenges and VocalAnalysis history reload when the signed-in identity changes — no full-page reload needed after login/logout.
- Fixed: streak-service and share-service resolved "my profile" via unfiltered `findAll()[0]`, which in cloud mode returns *other users'* public profiles. Now resolved by id (cloud profile id == userId) with a local fallback.

### 2b. Community/leaderboard/challenges review — ✅ done
Fixed: leaderboard ranks now recomputed from category metric on load (stored ranks went stale); leaderboard refetches on category switch (was mount-only); "you" row highlight uses the real persisted userId; broken Global tab count; CommunityShare "popular" sort no longer uses Math.random(), "highest" sort implemented, session search no longer matches unrelated sessions, profile identity unified on `getUserId()` + real streak from streak-service (was separate `pp_user_id` + hardcoded streak).
Tests: `src/tests/community-services.test.ts` (leaderboard/challenges/share/streak flows against an in-memory adapter), `src/tests/auth-service.test.ts`, `src/tests/utils/in-memory-db.ts` test double.
Known remaining mocks (intentional placeholders): Friends/Weekly leaderboard tabs, "Load More", follow buttons — need real backend social features first.

### 3. User actions (manual, one-time)
- [x] Google OAuth client ID — `144271507987-…ukkuq.apps.googleusercontent.com`, committed as a var in `workers/db-worker/wrangler.jsonc` and as `GOOGLE_CLIENT_ID` in `src/lib/defaults.ts` (public, not a secret). Verify authorized JS origins include `https://mercurypitch.com`, `https://dev.mercurypitch.com`, `http://localhost:3000`.
- [ ] Prod secrets (after first `pnpm deploy:db`):
  ```bash
  pnpm exec wrangler secret put JWT_SECRET --config workers/db-worker/wrangler.jsonc
  pnpm exec wrangler secret put ADMIN_KEY  --config workers/db-worker/wrangler.jsonc
  ```

### 4. Deploy — dev/prod environments
Separate workers + separate D1 databases per environment (mirrors app/jam-worker):

| Env | Worker | D1 database | Frontend |
|---|---|---|---|
| dev | `mercury-pitch-db-dev` | `mercurypitch-db-dev` | dev.mercurypitch.com via `VITE_API_BASE_URL` in `.env.development` |
| prod | `mercury-pitch-db` | `mercurypitch-db` (id `35d9bae5…`) | mercurypitch.com via prod env var |

**No custom-domain `/api/*` routes for the db-worker**: the main worker serves `/api/uvr/*` and `/api/share/*` on those domains and Cloudflare routes take precedence over custom domains, so a broad route would shadow them. The frontend talks to the worker's workers.dev URL cross-origin (CORS open, Bearer auth).

**One-time setup (run locally, before merging to main):**
```bash
pnpm db:init:dev          # create + schema mercurypitch-db-dev; commits its id into wrangler.jsonc
pnpm deploy:db:dev        # first deploy — prints the workers.dev URL
pnpm exec wrangler secret put JWT_SECRET --config workers/db-worker/wrangler.jsonc --env dev
pnpm exec wrangler secret put ADMIN_KEY  --config workers/db-worker/wrangler.jsonc --env dev
# put the printed URL into .env.development as VITE_API_BASE_URL and commit it
```

**Ongoing (automated):** `.github/workflows/deploy-db.yml` — on every push to main touching `workers/db-worker/**`, CI re-applies `schema.sql` to the remote dev DB (idempotent `CREATE IF NOT EXISTS` = the migration step) and deploys the dev worker. The existing `build.yml` then deploys the app (built with `.env.development`) to dev.mercurypitch.com. Prod: manual `workflow_dispatch` of deploy-db.yml with env=prod (after `pnpm db:init` + prod secrets, also one-time).

**Local testing (no deploy needed):**
```bash
pnpm dev:db                                        # worker on :8788 against LOCAL D1 (already initialized)
VITE_API_BASE_URL=http://localhost:8788 pnpm dev   # app on :3000 with HybridAdapter
```

### 5. Seed remote definitions — ✅ done
`pnpm db:seed -- --url <worker-url> --admin-key <key>` (scripts/seed-remote-db.mjs) seeds challenge/badge/achievement definitions from `src/db/seed-data.json` (single source shared with the local Dexie seeder). Idempotent — tables with rows are skipped. Verified against local D1. Definitions only; no per-user mock data goes to the cloud.

### 5b. Google Sign-In — ✅ redirect flow (2026-06-12)
The GIS/FedCM button was replaced entirely: FedCM worked in Chrome, but Firefox fell back to the popup flow, which our cross-origin-isolation headers (`COOP: same-origin`) break (`window.opener is null`). Google sign-in is now a **full-page OAuth redirect through the db-worker** (`GET /api/auth/google/start` → accounts.google.com → `GET /api/auth/google/callback` → code exchange with `GOOGLE_CLIENT_SECRET` → back to the app with `#gauth=<JWT>`). State is HMAC-signed (deviceId + returnTo, 10-min TTL), `returnTo` origins allowlisted, and the app's hash route is stashed/restored around the round-trip. The POST `/api/auth/google` idToken endpoint remains for future native clients.
Manual checks (user), in Google Cloud Console → the OAuth client's **Authorized redirect URIs** (JS origins no longer matter):
- [x] `http://localhost:8788/api/auth/google/callback` — local sign-in verified in Firefox.
- [ ] `https://mercury-pitch-db-dev.komediruzecki-2015.workers.dev/api/auth/google/callback` — needed for dev.mercurypitch.com.
- [ ] Prod worker callback URL — when prod deploys.
- [x] `GOOGLE_CLIENT_SECRET` secret set on the dev worker (and in `.dev.vars` locally).

### 5c. Account display name — ✅ done
Signed-in view shows the profile display name (gradient pill in the logo palette) with an inline editor — Google sign-in has no name prompt, so this is how Google users pick one. Saving updates the cloud profile and renames existing leaderboard entries; new leaderboard entries prefer the profile name over the generated `Singer-xxxxxx`. Fixed along the way: `getUserId()` now returns the JWT identity while signed in (device id only when signed out) — profile/leaderboard lookups were wrong for accounts that weren't an in-place upgrade of the current device.

### 6. dev.mercurypitch.com official test — checklist
One-time, in order (steps 1–3 need Cloudflare access). Done 2026-06-12:
- [x] 1. `pnpm db:init:dev` — created `mercurypitch-db-dev` (id `e00340be…`) + applied schema; id committed into `wrangler.jsonc`.
- [x] 2. `pnpm deploy:db:dev` — deployed: `https://mercury-pitch-db-dev.komediruzecki-2015.workers.dev`.
- [x] 3. Secrets set on the dev worker: `JWT_SECRET`, `ADMIN_KEY`, `GOOGLE_CLIENT_SECRET` (values documented in the user's personal notes, not in this repo).
- [x] 4. Definitions seeded (12 challenges, 8 badges, 7 achievements) via `scripts/seed-remote-db.mjs`.
- [x] 5. `VITE_API_BASE_URL` set in `.env.development` and committed. ⚠ Local `pnpm build:dev` is overridden by the gitignored `.env.development.local` (localhost) — deploy dev builds via CI, or prefix the env var explicitly.
- [ ] 6. Add the dev worker callback URL to the Google OAuth client (see 5b), then merge PR #91 to main — `deploy-db.yml` + `build.yml` take over (schema re-apply, worker deploy, app deploy to dev.mercurypitch.com).

Local stack for testing the same wiring without deploying (verified end-to-end 2026-06-12: anonymous bootstrap, register, Google sign-in, display name, signed-out browsing):
```bash
pnpm dev:db                                        # worker on :8788 (copy .dev.vars.example → .dev.vars once)
pnpm db:seed -- --url http://localhost:8788 --admin-key dev-admin-key
VITE_API_BASE_URL=http://localhost:8788 pnpm dev   # or use .claude/launch.json "app-with-cloud-db"
```

### 7. Later / nice-to-have
- **Prod rollout** (everything is dev-only so far): `pnpm db:init` (schema), `pnpm deploy:db:prod`, prod secrets (`JWT_SECRET`, `ADMIN_KEY` — use a strong unique key, `GOOGLE_CLIENT_SECRET`), seed definitions, add the prod worker callback URL to the Google OAuth client, set the prod build's `VITE_API_BASE_URL`.
- ~~`userSettings` consumer~~ — done (2026-06-12): settings-service syncs `pitchperfect_*` preference keys; pull on startup/auth change (cloud wins at sign-in), debounced write-through on change, inert when signed out / no API.
- ~~Server-side leaderboard ranking~~ — done: worker `GET /api/leaderboard` ranks by category metric with all-time/weekly periods, global/friends views (follows join), and limit/offset pagination. (Aggregating from raw `sessionRecords` instead of client-written `leaderboardEntries` remains a possible future hardening.)
- ~~Friends/Weekly tabs, Load More, follow buttons~~ — done: `follows` table + follow-service; Friends leaderboard, real weekly challenge cards (definitions + own progress), server pagination, wired follow/unfollow.
- Token refresh / longer sessions (current: 30-day JWT, silent sign-out at expiry); password reset flow (needs email provider).
- ~~Redirect-based Google sign-in fallback~~ — done; the redirect flow is now the only web flow (§5b).
- `melodyRecords` / `sessionTemplates` / `playlistRecords` to cloud — requires adding a `userId` column first.

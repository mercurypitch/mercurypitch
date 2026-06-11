# DB Integration — Status & Next Steps

Follow-up to [db-migration-plan.md](./db-migration-plan.md) and [users-auth-plan.md](./users-auth-plan.md). Snapshot of where the Cloudflare D1 integration stands as of 2026-06-11 and what comes next.

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

### 5. Seed remote definitions
Seed challenge/badge/achievement definitions to the remote DB via the CRUD API with `X-Admin-Key` (small script reusing `src/db/seed.ts` data against `ServerAdapter`).

### 6. Later / nice-to-have
- Leaderboard aggregation server-side (computed from `sessionRecords` instead of client-written `leaderboardEntries`).
- Token refresh / longer sessions; password reset flow (needs email provider).
- `melodyRecords` / `sessionTemplates` / `playlistRecords` to cloud — requires adding a `userId` column first.

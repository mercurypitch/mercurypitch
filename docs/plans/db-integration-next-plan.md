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

### 2. Auth UI
Settings → Account section:
- Signed-in state from `GET /api/auth/me`; logout = `setAuthToken(null)`.
- Register/login forms (email + password ≥ 8 chars), passing `deviceId: getUserId()` on register to keep existing data.
- "Continue with Google" via Google Identity Services (`google.accounts.id` → credential → `POST /api/auth/google { idToken, deviceId }`).

### 3. User actions (manual, one-time)
- [ ] Google Cloud Console → Credentials → OAuth client ID (Web application). Authorized JS origins: `https://mercurypitch.com`, `https://dev.mercurypitch.com`, `http://localhost:3000`. Put the id in `workers/db-worker/.dev.vars` and prod secret.
- [ ] Prod secrets:
  ```bash
  pnpm exec wrangler secret put JWT_SECRET --config workers/db-worker/wrangler.jsonc
  pnpm exec wrangler secret put ADMIN_KEY  --config workers/db-worker/wrangler.jsonc
  pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config workers/db-worker/wrangler.jsonc
  ```

### 4. Seed & deploy
- `pnpm deploy:db` → workers.dev URL becomes `VITE_API_BASE_URL` (custom-domain route later; must not shadow `/api/jam*` or the main worker's routes).
- Seed challenge/badge/achievement definitions to remote via the CRUD API with `X-Admin-Key` (small script reusing `src/db/seed.ts` data against `ServerAdapter`).

### 5. Later / nice-to-have
- Leaderboard aggregation server-side (computed from `sessionRecords` instead of client-written `leaderboardEntries`).
- Token refresh / longer sessions; password reset flow (needs email provider).
- `melodyRecords` / `sessionTemplates` / `playlistRecords` to cloud — requires adding a `userId` column first.

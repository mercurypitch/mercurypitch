# Cloudflare D1 Database Migration Plan

This plan outlines moving MercuryPitch's **cloud-relevant** data to a persistent Cloudflare D1 (SQLite) database, while keeping heavy karaoke/UVR data local on the user's device.

## 0. Architecture Decision (LOCKED IN)

**Hybrid storage split — no full migration, no sync of audio data:**

| Storage | Entities | Why |
|---|---|---|
| **Cloud (D1)** | `users` (new), `userProfiles`, `sessionRecords`, `challengeDefinitions`, `challengeProgress`, `badgeDefinitions`, `userBadges`, `achievements`, `userAchievements`, `leaderboardEntries`, `sharedMelodies`, `sharedSessions`, `featureFlags`, `userSettings` | Small, relational, needed cross-device: leaderboard, challenges, profiles, sharing. |
| **Local only (Dexie/IndexedDB)** | `uvrSessions`, `uvrStemBlobs`, `uvrStemFingerprints`, `uvrSessionLyrics`, `offlinePitchAnalysis`, `whisperTranscriptions`, `sessionGroups` | Audio blobs and derived analysis are huge (tens–hundreds of MB per song). Never synced; D1's 1 MB/row limit makes it impossible anyway. **No R2 bucket needed for now.** |
| **Local only (for now)** | `melodyRecords`, `sessionTemplates`, `playlistRecords` | Not yet in Dexie (entity types only). They lack a `userId` column — add one before any future cloud move. |

**Drizzle ORM: not needed.** The db-worker is a *generic* CRUD layer (`/api/:entity`) driven by an entity-name → table allowlist, which is exactly what the frontend `ServerAdapter` expects. Drizzle's value is per-table typed query builders — that would force per-entity route code and a build pipeline for zero gain here. Plain D1 prepared statements + the hand-maintained `schema.sql` (idempotent `CREATE IF NOT EXISTS`) are sufficient. Revisit only if the worker grows complex relational queries (e.g., computed leaderboards with joins).

**Adapter consequence:** because storage is split per-entity, the current all-or-nothing `resolveAdapter()` in `src/db/index.ts` must become a **HybridAdapter** that routes `getRepository(entityName)` to ServerAdapter (cloud entities) or DexieAdapter (local entities) based on a static map. UVR services keep working unchanged.

## 1. Setup — Initialize the D1 Database

Everything is scripted. Run:

```bash
pnpm db:init          # creates DB, patches wrangler.jsonc, applies schema remote + local
pnpm db:init:local    # local-only (no Cloudflare account needed, for wrangler dev)
```

The script (`scripts/init-cloudflare-db.sh`):
1. Creates `mercurypitch-db` via `wrangler d1 create` if it doesn't exist.
2. Writes the resulting `database_id` into `workers/db-worker/wrangler.jsonc`.
3. Applies `workers/db-worker/schema.sql` with `--remote` and `--local`.

Prerequisite: `pnpm exec wrangler login` (same account as the existing workers).

## 2. Remaining Steps

### Step A: Implement the DB Worker (`workers/db-worker/src/index.ts`)
Hono-based worker binding `DB` (D1), implementing the `ServerAdapter` contract:
- `GET /api/:entity` (supports `where[field]`, `orderBy`, `orderDir`, `limit`, `offset`)
- `GET /api/:entity/count`, `GET /api/:entity/:id`
- `POST /api/:entity`, `PATCH /api/:entity/:id`, `DELETE /api/:entity/:id`
- Entity names validated against a hard allowlist (the 14 cloud tables) — everything else 404s. This is the SQL-injection guard for table names.
- No R2 binding (blobs stay local).

### Step B: Users & Auth
See **[users-auth-plan.md](./users-auth-plan.md)**. Summary: anonymous-first users (device UUID exchanged for a signed JWT), upgradeable to real accounts later; worker enforces `userId` scoping from the token, not from the request body.

### Step C: HybridAdapter (frontend)
- `CLOUD_ENTITIES` set in `src/db/index.ts`; route repositories accordingly.
- `ServerAdapter` already accepts `headers` in its config — use it for `Authorization: Bearer <jwt>`.
- Activated only when `VITE_API_BASE_URL` is set; otherwise everything stays Dexie (current behavior, good for offline/dev).

### Step D: Seeding base data
`src/db/seed.ts` already populates challenges/badges/achievements idempotently via the adapter interface, so seeding the cloud DB = running `seedAll()` against the ServerAdapter once (small admin script or worker endpoint). User-scoped seeds (default profile, challenge progress) move to user-creation time in the worker.

### Step E: Deployment
- Add `deploy:db:dev` / `deploy:db:prod` scripts mirroring jam-worker.
- Start with the `workers.dev` URL as `VITE_API_BASE_URL`; custom-domain route (e.g. `mercurypitch.com/api/*`) later — needs care not to shadow `/api/jam*` (jam-worker) and existing main-worker routes.

## 3. Status

- [x] Cloud/local split decided
- [x] `schema.sql` (cloud tables only + `users` table)
- [x] `workers/db-worker/wrangler.jsonc` with D1 binding
- [x] Init script `scripts/init-cloudflare-db.sh` (`pnpm db:init`)
- [ ] You run `pnpm db:init` (requires wrangler login)
- [ ] DB worker implementation (Step A)
- [ ] Auth (Step B — see users-auth-plan.md)
- [ ] HybridAdapter (Step C)
- [ ] Seeding + deploy (Steps D–E)

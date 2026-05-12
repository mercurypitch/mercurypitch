# Database Abstraction Layer Implementation Plan

## Context

MercuryPitch has 4 hidden features gated behind `IS_DEV` (Community Share, Leaderboard, Challenges, Analysis) that are either 100% mock data or localStorage-only. There is no database abstraction layer — components call `localStorage` directly. This plan adds Dexie.js (IndexedDB wrapper) as the default adapter behind a swappable `DatabaseAdapter` interface, wires the hidden features through it with real sample data, and stubs a server/SQL adapter for future production use.

## Design Decisions

- **Dexie.js** for IndexedDB adapter — lightweight (~20KB gzipped), first-class TypeScript support, well-maintained
- **Repository pattern** — `DatabaseAdapter.getRepository<T>(name)` returns `Repository<T>` with CRUD + query
- **No migrations** — start fresh with IndexedDB, no legacy localStorage migration
- **Server adapter stub** — matches the same interface for eventual SQLite/PostgreSQL backend
- **Seed data** — mock challenge/badge/achievement/leaderboard data seeded into DB on first load
- **SolidJS signals** — repositories that should be reactive are wrapped in `createSignal` at the service layer, not inside the DB layer

## Implementation Phases (7 tasks)

### Task 1: Install Dexie.js and create DB core types
**Files to create:**
- `src/db/types.ts` — `DbEntity`, `QueryOptions<T>`, `Repository<T>`, `DatabaseAdapter` interfaces
- `src/db/entities.ts` — all entity interfaces (see below)

**Entities:** `UserProfile`, `SessionRecord`, `ChallengeDefinition`, `ChallengeProgress`, `BadgeDefinition`, `UserBadge`, `Achievement`, `UserAchievement`, `LeaderboardEntry`, `SharedMelody`, `SharedSession`, `FeatureFlag`

### Task 2: Implement DexieAdapter
**File:** `src/db/adapters/dexie-adapter.ts`

- Define Dexie database schema with tables for each entity
- Implement `DexieAdapter` class conforming to `DatabaseAdapter`
- Index key fields: `userId`, `category`, `challengeId`, `badgeId`, `isPublic`
- Transaction support via Dexie's `transaction()`
- Each table gets a `DexieRepository<T>` implementing `Repository<T>`

### Task 3: Implement ServerAdapter stub
**File:** `src/db/adapters/server-adapter.ts`

- HTTP adapter matching `DatabaseAdapter` interface
- Uses `fetch()` for CRUD operations against a REST API
- Configurable base URL
- Each repo maps to `GET/POST/PATCH/DELETE /api/<entity>`

### Task 4: Create DB factory + replace feature flags
**File:** `src/db/index.ts`

- `createDatabase()` factory — returns DexieAdapter in dev, selectable in production
- `initDatabase()` — creates adapter, seeds sample data, returns ready instance
- Singleton `dbPromise` for app-wide use

**Files to modify:**
- `src/stores/app-store.ts` — replace localStorage boolean flags with `db.getRepository('feature_flags')` calls

### Task 5: Seed sample data into IndexedDB
**File:** `src/db/seed.ts`

- Move mock arrays from components into seed functions
- `seedChallengeDefinitions()` — 12 challenge definitions
- `seedBadgeDefinitions()` — 8 badge definitions
- `seedAchievementDefinitions()` — 7 achievement definitions
- `seedLeaderboardData()` — 10 sample users with computed scores
- `seedUserProfile()` — default user profile
- Called once via `initDatabase()` with a "seeded" flag check

### Task 6: Wire hidden feature components through DB
**Files to modify:**
- `src/components/VocalChallenges.tsx` — read challenge/badge/achievement definitions from DB; read/write progress through DB
- `src/components/CommunityLeaderboard.tsx` — read leaderboard from DB; compute rankings from `session_records`
- `src/components/CommunityShare.tsx` — read/write shared melodies/sessions through DB; read user profile from DB
- `src/components/VocalAnalysis.tsx` — read session records from DB (write session results to DB when sessions complete)

### Task 7: Wire session history through DB
**Files to modify:**
- `src/stores/practice-session-store.ts` — dual-write: continue writing to `sessionResults` signal AND write to `db.getRepository('session_records')`

## Verification

1. `npm run typecheck` — no type errors
2. `npm run test:run` — existing tests pass
3. `npm run dev` — app loads, IndexedDB initializes in browser DevTools
4. Navigate to each hidden feature tab — data loads from IndexedDB, not hardcoded arrays
5. Open DevTools > Application > IndexedDB > MercuryPitchDB — all tables visible with seed data
6. Complete a practice session — session record appears in IndexedDB
7. Toggle feature flags — persisted in IndexedDB, survives page reload

---

## Melody Library Migration — Future Phase (Estimate)

### Current State

The melody library (`src/stores/melody-store.ts`, 40.9K) stores everything in a single localStorage key `pitchperfect_library` as a large `UnifiedLibrary` JSON blob. This hits the 5MB localStorage cap quickly for users with many melodies, sessions, and playlists.

### What needs to migrate

| Data | Current Storage | Size Concern |
|------|----------------|-------------|
| Melodies (`Record<string, MelodyData>`) | `pitchperfect_library` | High — melody items are large arrays |
| Sessions (`Record<string, PlaybackSession>`) | `pitchperfect_library` | Medium — session items + settings |
| Playlists (`Record<string, Playlist>`) | `pitchperfect_library` | Low — just name + melody refs |
| Library metadata + render settings | `pitchperfect_library` | Low |
| Session history | `pitchperfect_session_history` | Medium (capped at 50 entries) |
| Active session ID | `pitchperfect_active_session_id` | Trivial |
| Current melody ID | `pitchperfect_current_melody_id` | Trivial |

### Prepared Entities (already in design)

The following entities in `src/db/entities.ts` are designed to eventually replace the melody library:

- `MelodyRecord extends DbEntity` — `{ id, name, author?, bpm, key, scaleType, octave?, items: MelodyItem[], tags?, notes?, playCount?, isDeleted? }`
- `SessionTemplate extends DbEntity` — `{ id, name, difficulty?, category?, description?, items: SessionItem[], isDeleted? }`
- `PlaylistRecord extends DbEntity` — `{ id, name, melodyIds: string[], description? }`

These are NOT yet implemented as Dexie tables (saving ~50KB bundle size for now) but the entity types are ready for when we add them.

### Effort Estimate

| Step | Effort | Description |
|------|--------|-------------|
| Add MelodyRecord/SessionTemplate/PlaylistRecord tables to DexieAdapter | Small (~30 min) | 3 new Dexie tables |
| Write migration from `pitchperfect_library` JSON → IndexedDB | Medium (~1.5 hr) | One-time migration reading legacy key, splitting into tables |
| Refactor melody-store.ts to use DB repositories | Large (~3-4 hr) | Replace manual `_saveLibraryToStorage()` JSON with repository CRUD; update all 40+ melody operations |
| Remove `createPersistedSignal` for library signals | Small (~30 min) | Replace with signals hydrated from DB on app init |
| Test full melody CRUD, playback, editing | Medium (~1 hr) | Manual testing + existing tests |
| **Total** | **~6-8 hours** | | 

### Preparation (done now)

- `MelodyRecord`, `SessionTemplate`, `PlaylistRecord` entity types ready in `src/db/entities.ts`
- DexieAdapter can accept additional table definitions at construction time
- ServerAdapter can route new entity names automatically


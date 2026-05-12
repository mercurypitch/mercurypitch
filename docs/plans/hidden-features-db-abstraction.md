# Hidden Features & Database Abstraction Layer — Analysis & Implementation Plan

**Date**: 2026-05-10
**Branch**: `feat/hidden-features-db-abstraction`
**Status**: Analysis complete — ready for phased implementation

---

## 1. Executive Summary

PitchPerfect has four feature areas gated behind `IS_DEV` (`src/lib/defaults.ts`) and two runtime feature flags (`advancedFeaturesEnabled`, `devFeaturesEnabled` in `src/stores/app-store.ts`). Under `IS_DEV`, both flags default to `true`, making all hidden features visible.

**Key finding**: None of the hidden features are wired to a server, database, or remote API. All persistence is ad-hoc `localStorage`. Two components are 100% mock data. One is semi-wired with localStorage-backed progress. One derives analysis from session history (also localStorage). There is zero database abstraction — every component calls `localStorage` directly.

| Feature | Component | Data Source | Wired? |
|---------|-----------|-------------|--------|
| Community → Leaderboard | `CommunityLeaderboard.tsx` (866 lines) | 100% hardcoded mock arrays | **No** |
| Community → Share | `CommunityShare.tsx` (975 lines) | localStorage (`pp_shared_*`) | **No** |
| Community → Challenges | `VocalChallenges.tsx` (1657 lines) | localStorage (`pp_challenge_progress`) | **Semi** |
| Analysis / Spectrum | `VocalAnalysis.tsx` (820 lines) | localStorage session history | **No** |

---

## 2. Current State Per Feature

### 2.1 Community Leaderboard (`CommunityLeaderboard.tsx`)

**Gating**: `advancedFeaturesEnabled()` — Social group → Leaderboard tab.

**Three views**: Global, Friends, Weekly. Five categories: Overall, Best Score, Accuracy, Streak, Sessions.

**Data sources** (all hardcoded):
- `mockLeaderboardUsers`: 9 users with fixed names, avatars, scores (line ~50-130)
- `weeklyChallengesData`: 4 challenge results with fixed ranks
- Current user identified by `userId === 'me'` at rank 42

**Features built**: Podium (top 3), searchable table with column sort, user profile modal, category switching, view switching (Global/Friends/Weekly). All UI is polished and production-grade.

**Gaps**:
- Users are static objects — no concept of user identity, authentication, or profile sync
- Rankings are fabricated — no aggregation pipeline exists
- "Friends" view has no friend graph or social connections
- Weekly challenges never update — no scheduling or rotation
- No real-time or periodic refresh — data is frozen at compile time

### 2.2 Community Share (`CommunityShare.tsx`)

**Gating**: `advancedFeaturesEnabled()` — Social group → Share tab (default).

**Three tabs**: Melodies, Sessions, Profile.

**Data sources** (localStorage only):
- `pp_shared_melodies` — melody exports (`exportMelody()` reads `melodyStore.currentMelody()`)
- `pp_shared_sessions` — session exports (`exportSession()` reads `appStore.getSessionHistory()`)
- `pp_user_id` — generated user ID string

**Features built**: Export melodies/sessions to "shared" library, delete shared items, copy share links (`{baseUrl}/#/share?type={type}&id={id}`), profile tab with hardcoded displayName "SingerPro" and stats from session history.

**Gaps**:
- Share links don't resolve — `#/share?...` route is not implemented for loading shared content
- No actual sharing/publishing — data stays in localStorage of the exporting device
- No discovery mechanism — can't browse others' shared content
- Profile is local-only with a hardcoded display name

### 2.3 Vocal Challenges (`VocalChallenges.tsx`)

**Gating**: `advancedFeaturesEnabled()` — Social group → Challenges tab.

**Five categories**: high-notes, low-notes, speed, perfect, scales.

**Data sources**:
- 12 hardcoded challenges (line ~55-200)
- 8 hardcoded badges (line ~210-280)
- 7 hardcoded achievements (line ~290-360)
- `pp_challenge_progress` localStorage key for user progress (`updateChallengeProgress()`)
- Badge/achievement unlock computed from `getSessionHistory()`: totalSessions, bestScore, streak, highNoteCount

**Features built**: Challenge cards with progress bars, category filtering, challenge detail modal with practice simulation, badges grid with locked/unlocked state, achievements list.

**Gaps**:
- Challenge definitions are static — no server-side content management
- Badge/achievement thresholds are hardcoded — no tuning without redeploy
- Challenge progress is local only — lost if localStorage is cleared
- No social proof — can't see friends' challenge progress
- Practice simulation is UI-only (doesn't verify actual singing)

### 2.4 Vocal Analysis / Spectrum (`VocalAnalysis.tsx`)

**Gating**: `advancedFeaturesEnabled()` — enables Analysis tab in navbar.

**Data sources**:
- `getSessionHistory()` from `practice-session-store.ts` (localStorage-persisted via `createPersistedSignal`)
- All analysis is synthetic/simulated — `startAnalysis()` builds `SpectrumData[]` with `freq = score * 20`, `amplitude = Math.abs(avgCents) * 3`
- Exercise checks (`checkBelting()`, `checkFalsetto()`, `checkDynamics()`) use heuristic rules on pitch data
- Streak computed from session history date gaps; weekly scores from day-of-week grouping

**Features built**: Pitch accuracy scatter chart, spectrum bar chart (color-coded by range), session history list with filter/search, streak tracker, weekly trend chart, exercise recommendations based on heuristic analysis, PDF export (client-side).

**Gaps**:
- Spectrum is fake — no real FFT or frequency analysis (uses score * 20 as fake frequency)
- Analysis quality depends entirely on session history quality (localStorage, max 50 entries)
- No server-side aggregation for cross-device or long-term trends
- Exercise recommendations are heuristic, not ML-based
- PDF export is client-only — no server-side report generation

---

## 3. Current Persistence Map

All `localStorage` keys used across the app (hidden features highlighted):

| Key | Location | Purpose | Hidden Feature? |
|-----|----------|---------|-----------------|
| `pp_shared_melodies` | `CommunityShare.tsx` | Exported melodies | Yes |
| `pp_shared_sessions` | `CommunityShare.tsx` | Exported sessions | Yes |
| `pp_user_id` | `CommunityShare.tsx` | User identifier | Yes |
| `pp_challenge_progress` | `VocalChallenges.tsx` | Challenge completion | Yes |
| `pitchperfect_advanced_features` | `app-store.ts` | Feature flag | Yes |
| `pitchperfect_dev_features` | `app-store.ts` | Feature flag | Yes |
| `pitchperfect_uvr_sessions` | `app-store.ts` | UVR sessions | Yes |
| `pitchperfect_uvr-settings` | `app-store.ts` | UVR config | Yes |
| `pitchperfect_walkthrough_done` | `app-store.ts` | Walkthrough state | — |
| `pitchperfect_guide_sections` | `app-store.ts` | Guide progress | — |
| `STORAGE_KEY_SESSION_HIST` | `practice-session-store.ts` | Session results | — (used by Analysis) |
| Theme/settings keys | `settings-store.ts`, `theme-store.ts` | App preferences | — |

---

## 4. Database Abstraction Layer — API Design

### 4.1 Design Principles

1. **Async-first**: All methods return `Promise<T>` to allow IndexedDB / D1 / server adapters
2. **Entity-based**: One repository per entity type, not per component
3. **Adapter pattern**: Single `DatabaseAdapter` interface — swap implementations without changing callers
4. **Migration support**: Versioned schemas so adapters can evolve independently
5. **No ORM**: Plain TypeScript interfaces, explicit queries — no query builder needed at this scale

### 4.2 Core Interface

```typescript
// src/db/types.ts

/** Every persisted entity carries these fields. */
export interface DbEntity {
  id: string
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
}

/** Generic CRUD repository for one entity type. */
export interface Repository<T extends DbEntity> {
  findById(id: string): Promise<T | null>
  findAll(opts?: QueryOptions<T>): Promise<T[]>
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>
  update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>
  delete(id: string): Promise<void>
  count(opts?: QueryOptions<T>): Promise<number>
}

export interface QueryOptions<T> {
  where?: Partial<T>
  orderBy?: keyof T
  orderDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/** Top-level database handle passed to app init. */
export interface DatabaseAdapter {
  /** Return a typed repository for the given entity. */
  getRepository<T extends DbEntity>(entityName: string): Repository<T>

  /** Bulk operations for sync/import scenarios. */
  transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R>

  /** Schema version — adapters use this for migrations. */
  readonly schemaVersion: number
}
```

### 4.3 Entity Definitions

```typescript
// src/db/entities.ts

// ── User & Profile ──────────────────────────────────────────────
export interface UserProfile extends DbEntity {
  displayName: string
  avatarUrl?: string
  bio?: string
}

// ── Sessions & Results ──────────────────────────────────────────
export interface SessionRecord extends DbEntity {
  userId: string
  melodyId: string
  melodyName: string
  startedAt: string
  endedAt: string
  score: number            // 0-100
  accuracy: number         // 0-100
  notesHit: number
  notesTotal: number
  streak: number
  results: PracticeResultRecord[]  // denormalised for query performance
}

export interface PracticeResultRecord {
  noteIndex: number
  noteName: string
  octave: number
  cents: number
  hit: boolean
  score: number
}

// ── Challenges ──────────────────────────────────────────────────
export interface ChallengeDefinition extends DbEntity {
  category: 'high-notes' | 'low-notes' | 'speed' | 'perfect' | 'scales'
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  target: number          // e.g. target score, target streak
  rewardBadgeId?: string
  isActive: boolean
}

export interface ChallengeProgress extends DbEntity {
  userId: string
  challengeId: string
  progress: number         // 0-100
  completed: boolean
  completedAt?: string
  bestScore?: number
  attempts: number
}

// ── Badges & Achievements ───────────────────────────────────────
export interface BadgeDefinition extends DbEntity {
  name: string
  description: string
  icon: string             // emoji or icon name
  category: string
  unlockCondition: string  // human-readable, e.g. "Score 95+ on 5 sessions"
}

export interface UserBadge extends DbEntity {
  userId: string
  badgeId: string
  unlockedAt: string
}

export interface Achievement extends DbEntity {
  name: string
  description: string
  icon: string
  condition: string
}

export interface UserAchievement extends DbEntity {
  userId: string
  achievementId: string
  progress: number         // 0-100
  unlockedAt?: string
}

// ── Leaderboard ─────────────────────────────────────────────────
export interface LeaderboardEntry extends DbEntity {
  userId: string
  displayName: string
  avatarUrl?: string
  category: 'overall' | 'bestScore' | 'accuracy' | 'streak' | 'sessions'
  rank: number
  score: number
  period: 'all-time' | 'weekly' | 'monthly'
}

// ── Shared Content ──────────────────────────────────────────────
export interface SharedMelody extends DbEntity {
  userId: string
  melodyId: string
  melodyName: string
  melodyData: string       // serialised MelodyData
  isPublic: boolean
}

export interface SharedSession extends DbEntity {
  userId: string
  sessionId: string
  melodyName: string
  score: number
  accuracy: number
  results: PracticeResultRecord[]
  isPublic: boolean
}

// ── Social Graph ────────────────────────────────────────────────
export interface FriendConnection extends DbEntity {
  userId: string
  friendId: string
  status: 'pending' | 'accepted' | 'blocked'
}

// ── Feature Flags & Settings ────────────────────────────────────
export interface FeatureFlag extends DbEntity {
  key: string
  value: boolean
}

export interface UserSetting extends DbEntity {
  userId: string
  key: string
  value: string             // JSON-serialised
}
```

### 4.4 Repository Map (Entity → Component)

| Repository | Consumed By |
|------------|-------------|
| `UserProfile` | CommunityShare (Profile tab), CommunityLeaderboard, Auth (future) |
| `SessionRecord` | VocalAnalysis, CommunityShare (export), CommunityLeaderboard (stats) |
| `ChallengeDefinition` | VocalChallenges |
| `ChallengeProgress` | VocalChallenges |
| `BadgeDefinition` | VocalChallenges |
| `UserBadge` | VocalChallenges, CommunityLeaderboard (profile modal) |
| `Achievement` | VocalChallenges |
| `UserAchievement` | VocalChallenges, CommunityLeaderboard |
| `LeaderboardEntry` | CommunityLeaderboard |
| `SharedMelody` | CommunityShare |
| `SharedSession` | CommunityShare |
| `FriendConnection` | CommunityLeaderboard (Friends view) |
| `FeatureFlag` | app-store.ts, SettingsPanel |
| `UserSetting` | settings-store.ts, theme-store.ts |

---

## 5. Adapter Strategy

### 5.1 Phase 1: LocalStorage Adapter (immediate)

Wrap existing localStorage calls behind the `DatabaseAdapter` interface. Zero new dependencies. All data stays client-side. This gives us the abstraction layer without changing behaviour.

**Implementation**: `src/db/adapters/localstorage-adapter.ts`
- `getRepository()` returns a repository that JSON-serialises to `db_<entityName>_<id>` keys
- `findAll()` scans all matching keys — acceptable for current data volumes (< 1000 records)
- No transactions (localStorage is synchronous and single-tab)

### 5.2 Phase 2: IndexedDB Adapter (local-first)

Replace localStorage with IndexedDB for better query performance and larger storage. Use a thin wrapper (no Dexie.js dependency — keep it simple). Transactions become real.

**Implementation**: `src/db/adapters/indexeddb-adapter.ts`
- One object store per entity type
- Indexes on `userId`, `category`, `period` for common queries
- Proper transaction support for atomic writes

### 5.3 Phase 3: Server Adapter (production)

Back the same interface with a remote API (Cloudflare D1 + Workers, or similar). The adapter becomes an HTTP client — same Repository interface, different transport.

**Implementation**: `src/db/adapters/server-adapter.ts`
- `findAll()` → `GET /api/<entity>?where=...&limit=...`
- `create()` → `POST /api/<entity>`
- `update()` → `PATCH /api/<entity>/:id`
- `delete()` → `DELETE /api/<entity>/:id`
- Auth token from header/session

### 5.4 Adapter Selection

```typescript
// src/db/index.ts
import { IS_DEV } from '@/lib/defaults'

export async function createDatabase(): Promise<DatabaseAdapter> {
  if (IS_DEV) {
    const { LocalStorageAdapter } = await import('./adapters/localstorage-adapter')
    return new LocalStorageAdapter()
  }
  // Phase 3: return new ServerAdapter(authToken)
  const { LocalStorageAdapter } = await import('./adapters/localstorage-adapter')
  return new LocalStorageAdapter()
}
```

---

## 6. Existing Data Migrations

When switching adapters, existing localStorage data must be migrated:

| Key | Entity | Migration |
|-----|--------|-----------|
| `STORAGE_KEY_SESSION_HIST` | `SessionRecord[]` | Map each `SessionResult` → `SessionRecord` with generated IDs |
| `pp_challenge_progress` | `ChallengeProgress[]` | Direct map, add `id` + timestamps |
| `pp_shared_melodies` | `SharedMelody[]` | Direct map, add `id` + timestamps |
| `pp_shared_sessions` | `SharedSession[]` | Direct map, add `id` + timestamps |
| `pp_user_id` | `UserProfile.id` | Use as `UserProfile.id` |
| `pitchperfect_advanced_features` | `FeatureFlag` | One row with `key='advanced_features'` |
| `pitchperfect_dev_features` | `FeatureFlag` | One row with `key='dev_features'` |

The `LocalStorageAdapter` should read from legacy keys on first access and migrate transparently.

---

## 7. Phased Implementation Plan

### Phase 1 — Database Abstraction Layer (no behaviour change)

**Goal**: Create the interface + localStorage adapter. Wire all hidden features through it. Zero UX change.

**Task 1.1**: Create `src/db/` directory structure
- `src/db/types.ts` — `DbEntity`, `Repository<T>`, `QueryOptions<T>`, `DatabaseAdapter`
- `src/db/entities.ts` — all entity interfaces from section 4.3
- `src/db/index.ts` — `createDatabase()` factory, singleton `db` instance

**Task 1.2**: Implement `LocalStorageAdapter`
- `src/db/adapters/localstorage-adapter.ts`
- All CRUD operations serialise to `db_<entity>_<id>` keys
- Entity collections tracked under `db_<entity>_index` key for `findAll` without scanning all of localStorage
- Legacy key migration on first access for session history, challenge progress, shared content

**Task 1.3**: Wire `VocalAnalysis.tsx` through `db.getRepository('session_records')`
- Replace `getSessionHistory()` calls with repository queries
- Keep `practice-session-store.ts` writing to localStorage for now (Phase 2)
- Add a sync step: after session completes, write to both old store AND db repository

**Task 1.4**: Wire `VocalChallenges.tsx` through `db` repositories
- Challenge definitions → `db.getRepository('challenge_definitions')`
- Challenge progress → `db.getRepository('challenge_progress')`
- Badges → `db.getRepository('badge_definitions')` + `db.getRepository('user_badges')`
- Achievements → `db.getRepository('achievements')` + `db.getRepository('user_achievements')`
- Seed challenge/badge/achievement definitions from current hardcoded arrays on first run

**Task 1.5**: Wire `CommunityShare.tsx` through `db` repositories
- Shared melodies → `db.getRepository('shared_melodies')`
- Shared sessions → `db.getRepository('shared_sessions')`
- Profile → `db.getRepository('user_profiles')`

**Task 1.6**: Create `LeaderboardService` backed by real session data
- Compute leaderboard entries from `SessionRecord` repository
- Aggregate by category: overall (avg score), bestScore (max), accuracy (avg), streak (max), sessions (count)
- Replace hardcoded `mockLeaderboardUsers` with computed rankings
- Weekly view: filter sessions within current week
- Friends view: stub until social graph exists

**Task 1.7**: Wire feature flags through `db` repository
- Replace direct localStorage calls in `app-store.ts` for `advancedFeaturesEnabled` / `devFeaturesEnabled`
- Use `db.getRepository('feature_flags')`

---

### Phase 2 — Shared Content Resolution

**Goal**: Make `#/share?type=melody&id=<id>` routes actually load shared content.

**Task 2.1**: Implement `ShareResolver` component / route handler
- Parse URL hash for `type` and `id` parameters
- Load from `db.getRepository('shared_melodies')` or `db.getRepository('shared_sessions')`
- Display imported melody/session with attribution

**Task 2.2**: Add "Import to My Library" action on shared content view

---

### Phase 3 — IndexedDB Adapter

**Goal**: Replace localStorage adapter with IndexedDB for better query performance.

**Task 3.1**: Implement `IndexedDBAdapter`
- One object store per entity
- Indexes: `userId`, `category`, `period`, `challengeId`, `badgeId`
- Transaction support

**Task 3.2**: Auto-migrate data from localStorage to IndexedDB on first load

---

### Phase 4 — Server Adapter + Production Features

**Goal**: Back the DB layer with a real server API. Enable multi-device sync and social features.

**Task 4.1**: Design and implement server API matching the Repository interface

**Task 4.2**: Implement `ServerAdapter` HTTP client

**Task 4.3**: User authentication (OAuth or email/pass)

**Task 4.4**: Friend graph — connect, accept, block

**Task 4.5**: Real-time leaderboard with periodic refresh

**Task 4.6**: Challenge rotation and server-side content management

---

## 8. Migration Strategy Per Component

When each component is wired to the DB layer, the old localStorage keys become legacy. The `LocalStorageAdapter` handles reading legacy keys transparently and writing to the new format. Once all components are migrated (end of Phase 1), a cleanup task removes the legacy key reads.

| Component | Current | Phase 1 Target | Legacy Key Dropped |
|-----------|---------|----------------|--------------------|
| `VocalAnalysis.tsx` | `getSessionHistory()` → `sessionResults()` | `db.getRepository('session_records').findAll({ where: { userId } })` | Phase 2 |
| `VocalChallenges.tsx` | `localStorage.getItem('pp_challenge_progress')` | `db.getRepository('challenge_progress').findAll()` | Phase 1 |
| `CommunityShare.tsx` | `localStorage.getItem('pp_shared_melodies')` | `db.getRepository('shared_melodies').findAll()` | Phase 1 |
| `CommunityLeaderboard.tsx` | Hardcoded `mockLeaderboardUsers` | `LeaderboardService.getRankings()` → `db.getRepository('session_records')` | Phase 1 |
| `app-store.ts` (flags) | `localStorage.getItem('pitchperfect_*')` | `db.getRepository('feature_flags').findById()` | Phase 1 |

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing session persistence | Medium | High | Dual-write during transition; feature flag to rollback |
| localStorage quota for IndexedDB migration | Low | Medium | Track data sizes; prompt user if > 50MB |
| Type mismatch between old localStorage format and new entities | Medium | Medium | Exhaustive migration tests for each legacy key |
| Performance regression from async DB calls in render loops | Low | Medium | CreateSolid signals from repository results; avoid direct `await` in components |
| Adapter interface too rigid for server API | Low | High | Design server adapter first (even if not built), then backport to localStorage |

---

## 10. Success Criteria

1. **No component directly accesses localStorage** — all persistence through `db` instance
2. **Adapter can be swapped** — changing one import switches from localStorage to IndexedDB to server
3. **Leaderboard shows real data** — rankings computed from actual session records, not mock arrays
4. **Share links resolve** — `#/share?type=melody&id=X` loads and displays the shared content
5. **Cross-session persistence** — challenge progress, badges, and achievements survive page reloads via the DB layer
6. **Type safety** — all entity operations are fully typed, no `any` casts

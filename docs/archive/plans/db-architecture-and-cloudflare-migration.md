# DB Architecture & Cloudflare Migration Assessment

Date: 2026-05-28 | Branch: `feat/issue-63-singing-exercises`

## 1. Current Architecture

The database layer lives in `src/db/` and follows a clean **adapter pattern**:

```
src/db/
  types.ts              — DatabaseAdapter, Repository<T>, QueryOptions<T>, DbEntity interfaces
  entities.ts           — 20 entity type definitions
  index.ts              — Factory (createDatabase, getDb, resetDatabase)
  seed.ts               — Sample data seeding (challenges, badges, achievements)
  adapters/
    dexie-adapter.ts    — IndexedDB implementation (16 Dexie tables)
    server-adapter.ts   — REST/HTTP implementation (already written, not yet wired)
  services/
    session-service.ts         — Practice session CRUD
    streak-service.ts          — Practice streak tracking
    challenges-service.ts      — Challenges, badges, achievements
    leaderboard-service.ts     — Leaderboard entries
    share-service.ts           — Community shared melodies/sessions
    uvr-service.ts             — UVR session & stem blob management
    pitch-analysis-service.ts  — Offline pitch analysis cache
```

### Adapter Interface

```ts
interface Repository<T extends DbEntity> {
  findById(id: string): Promise<T | null>
  findAll(opts?: QueryOptions<T>): Promise<T[]>
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>
  update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>
  delete(id: string): Promise<void>
  count(opts?: QueryOptions<T>): Promise<number>
}

interface DatabaseAdapter {
  getRepository<T>(entityName: string): Repository<T>
  transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R>
  readonly schemaVersion: number
  destroy(): Promise<void>
}
```

### Adapter Selection (NEW — implemented 2026-05-28)

```ts
// src/db/index.ts
function resolveAdapter(): DatabaseAdapter {
  if (API_BASE_URL) {
    return new ServerAdapter({ baseUrl: API_BASE_URL })
  }
  return new DexieAdapter()  // default
}
```

Set `VITE_API_BASE_URL` to switch to server mode. Default is local Dexie.

## 2. IndexedDB Tables (16 tables, all through DexieAdapter)

| Table | Entity | Key Fields |
|-------|--------|------------|
| `userProfiles` | UserProfile | displayName, avatarUrl, currentStreak |
| `sessionRecords` | SessionRecord | userId, melodyId, score, accuracy, results[] |
| `challengeDefinitions` | ChallengeDefinition | category, difficulty, targetScore |
| `challengeProgress` | ChallengeProgress | userId, challengeId, status, attempts |
| `badgeDefinitions` | BadgeDefinition | name, tier, category |
| `userBadges` | UserBadge | userId, badgeId, earnedAt |
| `achievements` | Achievement | name, points, condition |
| `userAchievements` | UserAchievement | userId, achievementId, progress |
| `leaderboardEntries` | LeaderboardEntry | userId, category, period, rank, score |
| `sharedMelodies` | SharedMelody | userId, melodyId, author, tags |
| `sharedSessions` | SharedSession | userId, sessionId, author, score |
| `featureFlags` | FeatureFlag | key, value |
| `userSettings` | UserSetting | userId, key, value |
| `melodyRecords` | MelodyRecord | name, author, bpm, key, itemsJson |
| `sessionTemplates` | SessionTemplate | name, difficulty, category |
| `uvrSessions` | UvrSessionRecord | fileHash, status, processingMode |
| `uvrStemBlobs` | UvrStemBlob | sessionId, stemType, data (ArrayBuffer) |
| `uvrStemFingerprints` | UvrStemFingerprint | sessionId, fingerprintJson |
| `offlinePitchAnalysis` | OfflinePitchAnalysisRecord | fileHash, analysisResultsJson |
| `playlistRecords` | PlaylistRecord | name, melodyIds |

All 20 entity types use the adapter. No store or component reaches around the adapter to IndexedDB directly.

### Duplicated data: UVR sessions

`uvrSessions` data is stored in BOTH IndexedDB (via db services) **and** localStorage (`pitchperfect_uvr_sessions`). This is a known duplication — one source of truth should be chosen.

## 3. localStorage Inventory (55 static keys + 2 dynamic patterns)

### 3.1 High-priority migration candidates (user data, history, preferences)

These store persistent data that would benefit from server-side storage:

| Key | Store | Type | Rationale |
|-----|-------|------|-----------|
| `pitchperfect_library` | melody-store | UnifiedLibrary JSON | **Largest item** — all user melodies, playlists, sessions |
| `mercurypitch_exercise_history` | exercise-history-store | ExerciseHistoryEntry[] | Practice history |
| `pitchperfect_session_history` | practice-session-store | SessionResult[] | Session results |
| `pitchperfect_settings` | settings-store | SettingsConfig | Core pitch/detection config |
| `pitchperfect_vocal_range` | settings-store | VocalRangePreset | Voice profile |
| `pitchperfect_custom_scales` | settings-store | CustomScalesMap | User-created content |
| `pitchperfect_character` | settings-store | CharacterName | Character selection |
| `pitchperfect_character_sounds` | settings-store | boolean | Audio preference |
| `pitchperfect_adsr` | settings-store | ADSRConfig | Envelope preferences |
| `pitchperfect_reverb` | settings-store | ReverbConfig | Effect preferences |
| `pitchperfect_sensitivity_preset` | settings-store | SensitivityPreset | Detection config |
| `pitchperfect_accuracy_tier` | settings-store | AccuracyTier | Skill level |
| `pitchperfect_font` | settings-store | FontFamily | Display preference |
| `pitchperfect_pitch_algorithm` | settings-store | PitchAlgorithm | Technical preference |
| `pitchperfect_pitch_buffer_size` | settings-store | PitchBufferSize | Technical preference |
| `pitchperfect_theme` | theme-store | ThemeMode | Display preference |
| `pitchperfect_count_in` | transport-store | CountInOption | Practice preference |
| `pitchperfect_bpm` | transport-store | number | Practice preference |
| `pitchperfect_playback_speed` | transport-store | number | Practice preference |
| `pitchperfect_uvr_sessions` | app-store | UvrSession[] | Processing history |
| `pitchperfect_uvr-settings` | app-store | UvrSettings | Processing config |
| `pitchperfect_uvr-processing-mode` | app-store | UvrProcessingMode | Processing config |
| `pp_shared_melodies` | CommunityShare | SharedMelody[] | Community content |
| `pp_shared_sessions` | CommunityShare | SharedSession[] | Community content |
| `pp_challenge_progress` | VocalChallenges | UserChallengeProgress | Challenge state |
| `pp_user_id` | CommunityShare | string | User identity |
| `mp_daily_routine` | use-daily-routine | PersistedRoutine | Daily practice state |
| `pitchperfect_walkthroughs` | walkthrough-store | WalkthroughProgress | Onboarding state |
| `pitchperfect_walkthrough_done` | app-store | string | Onboarding flag |
| `pitchperfect_guide_sections` | app-store | Record<string,boolean> | Guide completion |
| `pitchperfect_welcome_version` | ui-store | string | Onboarding version |
| `pitchperfect_advanced_features` | app-store | boolean | Feature toggle |
| `pitchperfect_dev_features` | app-store | boolean | Feature toggle |
| `pp_volume` | App.tsx/EngineContext | number | Audio volume |
| `lyrics_v1_<sessionId>` | StemMixer | Lyrics JSON | Session-associated lyrics |
| `lyrics_gen_v1_<sessionId>` | StemMixer | Generated lyrics JSON | Session-associated lyrics |

### 3.2 Client-only keys (ephemeral UI state)

These are safe to leave in localStorage permanently:

| Key Pattern | Purpose |
|-------------|---------|
| `pitchperfect_sidebar_collapsed` | Sidebar visibility |
| `pitchperfect_grid`, `pitchperfect_flame_mode`, `pitchperfect_color_code_notes` | Visual toggles |
| `pitchperfect_sidebar_note_list_visible_v2` | Layout toggle |
| `pitchperfect_accuracy_percent` | Display format |
| `pitchperfect_show_*` (7 keys) | Panel visibility toggles |
| `pitchperfect_shazam_*` (7 keys) | Shazam detection params |
| `pitchperfect_exercise_tracker` | Tracker visibility |
| `pitchperfect_active_custom_scale` | UI selection pointer |
| `pitchperfect_active_session_id`, `pitchperfect_current_melody_id` | Ephemeral pointers |
| `pitchperfect_seeded` | First-launch flag |
| `pitchperfect_stem_denoise`, `pitchperfect_uvr-force-webgpu` | Browser-specific flags |
| `pitchperfect_workspace_prefs` | Desktop layout |
| `pitch_test_mode` | Dev testing |

## 4. Cloudflare Migration Considerations

### 4.1 What's ready now

- **Full adapter abstraction** — `DatabaseAdapter` + `Repository<T>` interfaces are clean
- **`ServerAdapter` fully implemented** — REST client for all CRUD operations
- **Env-based switching** — Set `VITE_API_BASE_URL` to swap backends, no code changes
- **All Dexie code in exactly one file** — `dexie-adapter.ts` is the only place IndexedDB APIs are called

### 4.2 Blockers for production server swap

| # | Issue | Impact | Resolution |
|---|-------|--------|------------|
| 1 | **UvrStemBlob binary data** | Blocker | `data: ArrayBuffer` can't be JSON-serialized. Needs R2 presigned URLs or multipart upload. `ServerAdapter` would need a `uploadBlob`/`downloadBlob` method added to the `Repository` interface, or a separate `BlobStorage` abstraction. |
| 2 | **model-cache.ts raw IndexedDB** | Medium | ONNX model caching (`pitchperfect-models` DB) bypasses the adapter entirely. Could be served from R2 instead of cached client-side. |
| 3 | **streak-service single-user assumption** | Medium | `streak-service.ts` takes `profiles[0]` — needs proper `userId` filtering for multi-user server. |
| 4 | **ServerAdapter.transaction() no-op** | Low | Transactions are a passthrough. Cloudflare D1 supports them — the `ServerAdapter` could batch operations or use a `/api/transaction` endpoint. |
| 5 | **localStorage stores not in DB layer** | Design | ~36 localStorage keys (section 3.1) are outside the adapter. Each would need a migration path or a server-backed `createPersistedSignal` variant. |
| 6 | **Dual UVR session storage** | Design | UVR sessions duplicated in both IndexedDB and localStorage. One source of truth needed. |

### 4.3 Server API contract (already defined by ServerAdapter)

The Cloudflare backend must serve:

```
GET    /api/:entity          — list with ?where[k]=v&orderBy=&limit=&offset=
GET    /api/:entity/:id      — single record
POST   /api/:entity          — create
PATCH  /api/:entity/:id      — update
DELETE /api/:entity/:id      — delete
GET    /api/:entity/count    — returns { count: number }
```

Entity names map to the 20 tables listed in section 2. Types are defined in `src/db/entities.ts`.

### 4.4 Suggested Cloudflare stack

| Layer | Service | Notes |
|-------|---------|-------|
| API | Cloudflare Workers | Hono or itty-router |
| Database | Cloudflare D1 | SQLite-compatible, per-entity tables |
| Blob storage | Cloudflare R2 | For UVR stem audio files (ArrayBuffer) |
| Auth | Cloudflare Access or custom JWT | `pp_user_id` → server-side user identity |
| ML models | R2 public bucket | Replace `model-cache.ts` IndexedDB with R2 URLs |

## 5. Migration Path (Recommended Order)

### Phase 1: Stabilize adapter boundary (done)
- [x] `resolveAdapter()` env switch (`VITE_API_BASE_URL`)
- [x] `API_BASE_URL` centralized in `defaults.ts`

### Phase 2: Blob storage abstraction
- [ ] Add `BlobStorage` interface (upload/download/delete)
- [ ] Implement `IndexedDBBlobStorage` (current behavior)
- [ ] Implement `R2BlobStorage` (Cloudflare presigned URLs)
- [ ] Wire `uvr-service.ts` through `BlobStorage` instead of direct `Repository<UvrStemBlob>`

### Phase 3: Server backend
- [ ] Create Cloudflare Worker with D1 + Hono
- [ ] Implement REST endpoints for all 20 entity types
- [ ] Add user authentication (JWT or Cloudflare Access)
- [ ] Seed challenge/badge/achievement data on server

### Phase 4: localStorage migration
- [ ] Create server-backed persistence adapter for SolidJS signals
- [ ] Migrate high-priority keys (section 3.1) to server
- [ ] Keep client-only keys (section 3.2) as localStorage, with server fallback

### Phase 5: Cleanup
- [ ] Remove duplicate UVR session localStorage (`pitchperfect_uvr_sessions`)
- [ ] Replace `model-cache.ts` IndexedDB with R2-served models
- [ ] Add proper `userId` filtering in `streak-service.ts`
- [ ] Add transaction support to `ServerAdapter`

## 6. Risk Notes

- **Offline support**: Switching entirely to `ServerAdapter` removes offline capability. Consider a hybrid approach where `DexieAdapter` acts as a local cache with sync.
- **Migration of existing user data**: Users with localStorage/indexedDB data need a migration path when server mode activates.
- **`pitchperfect_library` size**: This is the largest localStorage item (all melodies, playlists, sessions). Needs paginated API and incremental sync.

# Voice History / “Hear Yourself” — Product and Delivery Plan

Status: **local vault, Glass, repeatable Exercise, Weekly Legend, direct
freeform capture, and listening-studio polish implemented on draft PR #364**,
updated 2026-08-02. The remaining local-release gate is browser validation,
especially the real iPhone Safari recording path.

This plan starts from the mystery teaser in PR #359. **Hear Yourself** and
**Voice Mystery** are working language, not a locked public name. The internal
architecture should use neutral `voice-history` / `voice-take` terminology so
renaming the hook does not require a data migration.

## 1. Confirmed direction

- This is a capability inside the MercuryPitch app, not a standalone campaign
  page like Voice Mirror or Glass.
- The foundation is a private local vault of voice takes.
- The product payoff is comparison: hearing an earlier take next to a later
  take from the same practice context.
- Saving is explicit. The first release does not upload audio.
- Cloud sync comes later as optional cross-device portability:
  - a limited amount is free for new users;
  - additional cloud capacity is paid;
  - local recording and comparison remain useful without sync or an account.
- Cloud sync is not public audio sharing. Sharing audio remains a separate
  privacy and moderation decision.

## 2. Product job and success

### User job

After singing, a user wants to keep a meaningful take and later answer:
**“Can I hear how I have changed?”** They should not have to organize files,
name every recording, or understand browser storage to get that answer.

### First magic moment

The user opens one recurring practice context, chooses **Earlier** and
**Later**, and switches between their real recordings without losing the
musical context.

### Minimum lovable release

The release is lovable only when a user can:

1. explicitly keep a real voice take from a MercuryPitch practice surface;
2. find it again after reload;
3. accumulate at least two takes in one comparable context;
4. complete an Earlier/Later A/B listen;
5. understand that the audio is on this device and can delete or export it.

A vault that only lists files is foundation work, not the finished hook.

### Proposed success measures

- percentage of keep attempts that persist successfully;
- users with two or more takes under one comparison key;
- completed comparison listens per returning vault user;
- return within 7 and 28 days after a first kept take;
- storage-warning, decode-failure, and deletion-failure rates.

Telemetry carries event names and coarse numeric counts only. It never carries
audio, take titles, song names, context labels, filenames, or waveform data.

## 3. Experience direction

### Mode and visual authority

This is an **Operate** surface inside the established MercuryPitch app. It
inherits the existing app shell, responsive navigation, tokens, controls, and
motion rules. It does not establish a new visual identity.

### Structural thesis: practice threads, not an audio folder

The page is organized around recurring **practice threads**: one exercise,
Glass target, Legend challenge, karaoke song, or other stable musical context.
Each thread carries its take history. Threads ready for comparison are
prioritized over a flat chronological archive.

This structure makes the end goal visible from the start and prevents the
feature from feeling like a generic voice-memo library.

### Page topology

1. **Overview**
   - Local privacy statement and compact storage status.
   - “Ready to compare” threads with at least two eligible takes.
   - “Recent takes” grouped by week for recovery and browsing.
   - A short first-run explanation when the vault is empty.
2. **Practice thread**
   - Context title and source.
   - Oldest/latest span, take count, and comparable metric summary when valid.
   - Timeline of takes with play, favorite, rename, export, and delete actions.
   - Primary **Compare takes** action when two eligible takes exist.
3. **Comparison workspace**
   - Earlier and Later selections from the same comparison group.
   - One active player at a time; an A/B switch changes sides immediately and
     predictably.
   - Matching waveform scale and the same playback environment for both sides.
   - Context and honest metric deltas only when both takes share the required
     metric schema.
4. **Storage and privacy**
   - Used space, browser-reported availability when known, persistence status,
     export-all, and wipe-all.
   - Future sync settings will live here without replacing the local controls.

### Comparison behavior

- Default pair: earliest eligible take and latest eligible take in the thread.
- Labels are **Earlier** and **Later**, not “bad” and “good.”
- Switching never overlaps both recordings by default.
- Recordings remain dry. If room/FX playback is offered, the same chosen
  environment applies to both sides and does not alter the stored audio.
- A metric delta appears only when source, comparison key, and metric schema are
  compatible. Otherwise the experience stays audio-first.
- The first version does not time-warp, pitch-correct, loudness-normalize, or
  claim improvement from unmatched recordings.

### Responsive and accessible behavior

- Desktop may show Earlier and Later side by side; narrow screens stack them
  while keeping the A/B control and active side persistent.
- Keyboard operation covers selecting takes, play/pause, switching sides,
  favorite, export, and deletion.
- Recording, playback, selection, and storage states use text/icon feedback in
  addition to color.
- Motion respects `prefers-reduced-motion`.
- Waveforms use stored peak buckets. Rendering must not scan raw audio inside
  animation frames.

## 4. Scope

### Local release

- Shared real-voice capture contract using the mic stream already owned by the
  active MercuryPitch surface.
- Explicit keep/discard action.
- Durable local storage, list, playback, update, export, delete, and wipe-all.
- Practice-thread overview and detail.
- Same-context Earlier/Later comparison.
- Storage estimate, quota errors, and best-effort persistent-storage request.
- Feature flag and conversion of the homepage teaser from reveal-only to
  navigable when the release gate opens.

### Recommended capture sequence

1. **Glass**
   - Lowest-risk first adapter because it already produces real `Blob` takes,
     duration, peaks, rep number, shatter status, and contextual metrics.
   - Add **Keep this take** explicitly; do not auto-save the winning take.
   - Proposed comparison key: Glass plus target MIDI and metric schema version.
2. **Repeatable exercises**
   - Add shared audio capture alongside the existing pitch-result flow.
   - Use a stable exercise/configuration fingerprint as the comparison key.
   - This is the first source that proves progress across separate sessions.
3. **Weekly Legend**
   - Reuse exercise capture while attaching the existing weekly challenge ID,
     title snapshot, score, and tier.
   - Takes from the same weekly challenge compare directly. Cross-week Legend
     takes are browseable but not automatically treated as equivalent.
4. **Karaoke**
   - Keep user voice separately from copyrighted source/stem media.
   - Comparison keys require a stable local session/song fingerprint.
5. **Freeform recorder**
   - Implemented as an in-place dry capture inside the voice-history page for
     recurring self-chosen prompts.
   - A new thread is persisted only after its first take is explicitly kept;
     **Record another take** reuses that thread's stable comparison key.

Jam recording is deferred. Capturing a live room introduces participant
consent, multi-party audio, and retention questions that do not belong in the
local single-user release.

### Explicit non-goals for the local release

- automatic saving;
- silent deletion or retention expiry;
- public audio uploads, share links, or community voting;
- cloud sync, cloud restore, or subscription UI;
- a composite voice score;
- clinical or health interpretation;
- recording other Jam participants;
- importing a general-purpose music library.

## 5. Local data architecture

### Separate metadata from audio

Do not put large audio payloads on records used to render the journal. A list
query must not hydrate every recording into memory.

```ts
type VoiceTakeSource = 'glass' | 'exercise' | 'legend' | 'karaoke' | 'freeform'

interface VoiceTakeRecord extends DbEntity {
  source: VoiceTakeSource
  comparisonKey: string
  contextVersion: number
  capturedAt: string
  durationMs: number
  mimeType: string
  sizeBytes: number
  peaks: number[]
  title: string
  favorite: boolean
  contextJson: string
  metricsJson?: string
  metricsVersion?: number
  roomId?: string
}

interface VoiceTakeAudioRecord extends DbEntity {
  takeId: string
  mimeType: string
  size: number
  data: ArrayBuffer
}
```

Proposed incremental Dexie version:

```ts
this.version(5).stores({
  voiceTakes: 'id, createdAt, capturedAt, source, comparisonKey',
  voiceTakeAudio: 'id, &takeId',
})
```

The exact schema version must be rebased against `main` at implementation time.
The current latest Dexie version is 4.

### Comparison keys

A comparison key is stable, private, and not user-facing. It encodes only the
facts needed to decide whether two takes are meaningfully comparable.

Examples:

```text
glass:target-midi:67:v1
exercise:sight-singing:<config-hash>:v1
legend:<weekly-challenge-id>:v1
karaoke:<local-song-fingerprint>:v1
freeform:<user-thread-id>:v1
```

Changing scoring or capture semantics increments the context/metrics version
instead of making old and new results appear directly equivalent.

### Service boundary

Add a dedicated service under `src/db/services/voice-take-service.ts`. UI and
capture surfaces do not access Dexie repositories directly.

```ts
saveVoiceTake(draft): Promise<SaveVoiceTakeResult>
listVoiceTakes(query?): Promise<VoiceTakeRecord[]>
getVoiceTake(id): Promise<VoiceTakeRecord | null>
getVoiceTakeBlob(id): Promise<Blob | null>
updateVoiceTake(id, patch): Promise<Result>
deleteVoiceTake(id): Promise<Result>
deleteVoiceThread(comparisonKey): Promise<Result>
exportVoiceTake(id): Promise<File | null>
exportAllVoiceTakes(): Promise<Blob>
getVoiceStorageSnapshot(): Promise<VoiceStorageSnapshot>
wipeVoiceTakes(): Promise<Result>
```

Required service behavior:

- preflight with `navigator.storage.estimate()` when available;
- save metadata and audio atomically against the local adapter;
- create metadata first inside the transaction, then key its single audio row
  by `takeId`;
- use `durableWrite()` and return actionable quota/failure results;
- never claim success before the transaction commits;
- clean up or reject orphaned metadata/audio consistently;
- create object URLs only at playback time and revoke them on replacement or
  unmount;
- request persistent storage after the first successful explicit keep;
- generalize the existing stem-specific persistence notification rather than
  showing stem copy for voice takes;
- make deletion and wipe-all transactional and report partial failure;
- never auto-delete a favorite or any other take.

### Recorder extraction

Promote `src/features/glass/take-recorder.ts` into a shared voice-capture module
and retain a compatibility re-export while Glass migrates.

- Reuse the mic stream already held by `MicManager`; never call a second
  `getUserMedia()` for the vault.
- Preserve WebM/Opus, MP4, and WebM fallback selection.
- Preserve unsupported/failed recording as a normal capability state.
- Keep capture audio dry; effects belong to playback.
- Cap duration through a configurable policy, not scattered timers.
- Compute peaks once after decode and store the small bucket array.

## 6. Application integration

### Neutral internal route

Use a stable internal tab/route such as `voice-history`; keep the visible label
in one copy/config location while the product name remains undecided.

Implementation touchpoints include:

- `src/features/tabs/constants.ts`: tab ID, `ActiveTab`, practice group, singing
  scope, ordering, labels, and DOM IDs;
- `src/lib/hash-router.ts` and routing tests;
- `src/components/AppNavTabs.tsx` and mobile nav metadata;
- `src/App.tsx`: lazy/page render within `TabErrorBoundary`;
- home destination card: reveal-only before the flag, navigable afterward;
- tour coverage only after the navigation and empty state are stable.

The new tab belongs to the singing practice scope. Whether it appears directly
in the simple-mode bar or under mobile **More** should be decided with the final
navigation label and ordering; adding it must not accidentally displace a
current primary mobile tab.

### Release control

The first local slice is review-controlled by draft PR #364 instead of adding a
second client-side feature flag. The mystery card, history tab, and Glass keep
action ship as one coherent unit. If a staged beta is needed after review, add
a dedicated `voiceHistoryEnabled` flag across all three entry points rather
than coupling release to the broad advanced/dev switches.

## 7. States that must be designed

| State                         | Required response                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Empty vault                   | Explain local privacy and point to an available capture surface; do not imply missing cloud data. |
| One take in a thread          | Play and manage it; show what one more take will unlock.                                          |
| Two or more comparable takes  | Promote Earlier/Later comparison.                                                                 |
| Takes exist but none compare  | Keep the timeline useful and explain equivalence without blaming the user.                        |
| MediaRecorder unavailable     | Preserve pitch-only practice and state that voice saving is unavailable in this browser.          |
| Mic denied/lost               | Use the shared mic recovery path; never leave a recording indicator active.                       |
| Audio decode/playback failure | Keep metadata, offer export/delete, and avoid a false empty state.                                |
| Storage estimate unavailable  | Continue with honest “availability unknown” copy.                                                 |
| Storage low or quota exceeded | Do not lose the in-memory take silently; offer export and storage management.                     |
| Persistent storage denied     | Saved locally remains true; explain that the browser may reclaim site data.                       |
| Missing audio orphan          | Mark the take unavailable and offer cleanup; never loop loading.                                  |
| Delete/wipe confirmation      | Name local scope clearly; future synced deletion requires separate wording.                       |
| Reduced motion                | Remove decorative transitions while preserving state changes.                                     |

## 8. Analytics and privacy invariants

Add count-only events to the existing app funnel and worker allowlist:

```text
mystery_reveal
voice_history_open
voice_keep_attempt
voice_keep_success
voice_keep_failure
voice_compare_start
voice_compare_complete
voice_export
voice_delete
voice_storage_warning
voice_sync_interest        # only when future sync is presented
```

Invariants:

- Local keep, playback, export, and delete make no audio network request.
- No analytics payload includes audio-derived identity, text labels, song
  identity, raw scores, waveform buckets, or storage filenames.
- Any future sync request is visibly distinct from anonymous analytics.
- A regression test should prove that a local save succeeds with network
  access disabled.

## 9. Future cloud sync

Cloud sync is a later project and must not be implemented by adding
`voiceTakes` to `HybridAdapter.CLOUD_ENTITIES`. That would replace the local
repository with a remote one in configured builds and break the signed-out,
offline-first contract.

### Proposed architecture

- Local IndexedDB remains the immediate write target and playback source.
- A sync coordinator runs above the local take service after explicit opt-in.
- Private R2 objects hold encrypted-at-rest audio; D1 holds user-scoped
  metadata, object references, versions, tombstones, and quota usage.
- Worker endpoints issue authenticated upload/download operations without
  public object URLs.
- Sync state is additive metadata: local-only, queued, syncing, synced,
  conflict, or failed.
- Audio is append-only by content identity; mutable metadata can use versioned
  last-write-wins rules; deletion uses tombstones so another device does not
  resurrect removed audio.
- Downloads are on demand with an explicit device-cache policy.
- Server-side quota enforcement is authoritative and idempotent.

### Commercial boundary

- Account and local vault remain free.
- New signed-in users receive a DB-configured free cloud allowance.
- Additional storage is sold because it creates recurring infrastructure cost,
  consistent with `docs/plans/premium.md`.
- Quotas and prices come from backend configuration, not hardcoded UI.
- Reaching a cloud quota never deletes the local take or blocks local capture.

### Decisions required before cloud implementation

- free allowance, paid tiers, grace period, and over-quota behavior;
- subscription versus storage add-on;
- whether end-to-end encryption is required or managed encryption is enough;
- account deletion, export, recovery, and retention obligations;
- device-cache limits and selective-download controls;
- conflict and tombstone retention windows;
- whether existing local takes are bulk-enabled or individually selected when
  the user first enables sync.

## 10. Delivery ladder

The original ladder below separated planning and implementation. The user
explicitly chose to consolidate the local vault, Glass adapter, navigation, and
Earlier/Later workspace into planning PR #364. Cloud work remains separate.

### PR #364 — implemented local slice

- Durable `PRODUCT.md`.
- This product, UX, data, rollout, and verification plan.
- Dexie v6 entities, local-only routing, and atomic durable voice-take writes.
- Glass **Keep** adapter with explicit consent and retry/storage feedback.
- Shared dry mic capture for all 18 repeatable exercise runners, capped at five
  minutes and discarded unless the singer explicitly keeps the result.
- Stable exercise/configuration fingerprints so different targets and variants
  never enter the same comparison thread accidentally.
- Exercise result states for preparing, keeping, retrying, unsupported capture,
  and explicit discard without changing the saved score.
- Weekly Legend handoff from the scored exercise into its result card, where
  the temporary replay is kept or discarded explicitly without changing the
  recorded score.
- Challenge-scoped Legend comparison threads with the weekly challenge ID,
  title snapshot, target score, result score, and tier attached locally.
- Authored Weekly Legend note sequences used exactly as launched so the saved
  voice take, scoring context, and comparison metadata describe the same run.
- In-place freeform capture with a named recurring prompt, dry temporary
  replay, explicit Keep/Discard/Record again, five-minute cap, and shared mic
  lifecycle cleanup.
- Stable freeform thread keys: nothing enters the vault until the first keep,
  and later takes in the same thread become eligible for Earlier/Later.
- Multiple named freeform threads can coexist. Singers can start a different
  thread from the direct-capture flow and rename a freeform thread without
  changing its stable comparison key or separating its existing takes.
- Live freeform feedback layers a truthful mic-energy envelope with a smoothed
  pitch contour and an unmistakable recording state; it never invents a score
  or target for freeform singing.
- Saved history reuses the Glass canvas waveform, with frame-synchronised
  playheads for fluid playback rather than coarse media `timeupdate` steps;
  every replay waveform is a pointer- and keyboard-accessible seek control.
- A single playback-only listening room applies Dry, Starlight, Nebula,
  Supernova, or custom Echo/Reverb/Hall settings equally to Earlier and Later;
  saved blobs remain dry and effect tails are reset between takes.
- Take, complete-thread, and clear-all deletion use the app's accessible
  confirmation dialog. Thread and whole-history deletion are separate actions
  with typed confirmation, and native browser dialogs are not used.
- Local bulk deletion stays transactional through both direct Dexie and the PR
  preview's HybridAdapter path without parallel IndexedDB work inside a single
  transaction.
- Empty, overview, thread, playback, storage, export, and delete states.
- Navigable mystery card and dedicated **Hear Yourself** tab.
- Earlier/Later workspace for matching Glass target contexts.
- Count-only vault events and focused service/component coverage.

### Follow-on — local beta validation

- Exercise the complete keep, reload, playback, comparison, export, and delete
  flow in Chromium desktop and a narrow mobile viewport.
- Validate the MediaRecorder, decode, replay, keep, and reload path on real
  iPhone Safari. Chromium mobile emulation checks layout, not WebKit audio
  behavior.
- Confirm same-challenge Weekly Legend takes compare directly and cross-week
  attempts remain in separate threads.
- Confirm a direct take is absent after discard, survives reload after keep,
  and unlocks Earlier/Later after **Record another take** in the same thread.
- Open the beta only after the two-take flow passes on Chromium and Safari.

### PR 5 — source expansion

- Karaoke take adapter.
- Storage-management refinements from measured take sizes and failure rates,
  including bulk export and richer quota/usage controls.
- Jam remains excluded until multi-party consent is designed.

### PR 6+ — cloud portability

- Separate threat model and sync specification.
- R2/D1 schema, quota service, entitlements, sync coordinator, device cache,
  export/deletion, and billing presentation.
- Roll out opt-in behind a server-controlled entitlement/flag.

## 11. Verification plan

### Unit and service tests

- Dexie v5 to v6 upgrade preserves all existing tables and rows.
- Metadata queries do not read audio payloads.
- Save is atomic under metadata failure, blob failure, and quota failure.
- Durable write retry does not duplicate a take.
- Delete-take, delete-thread, and wipe-all remove both metadata and audio while
  preserving records outside the chosen scope.
- Storage estimate unknown/low/available branches.
- MIME selection and unsupported `MediaRecorder`.
- Comparison eligibility and default-pair selection.
- Metric deltas reject version/context mismatch.
- Export reconstructs the correct MIME type and safe filename.

### Component tests

- Empty, one-take, ready-to-compare, decode-error, and quota states.
- Keyboard and touch A/B switching.
- Object URLs are revoked.
- Delete confirmation restores focus.
- Playback progress samples every animation frame and invalidates stale loops.
- Listening-room presets and custom sends stay within safe bounds.
- Live visualization keeps bounded waveform/pitch history and treats uncertain
  pitch frames as gaps.
- Feature flag keeps teaser, route, and capture actions consistent.

### End-to-end checks

- Keep a Glass take, reload, reopen, play, export, and delete.
- Keep two eligible takes and complete an Earlier/Later comparison.
- Drag a listening-room slider with a real pointer and confirm the setting does
  not alter or replace the stored take.
- Drag a replay waveform with a real pointer, confirm its playhead seeks to the
  requested position, and repeat with keyboard arrows.
- Confirm capture shows a live waveform/pitch contour, saved history uses the
  Glass canvas waveform, and take/thread/all deletion opens only the in-app
  dialog.
- Deny mic; lose mic mid-capture; recover without a stuck indicator.
- Disable network and repeat the full local flow.
- Simulate low quota without falsely reporting a successful save.
- Verify desktop and narrow layouts plus reduced motion.
- Verify existing Glass in-memory playback remains unchanged when a user does
  not keep a take.

Before every implementation PR:

```bash
pnpm check
pnpm test:run
```

Run the focused browser suites for any PR touching mic, playback, navigation,
or IndexedDB.

## 12. Risks and mitigations

| Risk                                             | Mitigation                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Browser eviction makes “saved” feel dishonest    | Request persistence, show its status, offer export, and use precise local-storage copy. |
| Audio records make the journal slow              | Separate metadata/audio tables; load one blob only when needed.                         |
| Safari recording/decode formats diverge          | Preserve MP4 fallback and test capture plus replay on Safari before beta.               |
| Contexts look comparable when they are not       | Stable comparison keys and versioned metric/context schemas.                            |
| The vault becomes cluttered                      | Context-first grouping, favorites, explicit bulk management; no silent deletion.        |
| A future cloud layer breaks local-first behavior | Sync above the local service; never route the core repository exclusively to cloud.     |
| Users confuse sync with sharing                  | Separate wording, controls, events, and backend paths.                                  |
| Mic ownership regresses                          | Reuse `MicManager`; no second stream; release on unmount/loss.                          |
| Waveforms cause render jank or aliasing          | Persist peak buckets once; never scan raw samples per animation frame.                  |

## 13. Open decisions

These do not block the local foundation:

1. Final public name, navigation label, and teaser copy.
2. Maximum take duration and any per-source keep guidance.
3. Whether freeform capture belongs in the first public beta or follows it.
4. Final position in desktop and mobile navigation.
5. Whether comparison switches from the beginning or preserves relative
   playhead position after user testing.
6. Cloud allowance, pricing, encryption model, and retention policy.

The most important implementation gate is not a name decision. It is proving
that two locally stored takes from one stable context produce a comparison
users want to repeat.

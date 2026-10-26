# Studio source and app integration investigation

Inspected 2026-10-26 at `c90e1a87c6b2a273334efd08192cce2c25e95295` (`feat/studio-fx-chain`, PR #1219). Source inspection only; no tests, browser flows, audio playback or physical-device acceptance were performed. No repository files were changed.

## Main finding

The app already has a common local catalogue for explicitly kept performances from Karaoke, Hear Yourself, Guitar Night, Piano Night and Drum Night. Studio should adapt that catalogue, then copy the selected audio into Studio-owned immutable assets. It does not need five independent media libraries. The catalogue's internal name is still `VoiceTakeRecord`, but it already includes instruments.

V1 agreed scope: audio clips; move, trim, split, duplicate, fades, level, pan, mute and solo. Full arrangement on desktop and tablet; simpler adding/listening/exporting on phone. MIDI/note editing, stretching and pitch changes are deferred.

## Existing inputs and their real contents

| Source                    | Existing API and storage                                                                                                                                                            | What the audio actually contains                                                                                                                                        | Studio implication                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All explicitly kept takes | `listVoiceTakes()`, `getVoiceTakeBlob(id)` in `src/db/services/voice-take-service.ts:179-194`; metadata and audio separate in `src/db/entities.ts:190-235`                          | Source-tagged replayable audio, title, duration, small peaks and context                                                                                                | List metadata first, decode only selected audio. Reuse one picker with filters.                                                                                         |
| Karaoke/vocal practice    | `keepKaraokeVoiceTake()` in `src/lib/domain/karaoke-voice-take.ts:34-67`                                                                                                            | Dry microphone only. Source stems are deliberately excluded (`:5-6`). Context has session ID and song title but no universal recording-to-song offset (`:50-56`).       | Default role Lead vocal. Backing requires a separate source selection; do not promise automatic alignment for historical takes.                                         |
| Hear Yourself freeform    | `keepFreeformVoiceTake()` in `src/features/voice-history/freeform-voice-take.ts:32-52`                                                                                              | Kept blob with local prompt/thread metadata                                                                                                                             | Treat as a finished audio take, not a new Studio recording or scored task.                                                                                              |
| Guitar Night scored takes | `guitarNightTakeKeepInput()` in `src/features/guitar-night/useGuitarNightTakeCapture.ts:87-128`                                                                                     | Captured replay plus song/track, beat range, tempo and input kind                                                                                                       | Source tempo/range can be hints. MediaRecorder capture admits up to 250 ms boundary drift (`:53-66`), so those fields do not establish sample-accurate alignment.       |
| Guitar recorder           | `createGuitarRecordingService().keep()` in `src/db/services/guitar-recording-service.ts:435-525`                                                                                    | Dry input WAV under `guitar-take:<id>`; explicit `recordingLabel: 'Dry input'`                                                                                          | Do not silently import the heard amp sound. Offer the dry take initially and describe it honestly.                                                                      |
| Piano Night               | `keepInstrumentNightTake()` adapts into the same store (`src/lib/domain/performance-take.ts:85-101`); `src/features/piano-night/usePianoNightController.ts:474-494` renders on keep | Player note lifetimes are rendered as deterministic mono 24 kHz felt-synth PCM, excluding the Score/Hear arrangement (`piano-performance-take-renderer.ts:2-15,89-141`) | Available as audio now, but do not imply it is the sampled piano signal or full authored MIDI arrangement. Richer instrument rendering is a later adapter.              |
| Drum Night                | `keepDrumPerformanceTake()` in `src/features/drum-night/persistence/drum-performance-take.ts:88-100`                                                                                | Live-kit audio only, with frozen scalar score metadata. Not room microphone audio or a full authored score (`:2-7`)                                                     | Import the kept replay; saved project/take summary alone is not audio.                                                                                                  |
| Karaoke backing/stems     | `readUvrSessionRecords`, `readUvrStemManifest`, `readUvrStemSelectionWithinBudget` in `src/db/services/uvr-read-service.ts:39-41,80-99,138-169`                                     | Locally durable separated stems; selected kinds read lazily                                                                                                             | Secondary source adapter. Manifest lookup uses index counts; avoid reading all historical stem blobs merely to populate a picker.                                       |
| External audio            | `AUDIO_UPLOAD_ACCEPT`, `audioUploadValidationError` in `src/lib/audio-upload-contract.ts:9-58`                                                                                      | Picker accepts MP3, WAV and FLAC; `decodeAudioData` still determines actual browser decodability                                                                        | Reuse explicit MIME/extensions, not `audio/*` (iOS picker issue documented at `:4-7`). Validation limits must reflect Studio memory, not paid separation upload limits. |

Instrument provenance is already separate from voice-analysis eligibility in `src/lib/domain/performance-take.ts:61-82`. Studio must not send guitar/piano/drum mixes to Voice Atlas or reuse performance scores as audio-quality judgments.

## Persistence design supported by the existing code

Verified:

- One on-device database is `MercuryPitchDB`; the latest schema at this head is v12 (`src/db/adapters/dexie-adapter.ts:39-49,115-127`). Add the next incremental version, preserving existing tables.
- Existing metadata is list-safe and audio lives separately (`src/db/entities.ts:202-235`). Mirror this separation for Studio project summaries, arrangement document, immutable audio assets and derived peaks/analysis.
- `HybridAdapter` routes only an explicit entity allowlist to the server (`src/db/adapters/hybrid-adapter.ts:19-49`). Studio tables must stay absent in v1. Account presence must not change that.
- `HybridAdapter.transaction()` is not a cross-store transaction; `transactionLocal()` reaches the real Dexie transaction (`src/db/adapters/hybrid-adapter.ts:237-248`). Use the latter or the local adapter for atomic asset-plus-project writes.
- `durableWrite()` returns failure/quota state and retries only boundedly (`src/db/durable-write.ts:36-61`). Storage estimates are best-effort; they cannot replace handling a failed write (`:64-108`). A saved indicator must follow successful persistence.
- Deleting a Hear Yourself take, thread or the entire library deletes original audio (`src/db/services/voice-take-service.ts:305-366`). A Studio clip that only holds a `takeId` will break later.

Recommended architecture (proposal, not existing implementation):

1. `StudioProject` holds schema version, local ID, title, revision, project sample rate, time ruler preference and clip/track IDs. Keep future cloud IDs separate; no account required.
2. `StudioAsset` owns immutable audio bytes and provenance `{ kind, sourceId, importedAt, sourceTitle }`, original MIME, channels, sample rate, duration, content hash and processing state. One imported source can serve many clips. Start with one Studio copy per source/content hash; more elaborate shared ownership across features is unnecessary for v1.
3. `StudioTrack` owns name, role, colour, level, pan, mute, solo and an FX spec. `StudioClip` owns asset ID, integer source trim frames, project placement, fades and clip gain. Never destructively edit source bytes.
4. Commands/reducer implement edits and undo/redo; coalesce a pointer drag into one command. An explicit project revision makes asynchronous writes and future multi-tab conflict handling measurable.
5. Decode and waveform/analysis caches are derived and evictable. Persist original/imported audio and the arrangement; do not persist `AudioBuffer`, `AudioNode`, object URLs or render contexts.
6. Serialize autosaves per project; show Saving / Saved on this browser / Could not save states. Keep the in-memory edit after failure and offer a project backup. Browser persistence is not cloud backup.
7. Export/import a versioned local project bundle before promising safe long-term projects. Validate asset IDs, sizes, formats and path names on import; never depend on absolute source paths.

## Route, tab and app ownership

The existing architecture already supports a clean URL that boots the full app. `/ear-lab` and `/jam` use `boot: '/src/index.tsx'` with a `bootHash` in `src/seo/entry-pages.ts:454-458,488-492`; `vite.config.ts:98-110` derives development/preview rewrites. Follow that pattern for `/studio-night` and an integrated `#/studio-night` tab. Do not clone the standalone guitar/piano/drum entry app pattern.

Implementation touchpoints:

- `src/features/tabs/constants.ts`: add the tab constant and `ActiveTab`, group membership, instrument scopes, element ID and label. The existing group **already says Studio** and contains Compose, Analysis and Settings (`:121-127`). Recommended proposal: add a tab labelled Studio within the group but rename the group to Create after design review, or choose another non-duplicative grouping. Keep Settings reachable. Simple-mode primary groups currently exclude this group (`:223-236`); Studio must remain discoverable from source take actions and the visible navigation scope.
- `src/lib/hash-router.ts:84-107`: register the valid tab; `src/features/routing/useHashRouter.ts` is the URL-to-state/state-to-URL boundary. Use the existing change-veto path, including browser Back/Forward.
- `src/App.tsx`: lazy composition of a `src/features/studio/` feature, not audio scheduling in the already-large app shell. Existing take leave guard is at `:1307-1348`; existing Hear Yourself host is at `:4373-4383`.
- `src/features/sidebar/sidebar-registry.ts`: ensure the Studio feature gets the intended available width instead of inheriting unrelated practice panels.
- `src/stores/app-store.ts:2025-2037` holds page tours; `usePageTourOffer` knows how to offer/restart them. Add an actual Studio tour and verify affected selectors. Do not run the full release tour suite per change.

The generic room registry is currently **empty**, with future conversion described in comments (`src/features/rooms/registry.ts:54-70`). It is not a ready integration framework to depend upon.

## Audio ownership and scheduling

- The native host already lends an audio lease; Karaoke demonstrates acquisition plus release at `src/features/karaoke-room/KaraokeRoomStage.tsx:159-168`. The shared package provides lazy `acquireSharedAudioContext()` and gesture-driven `unlock()` (`packages/audio-io/src/shared-audio-context.ts:284-332`). Studio should use the active host's lease abstraction, disconnect its own graph on leave, and never close a borrowed context.
- Some current web features still create their own contexts; Hear Yourself does so (`src/features/voice-history/VoiceHistoryPage.tsx:621-695`). Do not infer that the entire app is already migrated to one context.
- Use one audio-clock transport for the multitrack session, scheduling all clip sources against the same start time. Do not coordinate HTML audio elements with UI timers. Build from project snapshot + edit commands, not from DOM position.
- Cancellation/stale-result checks in `src/features/voice-history/decoded-voice-playback.ts:85-165` are a useful lifecycle pattern for slow decoding, route changes and fast asset changes. Its media-element fallback is unsuitable for a synchronized editable timeline: Studio should surface decode failure explicitly.
- `src/lib/audio-memory-budget.ts:8-13,93-114` distinguishes encoded bytes from decoded Float32 PCM. A 5-minute stereo 48 kHz track alone is about 110 MiB decoded, before FX/render buffers. The existing generous playback ceilings are not proof a multitrack bounce will fit. Admission must account for all simultaneous input and output buffers and bounded decode concurrency.
- Do not autoplay when opening the route, reloading a project, returning from another tab or completing decode. Stop and dispose scheduled sources on seek/stop, then rebuild from the new transport snapshot. Backgrounding/interruption behavior needs native and browser tests.

## Export reuse and gaps

- `src/lib/audio-buffer-wav.ts` already encodes mono/stereo 16-bit PCM WAV with optional frame range. Reuse `encodeAudioBufferToPcmWav`, not the mono-only voice export wrapper, for stereo Studio output.
- `src/features/voice-history/voice-take-export.ts:140-197` demonstrates truthful container handling; `:199-234` handles object-URL cleanup and feature-detected file sharing. A finished bounce and a successful delivery are separate states.
- `renderGuitarRecordingMix()` at `src/features/guitar-night/guitar-recording-mix-export.ts:145-218` can render recorded guitar or detected notes through the amp plus drums. It is a specialized export with its own limiter/tail, not a general Studio arrangement renderer. Importing this as a source later would bake those decisions in; do not double-apply a master silently.
- No MP3 encoder was found in the inspected package/dependency and relevant export paths. MP3 import does not establish MP3 export. Make WAV the guaranteed v1 output unless a tested encoder is explicitly added.
- Kept replay and authored MIDI project are distinct. Full guitar/piano/drum compositions still need an explicit audio-render adapter; those adapters can be later integration work without putting MIDI editing in Studio v1.

## Phase checks that should be in the master plan

Phase 2: metadata-only catalogue listing; missing/corrupt audio; transactional import; source deletion after import; browser reload; quota failure; schema upgrade from existing DB; stale asynchronous decode; two tabs editing same project; route/Back/Forward and save guard; zero cloud requests from project storage.

Phase 3: actual app tab and clean URL reach the same feature; empty project and picker; desktop/tablet geometry; phone scope remains explicit; keyboard and screen-reader paths; selected clip commands are visible and usable.

Phase 4: real-pointer Playwright `@smoke` tests (red to green) for move, trim, split, fades and drag/drop; undo/redo after a gesture; keyboard equivalents; pointer cancellation; touch scrolling vs dragging; resize/zoom without losing placement; make a short song entirely through the UI, save, reload and replay it. Use small generated audio fixtures, not LFS assets.

Phase 5: common audio-clock alignment, sample-rate conversion, trim/fade parity live versus offline, render tails, mute/solo correctness, measured loudness/peak after final export processing, empty/silent input, cancellation/progress, stereo WAV headers and share/download failure handling. Do not claim mastered output is good merely because a loudness number meets a target.

Phase 6: owner audition plus real Safari/iPad/phone acceptance, leaving/returning during playback or save, interrupted render, large-but-admitted project, source-library deletion, and clean browsing-context storage limits. CI/browser emulation does not establish physical-device audio behavior.

## Follow-up: existing export restriction and narrow amendment

Verified `docs/specs/instrument-night-history.ears.md:73-78`, **REQ-INH-009**: instrument replay audio, waveform peaks, source context and result evidence stay in existing device-local take stores and shall not enter cloud entities, analytics payloads, project exports or device sync through that flow. **REQ-INH-007** (`:60-65`) already preserves ordinary individual replay/export/favourite/delete. This is a project-bundle boundary, not a blanket ban on exporting a take.

The owner's explicit Studio request authorizes a narrow behavior change. Update the spec in the implementation phase so the rule stays honest. Recommended replacement/addendum:

> Keeping an instrument performance in Hear Yourself shall remain device-local and shall not automatically copy it to another project, include it in a project export, upload it, or send its audio, waveform, source context or result evidence to analytics or device sync. When the musician explicitly adds a kept take to Studio, the system may create a Studio-owned local audio asset and minimal source provenance. When the musician explicitly exports a Studio project backup, that backup may include the audio assets selected for that project. Completed practice scores, contours, device evidence and unrelated history shall not be copied into Studio assets or backup bundles. Cloud storage and device sync remain outside this version.

Use a separate Studio EARS spec for the Add and Export contracts, and link it from REQ-INH-009. Do not broaden the cloud allowlist. Karaoke privacy at `docs/specs/karaoke-voice-history.ears.md:46-50` remains satisfied by this local-only behavior.

## Follow-up: cheapest navigation implementation and exact pathname behavior

`src/seo/render-entry-page.ts:243-254` emits `if (!window.location.hash) window.location.hash = bootHash` before booting the configured module. A `studio-night` registry entry with `boot: '/src/index.tsx'` and `bootHash: '#/studio-night'` therefore opens the full app from `/studio-night` and preserves a caller-supplied hash. The visible address becomes `/studio-night#/studio-night`; changing tabs changes its hash while keeping the clean path. This is existing behavior, not a new standalone application. Direct `/#/studio-night` opens the identical feature through the existing hash router.

There is no pathname parser in `parseHash()`; merely adding a tab does not make `/studio-night` work. Production uses `not_found_handling: '404-page'` (`wrangler.jsonc` assets block), so the generated `studio-night.html` matters. Using `slug === canonical path` avoids a new alias handler or `run_worker_first` rule. A raw pathname-only client patch without a served entry would work inconsistently between Vite fallback and hosted assets.

Minimum phase 2/3 navigation file set:

| File                                                           | Minimal change                                                                                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/tabs/constants.ts`                               | `TAB_STUDIO_NIGHT`, ActiveTab, group membership, all instrument scopes, simple-mode visibility decision, DOM ID, label.                                                          |
| `src/components/AppNavTabs.tsx`                                | One `TAB_META` entry with existing SVG icon, ID, label and accessible label. Phone bar already reuses this metadata (`src/components/mobile/BottomTabBar.tsx:25,57-61,116-125`). |
| `src/lib/hash-router.ts`                                       | Add the tab to `VALID_TABS`; generic tab parsing/building already works.                                                                                                         |
| `src/App.tsx`                                                  | Lazy import and one tab host, plus only the needed leave/save boundary integration. Keep project logic in the feature.                                                           |
| `src/features/sidebar/sidebar-registry.ts`                     | Exhaustive layout map entry. It always appends mic (`:128-131`), so hiding irrelevant app chrome is a shell-layout decision, not an empty array trick.                           |
| `src/seo/entry-pages.ts`                                       | Full-app clean entry `/studio-night` with boot hash. Metadata/SEO copy should describe actual phase capability.                                                                  |
| `src/features/studio/StudioPage.tsx`                           | Thin feature entry, initially project/catalogue shell in phase 2; approved arranging UI in phase 3.                                                                              |
| `src/stores/app-store.ts`                                      | New Studio tour when the UI exists; do not add dead selectors in the data-only phase.                                                                                            |
| `docs/specs/instrument-night-history.ears.md`, new Studio spec | Narrow local Add/backup exception and feature contracts.                                                                                                                         |

`src/features/routing/useHashRouter.ts:263-265` already accepts a generic tab, so basic navigation does **not** require another conditional there. Change it only if project IDs or pending-source handoff need dedicated URL state. `vite.config.ts`, entry renderer and worker need verification, not necessarily edits, because registry-driven entries already generate the file, build input and development rewrite. Tests should cover generated entry boot hash, direct hash, browser Back/Forward, app tab and same-origin source access.

# Agent index — MercuryPitch

Map of a ~245k-LOC SolidJS codebase, written for coding agents. **Read this
before grepping.** It exists so you can jump straight to the right file instead
of rediscovering the architecture every session.

- **Tables below are generated** by `node scripts/gen-agent-index.mjs` from the
  filesystem and from each file's leading comment block. Never hand-edit inside
  `BEGIN:GENERATED` markers — your edit will be overwritten.
- **Prose outside the markers is hand-written** and is the valuable part:
  invariants, gotchas, and the mistakes that have actually cost us time.
- If a module's blurb reads `(no header comment)`, the fix is to add a header
  comment to that file, not to describe it here.

---

## 1. Orientation

| Layer                | Lives in                                  | Rule of thumb                             |
| -------------------- | ----------------------------------------- | ----------------------------------------- |
| Route shells         | `src/pages/`                              | Thin. Composition only, no logic.         |
| Feature surfaces     | `src/features/<name>/`                    | Self-contained. Owns its UI + controller. |
| Shared components    | `src/components/`                         | Cross-feature UI. Large and legacy-heavy. |
| Algorithms / engines | `src/lib/`                                | Pure-ish, testable, no JSX.               |
| Global state         | `src/stores/`                             | SolidJS stores. See §4 before adding one. |
| Backend              | `workers/db-worker`, `workers/jam-worker` | Cloudflare Workers + D1.                  |
| Persistence (client) | `src/db/`                                 | Dexie / IndexedDB.                        |

Routing is hash-based: [`src/lib/hash-router.ts`](../../src/lib/hash-router.ts) →
[`src/features/routing/useHashRouter.ts`](../../src/features/routing/useHashRouter.ts).
There is no file-system router; a new page must be registered in both.

**Newer code lives in `src/features/`; older code lives in `src/components/`.**
When extending an existing surface, follow the neighbours. When building
something new, prefer a `src/features/` module.

---

## 2. Guardrails — non-negotiable

These are the rules that break things when ignored.

1. **Never touch production.** Testing uses local or dev only (`api-dev`,
   localhost workers). Prod deploys go through the `/prod-upd` release flow.
2. **Never push to `main`; never force-push.** Feature branches prefixed
   `feat/`, PRs target `main`. `--force-with-lease` is acceptable for rebases;
   plain `--force` is not.
3. **No Claude attribution anywhere** — no `Co-Authored-By`, no "Generated with"
   trailers, in commits, PR bodies, or any artifact.
4. **No emojis** in code, UI, logs, commits, or PR text. Use an SVG icon
   component instead.
5. **Keep local gates proportional.** Run focused tests while developing. Once
   per work item, before its first PR push, run `pnpm pr:prepare` and the
   relevant workspace typecheck. CI is the authoritative full gate after that.
6. **Schema changes ship as a numbered migration** — a new
   `workers/db-worker/migrations/NNNN_name.sql`, applied by
   `wrangler d1 migrations apply` from `deploy-db.yml` (dev on merge, prod at
   release). Never edit an already-applied file — add the next number.
   `migrations_dir` must be set on **every** `d1_databases` block in
   `workers/db-worker/wrangler.jsonc`; wrangler does not inherit it. The
   `scripts/migrate-*.sql` files are
   [legacy-only](../../scripts/README-legacy-migrations.md) — never add
   another. Release pre-flight:
   [the release handoff](../integration-2026-07-release-handoff.md) §7.
7. **Never use `rg -r`** — it means `--replace`, not "recursive", and silently
   garbles output.

---

## 3. Module map

<!-- BEGIN:GENERATED module-map -->
#### Features (`src/features/`) — self-contained user-facing surfaces

| Module | Entry point | LOC | What it is |
|---|---|---|---|
| `stem-mixer` | [useStemMixerLyricsController.ts](../../src/features/stem-mixer/useStemMixerLyricsController.ts) | 12.2k | StemMixer Lyrics Controller — lyrics/LRC gen/blocks state + actions |
| `exercises` | [ExerciseShell.tsx](../../src/features/exercises/ExerciseShell.tsx) | 12.0k | ExerciseShell — shared chrome for every exercise runner Owns the layout that used to be duplicated across all 18 exercise components: the... |
| `admin` | [AdminPremiumPerksPage.tsx](../../src/features/admin/AdminPremiumPerksPage.tsx) | 10.1k | AdminPremiumPerksPage — protected art and supporter access console THESIS: a premium background is not live until its exact art revision... |
| `mirror` | [MirrorApp.tsx](../../src/features/mirror/MirrorApp.tsx) | 5.4k | Voice Mirror — the guided 3-task flow (spec §2). |
| `zen` | [ZenPitchStage.tsx](../../src/features/zen/ZenPitchStage.tsx) | 4.9k | _(no header comment)_ |
| `glass` | [GlassApp.tsx](../../src/features/glass/GlassApp.tsx) | 4.7k | Glass — the shattering voice mirror (P2: self-voice loop). |
| `guitar-night` | [useGuitarNightPreparationController.ts](../../src/features/guitar-night/useGuitarNightPreparationController.ts) | 4.2k | Guitar Night preparation controller owns one cancellable, stale-safe local song run |
| `onboarding` | [BeatFirstLight.tsx](../../src/features/onboarding/beats/BeatFirstLight.tsx) | 3.4k | Beat 2 — First light The mic is asked HERE, one tap after the visitor said "sing one note" — at the moment of intent, with the reason on... |
| `challenges` | [ChallengeStage.tsx](../../src/features/challenges/ChallengeStage.tsx) | 3.2k | ChallengeStage — the weekly Legend performed on the zen canvas "Sing it" no longer runs the plain sight-singing drill: the challenge's me... |
| `guitar-practice` | [useGuitarPracticeController.ts](../../src/features/guitar-practice/useGuitarPracticeController.ts) | 2.9k | useGuitarPracticeController — Guitar Hero-style game logic |
| `karaoke-night` | [KaraokeNightApp.tsx](../../src/features/karaoke-night/KaraokeNightApp.tsx) | 2.7k | KaraokeNightApp — the standalone Karaoke Night shell A separate entry surface from the in-app Karaoke tab: its own stage, song rails and... |
| `guitar-tab-3d` | [GuitarTab3DView.tsx](../../src/features/guitar-tab-3d/GuitarTab3DView.tsx) | 2.6k | GuitarTab3DView — 3D-style falling-notes guitar tab playback A drop-in alternate renderer for the same falling-notes data the 2D "hero" v... |
| `analysis` | [AnalysisDashboard.tsx](../../src/features/analysis/AnalysisDashboard.tsx) | 1.9k | Analysis dashboard — one responsive page for every take Replaces VocalAnalysis.tsx (3,102 lines) and AnalysisMobileOverview.tsx. |
| `guitar` | [guitar-backing-transport.ts](../../src/features/guitar/backing/guitar-backing-transport.ts) | 1.8k | Guitar backing transport keeps separated stems on one route-owned Web Audio clock. |
| `path` | [path-content.ts](../../src/features/path/path-content.ts) | 1.6k | The Ascent — guided-path content (data, not code) One path = an ordered list of themed weeks (the celestial orbs). |
| `routines` | [use-daily-routine.ts](../../src/features/routines/use-daily-routine.ts) | 1.5k | The resolved routine, stored whole: generated routines can be length-scaled (and shared routines aren't in the registry at all), so the i... |
| `practice-intelligence` | [weakness-analyzer.ts](../../src/features/practice-intelligence/weakness-analyzer.ts) | 1.4k | Weakness Analyzer — Detect problem areas from practice history Scans exercise history and session results to identify: - Low-scoring exer... |
| `playback` | [usePlaybackController.ts](../../src/features/playback/usePlaybackController.ts) | 1.1k | usePlaybackController — the Singing tab's transport Start/stop/seek across the three playback modes (free practice, session, backing track). |
| `falling-notes` | [useFallingNotesController.ts](../../src/features/falling-notes/useFallingNotesController.ts) | 936 | useFallingNotesController — Game logic for Synthesia-style piano practice |
| `home` | [DestinationGallery.tsx](../../src/features/home/DestinationGallery.tsx) | 779 | DestinationGallery — the Home page's card grid `HOME_DESTINATIONS` is the content; the component is the renderer. |
| `lab` | [LabSurface.tsx](../../src/features/lab/LabSurface.tsx) | 779 | Lab — hidden audio-research surface Not in TAB_GROUPS, so it never appears in the tab bar. |
| `voice-constellation` | [useVoiceConstellationIsolation.ts](../../src/features/voice-constellation/useVoiceConstellationIsolation.ts) | 768 | Voice Constellation Isolation — route-lifetime focus and page isolation. |
| `mic-feedback` | [MicLatencyWizard.tsx](../../src/features/mic-feedback/MicLatencyWizard.tsx) | 594 | MicLatencyWizard — measure the speaker-to-microphone round trip Plays a short click track through the speakers and records what comes bac... |
| `community` | [ProfileView.tsx](../../src/features/community/ProfileView.tsx) | 518 | ProfileView — your voice, so far Lifted out of CommunityShare, where it was ~200 lines inside an 1100-line component and could not be loo... |
| `session` | [useSessionSequencer.ts](../../src/features/session/useSessionSequencer.ts) | 436 | useSessionSequencer — drives a multi-item practice session item by item Between items it rewrites global musical context (key, scale, bpm... |
| `backgrounds` | [PremiumBackgroundPicker.tsx](../../src/features/backgrounds/PremiumBackgroundPicker.tsx) | 357 | PremiumBackgroundPicker — compact accessible stage gallery Locked cards intentionally render an atmospheric placeholder and never ask the... |
| `keyboard` | [useKeyboardShortcuts.ts](../../src/features/keyboard/useKeyboardShortcuts.ts) | 328 | useKeyboardShortcuts — global hotkeys, mounted once by App One document-level keydown listener for the whole app. |
| `routing` | [useHashRouter.ts](../../src/features/routing/useHashRouter.ts) | 299 | useHashRouter — binds the URL hash to app state, both directions The app has no file-system router. |
| `jam` | [useJamRoomBackground.ts](../../src/features/jam/useJamRoomBackground.ts) | 292 | Jam room background controller — shared host selection and protected bytes A Jam background is room state, not a personal preference. |
| `practice` | [usePracticeController.ts](../../src/features/practice/usePracticeController.ts) | 283 | usePracticeController — mic capture and scoring for the Singing tab Owns one mic lease for the duration of the practice run. |
| `tabs` | [constants.ts](../../src/features/tabs/constants.ts) | 236 | ── Tab ID constants Use these everywhere instead of raw strings. |
| `recording` | [useRecordingController.ts](../../src/features/recording/useRecordingController.ts) | 222 | useRecordingController — sung input captured as editable notes Feeds mic frames through the shared live-pitch pipeline (@/lib/pitch-pipel... |
| `account` | [local-progress-notice.ts](../../src/features/account/local-progress-notice.ts) | 192 | Signing in to an account made somewhere else Creating an account upgrades THIS device's row in place, so the account id and the device id... |
| `tours` | [usePageTourOffer.ts](../../src/features/tours/usePageTourOffer.ts) | 111 | Offer a page's spotlight tour once, the first time the user visits a tab that has one. |
| `editor` | [useEditorController.ts](../../src/features/editor/useEditorController.ts) | 93 | useEditorController — Compose-tab actions (MIDI import/export, share) The thin action layer over the piano-roll editor: import a MIDI fil... |
| `practice-timer` | [PracticeTimerPill.tsx](../../src/features/practice-timer/PracticeTimerPill.tsx) | 80 | PracticeTimerPill — the ambient voice-rest readout Deliberately quiet: it only appears once the timer has something to say, and the phase... |
| `events` | [usePianoRollEvents.ts](../../src/features/events/usePianoRollEvents.ts) | 72 | usePianoRollEvents — bridges eventBus messages into app state The canvas piano roll is not a Solid component, so it cannot call stores di... |

#### Library subsystems (`src/lib/<dir>/`) — algorithm packages

| Module | Entry point | LOC | What it is |
|---|---|---|---|
| `jam` | [jam-catalog.ts](../../src/lib/jam/jam-catalog.ts) | 5.7k | ── Jam catalogue Turns the app's practice content into something a jam room can run. |
| `mirror` | [metrics.ts](../../src/lib/mirror/metrics.ts) | 2.1k | Voice Mirror — pure metrics over F0 frame streams. |
| `pitch-algorithms` | [index.ts](../../src/lib/pitch-algorithms/index.ts) | 2.0k | Pitch Algorithms Library Export |
| `shazam` | [melody-matcher.ts](../../src/lib/shazam/melody-matcher.ts) | 1.9k | Melody Matcher — Multi-feature DTW scoring against fingerprints Phase 3 of Shazam Sing Takes a LivePitchContour (from the live pitch buff... |
| `backgrounds` | [background-surface.ts](../../src/lib/backgrounds/background-surface.ts) | 1.4k | Background surface controller — one resolved image for every Karaoke/Jam view A controller owns the selected private object URL and expos... |
| `guitar` | [guitar-synth.ts](../../src/lib/guitar/guitar-synth.ts) | 1.3k | Guitar Synthesis — Karplus-Strong physical modeling + bass |
| `glass` | [fracture.ts](../../src/lib/glass/fracture.ts) | 1.0k | Glass — fracture geometry, shard physics and the shatter timeline (spec §7 + §17.3). |
| `pitch-pipeline` | [index.ts](../../src/lib/pitch-pipeline/index.ts) | 786 | Barrel for the shared vocal pitch denoise + note-segmentation pipeline. |
| `key-detection` | [index.ts](../../src/lib/key-detection/index.ts) | 262 | Key Detection — barrel for musical-key estimation Krumhansl-Schmuckler profile correlation over a pitch-class histogram. |
| `tab` | [gp-to-midi-song.ts](../../src/lib/tab/gp-to-midi-song.ts) | 151 | Guitar Pro (.gp/.gp3/.gp4/.gp5/.gpx) → MidiSong mapping Pure mapping from an alphaTab Score into the app's existing MidiSong shape, so im... |
| `platform` | [index.ts](../../src/lib/platform/index.ts) | 127 | Platform services — web implementations. |
| `gpu` | [webgpu-device.ts](../../src/lib/gpu/webgpu-device.ts) | 66 | WebGPU device acquisition (seam for the planned TypeGPU backend) Adapted from the chaos-master project's WebgpuAdapter: a single shared d... |

#### Core library files (`src/lib/*.ts`, 400+ LOC)

| File | LOC | What it is |
|---|---|---|
| [piano-roll.ts](../../src/lib/piano-roll.ts) | 6.0k | Piano Roll Editor — Canvas-based note editor |
| [audio-engine.ts](../../src/lib/audio-engine.ts) | 2.4k | Audio Engine — Web Audio API playback and microphone input |
| [vocal-analyzer.ts](../../src/lib/vocal-analyzer.ts) | 1.5k | Vocal Analyzer — DSP utilities for vocal analysis features Phase 1: Intensity Mirroring, Breathiness Index, Slide Tracking |
| [sheet-music-renderer.ts](../../src/lib/sheet-music-renderer.ts) | 956 | Sheet Music Renderer — MelodyItem[] → VexFlow notation Renders a melody as proper multi-measure notation (barlines, key-aware accidentals... |
| [uvr-api.ts](../../src/lib/uvr-api.ts) | 860 | UVR API Client - Frontend Integration |
| [runpod-bridge.ts](../../src/lib/runpod-bridge.ts) | 766 | RunPod bridge — HTTP request/response handling Turns the app's /api/uvr/* requests into RunPod job calls and back into the responses the... |
| [lyrics-service.ts](../../src/lib/lyrics-service.ts) | 742 | Lyrics Service — fetch, parse, and sync lyrics |
| [playback-runtime.ts](../../src/lib/playback-runtime.ts) | 699 | PlaybackRuntime - Unified playback orchestrator Manages audio timing and syncs with PianoRollEditor |
| [pitch-detector.ts](../../src/lib/pitch-detector.ts) | 690 | Pitch Detector — YIN + McLeod Pitch Method (MPM) |
| [useWhisperTranscription.ts](../../src/lib/useWhisperTranscription.ts) | 668 | Shared Whisper transcription controller hook. |
| [practice-engine.ts](../../src/lib/practice-engine.ts) | 620 | Practice Engine — Mic, pitch detection, accuracy scoring |
| [effect-renderer.ts](../../src/lib/effect-renderer.ts) | 607 | Shared Effect Renderer Pure canvas drawing functions for slide, ease, and vibrato effects. |
| [uvr-processing-pipeline.ts](../../src/lib/uvr-processing-pipeline.ts) | 557 | UVR Processing Pipeline — Unified abstraction over: • Server mode → upload → poll /status → download stems • Local mode → VocalSeparator... |
| [runpod.ts](../../src/lib/runpod.ts) | 534 | RunPod bridge — translate the app's /api/uvr/* contract to/from RunPod's serverless job API. |
| [pitch-algorithm-tester.ts](../../src/lib/pitch-algorithm-tester.ts) | 506 | Pitch Algorithm Tester — Compare pitch detection algorithms |
| [mic-manager.ts](../../src/lib/mic-manager.ts) | 499 | ── MicManager Single, reference-counted owner of the capture microphone for the app's analysis features (pitch detection, scoring, live v... |
| [uvr-stem-split.ts](../../src/lib/uvr-stem-split.ts) | 490 | Stem split — break a session's instrumental into its parts Second separation pass over the ALREADY-SEPARATED instrumental: the server (de... |
| [scale-data.ts](../../src/lib/scale-data.ts) | 464 | Scale Data — Music theory utilities for MercuryPitch |
| [midi-generator.ts](../../src/lib/midi-generator.ts) | 428 | MIDI Generator — pitch-detect vocal audio → Standard MIDI File |
| [uvr-song-preparation.ts](../../src/lib/uvr-song-preparation.ts) | 418 | UVR song preparation — durable file-to-session orchestration shared by every upload surface UI remains outside this module. |
| [share-codec.ts](../../src/lib/share-codec.ts) | 402 | Share Codec — Base64url self-contained payload encoding Encodes melodies, exercises, and daily routines into compact base64url strings su... |
| [midi-song.ts](../../src/lib/midi-song.ts) | 400 | MIDI Song Parser — multi-track import with instrument names Unlike importMelodyFromMIDI (which flattens everything into one melody), this... |

#### Stores (`src/stores/`) — global reactive state

| File | LOC | What it is |
|---|---|---|
| [jam-store.ts](../../src/stores/jam-store.ts) | 2.8k | ── Jam store Reactive state management for P2P jam sessions. |
| [app-store.ts](../../src/stores/app-store.ts) | 2.0k | App Store — audio-engine singleton, key/scale, and ALL guided-tour content Two unrelated things share this file for historical reasons: 1. |
| [melody-store.ts](../../src/stores/melody-store.ts) | 1.7k | Melody Store — Melody items and scale data (in-memory) |
| [uvr-store.ts](../../src/stores/uvr-store.ts) | 1.6k | UVR Store — stem separation: settings, job status, and session records Covers both processing modes: `local` (ONNX in-browser, WebGPU whe... |
| [settings-store.ts](../../src/stores/settings-store.ts) | 657 | Settings Store — every persisted user preference, plus its defaults `SettingsConfig` is the shape; `DEFAULT_SETTINGS` is the fallback use... |
| [karaoke-playlist-store.ts](../../src/stores/karaoke-playlist-store.ts) | 502 | Karaoke Playlist Store — persisted set lists + playback transport A playlist is a saved, reusable set list built from session groups and/... |
| [session-store.ts](../../src/stores/session-store.ts) | 472 | Session Store — Unified session management with localStorage |
| [ui-store.ts](../../src/stores/ui-store.ts) | 457 | UI Store — active tab, modal/library visibility, focus mode, first-run flags `setActiveTab` is the app's navigation primitive; `onTabTran... |
| [background-store.ts](../../src/stores/background-store.ts) | 326 | Premium background store — account-safe shipped catalog and access evidence Access is memory-only and server-evidenced. |
| [theme-store.ts](../../src/stores/theme-store.ts) | 270 | Theme Store — the nine colour presets and how one gets picked Adding a preset means three edits in lockstep: the `THEME_PRESETS` tuple, a... |
| [practice-session-store.ts](../../src/stores/practice-session-store.ts) | 258 | Practice Session Store — the multi-item guided practice run A session is an ordered list of SessionItems, each repeated N times. |
| [onboarding-store.ts](../../src/stores/onboarding-store.ts) | 222 | First Light — onboarding flow state Which beat the visitor is on, which track they picked, and what (if anything) the voiceprint measured. |
| [annotation-store.ts](../../src/stores/annotation-store.ts) | 217 | Annotation Store — Sonic Visualiser-style annotation CRUD |
| [walkthrough-store.ts](../../src/stores/walkthrough-store.ts) | 185 | Walkthrough Store — Track completed walkthroughs |
| [notifications-store.ts](../../src/stores/notifications-store.ts) | 184 | Notifications Store — toast queue Toasts are pushed from anywhere and rendered by Notifications.tsx. |
| [practice-timer-store.ts](../../src/stores/practice-timer-store.ts) | 171 | Practice Timer Store — the voice-rest clock Off by default. |
| [falling-notes-store.ts](../../src/stores/falling-notes-store.ts) | 155 | Falling Notes Store — Game state for Synthesia-style piano practice |
| [exercise-history-store.ts](../../src/stores/exercise-history-store.ts) | 126 | Exercise History Store — completed-run log and per-exercise stats `recordExerciseResult` is the single funnel every exercise calls on fin... |
| [pane-layout-store.ts](../../src/stores/pane-layout-store.ts) | 114 | Pane Layout Store — Multi-pane layout persistence |
| [saved-midi-songs-store.ts](../../src/stores/saved-midi-songs-store.ts) | 100 | Saved MIDI Songs Store — imported MIDI songs (localStorage) Imported MIDI files for guitar/piano practice are kept in a shared store so t... |
| [console-store.ts](../../src/stores/console-store.ts) | 96 | Console Store — in-app console log capture for the debug overlay Mirrors console output into a ring buffer the ConsoleLog panel renders,... |
| [index.ts](../../src/stores/index.ts) | 95 | Stores barrel export |
| [mic-latency-store.ts](../../src/stores/mic-latency-store.ts) | 75 | Mic Latency Store — the measured round trip, per input device Per device on purpose: a USB interface and a laptop's built-in mic differ b... |
| [playback-store.ts](../../src/stores/playback-store.ts) | 67 | Playback Store — Transport and playback state |
| [usage-store.ts](../../src/stores/usage-store.ts) | 64 | Usage store — lightweight cumulative "has really used the app" tracking Persists two coarse signals across sessions: - usageMs: foregroun... |
| [billing-store.ts](../../src/stores/billing-store.ts) | 50 | Billing store — credit-balance refresh signal The balance is displayed by PricingPanel (Settings → Account) via /api/billing/me. |
| [mic-store.ts](../../src/stores/mic-store.ts) | 46 | Mic Store — page-facing mic indicator (NOT the device owner) Device ownership lives in src/lib/mic-manager.ts. |
| [playback-state-store.ts](../../src/stores/playback-state-store.ts) | 39 | Playback State Store — transport position, shared app-wide Prefer the `isPlaying()` / `isPaused()` / `isStopped()` helpers over reading t... |
| [transport-store.ts](../../src/stores/transport-store.ts) | 37 | Transport Store — persisted tempo, count-in and playback speed Every setter clamps to a musically valid range (bpm 40-280, speed 0.25-2.0x). |
| [uvr-upload-queue-store.ts](../../src/stores/uvr-upload-queue-store.ts) | 22 | UVR Upload Queue Store — app-lifetime holder for the stem-upload queue |

#### Pages (`src/pages/`) — route-level shells

| File | LOC | What it is |
|---|---|---|
| [GuitarPage.tsx](../../src/pages/GuitarPage.tsx) | 1.2k | Original tab fingering (Guitar Pro imports) is preserved through load. |
| [HomePage.tsx](../../src/pages/HomePage.tsx) | 594 | HomePage — the "today" landing surface One obvious next step: your streak (with forgiveness), today's generated 5–15 min session, this we... |
| [PianoPage.tsx](../../src/pages/PianoPage.tsx) | 407 | Derived in AppShell (also consumed by the playback wiring), threaded in. |
| [PathPage.tsx](../../src/pages/PathPage.tsx) | 339 | PathPage — The Ascent: the guided learning path A serpentine trail of celestial week-orbs climbing a night sky — week 1 at the foot, week... |
| [ExercisesPage.tsx](../../src/pages/ExercisesPage.tsx) | 223 | The app's single pitch-frame stream. |
| [LabPage.tsx](../../src/pages/LabPage.tsx) | 101 | Supporter research surface. |
| [KaraokePage.tsx](../../src/pages/KaraokePage.tsx) | 50 | Initial view / session come from the hash router (deep links), owned by AppShell so the router can keep writing them. |
| [JamPage.tsx](../../src/pages/JamPage.tsx) | 27 | Jam tab (TAB_JAM). |
| [LeaderboardPage.tsx](../../src/pages/LeaderboardPage.tsx) | 24 | Leaderboard tab (TAB_LEADERBOARD). |
| [ChallengesPage.tsx](../../src/pages/ChallengesPage.tsx) | 20 | Challenges tab (TAB_CHALLENGES). |
| [CommunityPage.tsx](../../src/pages/CommunityPage.tsx) | 20 | Community tab (TAB_COMMUNITY). |
| [AnalysisPage.tsx](../../src/pages/AnalysisPage.tsx) | 19 | One dashboard at every width. |
| [SettingsPage.tsx](../../src/pages/SettingsPage.tsx) | 11 | Settings tab (TAB_SETTINGS). |

#### Cloudflare Workers (`workers/`) — backend

| Module | Entry point | LOC | What it is |
|---|---|---|---|
| `db-worker` | [index.ts](../../workers/db-worker/src/index.ts) | 14.5k | ── MercuryPitch DB Worker Generic CRUD REST API over Cloudflare D1, matching the contract of the frontend ServerAdapter (src/db/adapters/... |
| `jam-worker` | [index.ts](../../workers/jam-worker/src/index.ts) | 1.3k | ── Jam Signaling Worker WebSocket upgrade router → Durable Object signaling relay. |

<!-- END:GENERATED module-map -->

---

## 4. Invariants worth knowing before you edit

### Microphone

`src/lib/mic-manager.ts` is the **only** capture path — a single
reference-counted owner shared by every analysis feature. Any new surface that
uses the mic must `registerMicIndicator` and release **unconditionally** on
unmount, or the mic leaks across pages. Never call `setPreferredDevice` from
page-local UI. `src/lib/mic-sentinel.ts` is the watchdog; ask bug reporters for
`window.__micSentinel.dump()`.

### SolidJS reactivity

Props are **not** destructured — that breaks reactivity. Reactive accessors must
be read **synchronously**, never inside an async callback:

```tsx
// wrong -- "computations created outside a `createRoot`" warning
onClick={() => { void (async () => { await del(activeTrack().id) })() }}
// right -- read the signal first, then go async
onClick={() => { const t = activeTrack(); void (async () => { await del(t.id) })() }}
```

`<For>` recreates rows when the underlying store commits, which will cancel a
pointer gesture mid-drag. Resetting a value-bound signal clobbers
`currentTarget.value` if you read it afterwards.

### Canvas performance

Never iterate a full audio buffer per-pixel inside `requestAnimationFrame`.
Precompute a min/max peak mipmap in `Float32Array` blocks at load time and draw
from that — `O(1)` per frame, and it avoids the moiré banding that
sample-skipping produces. Cache static backgrounds to an `OffscreenCanvas`.
Never pin an inline canvas `width`; use `src/lib/canvas-size-sync.ts`.

### Playback

`PlaybackRuntime.on('state')` hands the handler the **whole event object**, not
a bare state string. Use the `isPlaying` signal to detect pause/stop.

---

## 5. How-to — common tasks

| Task                   | Start here                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Add a route/page       | `src/lib/hash-router.ts` + `src/features/routing/useHashRouter.ts` + `src/pages/`                         |
| Add a global setting   | `src/stores/settings-store.ts` → `src/components/SettingsPanel.tsx`                                       |
| Add a guided-tour step | `WALKTHROUGH_STEPS` / `PAGE_TOURS` in `src/stores/app-store.ts` + `Walkthrough.tsx`                       |
| Add an exercise        | `src/features/exercises/<name>/` — copy the nearest sibling's shape                                       |
| Change stem separation | `src/lib/uvr-processing-pipeline.ts`, `src/lib/uvr-api.ts`, `src/stores/uvr-store.ts`                     |
| Change lyrics timing   | `src/lib/canonical-lrc.ts`, `src/lib/lyrics-service.ts`, `src/features/stem-mixer/lrc-gen-engine.ts`      |
| Touch pitch detection  | `src/lib/pitch-pipeline/` (live) and `src/lib/pitch-algorithms/` (detectors)                              |
| Add an API endpoint    | `workers/db-worker/src/index.ts` — **and** add the route to `assets.run_worker_first` in `wrangler.jsonc` |
| Add a DB column        | new `workers/db-worker/migrations/NNNN_<what>.sql` — next number, never edit an applied one               |

### Verification gates

| Change touches                               | Required check                                                        |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Root app (`src/`, root config)               | `pnpm typecheck` once before the first PR push                        |
| Beside Cue or shared mobile packages         | `pnpm beside-cue:typecheck` once before the first PR push             |
| DB Worker                                    | `pnpm typecheck:db` once before the first PR push                     |
| Jam Worker                                   | `pnpm typecheck:jam` once before the first PR push                    |
| Tour steps or tour-targeted DOM              | Verify the affected `targetSelector`s resolve. **Not** the full walk. |
| Exercise chrome / mobile layout              | `pnpm audit:mobile`                                                   |
| Pointer-driven controls (drag, scrub, swipe) | A real-mouse Playwright spec, red→green, tagged `@smoke`              |
| Release                                      | `/prod-upd`, which includes the full `pnpm test:tours` walk           |

Before the first PR push, also run `pnpm pr:prepare` once for every work item.
For cross-workspace changes, run each affected typecheck once. After the PR is
open, use CI as the authoritative full gate and rerun only the targeted command
for a failure.

`pnpm test:tours` is a **release gate, not a per-PR gate** — it takes 20+
minutes. Do not run it per change, even when editing tour steps.

---

## 6. Context-budget hazards

<!-- BEGIN:GENERATED heavy-files -->
Reading any of these end-to-end costs roughly 1.2k+ lines of context.
Grep for the symbol and read the surrounding range instead.

| File | LOC |
|---|---|
| [src/components/StemMixer.tsx](../../src/components/StemMixer.tsx) | 7.5k |
| [src/lib/piano-roll.ts](../../src/lib/piano-roll.ts) | 6.0k |
| [src/App.tsx](../../src/App.tsx) | 4.1k |
| [src/components/UvrPanel.tsx](../../src/components/UvrPanel.tsx) | 3.2k |
| [src/stores/jam-store.ts](../../src/stores/jam-store.ts) | 2.8k |
| [src/components/PitchTestingTab.tsx](../../src/components/PitchTestingTab.tsx) | 2.5k |
| [src/lib/audio-engine.ts](../../src/lib/audio-engine.ts) | 2.4k |
| [workers/db-worker/src/premium-background-admin.ts](../../workers/db-worker/src/premium-background-admin.ts) | 2.2k |
| [workers/db-worker/src/index.ts](../../workers/db-worker/src/index.ts) | 2.2k |
| [src/features/glass/GlassApp.tsx](../../src/features/glass/GlassApp.tsx) | 2.1k |
| [src/components/PitchCanvas.tsx](../../src/components/PitchCanvas.tsx) | 2.1k |
| [src/features/admin/AdminPremiumPerksPage.tsx](../../src/features/admin/AdminPremiumPerksPage.tsx) | 2.0k |
| [src/stores/app-store.ts](../../src/stores/app-store.ts) | 2.0k |
| [workers/db-worker/src/auth.ts](../../workers/db-worker/src/auth.ts) | 1.9k |
| [src/features/stem-mixer/useStemMixerLyricsController.ts](../../src/features/stem-mixer/useStemMixerLyricsController.ts) | 1.9k |
| [src/features/stem-mixer/useStemMixerCanvasController.ts](../../src/features/stem-mixer/useStemMixerCanvasController.ts) | 1.9k |
| [src/components/SettingsPanel.tsx](../../src/components/SettingsPanel.tsx) | 1.9k |
| [src/features/mirror/MirrorApp.tsx](../../src/features/mirror/MirrorApp.tsx) | 1.7k |
| [src/features/stem-mixer/useLrcGenController.ts](../../src/features/stem-mixer/useLrcGenController.ts) | 1.7k |
| [src/stores/melody-store.ts](../../src/stores/melody-store.ts) | 1.7k |
| [workers/db-worker/src/guided-exercises.ts](../../workers/db-worker/src/guided-exercises.ts) | 1.6k |
| [src/stores/uvr-store.ts](../../src/stores/uvr-store.ts) | 1.6k |
| [src/features/admin/exercises/ExerciseEditor.tsx](../../src/features/admin/exercises/ExerciseEditor.tsx) | 1.6k |
| [src/components/icons.tsx](../../src/components/icons.tsx) | 1.5k |
| [src/lib/vocal-analyzer.ts](../../src/lib/vocal-analyzer.ts) | 1.5k |
| [src/components/jam/JamPanel.tsx](../../src/components/jam/JamPanel.tsx) | 1.4k |
| [src/components/CommunityLeaderboard.tsx](../../src/components/CommunityLeaderboard.tsx) | 1.4k |
| [src/components/LibraryModal.tsx](../../src/components/LibraryModal.tsx) | 1.4k |
| [src/db/services/session-export-service.ts](../../src/db/services/session-export-service.ts) | 1.3k |
| [src/components/FallingNotesCanvas.tsx](../../src/components/FallingNotesCanvas.tsx) | 1.3k |
| [src/components/StemMixerLyricsPanelBody.tsx](../../src/components/StemMixerLyricsPanelBody.tsx) | 1.3k |
| [src/features/stem-mixer/useStemMixerAudioController.ts](../../src/features/stem-mixer/useStemMixerAudioController.ts) | 1.3k |
| [src/features/guitar-practice/useGuitarPracticeController.ts](../../src/features/guitar-practice/useGuitarPracticeController.ts) | 1.3k |
| [src/components/CommunityShare.tsx](../../src/components/CommunityShare.tsx) | 1.2k |
| [src/components/ShazamListen.tsx](../../src/components/ShazamListen.tsx) | 1.2k |
<!-- END:GENERATED heavy-files -->

CSS is the other trap: `src/styles/uvr.css`, `vocal-analysis.css`,
`guitar-practice.css`, `exercises.css`, and `app.css` are each 35–90 KB. Grep
for the selector; never read them whole.

---

## 7. Browser-preview gotchas

The headless preview lies in specific, repeatable ways:

- **First-run overlays block the page.** Set `localStorage` key
  `pitchperfect_welcome_version` to the app version (and the survey key), then
  reload, before testing anything.
- **`requestAnimationFrame` is paused headless** — canvases freeze and
  screenshots time out. Verify canvas output via `getImageData`/`toDataURL` and
  assert on the DOM for HUD state.
- **The dev server is HTTPS-only.** `VITE_NO_SSL=1` plus the `app-http` launch
  config gets you plain HTTP; revert before committing.
- **The mic needs a shim** — stub `getUserMedia` with an oscillator, and fix the
  0×0 viewport. Prefer `element.click()` over synthetic pointer clicks.
- **The piano falling-notes game is audio-gated** and will not advance headless
  (`startGame` awaits an `AudioContext` resume). Verify it by unit test instead.
- `backdrop-filter: none` in headless output is an artifact, not a regression.

---

## 8. Commands

<!-- BEGIN:GENERATED scripts -->
| Script | Runs |
|---|---|
| `pnpm dev` | `cross-env VITE_OVERRIDE_ONNX_MODEL= vite` |
| `pnpm dev:host` | `cross-env VITE_OVERRIDE_ONNX_MODEL= vite --host` |
| `pnpm dev:jam` | `cd workers/jam-worker && npx wrangler dev --port 8787 --live-reload` |
| `pnpm dev:db` | `cd workers/db-worker && npx wrangler dev --port 8788 --live-reload` |
| `pnpm dev:db:cron` | `cd workers/db-worker && npx wrangler dev --port 8788 --live-reload --test-scheduled` |
| `pnpm dev:seed` | `node scripts/seed-dev-league.mjs` |
| `pnpm dev:seed:reset` | `node scripts/seed-dev-league.mjs --reset` |
| `pnpm dev:uvr-worker` | `npx wrangler dev -c wrangler.uvr-dev.jsonc --port 8790 --var DB_API_URL:http://localhost:8788` |
| `pnpm dev:runpod` | `cross-env VITE_OVERRIDE_ONNX_MODEL= VITE_UVR_WORKER=1 VITE_UVR_PROXY_PORT=8790 vite` |
| `pnpm build` | `vite build` |
| `pnpm build:tours` | `cross-env VITE_API_BASE_URL= VITE_OVERRIDE_ONNX_MODEL= VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= vite build` |
| `pnpm build:e2e` | `cross-env VITE_API_BASE_URL= VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= vite build` |
| `pnpm build:dev` | `vite build --mode development` |
| `pnpm preview` | `cross-env VITE_OVERRIDE_ONNX_MODEL= vite preview` |
| `pnpm prod` | `cross-env VITE_OVERRIDE_ONNX_MODEL= vite build && vite preview` |
| `pnpm test` | `vitest` |
| `pnpm test:ui` | `vitest --ui` |
| `pnpm test:run` | `vitest run` |
| `pnpm test:coverage` | `vitest run --coverage` |
| `pnpm test:e2e` | `playwright test` |
| `pnpm lyrics:compare` | `node scripts/compare-lrc-timing.mjs` |
| `pnpm marketing:capture` | `node scripts/capture-marketing.mjs` |
| `pnpm test:tours` | `node scripts/walk-tours.mjs` |
| `pnpm audit:mobile` | `node scripts/audit-exercises-mobile.mjs` |
| `pnpm verify:opening` | `node scripts/verify-opening.mjs` |
| `pnpm beside-cue:dev` | `pnpm --filter @irchiinnuss/beside-cue-app dev` |
| `pnpm beside-cue:build` | `pnpm --filter @irchiinnuss/beside-cue-app build` |
| `pnpm beside-cue:check` | `pnpm --filter @irchiinnuss/beside-cue-core --filter @irchiinnuss/mobile-runtime --filter @irchiinnuss/beside-cue-app check` |
| `pnpm beside-cue:test` | `pnpm --filter @irchiinnuss/beside-cue-core --filter @irchiinnuss/mobile-runtime --filter @irchiinnuss/beside-cue-app test:run` |
| `pnpm beside-cue:android` | `pnpm --filter @irchiinnuss/beside-cue-app cap:run:android` |
| `pnpm serve` | `pnpm dlx http-server dist -p 4173 -c-1` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm fmt` | `prettier src --check` |
| `pnpm fmt:write` | `prettier src --write --log-level warn` |
| `pnpm lint` | `eslint src` |
| `pnpm lint:fix` | `eslint src --fix` |
| `pnpm lint:audit` | `eslint -c eslint.audit.config.js src workers` |
| `pnpm lines` | `cloc src --exclude-dir=node_modules,dist --by-file-by-lang --not-match-f='(.*[.]d[.]ts|.*[.]stories[.].*|.*[.]test[.].*|.*[.]json)'` |
| `pnpm docs:index` | `node scripts/gen-agent-index.mjs` |
| `pnpm docs:index:check` | `node scripts/gen-agent-index.mjs --check` |
| `pnpm pr:prepare` | `node scripts/pr-prepare.mjs` |
| `pnpm pr:validate` | `node scripts/pr-prepare.mjs --check` |
| `pnpm pr:prepare:test` | `node --test scripts/pr-prepare.test.mjs` |
| `pnpm assets:legends` | `node scripts/gen-legend-tiers.mjs` |
| `pnpm assets:legends:check` | `node scripts/gen-legend-tiers.mjs --check` |
| `pnpm assets:pwa-images` | `node scripts/optimize-pwa-images.mjs` |
| `pnpm check:ci` | `run-s typecheck lint fmt docs:index:check` |
| `pnpm check:syntax` | `pnpm run check:ci` |
| `pnpm check` | `run-s typecheck lint:fix fmt:write` |
| `pnpm beside-cue:typecheck` | `pnpm --filter @irchiinnuss/beside-cue-core --filter @irchiinnuss/mobile-runtime --filter @irchiinnuss/beside-cue-app exec tsc --noEmit` |
| `pnpm deploy:dev` | `pnpm exec wrangler deploy --env dev` |
| `pnpm deploy:prod` | `pnpm exec wrangler deploy --env prod` |
| `pnpm deploy:jam:dev` | `cd workers/jam-worker && pnpm exec wrangler deploy --env dev` |
| `pnpm deploy:jam:prod` | `cd workers/jam-worker && pnpm exec wrangler deploy --env prod` |
| `pnpm deploy:all:dev` | `run-s deploy:dev deploy:jam:dev` |
| `pnpm deploy:all:prod` | `run-s deploy:prod deploy:jam:prod` |
| `pnpm db:init` | `./scripts/init-cloudflare-db.sh all prod` |
| `pnpm db:init:dev` | `./scripts/init-cloudflare-db.sh all dev` |
| `pnpm db:init:local` | `./scripts/init-cloudflare-db.sh --local` |
| `pnpm db:seed` | `node scripts/seed-remote-db.mjs` |
| `pnpm db:seed:weekly` | `node scripts/seed-weekly-rotation.mjs` |
| `pnpm deploy:db:dev` | `cd workers/db-worker && pnpm exec wrangler deploy --env dev` |
| `pnpm deploy:db:prod` | `cd workers/db-worker && pnpm exec wrangler deploy --env prod` |
| `pnpm typecheck:db` | `tsc -p workers/db-worker` |
| `pnpm typecheck:jam` | `tsc -p workers/jam-worker` |
| `pnpm size` | `vite build && du -sh dist/assets/*.js dist/assets/*.css dist/assets/*.wasm 2>/dev/null | sort -rh` |
<!-- END:GENERATED scripts -->

---

## Keeping this file honest

```bash
node scripts/gen-agent-index.mjs
```

Run it when modules are added, moved, or renamed. `--check` fails if stale —
wire it into CI so an out-of-date map breaks the build instead of quietly
misleading the next agent. A stale index is worse than no index: it sends agents
hunting for things that do not exist.

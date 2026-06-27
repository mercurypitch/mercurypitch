# Developer Changelog

Detailed engineering history. The concise, user-facing summary shown in the
app's "What's New" modal lives in [`CHANGELOG.md`](./CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.5] - 2026-06-26

### Added

- `ExerciseShell` (`src/features/exercises/ExerciseShell.tsx`): shared chrome for all 18 exercise components — header with a top-left "?" help toggle + collapsible panel, idle area with the Start button placed beneath the description/settings, a single result action (one "Try Again" in the overlay; "Change Target" in the controls), and an optional auto-score timer. All 18 `XxxExercise.tsx` components migrated to it; per-exercise canvas/metrics/idle content passed via slots. Celebration `createEffect`, controllers, autoStart, and `onCleanup` preserved per component.
- `exercise-help.ts`: `Record<ExerciseType, { summary; body }>` beginner help text; `IconQuestion` added to `exercise-icons.tsx`.
- Timed auto-score mode for the continuous-hold drills (long-note, vibrato, pitch-hold) via the shell's `autoTimer` prop (presets 5/15/30s). The timer arms only on the `active` transition so the `autoStart` path and the transient `count-in` state never trigger a premature stop.
- Moving target guide in `PitchOverTimeCanvas` (`movingTarget?: () => number | null`, forwarded through `ExercisePitchTracker`): an amber guide line + glowing dot that moves vertically. Driven by `SlideExercise` as a looping triangle-wave glide between the from/to notes.
- Vibrato styles + guide: new `vibrato/vibrato-styles.ts` (slow/medium/fast presets with research-backed rate/depth windows + sine-guide params). `useVibratoController` gains `setStyle(id)` and scores against the chosen style's windows. `VibratoExercise` adds a target-note line (`targetNoteMidi`), a sine `movingTarget` the singer traces (style rate/depth, toggle via "Show the wave"), and a style picker. Help text updated; added a style-scoring regression test.
- Exercise mic toggle: `ExerciseShell` renders the shared `MicButton` (via `EngineContext`, read with `useContext` so it no-ops without a provider in tests) to start/stop the mic and show input level.
- Recent-scores chip enlarged: `ExerciseScoreHistory` now features the latest score prominently with the previous few + Best.
- Target-note line on every exercise: `targetNoteMidi` is now wired into `ExercisePitchTracker` for all remaining exercises (interval-trainer, scale-runner, arpeggio-jumper, drone-intonation, call-response, mirror-melody, chord-stacker, staccato-precision, dynamic-swell, routine-runner via `() => base.state().metrics.currentMidi || undefined`; pitch-hold via its selected note). Previously only long-note/vibrato/slide/siren/sight-singing drew it.

### Changed

- Exercise completion flow: removed the per-exercise `showCelebration(...)` modal and the `ExerciseShell` result overlay. A finished run now returns to the idle (selector + Start) state — `complete` is treated as idle-like and the Start button calls `onTryAgain` (reset + start). Recent scores render via a new `ExerciseScoreHistory` chip (top-right of the canvas, reads `exerciseHistory()`/`getExerciseStats()`), most-recent highlighted, with Best. `recordExerciseResult`/`updateDifficultyFromEma` still run in each component's result effect.
- Exercise idle layout: Start + note pills + timer toggle moved into a centred `.exercise-idle-center` beneath the description (was a bottom strip). Added a spacebar shortcut in `ExerciseShell` (start when idle, stop when active, try-again when complete; ignored while a form control/button is focused).
- Readability: lifted dark-theme `--text-secondary` (`#8b949e → #a8b3bf`) and `--text-muted` (`#484f58 → #6e7681`); bumped tiny font sizes and set explicit colors on `.badge-tier`/`.badge-name`/`.achievement-desc`/`.achievement-points`.
- Auto-zoom (`PitchOverTimeCanvas`): when the sung range is small, the view now targets ~1 octave + ~4 semitones headroom (floored at 0.5 oct half-range) instead of forcing 2 octaves, with exponential smoothing of the log bounds between frames to avoid jumpiness.
- Nav grouping (`AppNavTabs.tsx`): moved the Exercises tab from the Social group into the Practice group, positioned before Karaoke (Karaoke remains last). No logic change — button markup relocated only.

### Fixed

- `detectVibrato` (`src/lib/vocal-analyzer.ts`): the FFT assumed uniformly-spaced samples, but the live pitch stream is non-uniform (samples emitted only on confident frames at variable rAF timing), so vibrato was mis-rated or undetected. It now resamples MIDI onto a uniform time grid via the `time` field, applies a Hann window, and derives `binWidth` from the resampled rate. The vibrato controller analyzes a trailing ~4s window. Added a non-uniform/lossy-sampling regression test.
- Time-window scoring bug across controllers: `siren`, `drone-intonation`, `staccato-precision`, `routine-runner` selected the recent window via `slice(-floor(windowMs/50))` (a wrong 50ms/sample assumption). Replaced with a shared `trailingSamplesByTime(history, windowMs)` helper that filters by the `time` field. `interval-trainer` now averages cents deviation via `freqToExactMidi` (was custom MIDI math + single best sample); `pitch-hold` uses `freqToExactMidi`; `sight-singing` scores each note over its real on-screen window (recorded `_getElapsed()` boundaries) instead of an assumed `i * 2000ms` grid.
- Siren note generation: `generateSirens` previously used spans up to 32 semitones with one-sided clamps (`Math.max(36,start)` / `Math.min(84,end)`), so wide descending glides produced sub-audible/negative MIDI (the "G0"). Now exported + parameterized by `[rangeMin, rangeMax]` (from `getComfortableMidiRange`), with singable spans (≤12, ≤range) shifted into range as a pair without distortion. `SirenExercise` shows the end note as a target line + a triangle-wave glide guide (`movingTarget`) and labels start→end. Added a range-safety regression test.
- `PitchOverTimeCanvas`: the latest-dot note label now falls back to deriving the name from the dot's frequency (exercise samples carry no `noteName`), and `drawYAxisLabels` draws per-note gridlines/labels when zoomed to ≤ ~2.6 octaves (every semitone ≤1.4 oct, else every 2nd) instead of only octave Cs.
- `.exercise-card-grade` is now `inline-flex` + `align-items: center` so the grade icon centers with its label.
- Exercise difficulty badge + filter (`ExerciseMenu.tsx`): added a curated intrinsic `EXERCISE_DIFFICULTY: Record<ExerciseType, 'easy'|'medium'|'hard'>` shown as a badge on every card, plus All/Easy/Medium/Hard filter pills (`visibleCards` memo). Replaced the per-card adaptive `DifficultyIndicator` (which hid itself at the default level 5, so it only appeared on practised exercises and read as a fixed rating) — the adaptive level still drives scoring via `launchDifficulty`/`difficulty-store`, it's just no longer the card badge. `DifficultyIndicator.tsx` is now unused.
- Sight-Singing rewrite (`use-sight-singing-controller.ts` + `SightSingingExercise.tsx`): `setScale(scale, rangeMin, rangeMax)` generates notes only within `getComfortableMidiRange(preset)` (pitch-classes from the current scale), preferring stepwise motion. Replaced the fixed 2s `setInterval` auto-advance with a pitch-driven poll (`HOLD_TO_PASS_MS` in-tolerance hold, `MAX_NOTE_MS` timeout fallback) that scores each note at advance and emits live metrics (`holdPct`, `detectedMidi`, `centsOff`, `matched`). Staff now maps by diatonic step (lines E4-G4-B4-D5-F5), draws ledger lines + ♯ accidentals + a real treble clef glyph, and highlights the active note; added a hold bar and a DEV-only (`import.meta.env.DEV`) detected/target/hold readout.
- Interval Trainer & Dynamic Swell scored ~0 regardless of performance: `evaluateRound()` set its window start (`matchStartTime`/`holdStartTime`) and bound from absolute `performance.now()`, but pitch samples store `time` as exercise-relative (`elapsed/1000`). The predicate `p.time*1000 >= start-100` was therefore always false → the window selected zero samples → score 0. Both now use `base._getElapsed()` (same relative epoch) for the window start and the upper bound. Added driven happy-path regression tests for both (the interval-trainer happy path was previously un-assertable for this exact reason).
- Routine Runner score could exceed 100: `fatigueScore = fatigued ? max(0, 100 + hnrTrend*2) : 100` was unclamped, so a positive `hnrTrend` pushed the 30%-weighted term past 100. Now `min(100, max(0, …))`.
- Stable exercise metric shapes: the empty/zero-result branches of `arpeggio-jumper` and `call-response` (missing `richnessScore`) and `dynamic-swell` (missing `dynamicRangeDb`/`avgDb`/`peakDb`) now emit the same key set as their populated branches (zeroed), so consumers see a consistent shape.

### Tests

- New controller unit tests (deterministic, via a shared `createMockBase`): `interval-trainer`, `scale-runner`, `arpeggio-jumper`, `drone-intonation`, `call-response`, `chord-stacker`, `staccato-precision`, `routine-runner`, `dynamic-swell`, `sight-singing`. Each covers the empty-history floor (score 0 + real metric keys), setup/generation (targets/sequences within the requested range and scale), and a synthetic happy path (fake-timer driven where a poll loop is involved). The sight-singing range test locks the "notes within `[rangeMin, rangeMax]`" regression; the interval-trainer/dynamic-swell happy paths lock the relative-clock window fix.

## [0.4.4] - 2026-06-26

### Fixed

- Display-name save failed on cloud accounts with `404 Unknown entity: leaderboardEntries`. `AccountSection.saveDisplayName` still client-wrote the `leaderboardEntries` table, but the db-worker no longer exposes it (`workers/db-worker/src/tables.ts`) — the leaderboard is server-derived from `sessionRecords` and reads names from `userProfiles` (`COALESCE(p."displayName", ...)`). Dropped the dead leaderboard-rename block and the unused `LeaderboardEntry` import; updating `userProfiles.displayName` is sufficient. Only surfaced on cloud accounts (the local Dexie table is directly writable). Added a regression test asserting the leaderboard repo is not written.

## [0.4.3] - 2026-06-26

### Fixed

- Cloud accounts unavailable on mercurypitch.com ("no API configured"): the prod build (`vite build`) had no `VITE_API_BASE_URL` — only `.env.development` set it. Added `.env.production` pointing the prod build at the prod db-worker (`mercury-pitch-db.komediruzecki-2015.workers.dev`), mirroring `.env.development`.

### Changed

- Bumped `wrangler` to 4.105.0 and `@cloudflare/workers-types` to 4.20260625.1 (peer).

## [0.4.2] - 2026-06-25

### Fixed

- Shazam Sing view: the shared icon components render at a fixed 24px, which dwarfed the small button labels after the icon migration. Scoped icon sizing + inline-flex alignment in `ShazamListen.module.css` (13px on the Speech/Debug toggles, 16px on Stop & Match / Cancel / Try Again, 14px on the "Upload audio instead" link).

## [0.4.1] - 2026-06-25

### Added

- **Navigation-aware spotlight tour engine** (`Walkthrough.tsx`): steps can switch tabs (`requiredTab`), click through sub-tabs/sub-views/dropdowns to reveal a target (`navigate[]`, generation-token guarded), and open the off-canvas mobile sidebar (`inSidebar`, store-backed `sidebarOpen`). Springy glide + pulsing accent ring with a `prefers-reduced-motion` opt-out; tall targets scroll to their top; a listener-leak fix. Per-page tours for every tab via `PAGE_TOURS` + `PAGE_TOUR_CATALOG`, all listed in the Guide modal; stale legacy selectors refreshed onto a stable `data-tour` layer; crammed steps split into focused substeps.
- **Learn tutorials for every feature** (`src/types/walkthrough-content-extended.ts`, spread into `WALKTHROUGHS`; `WALKTHROUGH_TABS` extended): one read-along guide per remaining tab, plus a per-tutorial "Take the interactive tour" bridge in `WalkthroughModal` (per-id overrides, e.g. "Understanding Practice Modes" -> a focused practice-modes tour).
- **Shared mic-insights engine** (`useMicInsights`): debounced `none` / `no-input` / `too-quiet` state machine with a readable min-display hold, a reactive `insight()` and an `onChange` callback; tab-agnostic `MicInsightHint`. Ported to Singing, Karaoke, Piano, Guitar and Jam via a shared `rmsOfTimeData`/`rmsOfAnalyser` helper (per-tab `getInputLevel`).
- **StemMixer Vocal Pitch**: togglable live mic pitch line (red) and sung-note labels on the red user outlines; the mic hint now lives in the Vocal Pitch panel header; lyric-tool tour steps scoped to individual buttons.
- **Find My Voice** (`VoiceTypeDetectorModal`): auto-requests the mic and starts listening on open, waits for a strong sustained "Ah", scratches an abandoned take, with a live hearing/singing indicator and a permission-error retry.

### Changed

- **Exercises**: compact card redesign (badge icons, pill tags, centered gallery, centered Start); practice-intel reorg (suggestions + recent sessions up top, always-shown "Get started" fallback via a `WeaknessPanel` `fallback` prop).
- **Karaoke share link** gated behind a new `PREMIUM_FEATURES` flag (`src/lib/defaults.ts`, off by default; `VITE_PREMIUM_FEATURES=true` to enable) since sessions are local IndexedDB only; the session-id pill now shows the song duration.

### Fixed

- Self-review pass: per-frame `Float32Array` allocation removed from `rmsOfAnalyser`; Guitar count-in no longer trips "can't hear you"; `useMicInsights` `now()` falls back to `Date.now()`; the tour prepare-effect tracks `tourSteps()`; `GuideSelection` keydown listener moved to an `isOpen`-keyed effect with cleanup; the Karaoke/StemMixer tour is guarded on a loaded mixer (both Guide modal and Learn bridge).
- `.fn-btn` is `inline-flex` (score-card icon/label alignment); `.sm-session-id` fits its content; tab-name drift fixed in tours and Learn guides ("Practice Tab" -> "Singing", "Editor tab" -> "Compose").
- Resolved the outstanding `solid/reactivity` warnings in `GuitarPage`/`PianoPage`.

### Tests

- Re-runnable, gitignored Playwright control scripts in `assets/local/playwright/`: page-tours (35/35), guide-modal (16/16), learn-modal (20/20), legacy selectors (25/25), mobile tour (28/28). Full suite stays at 2053 passing.

## [0.4.0] - 2026-06-24

### Added

- **Practice Intelligence**: adaptive-difficulty engine (per-exercise EMA with hysteresis), weakness analyzer + targeted micro-drills, and a trends dashboard with a calendar heatmap and sparklines. Difficulty is wired into all 16 exercise controllers (scoring tolerance / counts / timing scale with the level; level 5 reproduces prior behaviour), and weak-pitch drills seed the target note for long-note and scale-runner.
- **Pitch accuracy heatmap**: per-note accuracy heatmap below the pitch canvas with click-to-seek to the note.
- **Onboarding survey**: optional post-welcome survey (deployed builds only, signed-in users), persisted to the cloud via a new `userSurveyResponses` entity.
- **Loading skeletons**: shimmer placeholders for lazy-loaded tabs.
- **Transition animations**: sidebar/backdrop/score-card/tab animations, reduced-motion aware.
- **Accessibility baseline (WCAG 2.2 AA)**: skip link, focus-visible, focus trap + dialog semantics for modals, labelled auth inputs, larger hit targets, reduced-motion reset, and a labelled falling-notes canvas.

### Changed

- **Server-authoritative leaderboard**: `GET /api/leaderboard` derives rankings from `sessionRecords` (per-user aggregates + server-computed streak; global/friends, all-time/weekly). The client-writable `leaderboardEntries` path was removed; old rows are wiped via `scripts/wipe-leaderboard-entries.sql`.
- **Backend hardening**: per-IP CRUD write rate limiting, score validation, fail-closed auth, constant-time login, security headers/CSP, and a top-level db-worker error boundary (CORS-bearing 500s instead of opaque "Failed to fetch").

### Fixed

- Survey is only shown to signed-in users (a signed-out submit hit the user-scoped write guard).
- Login email/password inputs get `name` + `autocomplete="username"`/`current-password` so password managers can fill the saved credential.
- UI icon-migration regressions: WebGPU/CPU badge icon no longer overflows its pill, library modal Cancel/Create button icons centered/sized, dead Session Editor collapse chevron wired up, and a dedicated Playlists tab icon.
- Performance: memoized falling-notes MIDI range and per-frame judgment indexing.

### Tests

- DexieAdapter query engine covered via fake-indexeddb; ServerAdapter retry/response handling; practice-intelligence engine modules.

## [0.3.14] - 2026-06-19

### Added

- **Karaoke Playlist Mode**: Build saved, reusable set lists from session groups and/or individual sessions in a new togglable left sidebar on the Stem Mixer (Karaoke tab). Per-entry singer assignment ("who will do this song"), optional shuffle of the overall order and of songs within a group, and persistent storage in IndexedDB (`karaokePlaylists`).
- **Guided Playback Flow**: A top "get ready" overlay shows the current song → group/singer → duration with a 4‑3‑2‑1‑Go countdown; the instrumental plays for true karaoke while the vocal stem is kept silent but tapped as the pitch reference for scoring. After each song the score modal appears, then the next song's overlay; a final ranked scoreboard recaps every singer at the end.
- **Mic Monitoring ("Hear my voice")**: Optional toggle + volume to route the mic to the speakers/headphones so singers hear themselves over the backing track — no second app required (off by default to avoid feedback; best with headphones).
- **Now-Playing Tab Title & Header**: The browser tab shows `MercuryPitch — <song>` during playback, and the Stem Mixer header gains a dimmed subtitle (Singer · Song · Next) while a playlist is running.
- **Playlist Gallery**: A collapsible gallery of saved playlists above the session list in the Karaoke upload view, each card showing song/singer counts with quick Play, Export, Rename and Delete actions. The session list is collapsible too.
- **Quick-start & countdown polish**: Each playlist row (sidebar and gallery) has an immediate Play button, and the countdown overlay greets the singer with an "Are you ready, <singer>?" pill.
- **Export/Import Karaoke**: Export a playlist to a ZIP containing its songs plus a manifest of the playlist structure, groups and singer assignments; importing a karaoke ZIP recreates the sessions, groups and playlists with remapped ids.
- **In-playback playlist transport**: Prev / Skip / Stop controls in the Stem Mixer header subtitle so you can skip the current song mid-play (previously the playlist only advanced when a song finished).
- **Mic monitor mixer**: A "Hear myself" toggle + volume fader in the Stem Mixer right sidebar (next to the stem faders) to set self-monitoring loudness during karaoke.
- **Playlist builder pill view**: Add songs/groups via click-to-toggle pill badges (or classic dropdowns), with a compact items view, collapsible add list, and bounded/scrollable lists so the editor stays reachable.
- **Round-robin "turns" mode**: A play mode where each group takes one song per round (like players taking turns) until every song has played; a standalone session counts as a one-song group, and shuffle re-randomises the turn order each round.
- **Reusable playlist editor**: The same editor is available in the Stem Mixer sidebar and inline via an "Edit" button on each gallery card in the upload view. Add songs into a playlist group by selecting the group item, then clicking song pills.
- **Focus-mode now-playing bar**: In karaoke focus mode (header hidden), a slim top bar shows Singer · Song · Next plus Prev/Skip/Stop controls; the playlist sidebar auto-closes once a song starts.
- **Search sessions by song**: A fuzzy search box (substring + subsequence) in the Karaoke session library filters songs by name across all groups.
- **Upload pre-separated stems**: Add a session from an uploaded vocal and/or instrumental (no separation). Add the missing stem later, or replace a stem with a better file — from the session card's stem list or the stem results view.

### Fixed

- **Playlist song loading**: Fixed a keyed-remount race where the Stem Mixer could show one song but play another, and stopped the URL-hash sync from re-triggering session loads (which made the mixer reload songs) during playlist playback.
- **Karaoke vocal muting**: The reference vocal is now silenced via the track's mute flag (so the mute button and waveform reflect it) while still driving the pitch reference.
- **Add-song/group dropdowns**: The placeholder is no longer auto-skipped to the first option, so the only/first item can actually be selected; the dropdown resets after each add.
- **Quieter karaoke**: The lyrics/transcription alignment-accuracy warning is suppressed during playlist playback (still shown for single sessions).
- **Skip/advance reliability**: The mixer now remounts per song via a load token bumped only after the new song's stems are in place, with a stale-load guard and current-song gating — fixing songs that "ended immediately" or got stuck when skipping/going to the previous song.
- **Previous/next replay after reload**: Revisiting a playlist song now persists its freshly-hydrated stem URLs to the session cache, so going to the previous song no longer fails on dead (post-reload) blob URLs.
- **Group song resolution**: A group's songs resolve to existing sessions only (merging `group.sessionIds` with `session.groupId`), so stale ids no longer cascade the playlist straight to the summary.
- **Karaoke import**: Round-robin play mode is preserved when importing a karaoke playlist (previously reverted to sequential).

- **Session cards**: Removed the redundant "UVR Session" heading; cards now show the band/group above the song title with hover tooltips for long names, and the action buttons (delete/export/share) sit as smaller, right-aligned controls in the top row so the title spans the full width.
- **Group singer default**: Adding a group to a playlist pre-fills its singer with the group's name (editable afterwards).

## [0.3.13] - 2026-06-13

### Added

- **Guide Character Voice Improvements**: Introduced the new **Harmony** character voice option that plays the target note with a major third (+4 semitones) on top, **Echo** (quiet voice playing at `0.3x` volume), and boosted the **Aria** volume to `1.3x`.
- **New Character Voices**: Added two new guide character voices to support diverse singing practices:
  - **Nova (Octave Anchor)**: Plays a sub-octave double (-12 semitones) using the strings instrument to ground lower registers.
  - **Spark (Percussive Tap)**: Plays short, staccato plucked synth notes to assist with rhythmic timing and precise pitch onset.
- **Detailed Character Descriptions**: Added rich tooltips to the character selector in the sidebar, providing clear explanations of each guide voice's role and how it helps the user practice.
- **Display Name Integration**: Integrated character display names (`Aria`, `Harmony`, `Nova`, `Spark`, etc.) into the sidebar indicator pill and SettingsPanel explanation text.
- **Character SVG Icons**: Designed and created custom SVG assets (`harmony_idle.svg`, `nova_idle.svg`, and `spark_idle.svg`) representing the respective character identities.
- **Unit Test Coverage**: Added detailed assertions verifying correct instrument selection, oscillator counts, and effects for the new character voices in the test suite.

## [0.3.12] - 2026-06-12

### Added

- **Cloud Accounts & Sync**: Anonymous-first cloud accounts — everyone gets a silent anonymous identity, upgradeable to email/password or Google without losing progress. Challenges, scores, badges, streaks and leaderboard entries sync across devices; karaoke/UVR audio stays on-device.
- **Google Sign-In (redirect flow)**: COOP-safe full-page OAuth redirect through the db-worker, replacing the Google popup flow that failed in Firefox/Safari (`window.opener is null` under cross-origin isolation).
- **Account Section**: Create account, sign in/out, and an editable display name that propagates to existing leaderboard entries.
- **Cloud Database Worker**: D1-backed REST API (db-worker) with JWT auth, per-user scoped CRUD, separate dev/prod environments and CI deploy workflow; the app picks cloud vs. local storage per entity via a hybrid adapter.
- **Undo Toast Notifications**: Destructive operations (e.g. session delete) show an undo toast; undone session items return to their original position.

### Fixed

- **Profile Save Conflict**: Saving a profile no longer 409s — cloud profile ids derive from the JWT identity.
- **Signed-Out State**: After signing out of an upgraded account the app stays quietly signed out instead of retrying a doomed anonymous handshake; data refetches on auth changes.
- **Notification Layering**: Toasts render above modals.
- **Console Log Memory**: Captured warn/info logs capped at 500 entries to prevent unbounded memory growth.

## [0.3.11] - 2026-06-09

### Added

- **Singing Exercises (16 new)**: Full exercise system with base exercise framework (`use-base-exercise.ts`), reusable pitch tracker, and note selector components. Exercises include: Long Note, Vibrato, Slide, Pitch Pursuit, Mirror Melody, Pitch Hold, Interval Trainer, Scale Runner, Arpeggio Jumper, Drone Intonation, Siren, Call & Response, Dynamic Swell, Chord Stacker, Staccato Precision, and Routine Runner.
- **Exercise Menu**: Card-based exercise browser with per-exercise stats (best score, play count, grade badges), tag categorization, and quick-start buttons.
- **Exercise History Store**: Persistent localStorage-backed history of completed exercises (last 100), with per-type stats (best/avg score, total plays) and automatic leaderboard and streak updates.
- **Session Celebration Modal**: Post-exercise score overlay with grade coloring and best-window highlights.
- **Daily Practice Routines**: Collapsible routine panel with segment-by-segment progress tracking, auto-advance on exercise completion, shareable routine links, and random routine generation from curated templates.
- **Routine Templates**: Library of predefined warm-up routines with configurable segments (warmup, exercise, challenge-prep, cooldown).
- **Karaoke Looping (A/B Loop)**: Audio loop state machine, transport controls for loop toggle, waveform loop region visualization on overview canvas with draggable A/B markers, loop count tracking, loop metrics bar, and keyboard shortcuts.
- **Karaoke Focus Mode**: Full-screen stem mixer mode with transport bar toggles, hidden headers, and compact controls.
- **Touch Pan/Zoom**: One-finger horizontal pan, two-finger pinch-to-zoom on all canvases, vertical pinch for panel resize, dampened sensitivity, and natural scrolling direction.
- **Pinch-to-Zoom Lyrics**: Font size scaling on lyrics panel via pinch gesture (max 3rem), context menu disabled on lyrics.
- **Session Grouping**: Group tabs with context menu, assignment dropdown, CSS styling, and group CRUD operations backed by IndexedDB. Sessions can be assigned/removed from groups.
- **Self-Contained Shareable URLs**: Base64url encoding for melodies, exercises, and routines. Compact tuple format for melody items. URL shortener backed by Cloudflare KV with 60-day TTL. Copy-to-clipboard with fallback.
- **Responsive Walkthrough Tooltips**: Mobile-responsive tooltip positioning with media queries for the guided tour.
- **SVG Icon Migration**: New exercise-specific icon set (`exercise-icons.tsx`), SVG icons added to text-only buttons (Shazam, ScaleBuilder, App, CommunityShare, CommunityLeaderboard), and enhanced toggle/mode button icons (Metronome, UvrPanel).
- **Streak Calendar Component**: Visual practice streak tracking.
- **Vocal Range Utilities**: `vocal-range.ts` for note option generation and default note selection based on voice type presets.
- **Frequency-to-Note Utilities**: Bidirectional MIDI/frequency/note-name conversion (`frequency-to-note.ts`).
- **New Note Effects**: Tremolo, Trill, and Staccato effects for the piano roll and practice sessions.
- **Whisper Language Selection**: EN/HR language dropdown in StemMixer and PitchTestingTab, threaded through worker/service/hook.
- **Whisper Warm-up (opt-in)**: Optional silent warm-up inference after model load to pre-compile shaders.
- **Mixer Deep-Link Fix**: Reloading `#/karaoke/session/{id}/mixer` correctly loads the mixer view with populated stems.
- **Keyboard Loop Shortcuts**: Keyboard shortcuts for loop toggle and loop boundary controls.
- **Challenge Drill Generator**: Auto-generates exercise drills from challenge definitions.

### Changed

- **Toolbar Icon Standardization**: All toolbar icons normalized to 16px (down from 18px).
- **Waveform Icon**: Replaced mushy waveform icon with clean stroke-based vertical lines.
- **Note Labels Icon**: Replaced note labels icon with music eighth note SVG across lyrics panel and mixer.
- **Panel Heights**: Updated default panel heights for better layout balance.
- **Whisper Chunk Timeout**: Increased per-chunk timeout from 120s to 200s for Firefox compatibility.
- **Export All Progress**: Toast styling keeps progress notifications visible until completion.
- **Hash Router**: Extended to support `#/share/{payload}`, `#/s/{shortId}`, exercise, and routine share routes.
- **Dexie Adapter**: Improved error handling, group cleanup on delete-all, and session deduplication.
- **Piano Roll**: Major enhancements — 900+ lines of changes for new note effects rendering, arc physics, and improved seek behavior.
- **Effect Renderer**: Extended with tremolo, trill, and staccato effect rendering logic.
- **Audio Engine**: Added tone playback API for exercises (`playTone`, `stopTone`).

### Fixed

- **SolidJS Reactivity Warnings**: Extracted reactive values synchronously before async `.then()` callbacks per SolidJS best practices (multiple locations).
- **Karaoke Looping**: Fixed RAF tick dying after first loop iteration; converted `loopCount` to reactive signal.
- **Focus Mode Panel Toggles**: Wired up all focus mode panel toggles; show all controls in focus toolbar; restored original icon-only toggle buttons.
- **Kebab Menu**: Replaced broken kebab menu with hover X button; fixed clear-all modal not closing.
- **Cache Persistence**: Fixed cache persistence on delete-all; cleaned up group DB records properly.
- **Prop Type / Test Mocks**: Fixed prop type issue, `deleteAll` group cleanup, test mock, and `CheckSmall` icon typo.
- **UvrPanel Merge Conflicts**: Resolved UvrPanel.tsx conflict to use main's version with export group support.
- **Page Zoom Prevention**: Prevented page zoom on lyrics pinch and disabled context menu on lyrics panel.
- **Touch Pan Direction**: Flipped touch pan direction to match natural scrolling convention.
- **Touch Sensitivity**: Dampened touch pan/zoom sensitivity and rounded `windowDuration` display.
- **E2E Tests**: Fixed e2e test selectors after icon migration and CSS module changes.
- **Lint/Formatting**: Various lint error boundary fixes, spacing, and reformatting.
- **Mixer Deep-Link Race Condition**: Fixed `handleSessionView` unconditionally overwriting the mixer view from URL hash.
- **Whisper Progress Bar**: Fixed erratic progress bar behavior with per-file monotonic aggregate reporting.



## [0.3.10] - 2026-06-02

### Added

- **Session Import/Export**: Added the ability to export all sessions to a ZIP file and import sessions from a ZIP file to easily backup and migrate data. Includes visual progress rings during export extraction and generation.

### Changed

- **Karaoke UI**: Re-styled the Karaoke Settings modal to be more compact, removed redundant title, and fixed oversized SVG icons. Added a styled "filename pill" with truncation and hover tooltip to the audio processing view and the results view.
- **Routing**: Renamed the URL hash from `#/uvr/...` to `#/karaoke/...` for better consistency with the Karaoke tab, while maintaining backwards compatibility for old links.
- **Database Migration**: Moved lyrics and session storage from `localStorage` to IndexedDB for improved reliability and storage capacity. *(Note: Users may need to clear/reset data via the "Clear All Data" button for the app to function stably after this migration).*
- **UI Consolidation**: Replaced duplicate delete buttons with a single unified "Clear All Data" wipe button to completely remove cached songs and session history.

### Fixed

- **UI / Modal**: The Escape key now properly closes the Karaoke Settings modal.
- **Whisper Transcription**: Fixed a crash (`serviceRef is null`) during transcription caused by component unmounting or HMR during a transcription loop.
- **Session Data**: Fixed a bug where identical sessions were duplicated in the "Recent Sessions" list upon page reload, and deleting one deleted both (fixed state duplication during IndexedDB load/save).
- **LRC Lyrics Sync**: Fixed actual word timings matching in LRC files ensuring that only the specific user-mapped lines are modified and correctly synchronized.
- **Deep Linking**: Fixed an issue where hard-reloading on a specific session URL (`#/karaoke/session/...`) would fail to load the session data.
- **Session Loading Performance**: Optimized `ensureHydrated` to cache loaded IndexedDB Blobs per page session, significantly speeding up "View Results" and "Play" navigation.
- **Whisper Transcription**: Increased processing timeout from 180s to 300s to prevent valid large files from failing. Added toast notifications to warn users of poor transcription accuracy (<25%).
- **Clipboard Access**: Added a dedicated "Paste" button to the lyrics headers and a global `Ctrl+V` listener to seamlessly load lyrics directly from the clipboard.
## [0.3.9] - 2026-05-30

### Added

- **Word-to-Pitch Alignment**: New alignment algorithm (`pitch-word-alignment.ts`) maps whisper-transcribed words to detected pitch notes via temporal overlap. Includes multi-word segment splitting, per-word confidence scoring, and raw-vs-denoised comparison logging.
- **Whisper Transcription**: Manual "Transcribe" button on both StemMixer and Vocal Analysis tabs. Long audio is chunked into 30s segments with 5s overlap, processed sequentially, and deduplicated. Progress feedback with elapsed timer during transcription and model download.
- **Shared Transcription Module**: Centralized whisper lifecycle (`useWhisperTranscription.ts`) and alignment utilities (`transcription-alignment-utils.ts`) shared between StemMixer and PitchTestingTab, ensuring consistent behavior across both views.
- **Pitch Pill Labels**: Note name labels render on pitch canvas pills (toggleable via PitchCanvasToolbar). Aligned lyric words appear below note names when alignment data is available.
- **LRC Word Timings Fallback**: When whisper transcription is unavailable, LRC files with per-word timestamps are used as the word source for pitch alignment.
- **PitchCanvasToolbar**: Compact toggle bar for pitch canvas display options (note labels, lyric labels).
- **LRC Generator Improvements**: Can now start LRC generation from any clicked line. Cancel search restores previous lyrics source. Improved loading UI with cancel/upload support during LRC search.

### Changed

- **Pitch Detection Accuracy**:
  - Added FFT confidence gate to filter out low-confidence pitch detections.
  - Replaced FFT `pseudoClarity` with SNR-based confidence scoring.
  - Standardized Autocorr frequency range from 60--2000 Hz to 65--2100 Hz.
  - Segmenter improvements: minimum note duration enforcement, singleton note filter, dropout bridging for short gaps.
  - Aligned segmenter/merger grouping tolerance to +/-0.5 semitones.
- **Canvas Word Labels**: Whisper per-word labels take priority over LRC line-level text when both are available. Word labels auto-hide when zoomed out (< 6 px/sec) to prevent unreadable text density.
- **Refactoring**: Extracted `canonical-lrc.ts`, consolidated LRC text building into `lrc-generator.ts`, replaced per-controller seekTo/duration signals with shared `seekTo` abstraction, renamed `rawText` to `originalText` across lyrics controller and LRC panel.

### Fixed

- **Show Mixer Button**: Now shows active/accent state when sidebar is visible, neutral when hidden.
- **LRC Generator**: Fixed index mismatch corruption when finishing LRC generation.
- **LRC Player**: Fixed highlighting stretching across long gaps between lines.
- **Shazam Debug Logs**: Gated debug `console.log` calls behind `IS_DEV` flag.

## [0.3.8] - 2026-05-22

### Added

- **Analysis Tab / Vocal Analysis**: Completely revamped the Pitch Testing UI to include a new "Session Gallery" feature, allowing users to browse previously analyzed vocal tracks.
- **Pitch Segmentation**: Built a new intelligent note segmentation algorithm (`note-segmenter.ts`) that extracts discrete, denoised musical notes from raw pitch sample arrays.
- **Lyrics Support**: Integrated `.lrc` lyric files sync support directly into the Pitch Testing Tab (`lyrics-service.ts`) with interactive, synchronized UI highlighting.
- **Offline Pitch Canvas**: Added a new interactive timeline viewer (`OfflinePitchCanvas.tsx`) for analyzing historical vocal performances with drag-to-seek, zooming, and scrolling capabilities.
- **Persistent Analysis**: Added Dexie DB integration (`pitch-analysis-service.ts`) to ensure offline analysis results (pitch data and segmented notes) survive page reloads.

### Changed

- **Mobile Navigation**: Updated mobile swipe gestures to correctly skip hidden/advanced UI tabs instead of getting stuck.
- **Performance**: Shifted heavy Pitch Canvas calculations to an `OffscreenCanvas` caching architecture to optimize rendering loops.

### Fixed

- **Analysis Tab**: Rewrote offline Pitch Canvas renderer to use `OffscreenCanvas` caching, resolving extreme frame drops and lag during waveform playback.
- **Analysis Tab**: Fixed caching bug causing multi-second delays when swapping between vocal tracks or toggling the "Denoised Melody" overlay.
- **Analysis Tab**: Fixed "Cancel Separation" button doing nothing by properly injecting the session ID to abort the background UVR worker.
- **UI & Reactivity**: Transitioned gallery components to strict CSS modules and resolved SolidJS reactivity warnings ("computations created outside a createRoot") in the `PitchTestingTab`.

## [0.3.7] - 2026-05-21

### Added

- **Appearance Settings**: Added a new Font Family selector in Settings allowing users to choose between Inter, Outfit, Plus Jakarta Sans, and System Default fonts.

### Changed

- **Session Library**: Unified library melody lists on all locations.

### Fixed

- **Settings UI**: Fixed font dropdown layout issues and adjusted unit spacing for better readability (e.g., "100 ms" instead of "100ms").
- **Welcome Screen**: Adjusted title styling to correctly inherit CSS variables and sizes from the global app title.

## [0.3.6] - 2026-05-21

### Added

- **Shazam Sing**: Debug panel is now visible by default for all users to aid in troubleshooting

### Changed

- **Karaoke Tab**: Redesigned tab icon to feature a clean, centered stem waveform
- **Karaoke UI**: Centered the main content area with a bounded width for better readability on large screens, and expanded the primary dark background color to cover the entire page
- **UI / Styling**: Replaced the plain header border in the Karaoke tab with a stylish `FancyDivider` component
- **Onboarding**: Moved the "Start Singing" and "Take a Tour" buttons to the top of the Welcome modal to prioritize primary actions
- **Navigation**: The "Analysis" advanced tab is now unblocked and available to all users by default

### Fixed

- **Global Error Handling**: Upgraded `TabErrorBoundary` to utilize the styled `CrashModal` overlay, ensuring tab crashes display proper stack traces and recovery buttons instead of unstyled placeholders
- **Linting & Code Quality**: Resolved strict boolean expression warnings in `AppErrorBoundary` and fixed incorrect HTML comments inside JSX blocks in `AppNavTabs`

## [0.3.5] - 2026-05-19

### Added

- **Jam Session -- Session Persistence**: room ID and display name stored in `sessionStorage`; page reloads auto-rejoin the same room
- **Jam Session -- Server-side Host Tracking**: `ownerName` persisted in Durable Object `ctx.storage`; reconnecting with the original display name restores host privileges
- **Jam Session -- Activity Scoreboard**: per-user scoreboard overlay on the exercise canvas showing exercise name, timestamp, and individual accuracy badges
- **Jam Session -- Exercise History Persistence**: completed exercise scores survive page reloads via `sessionStorage`
- **Voice Type Detector**: vocal range analysis modal for determining singer classification (soprano, alto, tenor, bass)
- **Vocal Range Presets**: predefined singing range presets that auto-configure default octave and exercise selection
- **Mobile UI**: Drawer-based navigation for mobile devices and compact icon-only control toolbar

### Changed

- **Jam Session -- Default Camera Off**: video disabled by default to reduce WebRTC handshake latency on room join
- **Jam Session -- Random Codenames**: users who join without a display name receive a thematic one-word codename
- **Jam Session -- Camera Widget**: repositioned to bottom-right horizontal row layout alongside chat widget
- **Jam Session -- Signaling Protocol**: `room-created` and `room-joined` messages now include `isHost` flag from the server
- **Jam Session -- Badges**: Added beautiful glowing pill badges for peers next to the room title
- **Compose Tab**: removed melody count badge for cleaner, consistent navigation
- **Jam Panel**: replaced inspirational quote branding; cleaned up display name input UI

### Fixed

- **Jam Session**: WebRTC video stream renegotiation to ensure camera streams connect reliably
- **Jam Session**: Fixed "Cam off" state sync when joining a room by broadcasting video state over the WebRTC datachannel
- **Jam Session**: Prevented remote audio source duplication causing volume overlap
- **StemMixer Lyrics**: Prevented auto-loading incorrect lyrics for generic filenames; close picker after manual upload
- **UI**: Visual improvements to UVR Guide modal and restored fancy gradient divider in sidebar
- **Shazam**: processing spinner and error state display on stop/match flow
- **Shazam**: melody matching algorithm accuracy improvements
- **Pitch Canvas**: scroll mode rendering after CSS module refactor
- **Durable Object Hibernation**: `ownerName` lost after DO eviction -- now persisted in `ctx.storage`
- **UI / Mobile Layout**: Resolved overly large toolbar buttons by implementing strict CSS modules for consistent `.ctrlBtn` sizing across all controls
- **UI / Header**: Fixed mobile responsive navigation layout to properly wrap onto two compact rows instead of creating extra vertical space
- **UI / Sidebar**: Fixed missing "Expand sidebar" arrow button when sidebar is collapsed by removing a conflicting global rule and scoping CSS modules correctly
- **E2E Test**: removed assertion on deleted `.tab-badge` element

## [0.3.4] - 2026-05-19

### Added

- **Shazam Sing**: Real-time microphone listening for audio fingerprinting and identifying songs
- Speech Recognition real-time feedback in ShazamListen component
- E2E Test configuration allowing dynamic playwright timeouts via `.env.local`

### Changed

- Massive CSS Modules Refactoring (`.module.css`): transitioned global CSS legacy styles into isolated component-level styles
- Rebased branch workflow to perfectly stabilize features into main branch

### Fixed

- Playwright UI test suite timeout failures resulting from CSS module class hashing (fixed 100+ failing tests)
- Missing Walkthrough Tour markdown styles (restored correct kebab-case mapping for `:global()` classes)
- Pause and Stop button interaction desyncs in transport controls and test environments
- Playhead teleportation, starting position bugs, and audio quality scrub issues
- Dynamic vs static import Vite build warnings for `uvr-service` and Shazam components

## [0.3.3] - 2026-05-17

### Added

- **Jam Session (new feature)**: real-time P2P music practice rooms powered by WebRTC and a Cloudflare Worker signaling server
  - Create or join a room via room code; shareable `#/jam:ROOMID` deep links auto-join on load
  - Shared melody exercise canvas with scrolling piano-roll, peer pitch trails, and a live scoreboard
  - Live pitch monitor strip showing all participants' pitch over time with per-peer color coding
  - Video and audio streaming with per-peer camera thumbnails (expandable, draggable tray)
  - In-room text chat widget
  - Host transport controls: Play, Pause, Resume, Stop, Loop, exercise picker, and live BPM override
  - TURN server support for NAT traversal
  - Auto-preloads first melody when room becomes active
- **Vocal Analysis**: offline pitch tracking panel with denoised pitch data and a toggleable offline/real-time mode
- **Practice Mode**: click-to-play and trill feature (GH #230)
- **StemMixer**: fully modularized — main component reduced from 8,500 to 776 lines via 5 controllers and 5 sub-components

### Fixed

- **LRC / Lyrics**: canonical line ordering mismatches causing incorrect active-line tracking, LRC download timings, and lyric-click seeking
- **LRC / Lyrics**: per-word timing interpolation regex and `parseLrcWordTimings` integration fixed
- **MIDI Synthesis**: progress stall at 100% — added yielding loop to `synthesizeMidiBuffer` to avoid UI hang
- **Piano Roll**: drag/move behavior corrected
- **Pitch Debug Panel**: missing CSS causing layout collapse

### Changed

- Default workspace layout is now fixed 2-column
- StemMixer SolidJS reactivity warnings resolved across all controllers

## [0.3.2] - 2026-05-15

### Added

- Precount and Anchor Tone toggles directly inside the Focus Mode toolbar
- Dynamic negative-space runway rendering in PitchCanvas to visually support count-in phases

### Fixed

- Focus Mode playhead tracking sync and trajectory easing during count-in
- "Teleport-back" physics glitches in PitchCanvas ball animation
- Desynchronization of Focus Mode playhead speed when increasing melody size beyond screen constraints
- Double playhead rendering bug in Focus Mode by fully deferring to the standard PitchCanvas playhead
- Merge conflicts and duplicate unused logic in the StemMixer Lyrics controller

## [0.3.1] - 2026-05-13

### Fixed

- Piano practice precount synchronization and "teleporting" notes effect
- Analysis tab UI layout collapse and component shrinking
- Karaoke tab WAV file upload validation across different browsers
- Vocal separator state persistence and worker re-initialization during tab navigation
- E2E test reliability by switching to hash-based navigation
- Various lint and typecheck errors across the codebase

### Changed

- Production deployments now trigger only on git tags (`v*`) instead of every push to main
- Optimized vocal separator recovery after cancellation to avoid model reloads

## [0.3.0] - 2026-05-11

### Added

- Database abstraction layer for persistent storage using Dexie.js
- Dexie-based stem persistence for UVR results, ensuring separated audio survives page reloads
- Support for WASM-based ONNX inference as fallback for Firefox (WebGPU compatibility)
- Local browser-side processing mode as the default for UVR separation

### Fixed

- Lyric service stability and fallback handling for missing data
- Vocal stem instrumental bleed in client-side UVR using STFT-domain subtraction
- Audio playback issues in stem mixer when switching sessions
- Mic sensitivity option persistence in settings
- Playwright E2E test reliability and GitHub Actions workflow configuration
- Unit test failure for UVR session status display

### Changed

- Redesigned UVR user interface with better processing status indicators and progress bars
- Improved stem mixer MIDI integration for practice sessions
- Optimized local UVR processing pipeline for better performance

## [0.2.0] - 2026-05-09

### Added

- Basic piano practice mode with black key visual feedback
- UVR (Ultimate Vocal Remover) integration for audio separation
- SwiftF0 integration for pitch detection improvements
- Developer console log component
- Changelog modal with "What's New" button
- Score modal optional setting

### Changed

- Optimized piano-roll move loop for better performance

### Fixed

- BPM safe setter and audio timing at keyboard
- Dropdown reactivity and visual visibility for judged notes
- whiteIndexToMidi octave offset
- Serving of ONNX Runtime WASM backend and dev mode MIME type
- Memory leak in useSessionSequencer (setTimeout cleanup)
- Safari error handling
- Silent errors and removed dead code
- Metronome icon alignment and duplicate divider removed

## [0.1.2] - 2026-05-06

### Added

- Perfect pitch deviance presets
- McLeod pitch detection algorithm and settings

### Changed

- Redesigned the note and accuracy score displays

### Fixed

- Yin algorithm failure when McLeod is set to 4K buffer size
- Playback and stop behavior on ESC key
- Session play issues and sequence REST getting stuck
- Per-note accuracy percentage display
- UI styles for dropdowns, sidebar, and header

## [0.1.1] - 2026-05-03

### Added

- Initial MercuryPitch voice practice application release
- Extend BPM range to 280
- Organize sidebar notes by melody and add accuracy color-coding
- Support 1-3 octaves in piano roll based on available vertical space
- Multi-select and vocal technique effects
- Scrollable playhead with drag-to-seek and timeline
- Shareable preset URLs and scale modes
- Instrument sounds (piano, organ, strings, synth)
- Settings tab with configurable pitch detection parameters and adjustable accuracy bands
- Pitch track canvas overlay on piano roll editor
- Pitch accuracy heatmap to piano roll
- Copy/cut/paste notes for piano roll editor
- Snap-to-grid toggle for piano roll editor
- Dark/light theme toggle with localStorage persistence
- Playback speed control

### Changed

- Playhead drag resumes from position with audio effects (vibrato LFO, slides, ease)
- Sync layout, instrument sounds, octave/rows/mode controls, and effects
- Extract AppHeader and AppSidebar for shared layout shell

### Fixed

- Default melody initialization in piano roll editor
- Clip pitch trail to visible canvas area during auto-scroll
- z-index layering so grid stacks correctly and piano keys are positioned properly
- Apply saved volume and default volume on app start
- Stretch piano roll to fill viewport width and synchronize playhead triangle with grid line
- Reset playhead to beat 0 on Reset to fix playhead getting stuck
- Initialize audioCtx to fix editor playback having no sound
- Prevent flash of unstyled content on load
- Preset system saves, loading scale data, and reactivity

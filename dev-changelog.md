# Developer Changelog

Detailed engineering history. The concise, user-facing summary shown in the
app's "What's New" modal lives in [`CHANGELOG.md`](./CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.13] - 2026-07-17

### Added

- **Zen mobile karaoke stage** (#265): `KaraokeMobileStage` replaces the mixer tree on phone-width viewports (`isNarrow` gate, performance preset only) — Portal-mounted on `<body>` (a filtered ancestor was capturing `position:fixed`), `100dvh` sizing + body-scroll lock, safe-area padding, auto-centering lyrics with word-level gradient sweep, tap-to-seek, scrubber + transport bottom bar, collapsible vocal pill (tap = mute via `toggleMute('Vocal')`, drag = `setTrackVolume`, pointercancel-safe, keyboard-activatable), in-stage song sheet (uvr-store library + playlist start, hydration via `KaraokeStageHost.pickSession`). Demo staging passes `autoPlay` through `KaraokeSong`.
- **Auto word-sync v1** (#265): `src/lib/vocal-onsets.ts` (log-energy flux onset detection on the vocal stem, no model) + `src/lib/word-sync.ts` (syllable-weighted layout, onset snapping, strict monotonic within-span clamping; unit-tested) + `applyAutoWordSync` in the lyrics controller persisting word-level LRC through the gen-finish path. Button in the Fixed/Grid lyrics headers with an overwrite confirm. Research + roadmap in `docs/plans/lyrics-word-sync.md`.
- **Highlight algorithm** (#265): `computeActiveWord` caps a word's sweep at its syllable-estimated sung duration (150ms floor), then dwells fully lit — held notes/rests no longer smear; returns continuous `fraction` for gradient renderers. Gen-mode taps subtract 180ms audio→motor latency (`TAP_LATENCY_SEC` const, calibration UI later).
- **iOS audio unlock** (#265): `src/lib/audio-unlock.ts` — synthesized-silent-clip session promotion past the ring/silent switch (ambient→playback), gesture-scoped `resume()`, visibilitychange re-resume; installed by the audio controller and the karaoke entry.
- **Email verification (soft gate)** (#265): `emailVerifications` table (hash-stored single-use 24h tokens; `scripts/migrate-add-emailVerifications.sql`), verify/resend endpoints (rate-limited, `#everified` redirect mirroring the Google flow), combined verify+welcome email, floating `VerifyEmailBanner` (authStamp-reactive), `karaoke_playlist_start` funnel event allowlisted.
- **Password UX** (#265): policy relaxed to 8+ chars with letter+number (server + `src/lib/password-policy.ts` mirror — browser generators always pass), live `PasswordRequirements` checklist + `aria-invalid` red borders, proper autocomplete attrs; Karaoke Night sign-in modal de-upselled.
- **KN mobile layout + playlists rail** (#265): no-overflow topbar (safe-area, truncating chip), hamburger collapsed rail, playlists card (`startPlaylist` one-tap), focus-mode transport restyled to the ControlOverlay glass recipe + focus toggle beside the stage-transparency slider, "our servers" copy sweep.

### Fixed

- Word-boundary black flash (transition-vs-class-swap on the gradient sweep), restart now glides the lyrics sheet to top (idx<0 handling + explicit scroll), demo stems CORS on LAN/https origins (mercury-pitch-models bucket → wildcard GET/HEAD), `snapToOnsets` strict monotonicity when capped at line end.

## [0.7.12] - 2026-07-16

### Added

- **Karaoke Night standalone entry** (#259, #261, #262): `karaoke.html` as a second Vite entry served at `/karaoke-night` (+ `/karaoke` alias, both emitted as real HTML files per the SPA-fallback-beats-worker lesson from #250). Theatre backdrop (generated still + plum scrim), stage-glass transparency (one `--kn-alpha` variable drives `--bg-primary/secondary/tertiary`, `--sm-canvas-bg` and the opaque `--on-accent` ink token), StemMixer `preset='performance'` (big centered 2.4rem lyrics, page-local layout/alignment prefs, no edit/analysis/tour chrome, whisper init skipped), demo-song manifest `public/karaoke-demo-song.json` (CC BY 4.0 stems + word-synced LRC on the public R2 bucket; seed-once lyrics under a stable session id), guest local-ONNX upload with warming/percent/queued progress states + cancel, collapsible icon rail, account sign-in chip + modal (direct `auth-service`: password + Google — `returnTo` round-trips the page; `consumeGoogleRedirect()` at boot), signed-in server-mode toggle with live credit balance (shared `setUvrProcessingMode` pref), and studio links: a UvrPanel-header Karaoke Night view-tab (new `StageCurtains` icon) plus per-playlist stage buttons → `/karaoke-night?playlist=<id>`, consumed at boot by the always-mounted `KaraokeNightRuntime`.
- **uvr-store extraction + StemMixer decoupling** (#259): the whole UVR domain (settings, model status, session/group caches, persistence) moved from `app-store` into `src/stores/uvr-store.ts` (app-store re-exports for back-compat); StemMixer's tour became an injected `onOfferTour` prop; the karaoke playlist runner + session hydration extracted to `features/stem-mixer/karaoke-playlist-runner.ts`, shared by UvrPanel and the night page.

### Fixed

- **Playlist song-skip race** (#260): the playback RAF end-detector treated `elapsedTime >= duration()` as a natural end while `duration()` was still `0` (stems not yet decoded), instantly "finishing" freshly armed playlist songs. End detection now short-circuits at zero duration and the playlist play effect waits for a real duration.
- **Standalone entries statically dragged ~2.7 MB** (#259): `lib/legal-links` co-located into the `advanced` chunk made ConsentBanner pull `advanced → library → vendor` into BOTH the mirror (the live ad landing page) and karaoke first paints. Shared leaf modules (legal-links, storage, analytics, consent, notifications-store, auth/user/billing services) are pinned to the `pitch-core` chunk — mirror 145 KB, karaoke 90 KB static JS.
- **Studio theme regressions caught in review** (#259): accent-control ink switched to `var(--on-accent)` (defaults to `var(--bg-primary)`, so every theme renders as before; the night page overrides it opaque), and canvases paint via `--sm-canvas-bg` (opaque dark in the studio across all themes, translucent on the night page).
- **Mixer tour vs. workspace layouts** (#259): several `mixer.*` targets exist only in the fixed-2col workspace; the tour now navigates to it up front via a `mixer.layout-fixed` hook.
- Firefox scrollbars (`scrollbar-width`/`scrollbar-color` — the app only styled `::-webkit-scrollbar`), karaoke focus-mode chrome moved from app.css into `mixer-shared.css` (loaded by both entries, specificity-hardened), Karaoke Night topbar baseline alignment (#262).

## [0.6.8] - 2026-07-08

### Changed

- **Branded OAuth domain** (#219, #220): the db-worker now serves on dedicated custom subdomains — `api.mercurypitch.com` (prod) / `api-dev.mercurypitch.com` (dev) — via wrangler `custom_domain` routes (auto-created on deploy), alongside the existing workers.dev URLs. A dedicated host avoids shadowing the main worker's `/api/uvr/*` + `/api/share/*`. `VITE_API_BASE_URL` points the frontend at them, so the Google consent screen + the OAuth `redirect_uri` (derived from the request origin, no `auth.ts` change) show a `mercurypitch.com` host instead of `komediruzecki-2015.workers.dev`. No session loss — auth is a client-side Bearer JWT, not a worker-domain cookie.

### Fixed

- **Transactional emails render dark-only** (#218): the purchase thank-you + signup welcome `<head>` declared `color-scheme` / `supported-color-schemes` as `"dark light"`, so a light-mode client tried a light rendering and, with no light styles, fell back to a white background. Declared `"dark"` only so clients render the dark design regardless of the recipient's mode.

## [0.6.7] - 2026-07-07

### Added

- **Guitar tuner reference tone** (#210): clicking a string button in `GuitarTuner` now plays that string's target pitch via a new optional `onPlayNote` prop, wired from `GuitarPage` to `audioEngine.previewNote(freq, 900)` (short, reduced-gain preview) — tune by ear alongside the needle. Still toggles the manual per-string target.

### Changed

- **Singing A-B loop: loop-on-B + draggable markers** (#212): `handleSetLoopB` now arms the loop immediately (`setLoopEnabled(true)` + clears the escape flag), matching the stem-mixer. `SingingStatusBar` gains draggable A/B markers on the seek rail — pointer-capture drag, a 0.25-beat min-gap clamp via new `handleMoveLoopA/B` in `App.tsx`, and a one-shot guard so a drag's pointer-up doesn't also seek. A reads `--accent` (blue), B reads `--red`, on both the markers and the control-bar `IconLoopPoint` buttons (`.loopBtnB`). Reuses the existing `ab-loop` math + RAF seek-back unchanged.
- **Welcome / changelog / sidebar polish** (#205, #206): compacted first-run welcome (Voice Mirror-first, mirror-before-consent, 50/50 mobile actions, version pill → the What's New modal), branded `ChangelogModal` restyle, sidebar Playback Setup collapsed by default, smaller 3D next-note target ring, round tour-dots fix, `.getStartedBtn` hover on the settings "Getting started" buttons, two-tone email wordmark + colourful sign-up cards. Version bump to 0.6.7.

### Fixed

- **Track switch preserves the playhead + transport** (#208): switching the scored track of an imported multi-track MIDI ran the full load path (`stopGame` / `setPlayheadBeat(0)`), rewinding to 0:00 and stalling the play button. New `changeScoreTrack()` on the guitar and piano (falling-notes) controllers rebuilds the notes/backing and resets the score but keeps the playhead + transport (keeps playing if playing; Play/Space resume from the current beat; notes before the playhead are marked passed so they don't all fire at once). The shared song picker gains an `onScoreTrackChange` hand-off (falls back to `onSongLoaded`).
- **Local/WebGPU separation retry no longer crashes when Cloud mode is active** (#209): `getSeparator()`'s `setUvrModelStatus('loading')` write synchronously re-ran `UvrPanel`'s server-mode cleanup effect (it read `uvrModelStatus()`), which called `destroyPipeline()` and nulled the module `separator` mid-init → "can't access property initialize, … is null". Gated that effect on the mode signal only (`on(uvrProcessingMode)` + `untrack` for the status), hardened `getSeparator` to hold a local reference across the store writes, and added `humanizeProcessingError` so no raw JS crash reaches a session card.
- **Singing song-change refreshes the canvas + timeline** (#215): `handleSingingSongLoaded` now calls `resetPlaybackState()` before loading the new melody. While playing/paused the playback controller holds a *frozen* `playbackDisplayMelody` / `playbackDisplayBeats` for the in-progress run (its auto-clear effect only fires when stopped), so switching songs mid/after a run — e.g. during A-B loop testing — left the previous song frozen on the canvas + timeline. Also clears the old A-B loop, whose beats belonged to the previous song.
- **Focus mode scrolls instead of squishing long songs** (#215): `FocusMode` passed `isScrolling={() => false}` to `PitchCanvas`, forcing the fit-whole-song `beatToX` branch (divide by the whole range, not the visible window); now `true`, so short melodies still render whole (`rangeBeats <= visibleBeatWindow`) but long songs scroll a fixed window like normal mode.
- **e2e** (#213): expand the (now collapsed-by-default) sidebar Playback Setup section before asserting on its scale controls — new idempotent `openPlaybackSetup` helper; fixes 6 specs across `app` / `critical-flows` / `css-audit`.

## [0.6.6] - 2026-07-07

### Added

- **A-B loop on the Singing tab** (#200): mark A then B on the melody and loop that section. The loop math is extracted to a pure, unit-tested `src/lib/ab-loop.ts` (`shouldLoopBack`, `isSeekOutsideLoop`, `loopRegionPct`, `clampLoopB`) mirroring the stem-mixer's half-open `[A, B)` semantics and its `seekedOutsideLoop` escape flag — so a manual seek past B is no longer instantly reverted. `App.tsx` owns the signals + the auto-seek-back effect (gated on `beat < totalBeats()` to avoid racing the runtime's natural-end); `SingingStatusBar` draws a reactive loop-region overlay (no stale IIFE); `SingingControlBar` reuses the existing `IconRepeat` for the toggle and a single consolidated `IconLoopPoint`. `.loopRegionActive` uses `var(--green)` (no hardcoded hex). 21 loop-math tests.
- **Guitar tuner + riff tracker** (#199): `src/lib/guitar/tuner.ts` `classifyPitch(frequency, clarity, targets, names)` classifies against the *selected* tuning, so presets (Standard / Drop D / Half Step Down / Open G / DADGAD) actually retune instead of only relabeling; the previously-dead `isTuningSignal` ±50-cent gate is wired in so off-string noise can't read "in tune" (manual per-string mode bypasses the gate so a far-off/fresh string still shows deviation). Open G frequencies corrected. `GuitarTuner`/`GuitarRiffTracker` components + a headless `RiffTrackerState` factory (record → timeline → score against a target melody). Riff capture is driven off a new reactive `articulationId` signal on `useGuitarPracticeController` (a lockstep mirror of the non-reactive scoring counter) so repeated same-pitch attacks aren't de-duplicated away by `detectedMidi`. Reuses `frequencyToMidi` / `computeCentsDeviation` / `noteToMidi` (the last now parses flats + multi-digit octaves); glyphs replaced with SVG icons. 33 tuner + riff tests.
- **Transactional emails** (#202): purchase thank-you email + account sign-up welcome email.

### Fixed

- **Server (RunPod) stem separation now survives a reload / iOS app-switch, with no double charge** (#201, #203): the RunPod job id is persisted to IndexedDB, and the client auto-resumes an in-flight job on load / `visibilitychange` / `online` with **no new debit** (`resumeServerSession`, `activeServerPolls` guard). `pollForCompletion` rides through transient failures for a 90s grace window after first contact, and `getProcessStatus` / `getOutputFile` gained per-request timeouts, so a half-open socket can't freeze the poll. A server-confirmed dead job rejects with `TerminalPollError` and clears its persisted id. The worker bridge serves stems straight from R2 (`<RUNPOD_STEM_PREFIX>/<jobId>/`, new per-env var) for the ~24 h the objects live after RunPod forgets the job (~30 min), and returns a terminal "expired" otherwise. Removed the `beforeunload` handler that cancelled in-flight jobs on reload, and stopped `cleanupStaleUvrSessions` from erroring a recoverable session. "Fetch my stems" recovery button + friendlier "warming up" copy. New R2-fallback + terminal-error + reconcile tests.

### Changed

- CI: bump GitHub Actions to Node 24 (#204).

## [0.6.5] - 2026-07-07

### Added

- Voice Mirror results/share card pairs the singer's vocal range with a legendary singer whose range overlaps — two legends per voice type (e.g. tenors get Freddie Mercury or Bruce Dickinson) for a varied match.

### Changed

- Voiceprint download filenames are dated (`voiceprint-YYYY-MM-DD.png`) so a folder sorts by day.

## [0.6.4] - 2026-07-07

### Fixed

- Cloud-separated stems no longer go missing after a reload (#uvr durability): stems are persisted durably to IndexedDB *before* a session is marked done, always reopened from the local copy, and never depend on the server's temporary links. Added a `beforeunload` guard during the finalize/save window, orphan-DB cleanup + reconcile-on-load, and serialized per-session DB writes; added durability + reconciliation test suites.

### Added

- Storage pre-flight warning before a paid separation. Voice Mirror: "Sing the Universe" cosmic-mode deep link + copy-image button, and a warmer piano-like reference tone with a "your turn" count-in before the Match step. Succinct karaoke upload-rights notice.

## [0.6.3] - 2026-07-06

### Fixed

- Added the missing `og-image.png` so social / Open Graph link previews render the MercuryPitch card.

### Changed

- Removed the header website icon (redundant with the About link).

## [0.6.2] - 2026-07-06

### Added

- New Pitch-orb brand logo (favicon + About icon) and orb favicons. Website link in Settings → About and the header. Canonical Terms & Privacy links at consent touchpoints, pointed at about.mercurypitch.com.

### Changed

- Practice accuracy heatmap scores on absolute cents deviation and is decoupled from the session shape (PR #187 review follow-ups).

## [0.6.1] - 2026-07-06

### Added

- Server-side model registry (#178): `runpod/handler.py` + `uvr-api/api.py` resolve quality-tier names (`roformer` | `mdx` | `karaoke` | `ensemble`) to exact weight files and reject everything else — the old `.onnx`-append logic could not load `.ckpt`/`.yaml` models at all, and the Cloudflare bridge previously forwarded any client `model` string (billable arbitrary-weight downloads). Legacy `UVR-MDX-NET-Inst_HQ_3` maps to `mdx`. Bridge allowlist `RUNPOD_ALLOWED_MODELS` 400s unknown names before submit/debit.
- BS-RoFormer (`model_bs_roformer_ep_317_sdr_12.9755.ckpt`, vocals SDR ~12.9 vs ~10 for MDX) is the server default; MDXC params honor each checkpoint's trained segment size (`override_model_segment_size: false`, `mdxc_overlap` knob). Images: `v0.2.0` bakes all four checkpoints; `v0.2.1` adds the min-duration guard and bakes models before the handler COPY so handler-only edits stop re-downloading ~2.5 GB. audio-separator's built-in ensemble is wired (`ensemble` = BS-RoFormer + Mel-Band Kim, `avg_wave`) but not user-exposed.
- Per-model credit metering: debit carries the job's model; db-worker prices `tier base x multiplier` (billing-core `UVR_MODEL_CREDIT_MULTIPLIERS`), refunds repay the exact ledger delta, `/api/billing/pricing` exposes `uvrModelCredits`, and `fetchPricing` derives the field client-side against backends that predate it (PR previews hit the prod db-worker).
- Settings -> Credits processing picker (#184): the tier cards are the control — real `<button>`s with Selected tag, accent ring and `aria-pressed`; Server (CPU) stays a disabled "coming soon" card. Karaoke's credits pill and Server tooltip read live per-song cost from pricing.

### Changed

- Single server quality at 1 credit per song (#188): the 2026-07-06 apples-to-apples cost runs (same 11-song folder, same v0.2.1 image) measured RoFormer at $0.0054/28.0 s handler avg vs MDX $0.0064/33.5 s — better, faster AND cheaper, so the Basic/HQ selectors were removed, multipliers collapsed to 1x for all user-facing models (`ensemble` keeps 2x), and the `uvrQualityModel` signal was deleted (`runUvrPipeline`'s `model` option remains for future tiers). Roformer ETA divisor tightened to the measured speed (2.5 -> 8x realtime, cap 300 s).
- The Server (GPU) surfaces carry an HQ mark (tier card + Karaoke mode toggle) naming the studio-quality model.

### Fixed

- Handler rejects sub-12 s inputs up front (`UVR_MIN_INPUT_SECONDS`, mirrored in the CPU container): RoFormer processes ~11 s windows and audio-separator 0.44.2 dies mid-separation with an opaque tensor-size error on shorter audio.
- FastAPI status contract: pydantic serialized Optional fields as explicit JSON `null`s that failed the app's zod validation on every container status poll (`response_model_exclude_none` server-side; the client schema now treats null as absent).
- `api.py` read `model`/`output_format`/`cpu_profile` as query params while the app sends multipart form fields — client values were silently ignored (masked while defaults matched). Now `Form()` fields.
- A misrouted `/api/uvr` (e.g. the local vite proxy port occupied by an unrelated service) no longer dumps a whole HTML 404 page into the failure panel — markup bodies get a short actionable message, plain-text bodies are capped.

## [0.6.0] - 2026-07-05

### Added

- Karaoke server-mode enablement (#157): the processing toggle's Server option is live — sends the `X-UVR-Provider: runpod` opt-in from `processAudio`, restores `'server'` from localStorage again, shows a "1 credit / song" hint pill, and turns the metering 402 / auth 401 into actionable messages. Server mode is GPU-only by design: with RunPod unconfigured the worker returns a clear 503 instead of silently falling back to the unmetered CPU container (`rejectUnconfiguredRunpod`).
- Server-job cost guards (#172): the handler probes input duration right after download and rejects songs over `UVR_MAX_INPUT_MINUTES` (default 12) before the expensive separation — the job errors cheaply and the worker auto-refunds; the probe fails open. The upload pill + client validation are mode-aware (100 MB local / 50 MB server).
- Large server uploads via R2 (#173): >7 MB files (the RunPod `/run` inline base64 ceiling) stream from the worker to R2 under `input/<uuid>` via a new per-env `UVR_INPUT_BUCKET` binding and reach the handler as `audio_s3_key`, downloaded with the handler's own S3 creds — the source audio never gets a public URL (key validated traversal-safe; precedence `audio_s3_key` > `audio_url` > `audio_base64`). Hard cap 50 MB (413); ≤7 MB keeps the inline fast path; 1-day R2 lifecycle rules expire staged inputs.
- Settings deep links + credit shortcuts (#174): the Settings sub-tab signal moved into `ui-store` (`openSettingsSection`); `#/settings/{account,practice,credits,display}` parse and sync both ways; checkout returns land on Settings → Credits; billing/auth failures carry a Get credits / Sign in button on both the toast and the persistent failed-session card; upload validation uses app notifications instead of native `alert()`.
- Credit metering for server-side UVR jobs (the `docs/plans/premium.md` "Metering paid jobs" design): db-worker `POST /api/billing/debit` (user JWT; tier cost read from the `pricingPlans` tier rows' `credits` column; the balance check and debit are one atomic conditional INSERT so concurrent jobs can't overdraw; idempotent per `uvr:<rp_<tier>_<id>>` ledger key; 402 `{ required, balance }` when short; no-ops while a tier's cost is unset) and `POST /api/billing/refund` (service-to-service only via `X-Service-Key` = `BILLING_SERVICE_KEY`, constant-time compare; at most one refund per jobRef). Main worker: `src/lib/uvr-metering.ts` — fail-open on transport errors (a billing outage degrades to unmetered jobs), fail-closed on an explicit 402 (cancels the just-submitted RunPod job); refunds fire on error status polls and on DELETE of an unfinished session, but not when deleting a completed one. Dormant in layers: no `DB_API_URL` var → no metering; tier credits NULL/0 → debits no-op; no service key → refunds skipped.
- Stripe checkout return UX: `#/billing/success` / `#/pricing` (the db-worker checkout session's success/cancel URLs) parse as a `billing-return` hash route that lands on Settings → Account with a toast, then cleans the one-shot hash to `#/settings` via `replaceState` so a reload can't re-fire it. New "Your credits" chip in `PricingPanel` fed by `/api/billing/me`, keyed on the new `billing-store` `balanceVersion` signal with staggered refreshes (0/3/10 s) to absorb webhook lag; hidden when logged out or without a cloud API.
- Separated stems keep a sanitized version of the uploaded filename (`_safe_name_stem`: basename-only so `../` dies, S3-key/shell-hostile characters stripped while readable ones survive, 60-char cap, `input` fallback) — output filenames, R2 object keys and user downloads read `<song>_(Vocals)_<model>.flac` instead of the anonymous `input_(Vocals)_…`.
- Shared song-status-bar primitives (`src/components/shared/status-bar/`, `SegmentedControl`, `src/lib/use-file-drop-zone.ts`): a glass strip in normal flow above each practice canvas with the song picker, seek scrubber, compact multi-column track dock and import actions. Replaces the per-page `FallingNotesSongPicker` / `GuitarPracticeSongPicker` / `MidiTrackMixer` / `SingingStatusChip` (all deleted). Guitar's view/sound switches and the sidebar mic-preset rows become `SegmentedControl` pills; the guitar transport becomes a floating dockable `ControlOverlay`. Canvas-wide drag-drop for `.mid`/`.midi` (all three pages) and Guitar Pro (guitar); the whole `useMidiSongPicker` flow gains `importMidiFile` + `skipAutoLoad`.
- Singing scores a chosen MIDI track, not a flatten of all tracks: drop/import opens the track picker (`hideBacking` variant — no backing audio column), the picked track becomes the practice melody, upserted into the melody library by name. The old flatten buried the melody under 10k+ notes and tanked FPS.
- Singing song timeline: the bar's seek rail drives `playbackRuntime.seekTo` while playing/paused; a stopped-state seek is recorded as `pendingStartBeat` and consumed by the next `start()` (mirrors the Piano/Guitar `pendingStartBeat` seek-then-play added earlier this cycle), cleared by `stop()` and song-switch (`clearPendingStart`).
- Polyphonic play-along audio: the piano game moved from the mono `playTone` slot to per-note `playNote` voices (the guitar game already used it); `AudioEngine.playNote` gains a 24-voice steal-oldest cap (`MAX_POLY_VOICES`). Both games flush voices (`stopAllNotes`) on pause/stop/seek/song-load. The `SessionPlayer` green banner folded into the singing status bar (test ids preserved).

### Fixed

- Null-session render crash in the karaoke error card (#174, #175): Delete & New cleared the current-session signal while handlers/render props still read `session()!` — first the handlers (`.sessionId`), then the render props (`.status`) behind a non-reactive `session() && (...)` guard. Handlers capture the session once; both session-prop blocks (`UvrProcessControl`, `UvrResultViewer`) use the `<Show when>` callback form whose accessor stays truthy-narrowed through teardown.
- runpod image: ubuntu 22.04's `python3-pip` targets the distro python 3.10 while the image symlinked `python` → 3.11, so every dependency installed into an interpreter the handler never ran — the model bake failed with `ModuleNotFoundError: audio_separator` on the first real build. Use the distro python consistently via `python -m pip`.
- runpod handler: audio-separator's model architecture snapshots `output_dir`/`output_format` at `load_model()` time, so a warm worker kept writing stems into the eager-load `_init` directory and every job failed with "Separation produced no output stems" despite a clean GPU separation in the logs. Sync the live `model_instance` per job and additionally trust `separate()`'s returned file list.
- Stem classification substring-matched the whole filename, so with real song names preserved a track called e.g. "Vocal Coach.mp3" would tag its instrumental stem as `vocal` — match audio-separator's `_(Stem)_` marker first, substring only as fallback.
- RunPod deploy runbook corrections from the first real GPU deploys (`docs/claude/RUNPOD.md`, `runpod/README.md`): container disk 20 GB (the CUDA + torch image is ~10 GB unpacked; the documented 5–10 GB fails at worker start), pinned version tags instead of `latest` (bumping the tag on the endpoint is the controlled release), endpoint type Queue.
- First tab switch after load escaped audio cleanup: the tab-leave cleanup was a `createEffect(on(activeTab, …, { defer: true }))`, and defer skips the initial run so `on` never recorded a previous input — the first change fired with `prevTab === undefined` and returned early, leaving the previous tab's audio running (e.g. singing playback under the piano tab). Refactored to a synchronous tab-transition listener at the `setActiveTab` choke point in `ui-store` (`onTabTransition`), which cannot miss a transition; `setActiveTab` is now a plain-value setter.
- Status bar occluded canvas HUD (piano score corners, guitar 3D chip, singing accuracy panel): the bar now sits in normal flow above the canvas instead of absolutely overlaying its top edge.
- `PitchCanvas` froze (~1 FPS) on large imports: the ball physics rebuilt the playable-note list every rAF frame (now a `createMemo`), and the note draw loop had no culling (now off-screen-culled, with a flat-fill fast path when the visible window holds >120 notes). ~1 → 60 FPS on a single track.
- Tab revisits clobbered the loaded song (the picker's mount auto-load overrode the app-wide controller — fixed with `skipAutoLoad`); the karaoke upload-zone highlight flickered off mid-drag (enter/leave depth counter, as in `useFileDropZone`); the stems time pill's Clock icon overflowed (24px intrinsic size in a 14px box). Phantom `--fg-primary/-secondary/-tertiary` CSS vars (and `--border-color` family) aliased in `:root`.

## [0.5.3] - 2026-07-02

### Added

- Voice Mirror standalone entry (`mirror.html` + `src/features/mirror/`): a second Vite input with its own tiny Solid tree (~25 kB gzipped incl. solid + pitch-core chunks, no ONNX/model weights, enforced via `manualChunks`). Served at `/mirror`, `/vocal-range-test`, `/tone-deaf-test` and the `mirror.*` subdomain root by the worker, with a matching dev/preview rewrite plugin in `vite.config.ts`.
- Pure metrics core (`src/lib/mirror/metrics.ts`, synthetic-track tests): §3 preprocessing (confidence gate, gap-aware 5-frame median filter, MIDI-cents), semitone-bin range with 150 ms dwell + percentile guard rails (±1 semitone margin), octave-folded match scoring with 150 ms/3-frame lock and post-lock windows, OLS drift + detrended wobble, onset/scoop (§4.4), vibrato via the existing `vocal-analyzer` FFT detector with sinusoid-variance exclusion from wobble (v1.1).
- Session reducer (`src/lib/mirror/session.ts`): pure guided-flow state machine (idle → mic → glides → hold → match×5 → results) with range-relative target picking and one free retry on unvoiced takes.
- Free Sing analysis (`src/lib/mirror/free-sing.ts`): dwell histogram → home note + tessitura quantiles, breath-gap phrase stats, debounced note-change agility, vibrato on the longest run.
- Sing the Universe (`src/lib/mirror/cosmic-melodies.ts` + `CosmicMode.tsx`): melodies from Gaia/Hipparcos declinations, ATNF pulsar spin rates (octave-folded) and the Perseus B♭ (pitch-class-pinned root), fitted into the detected range and scored by the match engine.
- F0 stream adapter (`f0-stream.ts`): AnalyserNode + rAF polling over the shared `MicManager`, YIN-only, detection gated to active takes, per-take detector history reset, RMS level tracking; silent-mic probe with automatic AudioContext rebuild (iOS WebKit sample-rate silence) and a live input-level meter.
- Share card renderer (`card-renderer.ts`): star-arc trace + steadiness pulsar on canvas, 1080×1920 / 1080×1080 PNG, Web Share API Level 2 with download fallback, brand-gradient wordmark, delta badge and title headline with shrink-to-fit.
- Client-side baseline (`baseline.ts`, localStorage, derived numbers only) with return-visit delta on the results screen and card.
- Anonymous funnel: `trackFunnel` beacons (sendBeacon/keepalive-fetch) keyed by a random clientId to the db-worker's new rate-limited `POST /api/mirror/event` → `mirrorEvents` D1 table (event allowlist, metrics only on `results_view`; not exposed via the generic CRUD).
- WelcomeScreen: brand-gradient "Mirror your voice" pill CTA linking to `/mirror`.
- Research + roadmap: `docs/plans/voice-mirror-phase2.md`.

### Changed

- Renumbered the previous release 0.6.0 → 0.5.2 (patch-scale update, wrong minor bump).
- `manualChunks`: new `vendor-solid` and `pitch-core` chunks so the mirror entry never pulls the app vendor bundle.

## [0.5.2] - 2026-07-01

### Added

- Shared pitch-denoise pipeline (`src/lib/pitch-pipeline/`): a reusable engine that turns a raw pitch contour into logical notes. Stages: log-domain fractional-MIDI conversion (`log-pitch.ts`), a running median (`running-median.ts`), a One-Euro filter (`one-euro.ts`), a temporal-continuity octave corrector that snaps octave jumps back to the melodic line (`octave-corrector.ts`), and a hysteresis (Schmitt-trigger) note state machine (`note-state-machine.ts`). Exposed as a live streaming pipeline (`live-pitch-pipeline.ts`) and an offline re-segmenter (`offline-segment.ts`, with a `segmentSecondsContourToMelody` seconds-native wrapper and a `pipeline` options override for coarse-hop callers). Fully unit-tested, incl. the C3→C4→C5→D3 octave-jump regression.
- Compose live tracking + open-ended recording (`useRecordingController.ts`, `piano-roll.ts`, `playback-runtime.ts`): the recorder feeds the live pipeline and exposes `provisionalNote`/`liveMidi`; the piano roll draws provisional dashed notes and a live pitch needle (`setPreviewNotes`/`setLiveMidi`/`drawPreviewNotes`/`drawLiveNeedle`) and grows to follow the playhead; `setOpenEnded` skips the auto-stop at arrangement end so recording runs until the user stops.
- Compose take review (`ComposeTakeReview.tsx`): on stop the raw contour is held as a pending take; an "As sung ↔ Clean" slider re-segments it (key-snap + merge + quantize scaled by the amount) with live preview and Keep/Discard, instead of auto-committing.
- Recorded take as a single undo step (`piano-roll.ts` `applyMelody`/`installMelody`, `PianoRollCanvas` `onEditorReady` bridge): committing a take routes through an injected `applyTake` that `pushHistory()` before replacing the melody, so one undo restores the previous melody; `melodyEquals` compares by value so the store round-trip is a no-op and history survives.
- Stem-mixer vocal-pitch cleanup (`useStemMixerPitchAnalysisController.ts`): analysis now captures a real per-frame contour (true frequency + clarity, including unvoiced frames) and re-segments it via the shared pipeline at a chosen cleanup amount (100ms coarse-hop tuning); slider/key/scale/tempo changes re-segment live without re-decoding audio. Panel gains a Cleanup section, disabled until a contour exists.
- Two-stage pitch-edit model (`pitch-edit-model.ts`): effective melody = `applyEditLayer(base, layer)` where `base` is the cleanup output and the layer holds manual notes + deleted regions keyed by region (not base id), so edits survive a cleanup-slider regen. Ops: `editNote` (move/resize/retune, suppresses the original span), `deleteNote`, `splitNote`, `mergeNotes`. Wired into the canvas (`useStemMixerCanvasController.ts`): hit-testing, click-to-select, drag body to move/retune within the octave, drag edges to resize, one undo step per drag.
- Edit persistence + views (`db/entities.ts`, `session-pitch-analysis-service.ts`): the original (algorithm) notes and the user edit layer are persisted separately (new optional `editLayerJson` column, no Dexie schema bump) and restored on reload; an Original / Edited / Both view toggle (Both ghosts the original behind the edited notes).
- Floating edit toolbar (`StemMixerEditToolbar.tsx` + `.module.css`): entering edit mode collapses the analysis panel and shows a compact bottom-centre glass toolbar (view segment, delete/split/merge, undo, reset, done); Escape exits. New `Split`/`Merge` SVG icons (`icons.tsx`).
- Krumhansl-Schmuckler key detection (`src/lib/key-detection/`): a duration-weighted 12-bin pitch-class histogram correlated against the 24 rotated key templates → argmax gives tonic + mode + confidence margin (`key-detector.ts`, `key-profiles.ts`). Per-region detection slides a window over the note timeline and merges consecutive same-key windows, so a modulating song yields a key per part. Wired into the vocal analysis: adopts the detected global key for cleanup snapping (user-overridable), persists the per-region keys (`keyRegionsJson`, no schema bump), restores them on reload, and shows "Detected key: X". Research plan in `docs/plans/key-detection.md`.
- Melody audition synth (`melody-synth.ts`): a lazily-created monophonic oscillator/gain (its own `AudioContext`, resumed on the toggle gesture) that glides to and fades in/out the active note. A "Melody" toggle in the Vocal Pitch canvas toolbar (`PitchCanvasToolbar`) drives it from the playhead, sounding whatever the pitch view shows.
- Scale/quantize helpers: `scaleDegreeSet`/`snapMidiToScale` (`scale-data.ts`) and `quantizeBeat` (`quantize.ts`), both tested.

### Changed

- Compose record-stop now routes through the full editor stop path so the take-review handoff and live-preview teardown are consistent.
- Analysis panel (`StemMixerPitchAnalysisPanel.tsx`): compact, `max-height` + scrollable with a translucent blurred sticky header sitting flush at the top (padding moved off the scroll container onto header/body), an X close icon that stays visible, and Escape-to-close. The tempo (BPM) number input is styled to match the app's dark inputs (`app.css`).

### Fixed

- Off-scale (accidental) notes on the piano roll are drawn at their true interpolated pitch (`midiToY`) and made hittable, instead of being pinned to the top row.
- Shared melodies decoded from the compact format carried `freq: 0` (the format stores only midi/startBeat/duration); the guitar pluck synth computed `sampleRate/freq` and built a `Float32Array` of length Infinity, throwing "Invalid typed array length: Infinity" and crashing playback. `share-codec` now reconstructs `note.freq` via `midiToFreq(midi)` on decode, and `renderPluckWaveform` returns a silent buffer for any non-finite / ≤ 0 frequency (`guitar-synth.ts`).
- Vocal pitch lane labels were drawn one row below the pills (a natural A appeared in the row labelled "A#"); the label row offset is corrected.

## [0.5.1] - 2026-07-01

### Added

- Reactive viewport hook (`src/lib/use-viewport.ts`): app-lifetime `isMobile`/`isNarrow` matchMedia singletons replace the scattered, non-reactive `prefersTopDock`/`isSmallScreen` checks (`ControlOverlay`, `Tab3DHud`, `GuitarPage`, `Walkthrough`) so small-screen/touch state updates on resize and rotation.
- Live on-canvas pitch marker (`PitchCanvas` `livePitch` prop, fed `currentPitch` from `App`): a left-anchored marker + dashed guide line driven by the mic whenever a note is detected, independent of playback (`pitchHistory` only fills during playback). The throttled rAF loop repaints on live-frequency change and once more on silence.
- Mobile singing HUD toggle (`singingHudMobileOpen` in settings-store; `SingingCanvasHud` button): the accuracy/sessions/pitch cards are hidden by default when `isNarrow()` and revealed via a persisted opt-in toggle; desktop behaviour is unchanged.
- Spotlight tour: desktop keyboard navigation (→/Enter advance, ← back, Esc close; ignores key-repeat, skips form fields/contenteditable, defers Enter to a focused button), clickable progress dots (`goToDot`), and a "continue to next section" button on a section's final step (`isLastInSection`/`goToNextSection`).
- Tour `reveal` field — expands a collapsed control group (`aria-expanded`) before a step and collapses it again on exit; all four control bars expose `[data-testid="{singing,piano,guitar,compose}-more-toggle"]`.
- Tour content: Effects section expanded (3 → 7 steps with per-effect `#roll-action-*` targets); the Settings spotlight split into three per-tab tours (`settings-general`/`settings-practice`/`settings-display`) anchored to full-width `.settingsSection` cards via `data-tour`; added editor + piano steps; enabled `#/guide/effects`. New Learn tutorials: Note Effects (compose), Display & Controls and General & Your Data (settings).

### Changed

- Spotlight tooltip redesign (`Walkthrough.module.css`): icon-only action buttons, a close (×) control, progress dots, and mobile breakpoints. `prepareAndPosition` now runs an immediate `updateHighlight()`/`updateTooltip()` before the rAF so steps anchor without waiting on a frame.
- `ControlOverlay`: centre-anchored default with an `inline`-mode max-width fix so the inlined Compose control bar doesn't squeeze the mic icon.

### Fixed

- Mic lifecycle: leaving the Singing/Compose tab now calls `practiceEngine.stopMic()` so `micActive` doesn't stay stuck on — previously the mic button looked active and reacted to playback on the next visit (`App.tsx`).
- Mic button icon no longer collapses to 0 width on a tight control bar (`flex-shrink: 0` on `.ctrlBtn` + svg, `MicButton.module.css`).
- `VALID_GUIDE_SECTIONS` (`hash-router.ts`) kept in sync with `GUIDE_SECTIONS`: added the missing `effects` id and replaced `settings` with the three per-tab ids.

## [0.5.0] - 2026-06-30

### Added

- Singing practice reworked into a canvas-overlay layout mirroring the 3D guitar view: pitch score + live mic monitor float as glass HUD cards (`SingingCanvasHud`, `SingingStatusChip`), a dockable/hideable glass control bar (`SingingControlBar` inside the generalized `ControlOverlay`), a top-left status chip (scale/melody + tempo + position), a top-right session scoreboard, melody-fit pitch viewport with explicit note-name labels, side-by-side HUD cards, and playback-time decluttering wired to the live `isPlaying` controller signal.
- Shared glass control-bar system: extracted reusable primitives (`control-bar/icons`, `NumberStepper`) and a generic dockable `ControlOverlay` (`static` + `inline` modes), then migrated Piano (`PianoControlBar`), Guitar (`GuitarControlBar`) and Compose (`ComposeControlBar`) onto bespoke bars; removed `SharedControlToolbar`.
- Header practice-context pill on Singing/Piano/Guitar and a dynamic header sub-title showing the loaded melody + character.
- Compose editor view switch reworked into a settings-style tab strip (`editorTab`/`editorTabActive`) with the control bar inlined in the same row via `ControlOverlay`'s new `inline` mode.
- Reusable `ConfirmDialog` (reuses the `.delete-confirm-*` styles + `useFocusTrap`); wired into karaoke playlist delete from both the gallery and sidebar. Karaoke empty states use a compact variant (`empty-state-compact`).
- Tabbed Settings (General / Practice / Display & Controls) with a polished account card; header account pill (username + sign-out) and a version + Ko-fi support double-pill.
- **Settings → Danger Zone: "Clear Karaoke & Vocal Separation Data"** — a button that deletes only UVR/karaoke data (separated songs, stems, lyrics, fingerprints, whisper transcriptions, session groups, and saved playlists) while keeping melodies, practice history, and settings. (`SettingsPanel`, `deleteAllSessionGroups`, `deleteAllPlaylists`, `deleteAllTranscriptionsFromDb`)
- DB-driven pricing with Stripe checkout/portal/webhook and animated pricing cards; RunPod serverless GPU + CPU separation tiers via an extracted, testable request bridge.
- Guitar Pro let-ring honored in tab playback (`applyLetRing` in `gp-to-midi-song`, `letRing` on `MidiSongNote`).
- `/exercises/<slug>` marketing deep-links that land on the exercise setup screen.

### Changed

- Sidebar reordered into collapsible sections.

### Fixed

- Backend-unreachable now degrades gracefully instead of crashing: cloud reads return empty, `fetchMe`/billing return null, and the global error handler downgrades network errors to warnings (warn-once).
- Deep-link routing uses an absolute asset base so first-load assets resolve (no SPA-shell fallback), and exercise deep-links no longer auto-start.
- **Singing guide tour: broken "Play / Pause / Stop" step.** The step targeted `[data-tour="transport.essential"]`, which existed on no element after recent relayouts, so the spotlight failed to highlight and the tooltip floated centred. Added the hook to the transport control group. (`SingingControlBar`)
- **Settings guide tour broken by the sub-tab relayout.** Settings is now split into General / Practice / Display sub-tabs, but five guide steps (Pitch Detection, Practice Aids, Accuracy Bands, Theme & Appearance, Reverb & ADSR) target controls under a non-default sub-tab; the tour only switched to the Settings tab (which opens on General), so the targets weren't in the DOM. Each step now uses `navigate[]` to open the correct sub-tab first. (`WALKTHROUGH_STEPS`)
- **Per-page "take a tour" toasts stacked.** A first-time user switching tabs piled up one offer toast per page. All tour-offer toasts now share a single notification channel — a new offer replaces the previous one, and leaving a tab retires the standing offer, so only the latest is shown. (`notifications-store`, `usePageTourOffer`, `offerTourOnce`)
- **"Reset to Factory Defaults" left state behind.** It only cleared `pitchperfect_*` localStorage keys, leaving sidebar collapse state (`sidebar-*`), karaoke UI prefs (`km-*`), the anonymous identity/auth token (`mp:*`), and the dev pitch-test flag. It now clears all localStorage + sessionStorage (alongside the model cache and IndexedDB) for a true factory wipe. (`SettingsPanel`)
- **Clearing all UVR sessions orphaned IndexedDB rows.** `deleteAllUvrSessions()` deleted only session records + lyrics, leaving stem audio blobs, fingerprints, and whisper transcriptions behind. It now wipes those too, so the existing in-app "clear storage" action no longer leaks rows. (`app-store`)
- **Mobile: "Choose your character!" guide step pointed off-screen.** The step targets `#character-icons`, which lives in the off-canvas sidebar, but lacked `inSidebar: true`, so the drawer never opened on mobile. Added the flag. (`WALKTHROUGH_STEPS`)
- **Mobile/narrow: toolbar guide steps could highlight an off-screen control.** The control bar scrolls horizontally, but the tour only scrolled targets into view vertically, so BPM / Volume / Play-mode (and Compose Record) steps could sit off to the side. The spotlight now also scrolls horizontally-clipped targets into view. (`Walkthrough`)
- **Mobile: spotlight tooltip action row could overflow at ≤360px.** The four controls now wrap. (`Walkthrough.module.css`)

## [0.4.9] - 2026-06-28

### Added

- HUD rail toggles in the 3D guitar view for the input-signal monitor ("Signal") and the orientation gizmo ("Axes"); both overlays are now user-controllable rather than the monitor being dev-only and the gizmo always on. Each toggle persists per device. Defaults: gizmo on (desktop) / off (small/touch); input monitor on in dev-desktop, off for players and on small/touch screens. (`Tab3DHud`, `Tab3DInputMonitor`, `GuitarTab3DView`)

### Changed

- The 3D control bar is raised above the other 3D-view overlays (input monitor, score card, nav gizmo) so it is never covered, hovered or not. (`Tab3DHud`)
- The 3D tab HUD dock now defaults to top on small/touch screens (bottom on desktop) and persists the user's choice locally (`gp-tab3d-hud-dock`). On small/touch screens the rail, top bar and loop popover lay out as a single horizontally-scrollable row so the bottom dock no longer wraps tall enough to cover the canvas. (`Tab3DHud`, `guitar-practice.css`)

### Fixed

- Unified tab order across the nav (covered by `tab-order.test.ts`), added touch gestures (orbit/pan/zoom) to the 3D view, and removed horizontal scroll on mobile. Community and leaderboard layouts are now phone-friendly. (`AppNavTabs`, `App`, `GuitarTab3DView`, `vocal-analysis.css`, `restored-legacy.css`)

## [0.4.8] - 2026-06-27

### Added

- Live input scoring surfaced in the 3D guitar view. The scoring engine already ran in any view (it scores mic/MIDI input against the falling notes while playing); this wires it into the 3D HUD: a Score/Combo readout + detected-note name while a run is playing, alongside the existing end-of-run corner card. (`Tab3DHud`, `GuitarPage`)
- In-scene scored-hit feedback: each successful hit flashes an additive ring on its cell coloured by accuracy (perfect/great/good), fading over `HIT_FLASH_MS`. Recent non-miss `hitResults` (Date.now timestamps) are mapped to cells in `buildScene` (`fret = midiNote - openMidi[string]`) and drawn in `Canvas2dTabRenderer.drawHits`. (`TabScene.hits`)
- Detected-note marker on the neck: the player's current input pitch is placed on its cell — snapped to a hittable target of the same pitch-class near the hit line (green), else approximated to the lowest playable string (neutral) — pulsing, alpha by detection clarity. Computed in `buildScene`, drawn in `Canvas2dTabRenderer.drawDetected`. (`TabScene.detected`)
- Mic + MIDI input toggles in the 3D control rail, so scoring is reachable with the shared transport bar hidden. (`Tab3DHud`, wired to `isMicActive`/`startMic`/`stopMic` and `midiConnected`/`midiConnect`/`midiDisconnect`)
- Dev-only input-signal monitor (`Tab3DInputMonitor`, gated on `import.meta.env.DEV`): shows input mode, your detected note vs the nearest target note, whether they match (same rule the scorer uses — exact MIDI / pitch-class mic), the last hit timing, an input level bar, and a live mic waveform. Added `getInputTimeData` to the controller for the waveform.
- Audio I/O device selection (`AudioDeviceSettings`, Guitar page "Devices" panel). `MicManager` gains `setPreferredDevice`/`getPreferredDevice` and applies `deviceId: { exact }` in its capture constraints, so capture can target an interface's instrument input instead of the OS default; the controller's `setInputDevice` restarts the mic so the engine re-wires onto the new device. Output routing via `AudioContext.setSinkId` (`audioEngine.setOutputDevice`/`outputDeviceSupported`, feature-detected). Selections persist (`mp.guitarInputDevice` / `mp.guitarOutputDevice`). `listAudioInputs`/`listAudioOutputs` enumerate devices (labels appear after mic permission).

## [0.4.7] - 2026-06-27

### Fixed

- 3D view default framing: `DEFAULT_CAMERA` reframed (radius 18→19, target y 1→-0.4) so the fixed-width neck plus the fret numbers sit above the bottom HUD with margin. The reset button uses the same constant, so it restores this framing. (`renderer/camera.ts`)
- Transpose now applies to ALL guitar sources, not just imported (`currentSong`-backed) songs. The re-voicing previously lived inside the combine `createEffect` gated on `currentSong()`, so app melodies loaded via `loadSong` with `songObj = null` (which set `fallingNotes` directly) were never transposed. Refactor: a new `baseNotes` signal holds the untransposed notes (set by both `loadSong` and the combine effect), and a dedicated effect derives `fallingNotes = revoiceNotes(baseNotes(), transpose())` and recomputes `transposeBounds`. The transpose helpers (`deriveOpenTuning`, `computeTransposeBounds`, `revoiceNotes`) were extracted to pure, non-mutating module functions (clone-on-shift), so the source melody/import is never altered and resetting transpose to 0 returns the exact original notes. (`useGuitarPracticeController.ts`)

## [0.4.6] - 2026-06-27

### Added

- 3D guitar tab playback view (`src/features/guitar-tab-3d/`). Backend-agnostic `TabRenderer` seam with a Canvas2D perspective backend (`Canvas2dTabRenderer`, `wgpu-matrix` lookAt/perspective): an upright fretboard wall on Z=0, a highway receding into −Z, notes flying down each (string, fret) lane onto their exact cell. WebGPU/TypeGPU backend scaffolding (`renderer/webgpu/`) sits behind the same interface for later. Surfaced as a new `'3d'` guitar view in `GuitarPage` via `GuitarTab3DView`, fed the same `guitar.fallingNotes`/`playheadBeat` as the 2D view.
- Readability layer in the renderer: imminence grading (near notes grow + glow, far fade to outlines, past fade out), chord spines binding notes within 1/16 beat, additive strike flash on landing, a "next to play" pulse on the nearest upcoming cell, decluttered per-cell labels, and luminance-adaptive label ink.
- Guitar Pro import (`src/lib/tab/gp-import.ts`, `gp-to-midi-song.ts`): `.gp/.gp3/.gp4/.gp5/.gpx` via `@coderline/alphatab` (MPL-2.0), dynamically imported / code-split. `scoreToMidiSong` preserves `stringIndex` (convention-agnostic `tuning.indexOf(realValue-fret)`), fret and MIDI; drops percussion.
- Orbit camera (`renderer/camera.ts`: yaw/pitch/radius/target, `cameraEye`/`cameraBasis`/`clampCamera`) driving the renderer via `setCamera`, plus a corner `NavGizmo` (axis cross drag-to-orbit, pan toggle, zoom, reset). Direct canvas control too: drag to orbit, shift/right-drag to pan, wheel to zoom.
- Glass HUD overlay (`ui/Tab3DHud.tsx`): dockable top (after the song name) or bottom-centre via a grip handle (click flips, drag snaps); transport, speed stepper + 0.5/0.75/1x presets + effective BPM, display toggles, and a practice-loop popover (A/B markers + speed ramp). `GuitarPage` gains a Hide/Show toggle that collapses the shared `SharedControlToolbar`.
- Transpose in `useGuitarPracticeController`: shifts every note's pitch by N semitones and re-voices it onto the neck (same string when in [0,24], else the nearest string that can host the pitch), affecting both synthesized audio (`targetFreq` scaled / backing freq × ratio) and the tab. Bounds computed from the instrument's reach so the whole song stays playable; octave = ±12; resets on song load. Exposed as `transpose`/`setTranspose`/`transposeBounds`.
- End-of-run score as a non-blocking corner card in the 3D view (`Tab3DHud`), matching the Exercises score-history chip (latest % + grade + notes/combo + recent runs), with Play again / Dismiss. In-session recent-scores list recorded in `GuitarPage`.

### Changed

- `.gp-tab3d-container` is now `height: 100%` so it fills `#guitar-fretboard-container` and scales with the window (was a fixed `min(62vh, 560px)` that left the parent background showing). Default camera radius 21.6 → 18 so the scene fills ~80% width / the lower two-thirds.
- The finished-run score modal (`.gp-score-overlay`) is suppressed for the `'3d'` view (still shown for the 2D/interactive views), replaced there by the corner card.

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
- Top-bar navigation UX (`AppNavTabs.tsx` + `app.css`, desktop ≥769px): (1) mouse-wheel `deltaY` now pans the tab bar horizontally (passive:false wheel handler, only when it overflows); (2) click-drag panning via pointer events (mouse only, 6px threshold, `setPointerCapture`, a capture-phase click swallow so a drag never activates a tab, `dragging`/`tabs-scrollable` classes drive the grab/grabbing cursor); (3) each group label is now a button that collapses its group down to the active tab — spacing switched from flex `gap` to animatable `margin`, non-active tabs transition `max-width`/opacity to 0, and the group re-expands on `:hover` or `:has(.app-tab:focus)` (the `:has` excludes the label so a collapsing click doesn't immediately re-expand via focus). Collapsed state persists via `createPersistedSignal('mp.navCollapsedGroups')`. Listeners and the ResizeObserver are torn down in `onCleanup`.
- Pre-merge review fixes: (1) **call-response** had the same absolute-clock window bug as interval-trainer/dynamic-swell (`performance.now()` vs relative `sample.time`) → always scored 0; now uses `base._getElapsed()`, and its happy-path test was rewritten as a true epoch lock (large absolute clock offset so a regression fails). (2) `mirror-melody` and `long-note` empty-result branches aligned to the populated metric shape (`consistency`/`richnessScore`; `volumeConsistency` consistent at 0). (3) staccato result label "Best Note" → "Best Round" (value was already `bestRound`). (4) long-note Stability bar now uses `fillClass(...)` instead of a hardcoded `good` color; removed a double `untrack`. (5) `ExerciseMenu` `gradeClass` returns `''` below 50 to match the empty `gradeLabel`; `IconCircleFill` is now a solid disc (was identical to `IconCircleEmpty`). (6) `scoreNoteAccuracy` now reuses `trailingSamplesByTime` (DRY).

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

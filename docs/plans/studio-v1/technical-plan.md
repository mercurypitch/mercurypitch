# Studio v1 technical plan

Implementation contract, grounded in PR #1219 at `c90e1a87c6b2a273334efd08192cce2c25e95295`. Source inspection and the peak-estimator reproduction are evidence; the schemas, timebase and boundaries below are design decisions to implement. See [source and app integration](evidence/source-integration.md), [FX investigation](evidence/fx-investigation.md) and [phase contracts](evidence/studio-phase-contracts.md). No implementation or device-performance claim is made here.

## Boundary and ownership

The owner accepted the layout with dark mode leading and light retained. Studio is a feature of the existing app at `/studio-night`, using the same origin and local database. V1 arranges finished audio: move, trim, split, duplicate, fades, volume, pan, mute and solo. Desktop and tablet get the full arrangement surface; phone gets the approved simpler adding, listening and export flow. MIDI editing, time stretching, pitch correction and cloud storage are deferred. New recording and overdubbing are explicitly deferred from v1. Collaboration remains outside this local-only version.

The existing kept-take catalogue already includes vocal, guitar, piano and drum sources. List its metadata without loading audio. Explicit **Add** reads only selected audio, validates/decodes it and creates a Studio-owned immutable asset. The original history item can then be deleted without breaking the project. Do not import all history or retain a fragile reference to its original blob. External MP3/WAV input uses the same asset pipeline; actual decoder support determines acceptance. UVR backing stems are a separate, lazy source adapter.

Provenance must describe the real signal: karaoke is dry microphone audio; guitar recorder keeps dry input; Piano Night currently produces a 24 kHz mono felt-synth replay of the player's notes; Drum Night keeps live-kit audio. Historical capture metadata does not establish sample-accurate alignment with accompaniment. Full authored instrument arrangements require later explicit render adapters.

## Durable model

Use new local tables in the next incremental Dexie schema after v12. Keep them outside the hybrid adapter's cloud allowlist. Model types live in `src/lib/studio/model/`; storage and source adapters live in `src/db/services/` and the feature's integration layer. Canonical PCM and preparation algorithms live in `src/lib/studio/audio/`, keeping database code independent from UI features under the repository architecture rules. The app shell only composes the feature.

```ts
type Frame = number // validated nonnegative safe integer
type StudioProject = {
  id: string
  schemaVersion: 1
  revision: number
  title: string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  sampleRate: 48000
  tempoBpm: number
  ruler: 'time' | 'bars'
  tracks: StudioTrack[]
  clips: StudioClip[]
  mix: { flavourId: string; macros: MacroValues; autoBalanceRevision?: number }
  master: {
    presetId: string
    engineVersion: string
    targetLufs: number
    ceilingDbtp: number
    maxLimitingDb: number
    masterEq: MasterEqSpec
  }
  export: { format: 'wav'; bitDepth: 16; range: 'song' | 'selection' }
}
type StudioTrack = {
  id: string
  name: string
  order: number
  role: TrackRole
  gainDb: number
  balanceGainDb: number
  pan: number
  mute: boolean
  solo: boolean
  fx: { version: number; baseSpec: ChainSpec; spaceOffset: number }
}
type FadeRamp = { fromSourceFrame: Frame; toSourceFrame: Frame }
type StudioClip = {
  id: string
  trackId: string
  assetId: string
  startFrame: Frame
  sourceInFrame: Frame
  sourceOutFrame: Frame
  gainDb: number
  fades: { curve: 'linear-amplitude'; in?: FadeRamp; out?: FadeRamp }
}
type StudioAsset = {
  id: string
  projectId: string
  sha256: string
  mimeType: string
  byteLength: number
  channels: 1 | 2
  normalizedSampleRate: 48000
  normalizedFrameCount: Frame
  importVersion: number
  originalName?: string
  canonicalPcmId: string
  canonicalPcmSha256: string
  preparation: { algorithmVersion: string; gainDb: number }
  provenance: { kind: SourceKind; sourceId?: string; importedAt: string }
}
```

Store asset bytes separately from metadata; project summaries are also separate from arrangement documents. A selected source may supply several clips without extra blob copies inside one project. Dedupe identical bytes within the project, retaining explicit ownership; cross-project ref-counting can wait. Labels and source names are snapshots. Persist resolved sound-affecting master EQ and limiting settings with the engine version, so a later preset change cannot alter a saved song. Do not carry practice scores, pitch contours, room/device evidence or unrelated source context into assets.

Peaks, in-memory AudioBuffers and diagnostic analysis are caches, keyed by content hash, sample rate and algorithm version. Canonical source PCM and the applied source-preparation gain/version are durable project data; rebuilding a cache never changes the sound. Render analysis additionally includes project revision, engine version and export settings. These caches can be discarded without losing edits. AudioBuffer, AudioNode, object URL and AudioContext are runtime objects, never persisted state. Removing a clip only removes its reference; prune unused assets deliberately after the undo horizon, not during a gesture.

## Time, commands and decoding

Use a fixed 48 kHz project timebase for v1. Placement, source bounds and fades are integer frames in that normalized timebase. Intervals are half-open: `[sourceInFrame, sourceOutFrame)`. Clip length is their difference. Validate positive length, `out <= normalizedFrameCount`, finite gain/pan, and positive fade ramps anchored within the asset, with non-overlapping in/out ramps. Ramps can extend beyond a trimmed or split clip's visible interval; evaluate their visible section without restarting it at the new edge. Convert frames to seconds only at the Web Audio boundary. Tempo controls the ruler and snapping; it never stretches audio.

At import, decode/resample once into 48 kHz audio and validate mono/stereo. Persist the immutable original bytes plus canonical normalized Float32 PCM, frame count, channels and hashes. Canonical PCM uses a versioned binary format with an explicit little-endian header; reading it does not invoke a lossy decoder again. All clips, playback and exports reference that canonical PCM. Backups include it, so a future browser decoder cannot shift saved trim boundaries. Keep loaded AudioBuffers in a bounded evictable cache. This increases storage and backup size: admission must account for both original bytes and canonical PCM before import. The original source remains available for deliberate future re-import; a project never silently re-decodes or rebalances an owned asset.

Commands operate on immutable project snapshots. Move changes placement. Head trim changes source-in and timeline start by the same frame delta, retaining the timing and gain of surviving audio; tail trim changes only source-out. Split creates adjacent source intervals sharing one asset, copying gain and source-anchored fade ramps unchanged. It adds no fade at the seam. Duplicate copies bounds, gain and ramps into a new identity at the original clip's exact end; an occupied destination follows the chosen overlap rule, never overwriting or silently moving another clip. A fade-handle edit replaces only that clip's ramp as one undoable command. Untrim reveals the retained source through its existing envelope, which the waveform must display honestly. Removing or changing that fade is explicit. The design specification uses one audible clip per lane; the audio scheduler can sum overlapping intervals only when the chosen UX explicitly permits them. One pointer gesture creates one undo command; cancellation restores its starting state. Selection and viewport are UI state and do not alter audio timing. Undo/redo restores complete clip snapshots, including fade anchors, through the same validator and autosave queue. Regression fixtures must prove that an untouched split inside either fade preserves the original rendered samples, and trimming preserves retained sample positions/gains outside the documented 3 ms boundary safety window. These two source ramps support fade handles only; general envelope automation is outside v1.

## Saving, competing tabs and backup

Read/decode/resample/hash outside a transaction, then atomically write the new asset bytes, metadata and first arrangement reference using a real local Dexie transaction. `HybridAdapter.transaction()` does not supply that guarantee. A failed commit leaves no visible successful import; cancelled or stale work cannot attach audio to a different project.

Each project has one serialized save queue. A save captures revision N; an edit during it queues N+1. **Saved** means the newest visible revision durably committed, never just that a request started. On failure retain the newest in-memory snapshot, show the failure and enable retry or backup. Storage estimates and persistent-storage requests are best effort; handle the actual quota/write rejection. Reuse the existing local-save navigation lease while a write is pending and keep browser/tab-exit behavior honest.

Use transactional compare-and-swap on project revision as the authority against lost updates. Feature-detected Web Locks can coordinate the active editor, and BroadcastChannel can notify other tabs, but neither replaces the database check. Another tab opens the same project read-only with an explicit reload/fork/takeover path. Every takeover establishes a new editor epoch; stale saves from the previous editor fail. Persisted editor metadata needs expiry/renewal if used, so a crashed tab cannot permanently lock a project. Test browsers without the optional APIs.

V1 includes explicit local **project backup**, separate from stereo song export. Proposed `.mpstudio` v1 bundle: versioned JSON manifest plus selected immutable original/canonical asset files and hashes, with no absolute source paths or account credentials. Restore into a new project ID after validating version, safe paths, unique IDs, decoded/encoded byte budgets, hashes and all clip references. Reject unknown schema/effect versions without destructive normalization. Stage validation before committing the restored project. A fresh browser-context round trip must recover every edit and asset. Provide backup even for an unsaved in-memory revision; report any missing assets rather than claiming completeness.

The existing instrument-history spec expressly excludes project exports through the keep flow. Phase 2 makes a narrow owner-authorized amendment: keeping remains local and never auto-copies or exports; explicit Add may create a local Studio asset; explicit project backup may include that project's selected assets. Cloud, analytics and device-sync restrictions stay intact. Ordinary individual take export is already permitted. See the [exact spec distinction](evidence/source-integration.md#follow-up-existing-export-restriction-and-narrow-amendment).

## One arrangement plan for playback and rendering

Compile a frozen project snapshot into a pure `ArrangementPlan`: lanes, active clip frame intervals, envelopes, track processing, audible-state rules, latency, output interval and tail policy. Live playback and offline rendering consume the same plan and graph builder. Coalesce contiguous, otherwise unchanged split fragments in the plan so splitting alone cannot restart resampler or FX state. Do not represent every clip as a separate FX track: clips on a lane share one lane graph, including stateful reverb/delay across adjacent clips.

**Boundary safety policy (Phase 4):** independently audible coalesced clip groups receive a 3 ms safety ramp at their true start/end. The resulting gain is the minimum of the safety ramp and the explicit source fade, never their product. Longer user fades therefore dominate. Preserve full group boundaries before seek, lookahead or export-range cropping; range boundaries must not create a new clip-edge dip. Untouched split fragments coalesce before applying this envelope. Freeze this policy in the engine version and verify identical live/offline golden vectors. Transport start/stop/seek envelopes remain separate, beginning at the actual audible epoch after warmup and latency.

Graph order: clip source/trim → fixed source preparation gain → fade and clip gain → lane sum → role chain → lane volume and pan → shared master. Source preparation is measured once against the complete owned asset, capped and persisted with its algorithm version; it is not recomputed on each trim, split or seek. The lane chain's built-in `level-match` stays at unity when source preparation is applied upstream, avoiding double normalization. Keep the measured role-balance trim separate from the user fader and persist both. Auto balance is an explicit undoable proposal and must not overwrite a user's faders after every edit. Validate this extension of the existing single-buffer auto-mix API in Phase 2 with quiet/loud takes sharing one lane. Mute/solo use one common predicate. Source role is distinct from musical role; a guitar-origin asset may be bass or acoustic guitar. Build macros from the saved base spec, avoiding cumulative parameter drift. An already processed analysis buffer must not receive the same chain again.

Channel mapping and pan law are shared graph-building rules: duplicate mono into L/R at unity before measurement and lane processing, matching the existing dual-mono loudness convention. Use an explicit stereo balance law for v1: center leaves both channels at unity; pan attenuates only the opposite channel with a cosine curve to zero at the extreme. Label it Pan and describe stereo behavior in help; no hidden 3 dB center gain. Validate center/endpoints and mono/stereo loudness using rendered fixtures.

The transport uses one audio clock and the active host's borrowed context lease. The live context may run at 44.1 kHz even though the project and export use 48 kHz. Measure chain latency at the actual context rate and convert it to seconds for scheduling; never add context-rate latency frames directly to project frames. Include a 44.1 kHz live-context versus 48 kHz export alignment fixture. It schedules sources from the plan, compensates active chain latency and disposes its own nodes on stop and leave. A seek while playing keeps the running graph: the lane chains, the master and the meters stay, and each lane crossfades from its sources to ones started at the new frame (10 ms, equal-power, ahead of the chain, so reverb and delay tails ring on). Only a plan that does not reach the target, one built from a later frame when memory was short or a shorter song's that an edit is replacing, hands over to a run built at the target instead. It never closes a borrowed context or starts sound after reload, route return or decode completion. Resume after interruption requires the approved explicit action. Start/seek use a defined preroll strategy; tails and warmup need parity tests because stateful effects make arbitrary seeks differ from playback from the beginning. Once edits settle, the transport reads the song's audio into the playback cache and measures each effect list's latency, once per list and rate, so Play only builds the graph. The warmup follows the previous build's duration (0.1 to 0.5 s), and an edit during playback that the running graph cannot follow builds the new run while the old one plays on, then hands over on the same frame with a 30 ms crossfade. An edit that only changes lane volume, balance, pan, Mute or Solo glides the running lane gains over about 12 ms instead (`StudioGraph.setLaneMix`); it restarts only to bring in a lane that was silent, and so never built, when Play started.

Bound decode concurrency and account for source PCM, render output, intermediate analysis buffers and effects before admitting a render. Five minutes of stereo 48 kHz Float32 PCM is about 110 MiB for one source alone; eight such sources approach 879 MiB before output/FX. These are arithmetic lower bounds, not measured device capacity or a shipping track limit. Benchmark the supported device matrix before publishing limits. Native offline rendering may not stop immediately; cancellation must stop subsequent passes and discard stale results without claiming instantaneous resource release.

## FX and output correctness

Reuse the PR's role presets, serializable chains, macro derivation, latency measurement and mastering choices. Extend its single-buffer-per-track renderer through the shared lane plan. Meter labels must distinguish sample peak in dBFS, estimated true peak in dBTP and integrated LUFS. V1 requires live L/R sample peaks with clip indication and resettable peak hold, 400 ms momentary LUFS, 3 s short-term LUFS, and final whole-song integrated LUFS plus validated true peak after rendering. The existing whole-buffer function is not a streaming meter. Compute on the audio/worker side; paint peak meters at a bounded cadence (target 30 Hz) and numeric LUFS at 10 Hz without rescanning song buffers. The detailed meter panel explains windows; new playback measurements reset on seek/stop/new song, peak hold has explicit reset, and final render results are revision-bound. LRA is deferred unless separately specified and verified.

The Phase 5 verification receipt records the repair of the original true-peak estimator shortcut: it skips interpolation intervals based on endpoint levels, yet the reproduced interval exceeds the reported peak by approximately 3.13 dB. Evaluate all required intervals or prove a conservative bound, with adversarial regression and independent reference vectors. Separately, the existing limiter is sample-based and the master path has no final true-peak correction. Repair that safety contract: validate the final rendered/encoded output against the chosen ceiling and apply a conservative correction or rerender when necessary. Do not simply relabel it safe. See [FX evidence](evidence/fx-investigation.md).

The owner confirmed WAV plus editable project backup for v1, with MP3 export later. The delivered WAV is stereo 48 kHz, 16-bit PCM using the existing encoder, with round-to-nearest quantization and no dither. Studio rejects nonfinite or out-of-range source samples before encoding. Loudness and peaks are measured from the quantized delivered bytes; see the Phase 5 receipt for observed reference differences and peak-margin limits. 24-bit WAV is an optional proposal requiring encoder work and tests; MP3 export is not promised. If a loudness target cannot be met within the limiting cap, show achieved measurements. Separate render completion from successful download/share delivery. Subjective demo readiness still needs listening; a number alone does not establish it.

## Phase delivery and commit contract

Owner phases remain sequential. Independent source mapping, DSP fixtures, schema design and test recipes can be prepared in parallel; final implementation follows approved design and the prior phase contract. Each phase produces its own inspectable commit(s) on the current PR branch. No merge or production release is implied.

| Phase                   | Deliverable                                                                                                                                     | Acceptance before advancing                                                                                                                                                   | Commit boundary                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2: Data and integration | Local schemas/services, catalogue/import adapters, revision saves, working backup/restore, narrow spec amendment; thin real app route/tab shell | Signed-out create/add/reload; source deletion preserves copy; schema upgrade; quota/decode/cancel/conflict failures; no cloud requests; clean URL and hash enter same feature | `feat(studio): add local projects and integrated entry`                                  |
| 3: Interface            | Approved desktop/tablet/phone layouts connected to real data, source picker, selected-clip controls, transport shell, actual tour targets       | Real empty/loading/error/saved states; keyboard/focus/accessibility; responsive geometry; navigation scope and sidebar work; no autoplay                                      | `feat(studio): build approved arrangement interface`                                     |
| 4: Interaction          | Commands/undo, pointer and keyboard editing, shared transport, reliable drag/drop and touch behavior                                            | Real-mouse Playwright `@smoke` red→green; make a short song through UI, save/reload/replay; cancellation, zoom/scroll and stale decode checks                                 | `feat(studio): complete arrangement interactions`                                        |
| 5: Sound and delivery   | Shared lane FX/render, peak-estimator repair, final peak safety, meters, mastered WAV, final backup/restore regression check                    | Alignment/live-offline parity, mixed rates, mute/solo, silence/tails, final encoded analysis, admitted memory/load, cancel/share failures, backup in fresh context            | `feat(studio): add mastering and verified exports` plus focused DSP fix commit if useful |
| 6: Manual PR acceptance | Exact-SHA preview, owner song-making/audition session, device checks and reproducible fixes                                                     | Real desktop/tablet/mobile audio/interruption checks; honest CI/served-SHA evidence; listen to exported song and restored backup; remaining limitations recorded              | Focused corrections and manual acceptance evidence                                       |

The cheapest integrated entry changes are the tab constants/metadata, hash-router valid set, lazy App host, sidebar layout and SEO entry registry. `/studio-night` should use the existing full-app boot-hash pattern, not a standalone app. The resulting clean entry may display `/studio-night#/studio-night`, matching current architecture. Add tour selectors when phase 3 creates their controls. Repository gates remain proportional: focused tests while building, real-pointer smoke coverage for pointer controls, required typecheck and PR preparation before the first push, then CI as the authoritative full gate.

## Phase 2 admission and recovery refinements

Local project admission is capped at 128 owned assets and 480 MiB total original plus canonical PCM bytes, including retained unreferenced assets. This leaves room within the 512 MiB backup cap for manifest and container overhead. These are engineering guardrails, not measured device capacity. The controller rejects an over-budget prepared import before staging its clip, and the service rechecks the authoritative aggregate in the atomic transaction.

A document reload may leave an unexpired lease because unload cannot guarantee asynchronous cleanup. A fresh document opens read-only and offers explicit takeover; it does not reuse sessionStorage identity, which duplicated tabs could share. Unsaved edits must be copied, backed up or explicitly discarded before takeover. Fully prepared audio from a failed write stays in memory with the unsaved revision and can be included in a complete validated backup.

# Studio v1 technical phase contracts

Phase contracts for the master plan, updated for the accepted v1 decisions. These describe delivery gates, not a claim that all phases have shipped. Based on source investigation at PR #1219 head `c90e1a87c6b2a273334efd08192cce2c25e95295`; see `source-integration.md` beside this file for evidence and exact reuse points.

## Phase 2: local project foundation and in-app entry

**Boundary:** a working local project and source catalogue, reachable through the real app tab and `/studio-night`. No polished arrangement surface is required yet; no cloud storage, MIDI editing or live recording enters this phase.

**Data contracts**

- Project has schema version, ID, title, updated timestamp and monotonically increasing revision. The active project is a snapshot, with one serialized persistence queue per project.
- Track has stable ID, order, display name, role, volume, pan, mute, solo and a versioned normalized FX spec. Store musical role separately from capture source. A guitar file can be acoustic, electric or bass; source name cannot reliably decide.
- Asset has immutable stored bytes, stable local ID, content hash, original MIME, decoded audio facts, source provenance and processing state. Project listing never reads these bytes.
- Clip references an asset, with source trim boundaries in source frames, project placement in project frames or another explicitly chosen fixed timebase, gain and fades. Store source and project sample rates explicitly. Project tempo is initially a grid/display aid, not time stretching.
- Original bytes and versioned 48 kHz Float32 canonical PCM are durable owned assets. Derived peaks, analysis and rendered bounces are revision-keyed caches; canonical PCM is not a disposable cache.
- Asset insertion and the first project reference commit atomically. Explicit Add snapshots a kept take so deleting its original history later cannot damage Studio. Never auto-import the whole library.
- Quota/decode/read failures remain distinct from an empty library. Cancelled import cannot add a late clip to another project.
- Project IDs and content hashes do not imply an account or upload. Future cloud sync must be a separate consent and ownership design.

**State contracts**

Project lifecycle: unopened → loading → ready or load-failed. Import: selected → reading → decoding → validating → committing → ready, with failure/cancellation branches. Persistence: clean → dirty → saving → saved; failure preserves the newest in-memory project and marks it unsaved. A new edit during saving queues the next revision rather than claiming the old write saved it.

**Acceptance**

Create a project signed out, list real kept takes from each available source, add one plus an external WAV, close/reopen, delete the original source take and still play the Studio copy. Inject failed/quota writes and failed/cancelled decodes. Validate schema upgrade from v12 without damaging existing voice, piano, drum or guitar records. Check no Studio table enters cloud entities. Verify a second tab cannot silently overwrite a newer revision.

**Commit boundary:** local entities, persistence, catalogue/import adapters, narrow spec changes, thin real app route/tab and focused tests. UI styling stays limited to an inspectable shell.

## Phase 3: approved arrangement interface

**Boundary:** approved mockups become actual app components over phase 2 data. Layout is not a separate demo page or iframe.

One main timeline, one source picker, contextual selected-clip commands, track controls and a persistent transport. Desktop/tablet expose full basic arranging. Phone offers adding, listening, levels and exporting without implying complete precision editing. Exact phone editing scope follows the approved design.

Selection is state, not focus or hover. Naming a clip and renaming a track are different actions. Toolbar controls act on an explicit selection. Empty, loading, missing-audio, unsaved and failed-render states have useful actions. Undo/redo includes delete and split. No visible advanced MIDI or cloud controls.

**Acceptance:** real data fills every designed surface; keyboard selection and command access; readable zoom states; touch hit areas; focus restoration after dialogs; sidebar does not steal arrangement width; tab route and clean URL reach the same active project; zero autoplay. Add the Studio tour only once its actual selectors exist.

**Commit boundary:** approved visual system, feature components, responsive layouts, source picker and actual command wiring. Mockup images never replace live controls.

## Phase 4: interaction and song-making proof

**Boundary:** no new feature breadth; make the approved edit language reliable.

- One pointer gesture produces one undoable command. Pointer cancellation restores the pre-gesture snapshot.
- Move changes placement, trim changes source interval, split creates adjacent intervals sharing one immutable asset, duplicate creates a new clip identity, and delete removes a reference. Each command has validated bounds and an inverse.
- Clip position does not change when viewport scroll/zoom changes. Gesture math uses content coordinates plus timeline scale. Dragging near an edge scrolls predictably; touch scrolling and editing do not compete.
- Mute, solo and per-track gain/pan use one shared definition in live and offline playback. Clips cannot overlap on the same lane in v1; a conflicting duplicate gets a new lane in the same undo step. Independent lanes sum.
- One audio clock drives playback. Seek/stop cancels scheduled nodes; opening or restoring a project never resumes sound.

**Acceptance:** red→green real-mouse Playwright `@smoke` coverage for drag/drop, trim, split and fade; keyboard equivalents; touch/pointer cancellation; undo after drag; reload persistence; stale decoding after navigation. A scripted UI run imports several small generated fixtures, makes a short arrangement, edits it, saves, reloads and plays it without test-only state injection after setup. Save selected captures and sanitized receipts; raw browser output stays in registered scratch.

**Commit boundary:** interaction corrections, audio transport completion and regression evidence. No screenshot-only claim of working arranging.

## Phase 5: mix, master, measure and export

**Boundary:** integrate the existing normalized FX chain API with the completed arrangement model.

Track source → trim/fade/clip gain → role chain → track gain/pan/mute/solo → shared master. Any alternate order must be explicit and identical live/offline. Delay compensation includes each active track chain. Global macro changes preserve the approved simple control model; detailed effect parameters remain behind an intentional disclosure, if offered at all.

Analysis and export bind to a frozen project revision. A live meter is not a final integrated loudness result. Final LUFS/true-peak values come from the actual final rendered buffer, including chosen tails and processing. If the limiter cap prevents reaching a target, show the achieved result instead of pretending the target was met. A bypass comparison should match perceived level where feasible.

WAV is the guaranteed v1 file format using the existing stereo PCM encoder. MP3 input is not evidence of MP3 export support. Only add MP3 output with a deliberate encoder/dependency and tests. A project backup is separate from a stereo song export and contains selected immutable source assets plus the arrangement, excluding practice metrics/contours and unrelated history.

**Acceptance:** alignment fixture with delayed/undelayed chains; mono/stereo and mixed sample rates; same trim/fades live and offline; muted/soloed tracks; silence; peak and loudness measurements; render progress/cancel; retained unsaved work after failure; bounded RAM admission; stereo headers and actual playback of downloaded file; filename/container truth; local backup round-trip in a new browser context.

**Commit boundary:** FX controls, metering, bounce/export and final analysis tests. Preserve any unresolved subjective sound or real-device findings for phase 6.

## Phase 6: owner audition on the PR

**Boundary:** owner manual acceptance of the tested PR, not automatic merge or release.

Review at the exact pushed SHA. Verify CI and the dev/PR preview that serves that SHA. Owner makes a song from actual kept takes, hears dry/processed changes, exports, reopens backup and auditions on desktop/tablet. Check Safari/iOS interruption behavior physically; emulation alone is insufficient. Record issues with project recipe, device/browser and exact action so fixes can be reproduced.

**Commit boundary:** manual-test corrections and evidence. Report green CI, exact preview revision and remaining acceptance items. Merge/deploy requires the owner's explicit go-ahead.

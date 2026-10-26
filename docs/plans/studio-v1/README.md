# MercuryPitch Studio v1: master plan

**Date:** 26 October 2026

**Status:** Layout approved with dark mode leading and light mode retained. Phase 2 local data and app integration is implemented and locally verified; fresh PR CI is pending.

**Branch:** `feat/studio-fx-chain`, existing draft [PR #1219](https://github.com/mercurypitch/mercurypitch/pull/1219)

**Inspected foundation:** `c90e1a87c6b2a273334efd08192cce2c25e95295`

**Design assets:** retained in the personal Studio handoff, `mercurypitch/studio-plan/v2-2026-10-26/`. Full-resolution art is not bundled in this checkout.

## The product

Studio turns recordings people already keep in MercuryPitch into a finished demo. A person adds a vocal, guitar, piano or drum take, arranges audio clips in lanes, balances the song, chooses its sound and downloads a stereo file. It lives inside the existing app at `/studio-night`, with the same local take catalogue and application lifecycle.

The standard is a small, understandable instrument for assembling a song: readable audio, direct edits, useful feedback, recoverable mistakes and sound that survives export. Apple-quality is a design aspiration, not an award or a shipped-quality claim.

This plan replaces the September proposal for the new work. The original documents, mockups, archive and Linear attachments remain historical references. New recording and overdubbing are deferred from v1 by the owner. The new proposal removes the permanent mixer and includes integrated FX.

## Decisions already made

| Decision           | Contract                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devices            | Full arranging on desktop and tablet. Phone supports adding, listening, basic balance and export.                                                                      |
| Editing model      | Audio clips only. Move, trim, split, duplicate, fades, volume, pan, mute, solo, undo and redo.                                                                         |
| Later integrations | Existing MIDI arrangement tools remain separate. MIDI/note editing, pitch correction and time stretching are outside v1.                                               |
| Location           | Integrated Studio tab and full-app clean URL `/studio-night`. No standalone Night application or separate origin.                                                      |
| Persistence        | Projects and source audio stay in the current browser. Being signed in does not enable uploads. Cloud projects are a later phase with a separate contract.             |
| Input              | Explicitly kept app takes and user-selected MP3/WAV files; other supported formats only after actual decode succeeds.                                                  |
| Export             | Stereo WAV and an editable local project backup in v1. MP3 export later; MP3 import stays in v1.                                                                       |
| Delivery           | Six phases, each recorded as a coherent commit on the existing PR branch. Keep the PR draft through manual acceptance. No merge or release is authorized by this plan. |

Implementation defaults: seconds as the initial ruler, one clip at a time per lane, role-based FX with simple song controls, and one contextual panel at a time. Importing MP3 does not promise MP3 encoding. These defaults implement the approved simple layout; new recording remains out of scope.

## Read the design

- Review gallery: available in the personal Studio handoff with full-size mockups and image inspection controls.
- [Design specification](design-spec.md): chosen visual direction, exact screen hierarchy, gesture rules and states.
- [Technical plan](technical-plan.md): schemas, timing, audio ownership, implementation contracts and acceptance matrix.
- [Source integration evidence](evidence/source-integration.md), [FX investigation](evidence/fx-investigation.md), and [design research](evidence/design-inputs.md).

The generated images are proposals. Numbers in their meters are illustrative. The gallery is not a working audio editor. The written contract controls if a generated label, control or waveform differs from it.

## What exists, and what still needs building

The common `VoiceTakeRecord` catalogue already covers kept Karaoke, Hear Yourself, Guitar Night, Piano Night and Drum Night performances. Adapt `listVoiceTakes()` and `getVoiceTakeBlob()` rather than creating five competing source libraries. Listing must read metadata only; audio is loaded when previewed or selected.

Source meaning matters. Karaoke is a dry microphone take, not the backing song. Guitar recording may be dry input rather than the heard amp sound. Piano replay is currently a mono 24 kHz felt-synth render of the player's notes, not the complete authored arrangement or sampled piano output. Drums are the kept live kit performance. Existing metadata does not establish sample-accurate alignment with a backing song. Source labels and import behavior must reflect these distinctions.

The FX branch has ten role chains, five macros, seven named flavours, source preparation, live chains and offline mixing/mastering. It has no Studio project document, arrangement scheduler, multi-clip lane abstraction, editor or encoded song-download pipeline. Integrated loudness exists; live momentary/short-term loudness and the meter UI remain work.

**Confirmed export blocker:** the current true-peak estimator's candidate shortcut can report 0 dBTP for a buffer whose own interpolation kernel reaches +3.129 dB at a skipped position. The limiter protects sample peaks and the browser master probe checks sample peaks. Repair and validate the estimator, then verify/correct final-file true peaks before claiming peak-safe exports. The exact reproduction is in [evidence/true-peak-repro.mjs](evidence/true-peak-repro.mjs). This is not an independent standards-conformance test.

The inspected engine foundation at `c90e1a8` had passing GitHub CI. Each later phase needs its own head-specific check results. That is separate from this investigation: source review and the dependency-free peak reproduction were performed here; the full unit/browser suite and physical-device audio were not rerun. All 1,514 LFS entries remain pointers. No dependencies were installed for reconnaissance.

## A first song, end to end

1. Open Studio inside the app and create a local project.
2. Choose Add takes. Preview a kept take or choose an external file. Preview and song playback never compete.
3. Select audio to add. Studio validates and copies it into project ownership, then shows the new lane and selected clip. The original stays unchanged.
4. Add another part, position it, trim unwanted silence, split or duplicate a section and shape fades. The first version does not change tempo or pitch to align it automatically.
5. Listen, balance levels and pan, and use mute/solo. Every arrangement action has undo and a non-drag alternative.
6. Open the song-sound panel. Choose a starting sound, adjust the existing macros, and compare at matched loudness. Preserve the user's balance after manual edits.
7. Choose Export. Render an immutable revision, encode the WAV, validate and measure the delivered bytes, then display actual integrated LUFS and peak results before download. A target is never displayed as a measured result.
8. Save a project backup separately from the audio export. Reopen the local project and continue; playback never restarts on its own.

## Six delivery phases

### Phase 1: design and interaction contract

**Deliver:** the fresh desktop arrangement, take selection and finish/export views, tablet and phone adaptations, exact editing/feedback rules, first-song flow, error states, master plan and source-backed architecture. Preserve existing handoff material. Add a lightweight reviewable contract to PR #1219; keep full-resolution art and design files in the requested dotfiles Studio directory.

**Review:** Can a new user find their takes, distinguish a clip from a lane, make an edit, undo it, understand saving and export a song without learning a full DAW? Does the default screen give the timeline most of the space? Are the tablet gestures and phone limitations clear? The owner accepted the layout, requested dark mode as the lead with light retained, and confirmed recording later. Both theme sets preserve the layout; Mute now uses a speaker icon and Solo retains a readable S.

**Commit:** `docs(studio): define v1 design and phased delivery contract`.

### Phase 2: local data, timing and app foundation

**Deliver:** versioned local project/track/clip/asset storage; catalogue adapters; atomic owned-audio imports; local backup/restore; pure edit commands and undo; revisioned autosave; multi-tab writer coordination; decode/memory admission; shared live/offline scheduling description. Add typed route and navigation registration with a minimal real-data shell. It is acceptable for this shell to be plain while final UI waits for Phase 3.

Use the existing full-app `bootHash` entry pattern for `/studio-night`. Keep Studio out of the cloud entity allowlist. Update the instrument-history specification narrowly for the user's explicit Add to Studio and project-backup actions; result scores, contours and analysis evidence remain excluded.

**Acceptance:** catalogue listing never decodes every recording; adding copies only the chosen audio; deleting the original take does not damage the project; save/reload and schema upgrade work; quota failure never claims Saved; stale async work is discarded; competing tabs cannot overwrite edits; no Studio upload occurs when signed in. Verify clean URL, hash URL, navigation and browser Back/Forward reach the same app feature.

**Commit:** `feat(studio): add local projects and app entry`.

### Phase 3: approved interface on real data

**Deliver:** the approved Studio layout, project chooser, source sheet, waveform lanes, one contextual panel, selection, transport, save feedback, responsive desktop/tablet layouts and the limited phone surface. Bind controls to Phase 2 commands and services. Include actual loading, empty and failed-import states.

Register the Studio tour and verify its target selectors. Resolve the current navigation-group name collision without hiding Settings or making Studio unreachable in simple mode. Use the existing theme/icon/accessibility conventions, with no decorative hardware controls or unsupported MIDI visuals.

**Acceptance:** actual data populates the approved design; keyboard focus and reading order work; important actions do not depend on hover; touch targets are usable; panels do not obscure transport or selected clips; app navigation and Studio gestures do not compete. UI screenshots are compared with approved mockups at desktop, tablet and phone widths.

**Commit:** `feat(studio): build the integrated arranger interface`.

### Phase 4: editing, transport and song-making proof

**Deliver:** complete direct manipulation, trim/split/fades/duplicate, snap, zoom, scrolling, keyboard/numeric alternatives, reliable undo/redo, pointer cancellation, audio-clock playback, seeking and looping. Fix the common pitfalls in the technical plan. No edit silently alters source audio.

**Acceptance:** real-mouse Playwright `@smoke` tests demonstrate red-to-green behavior for pointer controls. Test touch scrolling versus editing and keyboard alternatives. Create a short multitrack song through UI controls using small generated audio fixtures, save, reload and replay it. Check source deletion, storage failure, resize/zoom, navigation and interrupted audio. Save traces outside the creative handoff; keep selected screenshots and a concise receipt.

**Commit:** `feat(studio): complete clip editing and song assembly`.

### Phase 5: song sound, meters and export

**Deliver:** lane-role FX, source preparation, named flavours, five song macros, level-matched comparison, actual stereo output metering and disclosed loudness detail. Build final WAV export from a frozen project revision. Repair the peak-estimator shortcut and introduce verified final-output peak correction. Include export stages, cancel/discard behavior, download errors and measurement invalidation after edits.

**Acceptance:** one persistent FX graph per lane in both playback and render; different role latencies align; trim/fades/mute/solo/pan/tails match; stale analysis cannot replace newer results; empty/silent/corrupt audio is handled; target LUFS is distinct from actual LUFS when limiting limits loudness. Independently measure the encoded WAV and inspect its headers/channel count/duration. No fake percentage progress or claim that a canceled offline render has already released memory. Validate cancellation and capacity on the target browsers.

**Commit:** `feat(studio): add song mastering and verified WAV export`.

### Phase 6: manual acceptance on the PR

**Deliver:** a repeatable acceptance script, local/dev test projects, current CI links and a source-revision evidence ledger. Fix problems found during manual review in scoped follow-up commits on this branch. Record owner acceptance accurately; do not manufacture a code change merely to create a phase commit.

**Acceptance:** make a song on desktop and a physical tablet; use the phone flow; audition headphones and speakers; import real MP3/WAV, recover after reload, deny storage, remove a source-library take, interrupt playback/render and test the largest admitted project. Open the exported file in an independent player/DAW and inspect the measured results. PR previews use their own origin and cannot see production-browser recordings. No testing against production.

**Commit:** an acceptance-evidence document and any actual fixes, once those checks occur. Keep the PR draft if owner/device acceptance remains incomplete. Merge and release require separate explicit authorization.

## Work that can run in parallel

With the layout accepted, Phase 2 persistence and source adapters can be developed alongside pure timing/edit commands and test fixtures, with one agreed schema. During Phase 3, visual implementation and transport integration can proceed in separate files. Phase 4 interaction tests can be authored against the intended behavior while controls are completed. Meter reference fixtures and peak-correction research can start before Phase 5 without changing the visible UI.

The project schema, clip semantics, audio ownership and approved layout are shared dependencies. Do not independently invent these in competing branches. Use one integration owner and inspect the combined state before each phase commit. Parallel work does not remove a phase's acceptance gate.

## Durability, performance and privacy

Studio copies selected audio into its own immutable asset store; duplicated clips share that owned source. Original recordings remain unchanged. Persist the arrangement, original source bytes, canonical normalized PCM, and applied preparation gains. AudioNodes, object URLs and in-memory AudioBuffers are runtime state. Derived waveforms and diagnostic measurements are replaceable caches; rebuilding them must never rebalance a saved song.

Use transactional writes, serialized autosaves and revision checks. Handle browser eviction, quota exhaustion, unavailable persistence and another tab editing the same project. A backup must contain the arrangement plus its selected audio. A WAV cannot restore the editable project. Keep the local/cloud boundary unchanged for logged-in accounts.

Budget decoded frames and processing buffers, not track count alone. One three-minute stereo 48 kHz Float32 buffer is about 65.9 MiB; eight are about 527 MiB before FX, analysis, rendering or encoding. These are arithmetic estimates, not observed device capacity. Limit concurrent decode/render jobs and reject an operation before it exceeds the chosen device budget. Track/duration limits become release promises only after qualification.

Use a single audio clock and the host's audio lease. Stop/disconnect only Studio-owned nodes. Do not close a borrowed context. No autoplay after opening, decoding, reloading, background return or navigation. Freeze export state; never let edits mutate an in-flight result.

Local storage and audio decoding constraints are grounded in [MDN storage guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) and [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext). The behavior checklist follows [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) and [drag-and-drop guidance](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop).

## Verification and delivery discipline

Keep code gates proportional: focused tests during implementation, affected typechecks and repository preparation where required, then CI as the authoritative whole-repository check. Pointer controls require actual mouse tests. New tour targets need selector verification; the full tour walk remains a release gate. Never weaken existing checks to make this PR green.

For every phase record: source SHA, changed behavior, commands/results, browser screenshots, known limitations and what remains for manual acceptance. Separate source proof, local tests, CI, preview deployment, physical-device behavior and subjective listening. A generated mockup or green unit suite cannot establish the later categories.

Only scope-confirmed work is committed. Full-resolution images and local reports stay in the personal Studio handoff, with lightweight source/design contracts on the PR. Do not repack or replace the older Linear archive as a side effect.

## Accepted direction and implementation defaults

The owner accepted the existing layout, requested dark as the lead and explicitly retained the white/light mode. Both use the app appearance setting. Mute uses a speaker icon with a slash when muted. Solo uses a readable S, with a full Solo label in its tooltip and accessible name. Pressed state uses shape/border/fill as well as color.

V1 arranges kept takes and uploaded files; recording and overdubbing are deferred. The remaining implementation defaults follow the approved small editor: one audible clip per lane, duplicate conflicts create a new lane, seconds ruler initially, and one contextual panel. The navigation group keeps its stored identity but is labelled Create; its default order is Studio, Compose, Settings, Analysis, so Settings remains among the first three destinations. Studio is reachable in simple mode for every instrument.

Phase 2 is implemented with an inspectable foundation shell. [Local verification](phase-2-verification.md) covers storage, imports, backups and real app navigation. Phase 3 now builds both themes and the arrangement workspace over that data. Physical-device and listening acceptance remain Phase 6 work.

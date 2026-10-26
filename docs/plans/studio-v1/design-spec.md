# Studio v1 design specification

26 October 2026. Layout approved; dark leads and light remains available. This reconciles the lead design with the inspected app and [technical contract](technical-plan.md). Mockups illustrate the proposed interface; they do not establish audio behavior, measured loudness, browser durability or device performance.

## Confirmed scope and proposed decisions

The owner confirmed a **Studio** destination inside MercuryPitch, local browser projects, desktop/tablet audio arranging, a simpler phone experience, and audio editing before MIDI integration. V1 editing comprises move, trim, split, duplicate, fades, volume, pan, mute and solo. Existing kept takes and external MP3/WAV files are sources. WAV and editable project backup are the v1 outputs; MP3 export and account cloud storage come later.

**Graphite Sheet** is the accepted layout. The owner requested dark mode as the lead while retaining the white/light theme, and confirmed that new recording and overdubbing come later. The implementation defaults below complete the small audio editor without reopening the agreed device scope.

## Graphite Sheet

Dark mode pairs warm off-white waveforms with a graphite timeline. Light mode keeps graphite waveforms on a paper-colored timeline. Both share the same layout and controls. Source color occupies a narrow stripe, clip header tint and picker dot. Cobalt identifies selection, focus and the active primary action. Waveforms never become colored slabs.

| Token     | Light     | Dark      | Purpose                                |
| --------- | --------- | --------- | -------------------------------------- |
| Paper     | `#F5F3EE` | `#17181B` | Timeline                               |
| Sheet     | `#FFFFFF` | `#222428` | Clips, bars, headers, panels           |
| Graphite  | `#26282C` | `#E7E4DD` | Waveforms, primary text, playhead      |
| Pencil    | `#686B71` | `#9EA1A7` | Secondary text, ruler                  |
| Cobalt    | `#2A55C9` | `#7E9CFF` | Selection, focus, primary action, snap |
| Vermilion | `#C8402A` | `#FF7A5E` | Errors and invalid operations          |

Grid lines use Pencil at 18%; dividers use Graphite at 10%. Dark leads the mockups; matching light boards remain available. Follow the existing app appearance setting for both modes, with no Studio-only theme toggle. Do not overwrite the user's saved appearance preference. Dark source hues may be lightened, but actual contrast must be checked rather than assumed from a percentage.

| Source        | Tint            |
| ------------- | --------------- |
| Karaoke       | Rose `#C2566B`  |
| Hear Yourself | Plum `#8C5BA8`  |
| Guitar        | Ochre `#B07A1E` |
| Piano         | Teal `#2F8C86`  |
| Drums         | Olive `#6E8B3D` |
| External file | Stone `#8C7B6B` |

Use a 4 px lane stripe, clip-header tint at 16%, and a picker dot. Source labels remain visible so color is never the only identifier. Source provenance and musical FX role are separate: a guitar-origin take can have a bass role without inventing a different source.

Use system sans-serif with tabular figures for time, gain and meter values. Song title 17/22 semibold; panel heading 15/20 semibold; body and lane names 13/18; clip names and ruler 11/14 medium; time 20/24 medium. Phone body is 15/20 and labels 12/16. These are default mockup sizes, not a reason to disable text scaling.

Spacing follows 4 px increments, principally 8/12/16/24. Clip radius 4 px, buttons 6 px, panels 10 px, phone sheet top corners 14 px. Only floating toolbars and sheets use a small shadow. No glow, decorative gradients, fabricated hardware, MIDI note blocks or unrelated dashboard statistics.

## Integrated app navigation

The tab is **Studio**. Label the existing navigation group **Create**, retaining its persisted group ID. Use **Studio, Compose, Settings, Analysis** in the default order, keeping Settings among the first three destinations. Studio remains visible for every instrument and in simple mode. This distinguishes the destination from its group.

The actual hash destination is `#/studio-night`. The clean `/studio-night` entry boots the same full application through the existing `bootHash` pattern. Project-specific URL encoding is deferred to the routing implementation. Existing navigation modes must reach the same feature. A return or reload opens the project stopped; restoring playhead position must never resume audio.

## Desktop workspace

Design reference: 1440 × 960. The shared shell is represented by a 64 px collapsed navigation rail; real shell behavior and labels remain authoritative during integration.

The 56 px top bar contains the song-title menu, save state, Go to start, Play/Pause, time, compact Peak meter, Undo, Redo, Add takes, Sound and Export. The title menu offers Rename, Duplicate song, Download song backup and Delete song. Export is the primary filled button when no task panel is open.

The 232 px lane header aligns with each 104 px lane. It holds the source stripe, name, provenance note, mute, solo, volume with dB readout and pan with readout. Mute uses a speaker icon and gains a diagonal slash when muted. Solo uses a plainly readable S in a matching button. Use full Mute/Unmute and Solo labels with the track name in accessible names and tooltips. Both expose aria-pressed and a clear filled/bordered pressed state; color is not the only state cue. These are the only desktop/tablet track mix controls. There is no bottom mixer and no repeated set in the right panel. A corner cell contains Snap, Seconds/Beats and timeline zoom. The ruler and waveform lanes use the remaining width. Audio clips are 88 px high within each lane.

Only one contextual panel is open at a time. The desktop panel is 360 px wide and reduces the timeline's available width without changing clip times. It can show Add takes, Sound, Export, clip Details, or track name/role/provenance/removal. Escape closes the panel and returns focus to its opener, except when it first cancels an active edit. Recompute drawing and hit testing together after a resize; never change an in-progress pointer coordinate origin silently.

The selected clip gets a cobalt outline and a contextual toolbar with Split, Duplicate, Delete and Details. The toolbar sits above the clip, stays within the viewport and does not cover the transport. It disappears during dragging. Split is unavailable unless the playhead lies strictly inside the clip; the explanation is `Move the playhead over the clip`.

On narrow desktop windows, collapse optional top-bar controls into labelled menus before shrinking essential targets. If a 360 px panel leaves insufficient arranging width, use the tablet overlay behavior. These breakpoints require actual layout measurement, not a screenshot-only assumption.

## Tablet and phone

**Tablet, 1024 × 768 reference:** full editing. The shared app menu replaces a permanent collapsed rail. Headers are 176 px, lanes 132 px, and contextual toolbar targets 44 px. Name and source appear above mute/solo, volume and a `Pan C` button that opens the pan slider in that header. A 400 px right panel overlays the timeline. It must retain a reachable close action and preserve selection, zoom and scroll on dismissal.

**Phone, 390 × 844 reference:** adding, listening, simple mixing and export. Fit a song overview to width, with 72 px lanes and no trim/fade handles. An action row offers Add takes, Mix, Sound and Export above a persistent transport. Mix opens a bottom sheet with each track's mute, solo, volume, pan and menu; this is the phone's only set of mix controls. Tapping a clip may expose its identity and the explanation `Edit clips on a tablet or computer.` It does not pretend that a miniature desktop editor is available.

Phone sheets may scroll above the fixed transport and must account for safe-area insets and the on-screen keyboard. Essential controls remain reachable in portrait and landscape. Device-size mocks are a design reference; touch and actual-device acceptance occur in later phases.

## First song and source picker

The project list has **New song** and **Open backup**. An empty list says `No songs yet` with one useful sentence: `Build a song from takes you keep in the app, or from audio files.` New song opens with Add takes visible.

The picker filters All, Karaoke, Hear Yourself, Guitar, Piano, Drums and Files. List metadata first; do not decode all recordings just to show the catalogue. Each row includes title, actual source, duration, selection and preview. Examples supported by the current data are `Karaoke, voice only. Backing not included.`, `Piano replay, mono`, and `Guitar, dry input` where provenance verifies that signal. Do not invent device names or imply an authored instrument arrangement is already a finished audio take.

Choose file accepts WAV/MP3 for validation, with a clear rejection if the actual decoder cannot read the selected file. Checked rows produce a concrete action such as `Add 4 takes`. Recommend one new lane per take at the current playhead. The picker explains `Takes start at the playhead. Line them up by ear.` It must not promise automatic accompaniment alignment from historical metadata.

Previewing a take pauses the song; Play stops the preview; closing the picker stops preview. No load, decode, import, route change or panel opening starts playback.

During import, temporary placeholders may show `Preparing audio` and actual stage progress. They are UI work in progress, not saved clips or project assets. Decode/hash work occurs before an atomic asset-plus-reference commit. Until that commit succeeds the song cannot claim that import is saved. A failure offers Retry and Remove with `Couldn't add this take`; cancellation discards the pending job. Late completion cannot attach it to a different project. Successfully added assets are project-owned copies that survive deletion of the source history item.

## Arrangement contract

**Overlap rule:** a lane has at most one audible clip at any instant. Clips may touch. While dragging into occupied time, show a Vermilion invalid outline and a valid New lane target below the arrangement. Dropping on an occupied interval restores the original position with `No room here. Drop on another lane or New lane.` This is a visible rejection, not overwriting or hidden comping. This no-overlap default keeps every audible part visible; a second concurrent part belongs on another lane.

Duplicate places a new instance at the original's exact end. Paste places the copied clip at the playhead on the focused lane. If either destination conflicts, create a new lane with the same musical role, keep the intended start time, announce `Added on a new lane`, and make the whole operation one undo step. Adding selected sources uses the new-lane rule above. These operations never copy source bytes unnecessarily or modify the original recording.

Move changes timeline placement. Head trim changes source-in and timeline start together; tail trim changes only source-out. Split creates adjacent intervals sharing one source and adds no new fade at the seam. The authoritative timebase is 48 kHz frames, shown to the millisecond. Source-anchored fade ramps preserve surviving sample gain through split/trim outside the shared 3 ms clip-group boundary safety window; the waveform displays the visible portion of the retained envelope. A split inside an existing fade must not restart that fade. Untrim reveals retained source through its existing envelope. Dragging a fade handle explicitly replaces that clip's ramp as one undoable action. See the technical plan for the exact model and rendered regression tests.

Fade squares and trim marks may be visually small. Their actual targets are at least **28 × 28 CSS px for pointer** and **44 × 44 CSS px for touch** in the proposed web implementation. Fade, trim and move targets must not overlap. Reserve different vertical regions on a selected clip; when a clip is too short on screen, prefer Details and offer zoom rather than layering contradictory hit zones. Tablet handles appear after selection. The first pointer movement must not jump the edge to the middle of its expanded hit area.

Pointer move begins after a small threshold. Touch on an unselected clip or empty timeline scrolls; select first to edit. Pinch zoom must not turn into a clip edit. Pointer cancellation and Escape restore the starting state. Each completed gesture commits one undo step; intermediate drag/slider values are transient. Scrolling, hovering and selection are not undo operations.

Ruler selection seeks silently with no scrub audio. Seconds is the initial ruler. Beats asks for tempo and adds a grid without changing audio speed, pitch or placement. Snap is proposed on by default for clip edges, the playhead and a zoom-dependent grid. Alt bypasses snap for pointer/keyboard edits; a visible toggle supplies the equivalent on touch. A cobalt hairline identifies the current snap target.

Details provides keyboard-editable Start, Trim start, Trim end, Fade in and Fade out values with units and steppers. Validation is immediate and retains the previous valid edit on failure. This is the precise alternative to dragging.

## Keyboard and focus

Tab and Shift+Tab keep normal page focus navigation, including clips and controls. They are not globally captured to cycle clips. Only a modal dialog traps focus while open, following existing app conventions. Text fields, menus and other editing controls own their keys before Studio shortcuts do.

| Context                            | Key                           | Action                                                |
| ---------------------------------- | ----------------------------- | ----------------------------------------------------- |
| Workspace, outside typing controls | Space                         | Play/pause through shared shortcut ownership          |
| Workspace                          | Home                          | Go to start when it does not override text navigation |
| Focused clip                       | Left / Right                  | Nudge one current grid step; Shift nudges ten         |
| Focused clip                       | Up / Down                     | Move focus to a nearby clip in the adjacent lane      |
| Focused clip                       | S                             | Split at playhead when valid                          |
| Focused clip                       | Cmd/Ctrl+D                    | Duplicate after the original                          |
| Focused clip/lane                  | Cmd/Ctrl+C / V                | Copy / paste at the playhead on the focused lane      |
| Focused clip                       | Delete                        | Remove this clip                                      |
| Focused header                     | M / S                         | Mute / solo this lane                                 |
| Workspace                          | Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z | Undo / redo                                           |
| Active gesture or panel            | Escape                        | Cancel gesture first, otherwise close panel           |

Focused and selected are distinct visible states. A clip announcement includes lane, title, start/end and selection. Track buttons include the track name. Undo names the pending action. Deleting a clip is reversible without confirmation; deleting a song confirms the named project and its copied audio. Duplicate song and backup remain separate operations.

## Sound and meters

Sound contains **Flavour**, **Adjust** and **Master**. Flavours use the engine's Natural, Warm, Bright, Big, Punchy, Intimate and Lo-fi choices. Five centre-zero controls are Space, Tone, Punch, Warmth and Width, with readable values and Reset. They derive from the saved base chains, not repeatedly from already-modified parameters. Role choice belongs to the track panel. Avoid an effects rack in the default workspace.

Master offers the three existing preset targets: **Quiet, −16 LUFS target**, **Streaming, −14 LUFS target**, **Loud, −11 LUFS target**. There is no unsupported Off option. Streaming is the proposed default. Targets are not measurements, and capped limiting may produce a different achieved loudness. Changing sound must remain undoable and avoid abrupt playback gain changes. Recommend a level-matched comparison for Phase 5, subject to a defined and verified implementation; the current engine has not been shown to supply one.

The top bar has real L/R sample-peak activity, clipping indication and resettable peak hold once the audio runtime exists. Meter detail adds 400 ms momentary LUFS and 3 s short-term LUFS in Phase 5. Final integrated LUFS and validated estimated true peak belong to the rendered revision, not a live animated badge. Label dBFS, LUFS and dBTP accurately; LRA is deferred. Screen images use illustrative values with an external design-study notice.

## One export action

The Export panel shows **WAV, 48 kHz, 16-bit**, the master target and the full-song output range. It initially says **Measured when you export.** There is no separate Measure mix button. 24-bit WAV is a later proposal that requires encoder work; it must not appear as a v1 capability.

**Export WAV** freezes the project revision and settings, renders the arrangement and tails, encodes the final file, then measures the encoded bytes. Show truthful stage names such as Preparing, Rendering, Creating WAV and Checking output. Use indeterminate progress when an API does not supply a real percentage. Editing may be paused for this operation; Cancel remains available. Cancel stops later passes and discards results, but native rendering may release memory only after the current pass finishes. Do not imply instant resource release or successful file saving.

The completed panel changes the primary action to **Download WAV** and shows Integrated loudness, Sample peak and True peak (estimate), tied to the frozen revision. Render completion is not download completion. A change to audio, FX, master or export settings invalidates the downloadable result and measurements; return to Export WAV. A title-only change follows the technical implementation's explicit filename/revision rule rather than silently reusing the wrong file.

If measured final true peak exceeds the chosen ceiling, correct gain or rerender and verify the resulting bytes again before offering a successful export. A warning on an unsafe file is not successful delivery. Missing/corrupt project audio blocks export until Replace or Remove resolves it. When a target is unattainable within the limiting cap, report achieved loudness rather than implying target compliance. Listening still determines whether the song is a suitable demo.

## Saving, recovery and local backup

Use **Saving**, **Saved in this browser** and **Save failed** based on the newest visible revision's durable state. The mock's saved label is illustrative. A storage failure says `Not saved: storage full`, with retry/storage management and Download song backup. Never relabel failed edits as saved because a previous revision succeeded.

Another editor tab presents a read-only state and explicit reload/fork/takeover options governed by the technical concurrency contract. Imports still being decoded are not part of a backup. A fully prepared import whose save failed stays in memory and may be included in a backup of that unsaved revision; the backup must validate every referenced asset and never claim completeness while bytes are missing. A missing-audio clip stays visible with a hatch and `Audio missing`, and offers Replace with file or Remove. It may audition as silence with that state visible, but cannot pass export.

Download song backup produces an editable local project bundle, distinct from stereo WAV. Open backup restores into a new project after validation. Browser storage is origin-specific and may be cleared; neither the save label nor a persistent-storage grant substitutes for a backup. V1 never suggests that an account already syncs this song to cloud storage.

## Review and acceptance

The three image boards are arrangement, sources/sound/export, and tablet/phone, each available in dark and light mode. Keep **Window seat** and its source names consistent across them. Each active task surface has one primary filled cobalt action: top Export in the arrangement, Add takes inside its picker, Export WAV or Download WAV in export. Other active controls use outlines or light selection tint.

Visual checks: aligned ruler/header/lane geometry; graphite waveforms; source tints in the specified locations; text contrast at least 4.5:1 and meaningful UI marks at least 3:1; readable scaled text; visible focus; touch targets without overlap; no invented capabilities or copy. UI tests must establish these, rather than treating generated pixels as conformance evidence.

The eight specified light/dark primary, secondary, action and error token pairs pass 4.5:1 in [the token calculation](evidence/design-token-contrast.json). This calculation does not audit generated image pixels or validate an implemented screen. The three image boards do not depict every failure state. Their copy and recovery behavior are defined above and must be exercised during implementation.

Interaction checks: pointer and keyboard alternatives; one undo per gesture; predictable drop/snap behavior at different zoom/scroll positions; precise split/trim fade preservation; no autoplay; exclusive preview ownership; failed/cancelled imports never marked saved; missing audio blocks export; final-byte measurements and peak verification; project backup round trip; correct simplified phone behavior.

The layout, dark-led presentation with both modes, recording deferral, phone scope, local-first scope and audio-before-MIDI are settled. The Create label, no-overlap editing, Streaming master, per-take new-lane/playhead placement and source tints are the implementation defaults above. Later phases resolve implementation and device questions with evidence, while retaining this sequence and one inspectable phase commit boundary.

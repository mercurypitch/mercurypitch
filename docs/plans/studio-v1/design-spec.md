# Studio v1 design specification

26 October 2026. Layout approved; dark leads and light remains available. This reconciles the lead design with the inspected app and [technical contract](technical-plan.md). Mockups illustrate the proposed interface; they do not establish audio behavior, measured loudness, browser durability or device performance.

## Confirmed scope and proposed decisions

The owner confirmed a **Studio** destination inside MercuryPitch, local browser projects, desktop/tablet audio arranging, a simpler phone experience, and audio editing before MIDI integration. V1 editing comprises move, trim, split, duplicate, fades, volume, pan, mute and solo. Existing kept takes and external MP3/WAV files are sources. WAV and editable project backup are the v1 outputs; MP3 export and account cloud storage come later.

The owner requested dark mode as the lead while retaining the white/light theme, and confirmed that new recording and overdubbing come later. The implementation defaults below complete the small audio editor without reopening the agreed device scope.

## Console on the app theme

27 October 2026: the first build's own **Graphite Sheet** palette (paper `#17181B`, sheet `#222428`, cobalt `#7E9CFF`, a cream light mode) is retired. It ignored the app's theme presets and read as a separate product. The Studio now paints with the app's tokens, so every preset (dark, light, midnight, forest and the rest) applies. The layout follows the top-transport comp chosen on 26 October (VIS-05); the verdict and the comps are in the agent-out run `2026-10-27/511a65893cbe4d96b5a6efd8065e50b6`.

| Studio token                             | App token                                                    | Purpose                                                                |
| ---------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `--studio-bg`                            | `--bg-primary`                                               | Arrangement floor, inset fields                                        |
| `--studio-bar`                           | `--bg-secondary`                                             | Top bar, ruler, lane headers, panel                                    |
| `--studio-clip-base`                     | `--bg-card` (white in light mode)                            | The neutral a lane hue is mixed into for clips                         |
| `--studio-control`                       | `--bg-tertiary`                                              | Segmented control, tiles, quiet buttons                                |
| `--studio-rail`                          | `--text-primary` into `--bg-secondary` (36% dark, 50% light) | Fader, macro, meter and progress rails, at about 3:1 against the panel |
| `--studio-line` / `--studio-line-strong` | `--border-subtle` / `--border`                               | Dividers, outlines                                                     |
| `--studio-accent`                        | `--accent`                                                   | Selection, focus, playhead, primary action                             |
| `--studio-solo`                          | `--status-warning-fill`                                      | Pressed Solo                                                           |
| `--studio-danger`                        | `--status-danger-fg`                                         | Errors, invalid drops, clip light                                      |

Each lane carries one hue, chosen by musical role so a vocal reads as a vocal everywhere: rose for voice, amber for acoustic guitar, orange for electric guitar and bass, teal for piano and keys, violet for drums, green for backing. Tracks without a known role, such as uploaded files, rotate through the six so neighbours differ. Dark values: rose `#F0789F`, amber `#E3A53F`, teal `#3CC7B4`, violet `#A991F7`, green `#5CC271`, orange `#EC8A4F`; light mode uses deeper values of the same hues. The hue draws a 3 px edge on the lane header, the pan knob's arc, the clip body (14% into `--studio-clip-base`), its title band (30%) and its outline (46%). Waveforms are drawn in the hue mixed toward the text colour: the peak envelope as a translucent fill and the RMS body solid inside it, so loud and quiet passages read at a glance. Source labels stay visible under each lane name, so colour is never the only identifier, and source provenance stays separate from the musical role.

Use system sans-serif with tabular figures for time, gain and meter values. Song title 17/22 semibold; panel heading 15/20 semibold; body and lane names 13/18; clip names and ruler 11/14 medium; time 20/24 medium. Phone body is 15/20 and labels 12/16. These are default mockup sizes, not a reason to disable text scaling.

Spacing follows 4 px increments, principally 8/12/16/24. Clip radius 5 px, buttons 8 px, the transport capsule 14 px, phone sheet top corners 16 px. Only floating toolbars, the gesture status pill and sheets use a shadow. No glow, decorative gradients, fabricated hardware, MIDI note blocks or unrelated dashboard statistics.

## Integrated app navigation

The tab is **Studio**. Label the existing navigation group **Create**, retaining its persisted group ID. Use **Studio, Compose, Settings, Analysis** in the default order, keeping Settings among the first three destinations. Studio remains visible for every instrument and in simple mode. This distinguishes the destination from its group.

The actual hash destination is `#/studio-night`. The clean `/studio-night` entry boots the same full application through the existing `bootHash` pattern. Project-specific URL encoding is deferred to the routing implementation. Existing navigation modes must reach the same feature. A return or reload opens the project stopped; restoring playhead position must never resume audio.

## Desktop workspace

Design reference: 1440 × 960. The shared shell is represented by a 64 px collapsed navigation rail; real shell behavior and labels remain authoritative during integration.

The 60 px top bar has three zones. Left: the song-title menu and save state. Centre: a transport capsule with Go to start, a round Play/Pause, Repeat, an editable clock and a compact stereo peak meter. Right: Undo, Redo, Add takes, Sound and Export. The clock shows `m:ss.mmm` and accepts typed seconds or minutes (`65.5`, `1:05.5`); arrow keys step one second. The title menu offers Rename, Duplicate song, Download song backup and Delete song. Export is the primary filled button.

The 240 px lane header aligns with each 96 px lane. It holds the source stripe, then two rows: name and provenance note beside mute and solo, then the volume fader with its dB readout and a pan knob that always shows its value (C, L 30, R 12). Mute uses a speaker icon and gains a diagonal slash when muted. Solo uses a plainly readable S in a matching button. Use full Mute/Unmute and Solo labels with the track name in accessible names and tooltips. Both expose aria-pressed and a clear filled/bordered pressed state; color is not the only state cue. These are the only desktop/tablet track mix controls. There is no bottom mixer and no repeated set in the right panel. The ruler's corner cell holds Snap and a Time/Beats switch, with tempo beside it in Beats. Zoom out, Zoom in and Fit song to width float as one raised cluster in the lower right corner of the timeline, clear of the ruler and the scrollbars. Fit may go below the first zoom stop, so a long song still fits the window. The ruler and waveform lanes use the remaining width. Audio clips are 84 px high within each lane.

Only one contextual panel is open at a time. The desktop panel is 360 px wide and reduces the timeline's available width without changing clip times. It can show Add takes, Sound, Export, clip Details, or track name/role/provenance/removal. Escape closes the panel and returns focus to its opener, except when it first cancels an active edit. Recompute drawing and hit testing together after a resize; never change an in-progress pointer coordinate origin silently.

The selected clip gets an accent outline and a contextual toolbar with Split, Duplicate, Delete and Details. The toolbar floats at the timeline's foot, just past the lane headers and level with the zoom cluster, and leads with the track's hue and name so it says which clip it acts on. With enough lanes it floats over the bottom lane, as the zoom cluster does, and its label keeps it tied to the selection. It hides while a drawer overlays the timeline and during dragging. Split is unavailable unless the playhead lies strictly inside the clip; the explanation is `Move the playhead over the clip`.

On narrow desktop windows, Add takes and Sound drop their visible labels (keeping accessible names and tooltips) and then the compact meter hides, before any essential target shrinks. If a 360 px panel leaves insufficient arranging width, use the tablet overlay behavior. These breakpoints require actual layout measurement, not a screenshot-only assumption.

## Tablet and phone

**Tablet, 1024 × 768 reference:** full editing. The shared app menu replaces a permanent collapsed rail. Headers are 232 px, lanes 132 px, the ruler 48 px, and every timeline target 44 px. The header keeps the desktop's two rows: name and source beside mute and solo, then the volume fader, its dB reading under the right end, and the pan knob with its value beside it. A 400 px right panel overlays the timeline. It must retain a reachable close action and preserve selection, zoom and scroll on dismissal.

**Phone, 390 × 844 reference:** adding, listening, simple mixing and export. Fit a song overview to width, with 64 px lanes and no trim/fade handles. An action row offers Add takes, Mix, Sound and Export; the transport is docked under the overview. Mix opens a bottom sheet with each track's mute, solo, volume, pan and menu; this is the phone's only set of mix controls. Tapping a clip may expose its identity and the explanation `Edit clips on a tablet or computer.` It does not pretend that a miniature desktop editor is available.

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

Pressing the ruler seeks and dragging along it scrubs, silently, with no scrub audio. A stopped song's playhead follows the pointer; a playing song moves its playhead line and jumps there once on release. Ruler labels are not selectable text. Time is the initial ruler. Beats asks for tempo and adds a grid without changing audio speed, pitch or placement. Snap is proposed on by default for clip edges, the playhead and a zoom-dependent grid. Alt bypasses snap for pointer/keyboard edits; a visible toggle supplies the equivalent on touch. An accent hairline identifies the current snap target.

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

The three image boards are arrangement, sources/sound/export, and tablet/phone, each available in dark and light mode. Keep **Window seat** and its source names consistent across them. Each active task surface has one primary filled accent action: top Export in the arrangement, Add takes inside its picker, Export WAV or Download WAV in export. Other active controls use outlines or light selection tint.

Visual checks: aligned ruler/header/lane geometry; waveforms and clip tints in the lane hue; source labels under each lane name; text contrast at least 4.5:1 and meaningful UI marks at least 3:1; readable scaled text; visible focus; touch targets without overlap; no invented capabilities or copy. UI tests must establish these, rather than treating generated pixels as conformance evidence.

The retired Graphite token pairs passed 4.5:1 in [the first token calculation](evidence/design-token-contrast.json). The Studio now inherits the app's theme tokens. [The lane-hue calculation](evidence/lane-hue-contrast.json) covers what the Studio adds: clip titles on their hue band measure at least 7.28:1, the solid waveform body against its clip at least 5.97:1 in dark and 3.67:1 in light, hue marks against the floor at least 3.96:1, and the slider and meter rails about 3:1 against the panel. Light mode tints clips into white and draws the waveform in the pure hue, so amber reads as gold rather than brown on beige; the waveform is a graphic, so the 3:1 floor for marks applies, not the 4.5:1 floor for text. This calculation does not audit generated image pixels or validate an implemented screen. The three image boards do not depict every failure state. Their copy and recovery behavior are defined above and must be exercised during implementation.

Interaction checks: pointer and keyboard alternatives; one undo per gesture; predictable drop/snap behavior at different zoom/scroll positions; precise split/trim fade preservation; no autoplay; exclusive preview ownership; failed/cancelled imports never marked saved; missing audio blocks export; final-byte measurements and peak verification; project backup round trip; correct simplified phone behavior.

The layout, dark-led presentation with both modes, recording deferral, phone scope, local-first scope and audio-before-MIDI are settled. The Create label, no-overlap editing, Streaming master, per-take new-lane/playhead placement and source tints are the implementation defaults above. Later phases resolve implementation and device questions with evidence, while retaining this sequence and one inspectable phase commit boundary.

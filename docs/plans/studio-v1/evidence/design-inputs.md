# Studio design inputs

Inspected 26 October 2026. This is an evidence contribution for the design lead, not the final design. No existing handoff files, archive, Linear issue, or repository files were changed.

## Existing material inspected

- `personal Studio handoff: preferred-studio-mock.png`
- `personal Studio handoff: layout-reference-desktop.png`
- `personal Studio handoff: layout-reference-compact.png`
- `MercuryPitch-Studio-Reference-Implementation-Plan.md`, especially sections 1–9 and 12–18; `index.html` was inspected as a static interaction reference.

The September plan is explicitly a proposal tied to repository revision `87b1735`, not current implementation evidence. Its requirement that V1 have no effects and its overdub/recording-first sequence are superseded by the current user's FX-led brief. The current owner confirmed desktop/tablet arranging, simpler phone controls, and audio editing before MIDI integration.

## What the images actually show

The preferred raster spends almost equal attention on three control regions: left track list, right inspector, and a permanent bottom mixer. Mute/solo controls repeat in the track list and mixer. Five track colors and large waveform blocks make the arrangement legible, but the many bordered cards, rotary controls, record arms, global navigation, search, notification/avatar, Share action and master rack compete with it.

It also depicts unverified device names (`SM7B`, `KeyLab`), cloud-style saving, and MIDI-looking piano clips. These cannot be carried into a truthful audio-only mock. Its generated equalizer logo is not the canonical mark identified in the old plan. The desktop HTML reference corrects several of these issues and labels itself simulated, but still puts a complete mixer below the arrangement. Its compact variant removes that duplication and exposes more timeline, making it a better structural starting point.

## Recommended cuts for the new brief

1. Make the timeline the dominant surface. Keep track identity, waveforms, a single playhead and an understandable time ruler. Avoid a permanent mixer plus permanent inspector plus takes drawer.
2. One home for track volume, pan, mute and solo. A contextual panel can show selected-clip timing/fades or selected-track sound; do not duplicate these controls in multiple visible regions.
3. Open `Add takes`, clip detail, or song sound in one contextual panel at a time. Keep the transport visible and the arrangement recognisable while a panel is open.
4. Put beginner FX in the song sound panel, with a named starting sound and five existing macro controls. Detailed effect graphs belong behind a secondary action, if they are needed at all. The output meter can stay compact until opened.
5. Omit Share, cloud saving, hardware device labels and MIDI piano-roll visuals from v1. Use waveforms for rendered piano/drum/guitar audio. New recording/overdub is not requested in the current first release; recommend deferring it explicitly rather than inheriting the old plan's recording controls.
6. Avoid a decorative dashboard of project stats and badges. The song title, save state, Add takes and Export are sufficient top-level information. Brand should come from typography, spacing, waveform treatment and a restrained selection accent.
7. Phone should offer the same project through a track list, listening controls, adding takes, simple balance and export. Do not shrink the desktop timeline and its handles to fit. Full phone arranging remains outside the confirmed first scope.

These are recommendations for the lead designer. An Apple-like result is a behavior and hierarchy goal, not proof of an award or permission to reproduce an Apple screen.

## Interaction pitfalls to resolve in the mock contract

- Adding from the take library copies into the song; moving a clip moves that instance; duplicating reuses its source audio. The original recording must remain unchanged.
- A drop preview should show the destination lane and time before release. The drop stays selected. Invalid drops must explain the problem. Escape and pointer cancellation restore the starting state. One completed gesture creates one undo entry.
- A selected clip needs visible trim/fade handles without making its whole surface unscrollable on a tablet. Define scroll, move and edge-trim precedence; provide numeric position/duration/fade controls as alternatives.
- A split preserves continuous source timing. Trimming the left edge changes source offset and timeline start together. Dragging must account for zoom and scroll; drop position must not jump when a side panel opens.
- Define overlaps before drawing them. Summing, automatic crossfade and comping are different behaviors. The earlier plan proposes summing; keep that as a proposal until selected. Make overlap visible and reversible.
- Seconds should be the initial authoritative ruler for already-recorded takes. If a beat grid is available, changing BPM must not imply stretching audio. Do not label inferred tempo/key as measured truth.
- Previewing a library take and playing the song need an explicit audio-ownership rule. The user should not accidentally hear both, or include the preview in export.
- Show `Saving`, `Saved in this browser` and `Save failed` from durable results. A recent edit timestamp is not confirmation of successful saving. Reopening must not resume playback automatically.
- Changing FX while listening must not cause a loudness jump that masquerades as an improvement. Design a level-matched before/after audition. Show final integrated LUFS and true peak as measurements after analysis/render, not decorative moving numbers.
- Export progress, cancellation, an unsupported file, an unavailable source, and insufficient storage deserve designed states. Do not put an error toast over the only undo/export control.

## Primary guidance verified today

Apple recommends familiar gestures, immediate feedback, and other ways to perform important actions. Applied here: drag is an accelerator, while buttons, menus and numeric fields complete the same edits. Avoid custom gestures that conflict with scrolling or system behavior. [Apple HIG: Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)

Apple's drag guidance supports visible destinations, transfer feedback, selection after drop, and clear copy/move semantics. Applied here: show a temporary clip at its destination while an import decodes; keep it selected once ready; make failed imports recoverable. [Apple HIG: Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop)

Apple's accessibility guidance calls for alternate gesture actions, labels, adequate spacing, adaptable text and reduced motion. Its current platform table lists 44×44 pt as the default iOS/iPadOS control size; this is not a web CSS-pixel mandate. For the web prototype, choose comfortably sized touch targets and test them at the actual tablet viewport. Color must be supplemented by track names/icons and visible states. [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

## Browser constraints with design consequences

Storage is isolated by origin, so a localhost/dev/PR preview will not automatically see recordings saved on the production origin. Studio should be part of the shared app and use its actual source adapters. Test with local/dev recordings or explicit fixtures, never production. Storage is best effort unless persistence is granted, can run out, and private sessions have different durability. A WAV is an audio output, not a recoverable project backup. Recommend a local project-backup milestone before cloud storage; avoid any promise of permanent safekeeping. [MDN: Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

The Storage Standard provides persistence requests and quota estimates; estimates are preflight information, not a successful write. Use them to plan imports, still handle write failure, and explain persistence if a browser permission can appear. [WHATWG Storage Standard](https://storage.spec.whatwg.org/)

Decoded audio is 32-bit PCM in memory. A three-minute 48 kHz stereo asset alone needs `180 × 48,000 × 2 × 4 = 69,120,000` bytes (about 65.9 MiB), before graph/intermediate/export buffers. Eight such sources approach 527 MiB before overhead. This calculation is a planning estimate, not a measured application budget. Qualify by duration/channels/decoded bytes and device, not track count alone. [MDN: AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)

`decodeAudioData()` takes complete encoded files and resamples to the context rate. Therefore MP3/WAV import needs real decoding/validation and a loading state; a file extension cannot prove successful support. [MDN: decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)

OfflineAudioContext renders a graph into an AudioBuffer without playing it to hardware. That supports local song export, but neither encoded WAV/MP3 output nor a truthful percentage progress UI comes for free. Design stage labels such as preparation, rendering and file creation around measured implementation events. [MDN: OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)

## Recommended phase-one screen set

One desktop arrangement with four genuine audio lanes and no open panel; the same song with Add takes open; the same song with a selected clip and trim/fade controls; the song sound/mastering panel with final meter detail; export settings/progress/result; a tablet arranging adaptation; a phone listening/add/export adaptation; and compact empty, unavailable-source and storage-failure states. Keep the song and source names consistent so the set demonstrates a workflow rather than unrelated attractive screens.

---
version: 1
slug: 'src-features-studio-studiopage-tsx'
primary_target: 'src/features/studio/StudioPage.tsx'
related_targets:
  [
    'src/features/studio/StudioWorkspace.tsx',
    'src/features/studio/StudioPage.module.css',
    'src/features/studio/timeline/StudioTimeline.module.css',
  ]
---

# Studio — Console on the app theme

- **Scope and mode:** Operate surface at `#/studio-night` (tab Studio, Create group): the song library, then one arrangement workspace with a contextual panel (Add takes, Sound, Export, Song, Clip and Track details).
- **Audience and job:** A singer or player who keeps takes in MercuryPitch wants to line them up into one song, balance it, give it a sound and export a WAV, on a laptop or tablet; on a phone they add, listen, mix simply and export.
- **Primary flow:** New song, Add takes at the playhead, arrange (move, trim, split, fade), set level and pan per lane, choose a sound flavour and master target, Compare, Export WAV, Download.
- **Content and proof:** Real local takes and files only; measured loudness and peaks from the encoded WAV; no invented capabilities, no MIDI, no recording yet.
- **Direction:** A DAW-grade console painted with the app's own theme tokens, so every preset applies. A three-zone top bar with the transport as a centred capsule (round play, typed clock, stereo meter); lanes that each carry one hue by musical role, drawn through the header edge, pan arc, clip tint and a two-tone waveform (translucent peaks, solid loudness body). The memorable moment is the arrangement itself reading like a mixed song at a glance.
- **Constraints:** Keyboard-complete editing, 44 px targets on touch, panel as a column on desktop and an overlay or bottom sheet below 1100 px, AA contrast in both themes (lane hues measured in `docs/plans/studio-v1/evidence/lane-hue-contrast.json`), reduced motion respected, Studio code stays in its lazy chunk.
- **Open decisions:** A scrolling playhead follow mode, a dedicated mixer view on wide screens, and per-lane colour override.

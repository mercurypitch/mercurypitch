# Piano (falling notes) — mobile stage spec (Phase 2)

The easiest of the three conversions: `PianoPage.tsx` is already a standalone
page, the canvas already handles touch (single-finger key press, two-finger
pinch zoom → `visibleBeatWindow`), and the run loop is self-contained in
`falling-notes-store`. The work is chrome, not engine.

## Swap seam

```tsx
// PianoPage.tsx
<Show when={!isNarrow()} fallback={<PianoMobileStage {...shared}/>}>
  {/* existing desktop tree, untouched */}
</Show>
```

`useFallingNotesController` (engine + MIDI + mic wiring) is created in
`AppShell` and threaded in — it stays above the branch (kit convention #1).
`FallingNotesCanvas` is reused in both branches.

## Stage layout (portrait phone)

```
┌─────────────────────────────┐
│ ♪ Clair de Lune      [Songs]│ ← StatusChipRow + thin progress strip
│─────────────────────────────│
│      FallingNotesCanvas     │ ← flex:1; lanes + hit line
│   (notes fall toward keys)  │   combo/score HUD stays in-canvas
│  ┌───────────────────────┐  │
│  │  on-screen piano keys │  │ ← bottom of canvas (existing)
│─────────────────────────────│
│ ◉ Mic  ⏯  Labels  ⋯ More   │ ← TransportBar
│─────────────────────────────│
│  Sing  Piano  Drills   ⋯    │ ← BottomTabBar (scope-aware)
└─────────────────────────────┘
```

- **StatusChipRow**: song chip (opens song sheet), track chip when the MIDI
  has >1 track (opens track sheet — existing `MidiTrackPickerModal` content
  re-hosted in a `Sheet`), thin seek strip (tap-to-seek; A/B markers
  desktop-only).
- **Canvas**: unchanged renderer. Portrait is the natural orientation for a
  falling-notes runway; the pinch-zoom already handles lane density. Canvas
  region gets `data-stage-canvas` (excluded from tab-swipe — pinch/key
  presses must never trigger navigation).
- **Keyboard**: the existing in-canvas piano; key hit areas must honor
  `--touch-target` height. Haptic `tapLight()` on key press (Android),
  `success()` on combo milestones.
- **TransportBar**: `Mic` toggle (mic vs MIDI input: MIDI hardware is a
  desktop/tablet affair — on the stage, the toggle is mic/off; MIDI connect
  lives in the options sheet for the Android-Chrome + adapter niche),
  `Play/Pause/Stop`, `Labels` (note-name toggle — it's the one setting
  beginners flip constantly), `More` → options sheet.

## Options sheet

| Section | Rows |
| --- | --- |
| Playback | BPM slider, Speed (0.25–2×), Play mode Once/Repeat + cycles stepper, Precount |
| Display | Note labels, Zoom − / % / + (duplicates pinch for discoverability) |
| Input | MIDI keyboard connect (Web MIDI where supported) |
| Footer | `DesktopHint` ("A-B loops, per-track mixing & more — on desktop") |

Desktop-only v1: A-B loop markers, per-track mute/visibility matrix (track
*picker* stays), wheel zoom, drag-marker interactions.

## Score flow

The existing non-blocking corner score card becomes a compact bottom card
sliding up above the transport bar (grade, %, notes, max combo, Play Again /
Close) — not a full `ScoreSheet`: Piano runs are quick and retry-heavy, so
the canvas stays visible behind it. Haptic `success()` on personal best.

## Feature triage summary

| Keep on stage | In options sheet | Desktop-only v1 |
| --- | --- | --- |
| Mic toggle | BPM, speed, mode+cycles | A-B loop |
| Play/pause/stop | Note labels, zoom | Track mute/visibility matrix |
| Song/track picker (sheets) | Precount | Wheel zoom, marker drag |
| Canvas + touch keys + pinch | MIDI connect | MIDI-first workflows |
| Combo/score HUD + score card | | |

## Tours & audit

- `PIANO_TOUR_STEPS` gains mobile-aware steps: `[data-tour="piano-transport"]`,
  `[data-tour="piano-options"]`, `[data-tour="piano-songs"]`; existing desktop
  targets keep working (tour steps resolve per-viewport).
- Audit assertions: no horizontal overflow at 360/390/430 px; canvas ≥ 60% of
  viewport height; keys row ≥ 44px tall; transport + tab bar visible,
  non-overlapping; score card does not cover the keys row.

## Analytics

`mobile_stage_engaged{page:piano}`, `mobile_options_opened`,
`piano_touch_keys_used` (first touch-key press — measures whether the phone
keyboard is actually playable, informing whether a dedicated landscape mode
is worth a v2).

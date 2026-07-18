# Singing — mobile stage spec (Phase 1)

The flagship redesign: the default tab, the surface ad traffic lands on.
Today the desktop chrome (status bar + overlay control bar + sidebar) simply
compresses; the control bar overflows and setup lives in a hamburger drawer.

## Pre-work: extract the seam

`#practice-panel` is inline JSX in `App.tsx:2191-2349`. Move it verbatim to
`src/features/practice/SingingPanel.tsx` (props = the handlers/engines it
already closes over; no visual change, `pnpm check` + tours prove it). Then:

```tsx
<Show when={!isNarrow()} fallback={<SingingMobileStage …/>}>
  <SingingPanel …/>
</Show>
```

Engines, mic state, playback callbacks stay in `AppShell`/`EngineContext` —
both branches share them (kit convention #1). `PitchCanvas` is reused as-is
in both branches (it already handles resize/DPR; it must be *instanced* per
branch, not moved across portals, so canvas context resets stay clean on
swap).

## Stage layout (portrait phone)

```
┌─────────────────────────────┐
│ ▍C Major · 92 BPM   [Songs] │ ← StatusChipRow (chips open sheets)
│─────────────────────────────│
│                             │
│        PitchCanvas          │ ← full-bleed, flex:1
│    (ball, notes, trace)     │   accuracy chip + pitch chip float
│                             │   top-right (existing narrow HUD)
│─────────────────────────────│
│ ◉ Mic   ⏯  Once▾   ⋯ More  │ ← TransportBar (glass, safe-area)
│─────────────────────────────│
│  Sing  Drills  Karaoke  ⋯   │ ← BottomTabBar
└─────────────────────────────┘
```

- **StatusChipRow**: key/scale chip (opens options sheet at Setup), BPM chip
  (opens options sheet at Playback), song-name chip / **Songs** (opens song
  sheet). The `LoopSeekRail` timeline collapses into a thin (4px) progress
  strip under the chips; tap-anywhere seek, no A/B markers on mobile.
- **Canvas**: keeps ball/notes/trace/grid; canvas tap = play-note stays
  (natural on touch); trill double-tap, ctrl-scroll zoom, marker dragging are
  desktop-only (guard on `isNarrow()`), and the canvas region is excluded
  from tab-swipe (`data-stage-canvas`).
- **HUD**: current `SingingCanvasHud` narrow behavior (hidden cards + toggle)
  is replaced by two fixed compact chips — live accuracy % and detected note
  — styled by the kit; the full stat cards stay desktop.
- **TransportBar**: `Mic` (PillControl-style with live level ring), main
  `Play/Pause/Stop`, play-mode select (Once/Repeat/Session as a segmented
  sheet-picker, not 7 inline buttons), `More` → options sheet.
- **Session mode**: the status cluster (item N of M, skip/end) renders as a
  slim pill above the transport bar — same components, restyled.

## Options sheet (the one sheet, D4)

| Section | Rows (mobile v1) |
| --- | --- |
| Setup | Key, Octave ±, Scale (opens native-style picker rows; custom-scale *builder* stays desktop, saved custom scales are pickable) |
| Playback | BPM slider, Speed (0.25–2×), Precount on/off, Metronome on/off |
| Guides | Anchor tone on/off, Character/mascot on/off |
| Footer | Mic auto-calibrate button · `DesktopHint` |

Desktop-only in v1 (hint copy: "A-B loops, session modes & more — on
desktop"): A-B loop, session sub-modes, spaced rest, mic-waveform overlay,
display-toggle grid, history strip, heatmap panel (the heatmap data still
feeds the score sheet), Focus Mode (redundant — the stage *is* focus mode),
Compose handoff.

## Score flow

End-of-run `#score-card` becomes a `ScoreSheet`: grade hero, accuracy stats,
per-rating tiles, sparkline + Practice-Intelligence badges (existing
components re-hosted), `Try Again` primary + `Done`. Haptic `success()` on
reveal. Session summary uses the same sheet with the session table.

## Feature triage summary

| Keep on stage | In options sheet | Desktop-only v1 |
| --- | --- | --- |
| Mic toggle + level | Key/octave/scale | A-B loop, loop markers |
| Play/pause/stop | BPM, speed | Session sub-modes, spaced rest |
| Play mode (3) | Precount, metronome | Anchor tone fine settings |
| Song/track picker (sheet) | Anchor tone on/off | Display toggles, history strip |
| Live accuracy + note chips | Mic auto-calibrate | Custom scale builder |
| Score/session sheets | Mascot on/off | Focus Mode, Compose |
| Canvas tap-to-hear | | Heatmap panel, waveform overlay |

## Sidebar on mobile

The hamburger/sidebar drawer disappears on the Singing stage — its essential
content moved into the options sheet (Setup, mic calibrate) and the song
sheet (Library). Learn/Tour entry points move to the More sheet. (Drawer
remains for non-redesigned pages until Phase 4.)

## Tours & audit

- `PAGE_TOURS` Singing steps gain mobile variants targeting:
  `[data-tour="mobile-tabbar"]`, `[data-tour="singing-transport"]`,
  `[data-tour="singing-options"]`, `[data-tour="singing-songs"]`.
- New audit walker asserts: no horizontal overflow at 360/390/430 px; canvas
  height ≥ 55% of viewport; transport + tab bar visible and non-overlapping;
  options sheet opens and every row ≥ 44px tall; score sheet reachable after
  a 5s fake-mic run.

## Analytics

`mobile_stage_engaged` (first play on stage), `mobile_options_opened`,
`mobile_song_sheet_opened`, `desktop_hint_clicked` — extends the existing GA4
funnel so ad campaigns can see mobile completion directly.

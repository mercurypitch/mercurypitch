# Playback Modes — EARS Requirements

Requirements for the three playback modes — `once`, `repeat`, and `session` —
covering selection, per-mode behaviour, and the settings they share.

Source:

- `src/features/tabs/constants.ts` — `PLAYBACK_MODE_ONCE` / `_REPEAT` / `_SESSION`
- `src/features/playback/usePlaybackController.ts` — transport and mode routing
- `src/features/session/useSessionSequencer.ts` — session-mode item sequencing
- `src/stores/playback-state-store.ts` — shared `isPlaying` / `isPaused` state
- `src/components/TransportControls.tsx` — mode selection UI

Tests:

- `src/e2e/playback.spec.ts`, `src/e2e/practice-playback.spec.ts`
  (`REQ-PLAY-001..026`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Mode selection — `REQ-PLAY-001..002`

### REQ-PLAY-001 — Three modes
The user **shall** be able to select `once`, `repeat`, or `session` from the
transport controls.

### REQ-PLAY-002 — Active mode is visible
The transport controls **shall** visually indicate the selected mode.

## Once — `REQ-PLAY-003..007`

### REQ-PLAY-003 — Plays from the first note
**WHEN** playback starts in `once` mode, it **shall** begin at the melody's
first note.

### REQ-PLAY-004 — Plays to the end
**WHILE** playing in `once` mode, playback **shall** continue until the last
note completes.

### REQ-PLAY-005 — Does not loop
**WHEN** the melody completes in `once` mode, playback **shall** stop.

### REQ-PLAY-006 — Completion fires once
**WHEN** the melody completes in `once` mode, the completion handler **shall**
fire exactly once.

### REQ-PLAY-007 — No cycle counter
**WHILE** in `once` mode, the cycle counter **shall** be hidden.

## Repeat — `REQ-PLAY-008..013`

### REQ-PLAY-008 — Configurable cycle count
**WHERE** `repeat` mode is selected, the user **shall** be able to set the
cycle count within 1 to 20 inclusive; the default **shall** be 5.

### REQ-PLAY-009 — Restarts on completion
**WHEN** the melody completes in `repeat` mode and cycles remain, playback
**shall** restart from the first note.

### REQ-PLAY-010 — Stops after N cycles
**WHEN** the configured number of cycles has completed, playback **shall**
stop.

### REQ-PLAY-011 — Completion per cycle
**WHEN** each cycle completes, the completion handler **shall** fire.

### REQ-PLAY-012 — Final completion is the Nth
The completion event for the Nth cycle **shall** be the final one.

### REQ-PLAY-013 — Repeat indicator
**WHILE** in `repeat` mode, the cycle counter **shall** show a repeat
indicator.

## Session — `REQ-PLAY-014..021`

### REQ-PLAY-014 — Starts at the first item
**WHEN** playback starts in `session` mode, it **shall** begin with the first
SessionItem.

### REQ-PLAY-015 — Sequential advance
**WHEN** a SessionItem completes, playback **shall** proceed to the next item
without further input.

### REQ-PLAY-016 — Ends after the last item
**WHEN** the final SessionItem completes, the session **shall** end.

### REQ-PLAY-017 — Progress display
**WHILE** in `session` mode, the cycle counter **shall** show the current item
index and the total.

### REQ-PLAY-018 — Rest items pause
**WHERE** a SessionItem is of type `rest`, the sequencer **shall** insert a
pause of the item's duration before starting the next item.

### REQ-PLAY-019 — Melody and preset items
**WHERE** a SessionItem is of type `melody` or `preset`, the sequencer
**shall** load the referenced melody.

### REQ-PLAY-020 — Scale items are generated
**WHERE** a SessionItem is of type `scale`, the sequencer **shall** generate a
melody from the item's scale type and beat count.

### REQ-PLAY-021 — Results recorded once
**WHEN** a session ends, the app **shall** record the session result — score,
items completed, and name — and present a summary. This is a commit point and
**shall** run exactly once per session.

## Shared settings — `REQ-PLAY-022..023`

### REQ-PLAY-022 — Common transport settings
All three modes **shall** honour the same BPM, count-in, metronome, and volume
settings.

### REQ-PLAY-023 — Common capture behaviour
All three modes **shall** support the same note filtering while the mic is
active, and the same recording to piano roll.

## Lifecycle — `REQ-PLAY-024..026`

### REQ-PLAY-024 — Shared state
`isPlaying` and `isPaused` **shall** be shared across all modes and read from
`playback-state-store`.

### REQ-PLAY-025 — Stop resets mode state
**WHEN** playback is stopped, the app **shall** reset mode-specific state —
cycle index, session item index, and repeat counter.

### REQ-PLAY-026 — Pause preserves position
**WHEN** playback is paused, the app **shall** stop audio while preserving
position, and **WHEN** resumed **shall** continue from that point.

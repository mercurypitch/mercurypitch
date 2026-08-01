# Metronome — EARS Requirements

Requirements for the metronome: its toggle, sound types, independent volume,
timing accuracy, visual beat indicator, and count-in behaviour.

**Source:** `src/stores/app-store.ts` — metronome enable/sound/volume state;
`src/stores/transport-store.ts` — `bpm` (clamped 40-280) and `countIn`;
`src/contexts/EngineContext.tsx` — schedules clicks on the audio clock
**Tests:** `src/e2e/metronome.spec.ts` (`REQ-MET-001..019`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Toggle — `REQ-MET-001..005`

### REQ-MET-001 — Toggle control
**WHEN** the user activates the metronome toggle, the app **shall** enable or
disable the metronome immediately, with no further confirmation.

### REQ-MET-002 — Enable state persists
The metronome enable state **shall** persist across sessions.

### REQ-MET-003 — Toggle reflects state
The metronome toggle **shall** render a visually distinct on and off state.

### REQ-MET-004 — Sounds only during playback
**WHILE** playback is stopped, the metronome **shall** not sound, regardless of
its enable state.

### REQ-MET-005 — Disabled means silent and still
**IF** the metronome is disabled, **THEN** the app **shall** neither sound
clicks nor advance the visual beat indicator.

## Sound types — `REQ-MET-006..009`

### REQ-MET-006 — Selectable sound
The user **shall** be able to select the metronome sound from: click,
click-off, and syncopated.

### REQ-MET-007 — Selection persists
The selected metronome sound **shall** persist across sessions.

### REQ-MET-008 — Click-off accents weak beats
**WHERE** the click-off sound is selected, the metronome **shall** sound on the
weaker beats of the bar.

### REQ-MET-009 — Syncopated alternates
**WHERE** the syncopated sound is selected, the metronome **shall** alternate
between strong and weak beats.

## Volume — `REQ-MET-010..013`

### REQ-MET-010 — Independent volume
The metronome volume **shall** be adjustable independently of the main output
volume.

### REQ-MET-011 — Range
The metronome volume **shall** accept values from 0% to 100% inclusive.

### REQ-MET-012 — Default
**WHEN** no metronome volume has been stored, the app **shall** use 50%.

### REQ-MET-013 — Immediate effect
**WHEN** the user changes the metronome volume, the change **shall** take
effect without requiring playback to restart.

## Timing — `REQ-MET-014..016`

### REQ-MET-014 — Follows BPM
The metronome **shall** sound at intervals derived from the current BPM.

### REQ-MET-015 — No drift
**WHILE** playback continues, the metronome **shall** not drift from the BPM
reference.

### REQ-MET-016 — Full BPM range
The metronome **shall** hold `REQ-MET-014` and `REQ-MET-015` across the whole
supported BPM range of 40 to 280.

## Visual indicator — `REQ-MET-017`

### REQ-MET-017 — Indicator tracks audio
**WHILE** the metronome is sounding, the visual beat indicator **shall**
advance in sync with the audible click and display the current beat number.

## Count-in — `REQ-MET-018..019`

### REQ-MET-018 — Count-in uses the metronome
**WHILE** a count-in is in progress, the metronome **shall** sound each
count-in beat using the metronome's own timing and volume.

### REQ-MET-019 — Stops with the count-in
**WHEN** the count-in completes, **IF** the metronome is disabled, **THEN** the
app **shall** stop sounding clicks.

# EARS Specification — Guitar Practice

> **EARS** = Easy Approach to Requirements Syntax  
> Version: 1.0 | Date: 2026-05-29 | Scope: Guitar practice tab including synthesis, drum machine, visualization, and game mechanics

---

## 1. Guitar Synthesis

### REQ-GP-001 — Karplus-Strong Acoustic Guitar Voice
**WHEN** the audio engine plays a note with the `guitar-acoustic` instrument type, the system shall synthesize the sound using a Karplus-Strong physical model: a noise-burst excitation (3 ms) driving a tuned delay line, with lowpass-damped feedback (coefficient 0.92) to model string decay and harmonic roll-off, and a 15% body resonance parallel path for warmth.

### REQ-GP-002 — Karplus-Strong Electric Guitar Voice
**WHEN** the audio engine plays a note with the `guitar-electric` instrument type, the system shall synthesize the sound using a brighter Karplus-Strong model: lower feedback coefficient (0.85), higher damping cutoff (up to 12 kHz), and a 5% body resonance path for a tighter, brighter tone.

### REQ-GP-003 — Bass Voice Synthesis
**WHEN** the audio engine plays a note with the `bass` instrument type, the system shall synthesize a rich low-end voice using additive synthesis: a sine sub-oscillator at the fundamental, a lowpass-filtered sawtooth at the fundamental, a sine octave harmonic, and a bandpass-filtered noise pluck transient for attack articulation.

### REQ-GP-004 — MIDI-to-String Assignment
**Ubiquitous:** The system shall assign each MIDI note to the optimal guitar string (0-5, low E to high e) that minimizes fret position, considering open-string MIDI values (E2=40, A2=45, D3=50, G3=55, B3=59, E4=64) and a 24-fret range. Notes below the guitar range shall default to the lowest string.

### REQ-GP-005 — Guitar Note Data Model
**Ubiquitous:** Each guitar note shall carry: `midi` (MIDI number), `noteName` (e.g., "C4"), `stringIndex` (0-5), `fret` (0-24), `startBeat`, `duration`, and `targetFreq` (Hz). The `melodyToGuitarNotes` function shall convert melody items into this model.

---

## 2. Drum Machine

### REQ-GP-006 — Synthesized Drum Sounds
**Ubiquitous:** The drum machine shall synthesize all drum sounds using the Web Audio API with no external samples:
- **Kick**: sine sweep 150 Hz → 40 Hz over 80 ms, exponential decay over 300 ms.
- **Snare**: white noise burst (120 ms) + 200 Hz triangle tone sweep to 120 Hz (100 ms).
- **Hi-hat closed**: highpass-filtered (8 kHz) noise burst, 40 ms decay.
- **Hi-hat open**: highpass-filtered (7 kHz) noise burst, 200 ms decay.
- **Tom high/mid/low**: triangle oscillator sweeps starting at 350/240/150 Hz, 200 ms decay.
- **Crash**: bandpass-filtered (4 kHz, Q=1.2) noise burst, 800 ms decay.

### REQ-GP-007 — 16-Step Pattern Sequencer
**Ubiquitous:** The drum machine shall maintain a 16-step pattern (one bar of 16th notes) per instrument, stored as boolean arrays keyed by drum sound type: `kick`, `snare`, `hh-closed`, `hh-open`, `tom-high`, `tom-mid`, `tom-low`, `crash`.

### REQ-GP-008 — Step Sequencing and BPM Sync
**WHILE** the drum machine is playing, it shall advance through steps at intervals of `60 / bpm / 4` seconds using `setTimeout` with drift compensation, triggering all active instruments for the current step via their synthesis functions. After step 15, sequencing wraps to step 0.

### REQ-GP-009 — Preset Patterns
**WHEN** the user selects a preset (`basic-rock`, `funk`, `hip-hop`, `jazz`, `latin`, `empty`), the drum machine shall deep-clone the corresponding pattern and notify subscribers of the state change.

### REQ-GP-010 — Per-Instrument Volume and Direct Trigger
**Ubiquitous:** Each of the 8 drum sounds shall have an independent volume setting (0-1 range, default 0.8). The `trigger(sound)` method shall play a single drum sound immediately for auditioning without affecting the sequencer state.

---

## 3. Fretboard Visualization

### REQ-GP-011 — Canvas Fretboard Rendering
**Ubiquitous:** The `GuitarFretboardCanvas` component shall render a 6-string guitar neck using HTML Canvas 2D with device-pixel-ratio-aware scaling via `ResizeObserver`. The canvas shall draw:
- A dark wood-grain background gradient (`#1a120b` to `#241a10` to `#1a120b`).
- 6 horizontal string lines with distinct colors (wound strings E/A/D thicker at 2 px, plain strings G/B/e at 1.5 px).
- Fret marker dots at positions 3, 5, 7, 9, and 15 (single dot), and a double dot at position 12.

### REQ-GP-012 — Falling Note Pills
**WHILE** notes are active, the canvas shall render note pills (rounded rectangles) positioned vertically based on the beat distance from the playhead within the visible beat window. Each pill shall be color-coded by pitch class (12 colors mapped to note names). Judged notes shall recolor to gold (perfect), green (great), blue (good), or red (miss).

### REQ-GP-013 — Duration Tails
**Ubiquitous:** Notes with a duration longer than 0.05 beats shall display a vertical tail extending upward from the note pill, colored at 50% opacity with a darkened shade of the note's fill color, proportional in height to the note's beat duration.

### REQ-GP-014 — Strum Zone
**Ubiquitous:** The bottom 12% of the canvas height shall be rendered as a purple-highlighted strum zone with a gradient background, a demarcation line, and a "STRUM ZONE" label. The 6 horizontal string lines shall continue through this zone at increased opacity. Clicking a string lane in this zone shall register a strum input.

### REQ-GP-015 — HUD Overlay
**Ubiquitous:** The canvas shall render a heads-up display showing the current combo (as `Nx` in the top-right, only when combo > 1) and score below it. During non-playing states (`countdown`, `paused`, `finished`), a semi-transparent overlay shall display the state label (e.g., "GET READY", "PAUSED", "FINISHED") and final score on finish.

---

## 4. Game Mechanics

### REQ-GP-016 — Game State Machine
**Ubiquitous:** The game shall operate through a state machine with states: `idle` → `countdown` → `playing` → `finished`, plus `paused` as a suspension of `playing`. Transitions: `startGame()` moves from `idle`/`finished` to `countdown`; after 4 beats of count-in, auto-transition to `playing`; `finishGame()` auto-triggers when all notes have been judged and the last note duration has elapsed.

### REQ-GP-017 — Count-In and Playhead
**WHEN** the game starts, the playhead shall begin at beat -4 and advance at the song's BPM. During the count-in, the drum machine shall trigger a hi-hat closed sound on each integer beat. When the playhead reaches beat 0, the game state transitions to `playing`, the drum machine starts its full sequence, and the playhead resets to 0.

### REQ-GP-018 — Hit Detection and Timing Windows
**WHEN** the user strums a string (via click on the strum zone or keyboard keys 1-6 / A-S-D-F-G-H), the system shall find the closest unjudged note on that string within the allowed timing window (±150 ms) and record a hit judgment:
- `perfect`: ≤ 30 ms deviation (100 points)
- `great`: ≤ 75 ms deviation (75 points)
- `good`: ≤ 150 ms deviation (50 points)
- `miss`: notes that pass the -150 ms threshold without a hit (0 points, combo reset)

### REQ-GP-019 — Combo and Scoring
**Ubiquitous:** The current combo shall increment by 1 on every successful hit and reset to 0 on a miss. The maximum combo shall be tracked separately. The score shall accumulate points from each hit judgment. Both values shall be exposed as reactive SolidJS signals.

### REQ-GP-020 — Pause and Resume
**WHEN** the game is paused, the drum machine shall stop and the game state shall become `paused`. **WHEN** the game is resumed, the playhead shall continue from its paused position using time offset compensation, and the drum machine shall restart.

---

## 5. UI Integration

### REQ-GP-021 — Guitar Tab Navigation
**Ubiquitous:** A "Guitar" tab button with an SVG icon (guitar body + sound hole + headstock) shall appear in the "Practice" tab group of the app navigation bar, positioned after the Karaoke tab. Clicking it shall set the active tab to `TAB_GUITAR` and render the guitar practice panel.

### REQ-GP-022 — Shared Control Toolbar Integration
**WHEN** the guitar tab is active, the `SharedControlToolbar` shall render: play/pause/stop transport controls, BPM display (using the guitar tab's `bpmValue` prop), note label toggle, and practice mode/cycles display. Mic sensitivity controls shall be hidden on the guitar tab.

### REQ-GP-023 — Song Picker
**Ubiquitous:** The `GuitarPracticeSongPicker` shall present a modal song selection interface listing melodies from the melody store, each rendered as a clickable card showing song name and a "START" button. On selection, it shall convert the melody items to guitar notes via `melodyToGuitarNotes` and call the controller's `loadSong` with the adapted notes, song name, and BPM.

### REQ-GP-024 — Drum Machine Panel
**Ubiquitous:** The `DrumMachinePanel` shall display below the fretboard canvas:
- An 8-row × 16-column toggle grid where each cell represents a step for a drum sound. Active steps shall be styled with accent-colored backgrounds.
- Instrument labels on the left column with trigger buttons for auditioning sounds.
- A pattern preset selector dropdown.
- A BPM slider with numeric display.
- Per-instrument volume sliders with color-coded thumbs.
- Step number headers with beat-accent styling on downbeats (steps 0, 4, 8, 12).

### REQ-GP-025 — Responsive Layout and Dark Theme
**Ubiquitous:** All guitar practice UI components shall use CSS custom properties from the dark theme (`--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--accent`, `--spacing-md`, `--radius-sm`). On viewports narrower than 480 px, the drum grid shall reduce instrument label widths (44 px → 34 px), step cell sizes, and volume sliders shall reflow from 4 columns to 2 columns.

---

## 6. Audio Engine Integration

### REQ-GP-026 — Instrument Type Registration
**Ubiquitous:** The audio engine's `InstrumentType` union shall include `'guitar-acoustic'`, `'guitar-electric'`, and `'bass'`. The `getInstruments()` function shall return these types alongside existing instrument types. The `_createVoice()` method shall dispatch to `createGuitarVoice` or `createBassVoice` accordingly.

### REQ-GP-027 — Note Playback During Game
**WHILE** the game is in the `playing` state, the system shall automatically trigger audio playback for each note exactly when its `startBeat` aligns with the playhead, using `audioEngine.playTone(note.targetFreq, durationMs)` with a minimum duration of 50 ms. Each note shall be played at most once (tracked by a `playedIndices` set).

---

## 7. Cross-Cutting Concerns

### REQ-GP-028 — AudioContext Initialization
**WHEN** `startGame()` is called, the drum machine shall lazily initialize its `AudioContext` (with `latencyHint: 'interactive'`) if not already created. This ensures the Web Audio API is activated by a user gesture.

### REQ-GP-029 — Resource Cleanup
**WHEN** the guitar practice controller's owning component is unmounted (`onCleanup`), the system shall cancel the animation frame loop and stop the drum machine. The drum machine's `dispose()` method shall close its `AudioContext` and clear its subscriber list.

### REQ-GP-030 — State Reset on Song Load
**WHEN** a new song is loaded via `loadSong()`, the system shall stop any running game and reset all state: clear hit results, judged indices, played indices, score, combo, and missed notes.

---

## Summary of Requirements

| ID | Category | Type | Description |
|----|----------|------|-------------|
| REQ-GP-001 | Synthesis | Event-driven | Karplus-Strong acoustic guitar voice |
| REQ-GP-002 | Synthesis | Event-driven | Karplus-Strong electric guitar voice |
| REQ-GP-003 | Synthesis | Event-driven | Bass voice with additive synthesis |
| REQ-GP-004 | Synthesis | Ubiquitous | MIDI-to-string assignment algorithm |
| REQ-GP-005 | Synthesis | Ubiquitous | Guitar note data model |
| REQ-GP-006 | Drum Machine | Ubiquitous | Synthesized drum sounds (8 types) |
| REQ-GP-007 | Drum Machine | Ubiquitous | 16-step pattern sequencer |
| REQ-GP-008 | Drum Machine | State-driven | BPM-synced step scheduling |
| REQ-GP-009 | Drum Machine | Event-driven | Preset pattern loading |
| REQ-GP-010 | Drum Machine | Ubiquitous | Per-instrument volume and trigger |
| REQ-GP-011 | Visualization | Ubiquitous | Canvas fretboard rendering |
| REQ-GP-012 | Visualization | State-driven | Falling note pills with color coding |
| REQ-GP-013 | Visualization | Ubiquitous | Duration tails on notes |
| REQ-GP-014 | Visualization | Ubiquitous | Strum zone (bottom 12% of canvas) |
| REQ-GP-015 | Visualization | Ubiquitous | HUD overlay (combo, score, state) |
| REQ-GP-016 | Game Logic | Ubiquitous | Game state machine (5 states) |
| REQ-GP-017 | Game Logic | Event-driven | 4-beat count-in with playhead |
| REQ-GP-018 | Game Logic | Event-driven | Hit detection with timing windows |
| REQ-GP-019 | Game Logic | Ubiquitous | Combo tracking and scoring |
| REQ-GP-020 | Game Logic | Event-driven | Pause and resume with time offset |
| REQ-GP-021 | UI | Ubiquitous | Guitar tab button in navigation |
| REQ-GP-022 | UI | State-driven | SharedControlToolbar guitar mode |
| REQ-GP-023 | UI | Event-driven | Song picker with melody-to-guitar adapt |
| REQ-GP-024 | UI | Ubiquitous | Drum machine panel (grid, presets, volumes) |
| REQ-GP-025 | UI | Ubiquitous | Responsive dark-theme layout |
| REQ-GP-026 | Audio | Ubiquitous | Instrument type registration |
| REQ-GP-027 | Audio | State-driven | Automatic note playback during game |
| REQ-GP-028 | Cross | Event-driven | Lazy AudioContext initialization |
| REQ-GP-029 | Cross | Event-driven | Resource cleanup on unmount |
| REQ-GP-030 | Cross | Event-driven | Full state reset on song load |

# PitchPerfect Feature Ideas

A living list of proposed features and improvements for PitchPerfect.

---

## Editor Enhancements

- [ ] **Copy/paste notes** — Select one or more notes, copy them, and paste at a new beat position in the piano roll
- [ ] **Snap-to-grid toggle** — Allow free placement (no snapping) for expressive timing
- [ ] **Note velocity / velocity curve** — Visual velocity editing on note blocks (thicker/thinner or colour intensity)
- [ ] **Keyboard shortcut for note entry** — Arrow keys navigate pitch lanes, Space/Enter place note
- [x] **Undo/redo for note edits** — Maintain a history stack of edit operations in the piano roll  **(GH #73, DONE)**
- [ ] **Multiple selection and bulk move/delete** — Shift-select or Ctrl-select multiple notes and drag or delete together
- [ ] **Zoom controls for piano roll** — Zoom in/out on the time axis (horizontal) and pitch axis (vertical)  **(GH #74)**

---

## Playback & Audio

- [ ] **Instrument sounds** — Replace the sine-wave oscillator with a lightweight sampler or Web Audio synthesizer (e.g., piano, organ, strings)
- [ ] **Reverb / effects chain** — Add a simple reverb or EQ to the practice playback
- [ ] **Record from microphone to piano roll** — Real-time MIDI capture: sing or play and convert to note blocks
- [ ] **Adjustable tone envelope** — Attack, decay, sustain, release (ADSR) control for the oscillator
- [ ] **Play preview speed** — Slow down the melody (0.5x, 0.75x) for practice without changing BPM

---

## Practice & Feedback

- [ ] **Session history** — Store past practice sessions with timestamps, scores, and accuracy per run
- [ ] **Progress chart** — Visual line/bar chart of score improvement over time
- [ ] **Pitch accuracy heatmap on piano keys** — Colour-code piano keys showing weak/strong notes based on history
- [ ] **Target pitch overlay** — Show the target frequency as a horizontal guide line on the pitch canvas during Practice mode
- [ ] **Custom practice modes** — e.g., "Random notes" (skip practising known notes), "Focus mode" (practice only recent errors)
- [ ] **Count-in options** — Choose number of count-in beats (1, 2, 4, or off)

---

## Scale & Notation

- [ ] **Minor scales and modes** — Add natural/harmonic/melodic minor, Dorian, Mixolydian, etc.
- [ ] **Chromatic / note range mode** — Allow free pitch detection across all 12 semitones (not limited to the current scale)
- [ ] **Custom scale builder** — Let the user define a custom scale by selecting notes from the 12-tone grid
- [ ] **Tonic anchor tone** — Play a reference tone at the start of each run to help the singer lock in

---

## UI / UX

- [ ] **Dark/light theme toggle** — Switch between dark and light colour schemes
- [ ] **Responsive layout improvements** — Better mobile layout for the piano roll (touch gestures for note editing)
- [ ] **Piano key width based on octave count** — Auto-size the piano key column to fit 2-3 octaves comfortably
- [ ] **Waveform display during recording** — Show a live audio waveform in the pitch area while the mic is active
- [ ] **Tab badges** — Show a count badge on the Editor tab when notes are present

---

## Data & Export

- [ ] **Export melody as MIDI file** — Download the current preset melody as a standard .mid file  **(GH #75)**
- [ ] **Export melody as audio (WAV/MP3)** — Render the current melody to an audio file
- [ ] **Import MIDI file into editor** — Load a .mid file and populate the piano roll
- [ ] **Cloud preset sync** — Save and load presets to/from a server (optional authentication)
- [x] **Shareable preset URLs** — Encode preset data in a URL query string for easy sharing  **(DONE - PR #77)**

---

## Infrastructure

- [ ] **TypeScript migration** — Move all JS to TypeScript with strict types (see issue #33)
- [ ] **Unit tests** — Add Jest/Vitest tests for scale-data.js, pitch-detector.js, and audio engine helpers  **(DONE - 105 tests added via Vitest, see PR #76)**
- [ ] **E2E tests** — Playwright tests for critical flows: preset save/load, playback, note entry
- [x] **CI/CD pipeline** — GitHub Actions for lint, type-check, test, and build on every PR  **(DONE - tests.yml + build.yml, see PR #76)**
- [ ] **Bundle / build step** — Add a simple bundler (esbuild or Rollup) to produce a single JS bundle for production

---

_Last updated: 2026-04-14_

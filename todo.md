# PitchPerfect Feature Ideas

A living list of proposed features and improvements for PitchPerfect.

---

## Editor Enhancements

- [ ] **Copy/paste notes** — Select one or more notes, copy them, and paste at a new beat position in the piano roll  **(partially done — multi-select via PR #96)**
- [x] **Snap-to-grid toggle** — Allow free placement (no snapping) for expressive timing  **(DONE - PR #125)**
- [x] **Note velocity / velocity curve** — Visual velocity editing on note blocks (thicker/thinner or colour intensity)  **(DONE - PR #76)**
- [x] **Keyboard shortcut for note entry** — Arrow keys navigate pitch lanes, Space/Enter place note  **(DONE - PR #76)**
- [x] **Undo/redo for note edits** — Maintain a history stack of edit operations in the piano roll  **(GH #73, DONE)**
- [x] **Multiple selection and bulk delete** — Select multiple notes and delete them together  **(GH #120 — bulk delete via Delete key + toolbar button, DONE)**
- [x] **Zoom controls for piano roll** — Zoom in/out on the time axis (horizontal) and pitch axis (vertical)  **(GH #74, DONE - PR #125)**

---

## Playback & Audio

- [x] **Instrument sounds** — Replace the sine-wave oscillator with a lightweight sampler or Web Audio synthesizer (e.g., piano, organ, strings)  **(DONE - additive synthesis for piano/organ/strings/synth in audio-engine.ts)**
- [x] **Reverb / effects chain** — Add a simple reverb or EQ to the practice playback  **(DONE - PR #127, reverb types + wet/dry mix in Settings)**
- [ ] **Record from microphone to piano roll** — Real-time MIDI capture: sing or play and convert to note blocks
- [x] **Adjustable tone envelope** — Attack, decay, sustain, release (ADSR) control for the oscillator  **(DONE - PR #76)**
- [x] **Play preview speed** — Slow down the melody (0.5x, 0.75x) for practice without changing BPM  **(DONE - PR #76)**

---

## Practice & Feedback

- [x] **Session history** — Store past practice sessions with timestamps, scores, and accuracy per run  **(DONE - PR #76)**
- [x] **Progress chart** — Visual line/bar chart of score improvement over time  **(DONE - PR #76)**
- [x] **Pitch accuracy heatmap on piano keys** — Colour-code piano keys showing weak/strong notes based on history  **(DONE - PR #125)**
- [x] **Target pitch overlay** — Show the target frequency as a horizontal guide line on the pitch canvas during Practice mode  **(DONE - PR #76)**
- [x] **Custom practice modes** — e.g., "Random notes" (skip practising known notes), "Focus mode" (practice only recent errors)  **(DONE - PR #122)**
- [x] **Count-in options** — Choose number of count-in beats (1, 2, 4, or off)  **(DONE - PR #76)**

---

## Scale & Notation

- [x] **Minor scales and modes** — Add natural/harmonic/melodic minor, Dorian, Mixolydian, etc.
- [x] **Chromatic / note range mode** — Allow free pitch detection across all 12 semitones (not limited to the current scale)  **(DONE - PR #120)**
- [x] **Custom scale builder** — Let the user define a custom scale by selecting notes from the 12-tone grid  **(DONE - PR #127)**
- [x] **Tonic anchor tone** — Play a reference tone at the start of each run to help the singer lock in  **(DONE - PR #124)**

---

## UI / UX

- [x] **Dark/light theme toggle** — Switch between dark and light colour schemes  **(DONE - PR #76)**
- [x] **Responsive layout improvements** — Better mobile layout for the piano roll (touch gestures for note editing)  **(DONE - PR #123, mobile overhaul)**
- [x] **Focus Mode** — Distraction-free full-screen practice UI with pitch canvas + minimal toolbar + Space key play/pause  **(GH #123, PR #123)**
- [x] **Piano key width based on octave count** — Auto-size the piano key column to fit 2-3 octaves comfortably  **(DONE - PR #76)**
- [x] **Waveform display during recording** — Show a live audio waveform in the pitch area while the mic is active  **(GH #122, DONE - purple waveform overlay on PitchCanvas)**
- [x] **Tab badges** — Show a count badge on the Editor tab when notes are present  **(DONE - PR #76)**
- [x] **About section** — App info panel in Settings with version, features, and credits  **(GH #124, DONE)**

---

## Data & Export

- [x] **Export melody as MIDI file** — Download the current preset melody as a standard .mid file  **(DONE - export/import wired in piano-roll.ts)**
- [x] **Export melody as audio (WAV/MP3)** — Render the current melody to an audio file  **(DONE - PR #125, WAV export wired to toolbar)**
- [x] **E2E tests** — Playwright tests for critical flows: preset save/load, playback, note entry  **(GH #121 + GH #126, 20 tests + E2E CI job, DONE)**
- [x] **Import MIDI file into editor** — Load a .mid file and populate the piano roll  **(DONE - PR #121)**
- [ ] **Cloud preset sync** — Save and load presets to/from a server (optional authentication)
- [x] **Shareable preset URLs** — Encode preset data in a URL query string for easy sharing  **(DONE - PR #77)**

---

## Infrastructure

- [ ] **TypeScript migration** — Move all JS to TypeScript with strict types (see issue #33)
- [x] **Unit tests** — 256 tests covering app-store, melody-engine, practice-engine, audio-engine, pitch-detector, scale-data, preset save/load, MIDI import/export, session data, share-url, theme store  **(DONE - Vitest, see PR #76)**
- [x] **CI/CD pipeline** — GitHub Actions for lint, type-check, test, and build on every PR  **(DONE - tests.yml + build.yml, see PR #76)**
- [x] **Bundle / build step** — Add a simple bundler (esbuild or Rollup) to produce a single JS bundle for production  **(DONE - Vite bundler configured)**
- [x] **Refactoring** — Removed all `as any` type casts, consolidated duplicate `centsToBand` implementations, moved module-level `_nextId` into class, removed unused exports  **(GH #115, DONE - 2026-04-17)**

---

_Last updated: 2026-04-17_

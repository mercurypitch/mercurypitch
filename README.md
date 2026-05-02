# PitchPerfect

A browser-based vocal pitch practice tool. Sing along with customizable melodies, get real-time feedback on your pitch accuracy, and track your progress over time.

## Preview

![PitchPerfect Main](assets/PitchPerfectMain.png)

## Features

- **Real-time pitch detection** — Web Audio API + YIN algorithm tracks your voice with sub-cent accuracy
- **Practice modes** — Once, Repeat, and cyclic Practice with configurable cycles
- **Piano roll editor** — Click to place notes, drag to move, right-click to delete
- **Scale builder** — Define root note and scale type to generate melodies
- **Focus Mode** — AI-powered practice: app analyzes your history and targets the notes you struggle with
- **Session tracking** — Record practice sessions, see per-note accuracy and cents deviation, review progress over time
- **MIDI import/export** — Load .mid files or share your melody as a URL-encoded preset
- **ADSR envelope** — Shape the Attack/Decay/Sustain/Release of note playback
- **Reverb effects** — Add Room, Hall, or Cathedral reverb to practice playback
- **Metronome precount** — Count-in before playback, optional click track during play
- **Bulk note operations** — Delete all notes or reset to a default melody with one click
- **Theme support** — Dark and light themes, persisted to localStorage
- **Accuracy bands** — Configure how many cents off counts as Perfect/Excellent/Good/Okay

## Live Demo

Open [pitchperfect.clodhost.com](https://pitchperfect.clodhost.com) in a modern browser.

### Getting Started

1. Click **Mic** to enable microphone input
2. Select a **Key** and **Octave** (or choose a preset melody)
3. Click **Play** to start — sing the notes shown on the pitch canvas
4. Your pitch is tracked in real-time with per-note accuracy scoring

### Controls

| Control                  | Description                              |
| ------------------------ | ---------------------------------------- |
| Mic                      | Toggle microphone input                  |
| Play / Pause / Stop      | Playback transport                       |
| Once / Repeat / Practice | Playback mode                            |
| BPM                      | Tempo (40–280)                           |
| Pre                      | Metronome precount (4 beats)             |
| Sens                     | Pitch detection sensitivity (1–10)       |
| Focus                    | Toggle Focus Mode                        |
| Sessions                 | Browse and replay past practice sessions |

### Practice Modes

- **Once** — Play melody once, record results
- **Repeat** — Loop the melody continuously
- **Practice** — Cyclic practice with configurable repeat cycles; focuses on missed notes more

### Accuracy Scoring

Each sung note is rated by cents deviation from the target pitch:

| Band      | Threshold (cents) |
| --------- | ----------------- |
| Perfect   | ≤ configurable    |
| Excellent | ≤ configurable    |
| Good      | ≤ configurable    |
| Okay      | ≤ configurable    |
| Off       | > Okay threshold  |

## Project Structure

```
├── src/
│   ├── App.tsx              # Main SolidJS application
│   ├── components/          # UI components
│   │   ├── AppHeader.tsx    # Header with title and theme toggle
│   │   ├── AppSidebar.tsx   # Left sidebar with tabs
│   │   ├── PitchCanvas.tsx  # Live pitch visualization canvas
│   │   ├── PianoRollCanvas.tsx   # Piano roll editor canvas
│   │   ├── SettingsPanel.tsx      # Settings / About panel
│   │   ├── WelcomeScreen.tsx      # First-run welcome overlay
│   │   ├── FocusMode.tsx   # Focus mode selection UI
│   │   ├── SessionBrowser.tsx     # Browse past sessions
│   │   ├── SessionPlayer.tsx      # Replay a recorded session
│   │   ├── HistoryCanvas.tsx      # Mini progress chart
│   │   ├── NoteList.tsx    # Note editor list view
│   │   └── ...
│   ├── lib/
│   │   ├── audio-engine.ts   # Web Audio playback + ADSR + reverb
│   │   ├── pitch-detector.ts # Microphone input & YIN pitch detection
│   │   ├── piano-roll.ts     # Piano roll canvas rendering
│   │   ├── melody-engine.ts  # Melody playback + callbacks
│   │   ├── practice-engine.ts # Practice mode logic
│   │   ├── scale-data.ts     # Music theory utilities
│   │   └── share-url.ts     # URL-encoded preset sharing
│   ├── stores/
│   │   ├── app-store.ts      # Global app state (SolidJS signals)
│   │   ├── melody-store.ts   # Melody state
│   │   └── playback-store.ts # Playback state
│   ├── types/index.ts        # TypeScript interfaces
│   ├── styles/app.css        # All styles
│   ├── tests/                # Vitest unit tests
│   └── e2e/app.spec.ts       # Playwright E2E tests
├── public/                   # Built static site
└── vite.config.ts           # Vite bundler config
```

## Development

```bash
# Install dependencies
cd App && npm install

# Run dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Run E2E tests
npx playwright test
```

## Architecture

- **SolidJS** for reactive UI components
- **Web Audio API** for synthesized note playback and microphone input
- **Canvas 2D** for piano roll and pitch canvas rendering
- **localStorage** for settings and session persistence
- **Vitest** for unit tests with fake timers and RAF mocking
- **Playwright** for E2E browser tests

### Audio Engine

The `AudioEngine` class manages all Web Audio nodes:

- `OscillatorNode` per voice (polyphonic)
- `GainNode` chain with ADSR envelope (Attack → Decay → Sustain → Release)
- `ConvolverNode` + dry/wet `GainNode` split for reverb
- `AnalyserNode` for waveform data during playback
- Programmatic impulse responses for Room / Hall / Cathedral reverb

### Pitch Detection

Uses the YIN autocorrelation algorithm (via `pitchfinder`):

- Microphone stream → `AnalyserNode` → YIN detection at ~60fps
- Configurable sensitivity and minimum confidence threshold
- Cents deviation calculated from detected vs target frequency

## Deployment

The root dir builds to `dist/`, which is served as a static site. Any static hosting works (GitHub Pages, Netlify, Vercel, Apache, etc.).

## Requirements

- Modern browser with Web Audio API and `getUserMedia`
- Microphone access for pitch detection

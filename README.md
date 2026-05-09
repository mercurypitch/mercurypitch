# PitchPerfect

A browser-based vocal pitch practice tool with AI stem separation, community features, and real-time audio processing. Sing along with customizable melodies, get real-time feedback on your pitch accuracy, and track your progress over time.

## Features

### Core Practice
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
- **Theme support** — Dark and light themes, persisted to localStorage
- **Accuracy bands** — Configure how many cents off counts as Perfect/Excellent/Good/Okay

### UVR Stem Separation
- **AI vocal separation** — Separate any audio file into vocal and instrumental stems using UVR-MDX-NET
- **Multi-stem mixer** — Mix stems with independent volume control and synchronized playback
- **Synced lyrics** — Auto-fetch and display synced (LRC) lyrics during stem playback
- **LRC generator** — Generate timestamped lyrics with block/verse markers
- **Mic pitch scoring** — Sing along with separated vocals and get real-time accuracy scoring
- **Session history** — Browse, replay, and share past separation sessions with 3-column gallery
- **Hash-based deep links** — Shareable URLs for sessions, mixer views, and community content

### Community
- **Vocal challenges** — Take on pitch accuracy challenges and compete on the leaderboard
- **Community sharing** — Share melodies and session results with hash-based URLs
- **Leaderboard** — See top performers and recent activity

## Live Demo

Open [pitchperfect.clodhost.com](https://pitchperfect.clodhost.com) in a modern browser.

### Getting Started

1. Click **Mic** to enable microphone input
2. Select a **Key** and **Octave** (or choose a preset melody)
3. Click **Play** to start — sing the notes shown on the pitch canvas
4. Your pitch is tracked in real-time with per-note accuracy scoring

### Tabs

| Tab | Description |
|-----|-------------|
| Practice | Main pitch practice with piano roll editor |
| Editor | Piano roll note editor |
| Vocal Analysis | Analyze and visualize vocal recordings |
| UVR | AI stem separation — upload audio, mix stems, view lyrics |
| Community | Browse shared melodies and sessions |
| Leaderboard | Top performers across challenges |
| Vocal Challenges | Timed pitch accuracy challenges |
| Settings | App settings, keyboard shortcuts, about |

## Project Structure

```
├── src/
│   ├── App.tsx                    # Main SolidJS application
│   ├── components/                # UI components
│   │   ├── StemMixer.tsx          # Multi-stem mixer with pitch viz + lyrics
│   │   ├── UvrPanel.tsx           # UVR unified panel (upload, history, mixer)
│   │   ├── CommunityShare.tsx     # Community sharing UI
│   │   ├── CommunityLeaderboard.tsx
│   │   ├── VocalChallenges.tsx    # Vocal challenge mode
│   │   ├── PianoRollCanvas.tsx    # Piano roll editor
│   │   ├── PitchCanvas.tsx        # Live pitch visualization
│   │   ├── SettingsPanel.tsx      # Settings / About panel
│   │   └── ...
│   ├── lib/
│   │   ├── audio-engine.ts        # Web Audio playback + ADSR + reverb
│   │   ├── pitch-detector.ts      # YIN pitch detection via microphone
│   │   ├── piano-roll.ts          # Piano roll canvas rendering
│   │   ├── melody-engine.ts       # Melody playback + callbacks
│   │   ├── practice-engine.ts     # Practice mode scoring
│   │   ├── uvr-api.ts             # UVR REST API client
│   │   ├── uvr-processor.ts       # Client-side processing logic
│   │   ├── lyrics-service.ts      # Lyrics fetch/parse (LRCLIB, lyrics.ovh)
│   │   ├── hash-router.ts         # Hash-based client routing
│   │   ├── scale-data.ts          # Music theory utilities
│   │   └── share-url.ts           # URL-encoded preset sharing
│   ├── stores/
│   │   ├── app-store.ts           # Global app state (SolidJS signals)
│   │   ├── melody-store.ts        # Melody state
│   │   └── playback-store.ts      # Playback state
│   ├── types/index.ts             # TypeScript interfaces
│   ├── styles/app.css             # Global styles
│   └── tests/                     # Vitest unit tests (679 tests, ~20 suites)
├── public/                        # Apache DocumentRoot
├── docs/                          # Documentation and plans
└── vite.config.ts                 # Vite bundler config
```

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run type checking
npm run typecheck

# Run all checks (typecheck + lint + format)
npm run check:syntax

# Run tests (watch mode)
npm test

# Run tests once (CI mode)
npm run test:run

# Build for production
npm run build

# Preview production build
npm run serve

# Run E2E tests
npm run test:e2e
```

## Architecture

- **SolidJS** for reactive UI components (signals, no VDOM)
- **TypeScript** in strict mode throughout
- **Web Audio API** for synthesized note playback, microphone input, and real-time analysis
- **Canvas 2D** for piano roll, pitch visualization, and waveform rendering
- **localStorage** for settings, session persistence, and UI state
- **Vitest** for unit tests (679 tests)
- **Playwright** for E2E browser tests
- **Vite** for bundling, dev server, and HMR

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

### UVR Integration

The UVR panel communicates with a local Python API server (`audio-separator`):

- Upload audio → API processes with UVR-MDX-NET model
- Poll for completion → retrieve separated stems
- Mixer provides synchronized stem playback with per-stem volume

## Deployment

```bash
./deploy.sh              # Full deploy (pull + syntax checks)
./deploy.sh --check-only # Syntax checks only, no pull
```

The root dir builds to `dist/`, which is served as a static site. Apache serves `public/` as DocumentRoot.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, git workflow, and code conventions.

## Requirements

- Modern browser with Web Audio API and `getUserMedia`
- Microphone access for pitch detection

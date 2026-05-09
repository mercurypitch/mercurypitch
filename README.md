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
| Singing | Main pitch practice with piano roll and real-time feedback |
| Compose | Piano roll note editor with scale builder and MIDI import/export |
| Analysis | Visualize vocal recordings and session history |
| Karaoke | AI stem separation — upload audio, mix stems, synced lyrics |
| Community | Browse shared melodies and sessions |
| Leaderboard | Top performers across challenges |
| Challenges | Timed pitch accuracy challenges |
| Pitch Analysis | Analyze and compare pitch detection algorithms |
| Pitch Test | Test pitch detection with live microphone input |
| Settings | App settings, keyboard shortcuts, theme, about |

## Project Structure

```
├── src/
│   ├── App.tsx                    # Main SolidJS application
│   ├── index.tsx                  # Entry point
│   ├── components/                # UI components
│   ├── contexts/                  # SolidJS context providers
│   ├── data/                      # Static data and presets
│   ├── e2e/                       # End-to-end test utilities
│   ├── features/                  # Feature modules (practice, UVR, community)
│   ├── lib/                       # Core business logic and utilities
│   │   ├── audio-engine.ts        # Web Audio playback + ADSR + reverb
│   │   ├── pitch-detector.ts      # YIN pitch detection via microphone
│   │   ├── piano-roll.ts          # Piano roll canvas rendering
│   │   ├── playback-engine.ts     # Playback orchestration
│   │   ├── playback-runtime.ts    # Playback runtime state machine
│   │   ├── practice-engine.ts     # Practice mode scoring
│   │   ├── melody-engine.ts       # Melody playback + callbacks
│   │   ├── uvr-api.ts             # UVR REST API client
│   │   ├── uvr-processor.ts       # Client-side processing logic
│   │   ├── lyrics-service.ts      # Lyrics fetch/parse (LRCLIB, lyrics.ovh)
│   │   ├── hash-router.ts         # Hash-based client routing
│   │   ├── scale-data.ts          # Music theory utilities
│   │   ├── pitch-algorithms/      # Pitch detection algorithm implementations
│   │   └── ...
│   ├── pages/                     # Top-level page views
│   ├── stores/                    # SolidJS signal stores
│   ├── styles/                    # Global styles and design system
│   ├── test/                      # Test utilities and helpers
│   ├── tests/                     # Vitest unit tests
│   └── types/                     # TypeScript type definitions
├── public/                        # Apache DocumentRoot
├── docs/                          # Documentation and plans
├── scripts/                       # Build and utility scripts
├── uvr-api/                       # UVR Python API server
├── vite.config.ts                 # Vite bundler config
└── vitest.config.ts               # Vitest test config
```

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm run dev

# Run type checking
pnpm run typecheck

# Run all checks (typecheck + lint + format)
pnpm run check:syntax

# Run tests (watch mode)
pnpm test

# Run tests once (CI mode)
pnpm run test:run

# Build for production
pnpm run build

# Preview production build
pnpm run serve

# Run E2E tests
pnpm run test:e2e
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

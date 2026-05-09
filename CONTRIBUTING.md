# Contributing to PitchPerfect

Thanks for contributing! PitchPerfect is a browser-based vocal pitch practice tool with UVR stem separation, community features, and real-time audio processing.

## Development Setup

```bash
# Clone and install
git clone <repo-url>
cd pitch-perfect-repo
npm install

# Install git hooks (blocks direct pushes to main)
git config core.hooksPath .githooks
```

**Requirements:** Node.js 18+, modern browser with Web Audio API and `getUserMedia`.

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once (CI mode) |
| `npm run test:ui` | Run Vitest with browser UI |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run fmt` | Prettier check |
| `npm run fmt:write` | Prettier auto-format |
| `npm run check:syntax` | Run all checks (typecheck + lint + fmt) |

## Git Workflow

- **Never push to `main`** — create feature branches and target `dev` for PRs
- **Never force push** — always use `git push` without `--force`
- **Never use `git reset --hard` to rebase** — use `git rebase origin <branch>`
- Commit and push after each completed task

### Branch naming convention
`feat/<description>`, `fix/<description>`, `docs/<description>`

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
│   │   ├── SettingsPanel.tsx      # Settings / About
│   │   └── ...                    # Additional components
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
│   └── tests/                     # Vitest unit tests
├── public/                        # Served by Apache (DocumentRoot)
├── docs/                          # Documentation and plans
└── vite.config.ts                 # Vite bundler config
```

## Tech Stack

- **SolidJS** — reactive UI (signals, JSX, no VDOM)
- **TypeScript** — strict mode
- **Web Audio API** — synthesis, microphone input, audio analysis
- **Canvas 2D** — piano roll, pitch visualization, waveform
- **Vitest** — unit tests (679 tests, ~20 suites)
- **Playwright** — E2E browser tests
- **Vite** — bundler + dev server

## Testing

```bash
# Run all unit tests
npm run test:run

# Run specific test file
npx vitest run src/tests/uvr-api.test.ts

# Run E2E tests (requires dev server)
npm run dev &
npm run test:e2e
```

Tests are collocated in `src/tests/`. Test files mirror the source structure (e.g., `src/lib/hash-router.ts` → `src/tests/hash-router.test.ts`).

## Build & Deploy

The production build outputs to `dist/`. The live site is served from `public/` by Apache.

```bash
npm run build         # Build to dist/
npm run serve         # Preview production build locally
./deploy.sh           # Full deploy (pull + syntax checks)
```

## Code Style

- ESLint + Prettier enforce consistent style
- Strict TypeScript with `noUnusedLocals` and `noImplicitReturns`
- Signal naming: `const [value, setValue] = createSignal<T>(default)`
- Component names: PascalCase, `.tsx` extension
- Test names: `src/tests/<module>.test.ts`
- No emoji in code — use SVG icons from `components/icons`

## EARS Specification Format

Requirements use the EARS format in `docs/ears-*.md`:

```
### REQ-XX-NNN: Requirement Title
**Priority:** High | Medium | Low
**Type:** Functional | UI | Performance | Error Handling

**Description:** One-sentence summary.

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
```

Tests reference the EARS requirement IDs they cover in file headers.

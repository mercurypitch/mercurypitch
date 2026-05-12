# Contributing to PitchPerfect

Thanks for contributing! PitchPerfect is a browser-based vocal pitch practice tool with UVR stem separation, community features, and real-time audio processing.

## Development Setup

```bash
# Clone and install
git clone <repo-url>
cd pitch-perfect-repo
pnpm install

# Install git hooks (auto-format on commit, blocks direct pushes to main)
git config core.hooksPath .githooks
```

**Requirements:** Node.js 18+, modern browser with Web Audio API and `getUserMedia`.

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start Vite dev server with HMR |
| `pnpm run build` | Production build to `dist/` |
| `pnpm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `pnpm test` | Run Vitest in watch mode |
| `pnpm run test:run` | Run Vitest once (CI mode) |
| `pnpm run test:ui` | Run Vitest with browser UI |
| `pnpm run test:e2e` | Run Playwright E2E tests |
| `pnpm run lint` | ESLint check |
| `pnpm run lint:fix` | ESLint auto-fix |
| `pnpm run fmt` | Prettier check |
| `pnpm run fmt:write` | Prettier auto-format |
| `pnpm run check:syntax` | Run all checks (typecheck + lint + fmt) |

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
│   │   ├── uvr-api.ts             # UVR REST API client
│   │   ├── uvr-processor.ts       # Client-side processing logic
│   │   ├── lyrics-service.ts      # Lyrics fetch/parse
│   │   ├── hash-router.ts         # Hash-based client routing
│   │   ├── scale-data.ts          # Music theory utilities
│   │   └── pitch-algorithms/      # Pitch detection algorithm implementations
│   ├── pages/                     # Top-level page views
│   ├── stores/                    # SolidJS signal stores
│   ├── styles/                    # Global styles and design system
│   ├── test/                      # Test utilities and helpers
│   ├── tests/                     # Vitest unit tests
│   └── types/                     # TypeScript type definitions
├── public/                        # Served by Apache (DocumentRoot)
├── docs/                          # Documentation and plans
├── scripts/                       # Build and utility scripts
├── uvr-api/                       # UVR Python API server
├── vite.config.ts                 # Vite bundler config
└── vitest.config.ts               # Vitest test config
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
pnpm run test:run

# Run specific test file
pnpm exec vitest run src/tests/uvr-api.test.ts

# Run E2E tests (requires dev server)
pnpm run dev &
pnpm run test:e2e
```

Tests are collocated in `src/tests/`. Test files mirror the source structure (e.g., `src/lib/hash-router.ts` → `src/tests/hash-router.test.ts`).

## Build & Deploy

The production build outputs to `dist/`. The live site is served from `public/` by Apache.

```bash
pnpm run build         # Build to dist/
pnpm run serve         # Preview production build locally
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

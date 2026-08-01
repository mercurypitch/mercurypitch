# Development Tools -- Usage Guide

## Available Scripts

### Code Quality

```bash
# All-in-one: typecheck + auto-fix lint + auto-format
pnpm run check

# Individual commands
pnpm run typecheck       # TypeScript: tsc --noEmit
pnpm run lint            # ESLint check
pnpm run lint:fix        # ESLint auto-fix
pnpm run fmt             # Prettier check
pnpm run fmt:write       # Prettier auto-format
pnpm run check:ci        # Full gate (read-only, no auto-fix; check:syntax = alias)
```

### Testing

```bash
# Run all tests (watch mode)
pnpm run test

# Run tests once (no watch)
pnpm run test:run

# Run tests with browser UI
pnpm run test:ui

# Run E2E tests
pnpm run test:e2e
```

### Development

```bash
# Start dev server (https://localhost:3000)
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run serve
```

### Analysis

```bash
# Bundle size analysis
pnpm run size

# Source lines of code
pnpm run lines
```

## Workflow

```bash
# 1. Start dev server
pnpm run dev

# 2. Make changes, then run checks
pnpm run check

# 3. Run tests
pnpm run test:run

# 4. Build and preview
pnpm run build && pnpm run serve
```

## Whisper transcription — real-audio check (owner-run)

The in-browser Whisper path cannot be verified by CI: the model pulls
~40 MB on first run, and the failure mode that broke it (fp16 word-
timestamp corruption) only appears on **WebGPU**, which headless CI
Chromium does not have — a CI run would exercise the healthy WASM
fallback and pass while the real path stayed broken. So the check is an
opt-in spec that self-skips unless you point it at a local vocal stem:

```bash
WHISPER_STEM=~/Downloads/_trash_staging/Heaven_Can_Wait_2015_Remaster_vocal.wav pnpm exec playwright test src/e2e/whisper-transcription-real.spec.ts --project=chromium --headed
```

It loads the stem in Lab -> Pitch Detection, transcribes, and fails on
the garbage signature (median segment span at the 0.02 s quantum, one
token dominating, or the in-app hallucination guard rejecting the run).
Any vocal stem works; a 3-5 minute one keeps it quick.

Manual equivalent, if you would rather watch it: Lab -> Pitch Detection
-> Browse Audio -> pick a vocal stem -> Transcribe. Healthy output has
varied words with human-length spans; the console line
`[PitchTestingTab:<song>] Whisper transcription complete` now names the
song, and a rejected run shows a red message instead of silently
"succeeding" with zero usable words.

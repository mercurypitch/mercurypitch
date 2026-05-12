# MercuryPitch SolidJS App — Deployment Guide

## Build Commands

```bash
# Install dependencies (first time only)
pnpm install

# Development server (runs at localhost:3000)
pnpm run dev

# Production build (outputs to App/dist/)
pnpm run build

# Type check (CI uses this)
pnpm run typecheck

# Run tests
pnpm run test
```

## What the Build Produces

`pnpm run build` generates static files in `dist/` with base path `/solid/`:

```
dist/
├── index.html
└── assets/
    ├── index-XXXXX.css
    └── index-XXXXX.js
```

## Server Deployment

The main repo has a deploy script that handles everything:

```bash
# Run from repo root (not App/)
cd /var/www/mercurypitch.com/mercury-pitch-repo
./deploy.sh
```

The deploy script:

1. Pulls latest `main` branch from GitHub
2. Runs syntax checks on JS files
3. Rebuilds the SolidJS app (`pnpm run build` in App/)
4. Verifies required files exist in `public/`
5. Apache serves from `mercury-pitch-repo/public/` (DocumentRoot)

## Vite Config Notes

- `base: '/solid/'` — all assets load from this path
- Alias `@` → `src/` for imports
- Build target: `esnext`
- Entry point: `index.html`

## For NodeDeploy UI

If you need to configure NodeDeploy or similar service:

- **Build command**: `pnpm run build`
- **Output directory**: `dist/` (or leave blank — most deploy UIs detect it)
- **Node version**: 18+ recommended

## Local Development

```bash
pnpm install
pnpm run dev    # dev server at localhost:3000
pnpm run test   # run tests
```

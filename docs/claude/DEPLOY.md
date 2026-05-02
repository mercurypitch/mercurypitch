# PitchPerfect SolidJS App — Deployment Guide

## Build Commands

```bash
# Install dependencies (first time only)
npm install

# Development server (runs at localhost:3000)
npm run dev

# Production build (outputs to App/dist/)
npm run build

# Type check (CI uses this)
npm run typecheck

# Run tests
npm run test
```

## What the Build Produces

`npm run build` generates static files in `dist/` with base path `/solid/`:

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
cd /var/www/pitchperfect.clodhost.com/pitch-perfect-repo
./deploy.sh
```

The deploy script:

1. Pulls latest `main` branch from GitHub
2. Runs syntax checks on JS files
3. Rebuilds the SolidJS app (`npm run build` in App/)
4. Verifies required files exist in `public/`
5. Apache serves from `pitch-perfect-repo/public/` (DocumentRoot)

## Vite Config Notes

- `base: '/solid/'` — all assets load from this path
- Alias `@` → `src/` for imports
- Build target: `esnext`
- Entry point: `index.html`

## For NodeDeploy UI

If you need to configure NodeDeploy or similar service:

- **Build command**: `npm run build`
- **Output directory**: `dist/` (or leave blank — most deploy UIs detect it)
- **Node version**: 18+ recommended

## Local Development

```bash
npm install
npm run dev    # dev server at localhost:3000
npm run test   # run tests
```

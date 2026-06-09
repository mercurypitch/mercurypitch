# MercuryPitch -- Deployment Guide

## Build Commands

```bash
# Install dependencies (first time only)
pnpm install

# Development server (runs at https://localhost:3000)
pnpm run dev

# Production build (outputs to dist/)
pnpm run build

# All checks (typecheck + auto-fix lint + auto-format)
pnpm run check

# Run tests
pnpm run test:run
```

## What the Build Produces

`pnpm run build` generates static files in `dist/`:

```
dist/
├── index.html
└── assets/
    ├── index-XXXXX.css
    └── index-XXXXX.js
```

## Deployment

### Cloudflare Workers (primary)

```bash
pnpm run deploy:prod      # Deploy to production (mercurypitch.com)
pnpm run deploy:dev       # Deploy to dev (dev.mercurypitch.com)
```

Both use `wrangler.jsonc` -- a lightweight static-asset Worker.

### Self-hosted (Apache)

The deploy script handles pull + build + copy to `public/`:

```bash
./deploy.sh               # Full deploy (pull + build + verify)
./deploy.sh --check-only  # Syntax checks only, no pull
```

Apache DocumentRoot: `mercury-pitch-repo/public/`

## Local Development

```bash
pnpm install
pnpm run dev    # dev server at https://localhost:3000
pnpm run check  # typecheck + lint + format
```

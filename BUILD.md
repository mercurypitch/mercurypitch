# Build Guide

## Prerequisites

- **Node.js** >= 22
- **pnpm** (latest)
- **Wrangler** CLI (bundled via `devDependencies`)

## Local Development

Install dependencies and start the Vite dev server:

```sh
pnpm install
pnpm dev
```

The app is served at `http://localhost:5173` with hot module replacement.

## Production Build

Build the optimized static bundle into `dist/`:

```sh
pnpm run build
```

To build with development-mode flags (e.g. `IS_DEV = true`):

```sh
pnpm run build:dev
```

Verify the output:

```sh
ls dist/index.html dist/assets/*.js dist/assets/*.css
```

## Deployment

### Standard Deploy (no containers)

Deploy to **production** (`mercurypitch.com`):

```sh
wrangler deploy
```

Deploy to **dev** (`dev.mercurypitch.com`):

```sh
wrangler deploy --env dev
```

Both use `wrangler.jsonc` -- a lightweight static-asset Worker with no container dependencies.

### Deploy with UVR Docker Containers (Pro)

A separate config file `wrangler.containers.jsonc` preserves the full server-side UVR processing setup. This deploys a Docker container running the ONNX vocal separation API alongside the Worker.

```sh
wrangler deploy --env dev --config wrangler.containers.jsonc
```

This provisions:

| Resource        | Value                  |
| --------------- | ---------------------- |
| Container class | `UvrContainer`         |
| Image           | `./uvr-api/Dockerfile` |
| Max instances   | 3                      |
| Instance type   | `standard-4`           |
| Durable Object  | `UVR_SERVICE` binding  |

> To tear down existing containers, delete the `UvrContainer` Durable Object from the Cloudflare dashboard under Workers & Pages > mercury-pitch-dev > Settings > Bindings.

## Quality Checks

```sh
pnpm run typecheck        # TypeScript type checking
pnpm run lint             # ESLint
pnpm run fmt              # Prettier format check
pnpm run check:syntax     # All three in sequence
```

## Testing

```sh
pnpm test                 # Vitest (watch mode)
pnpm run test:run         # Vitest (single run)
pnpm run test:e2e         # Playwright end-to-end
```

## Bundle Analysis

Check asset sizes after a production build:

```sh
pnpm run size
```

Count lines of source code:

```sh
pnpm run lines
```

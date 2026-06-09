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
pnpm run check:syntax    # All three checks (read-only, no auto-fix)
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

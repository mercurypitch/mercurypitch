# Development Tools - Usage Guide

## Available Scripts

### Code Formatting & Quality

```bash
# Check formatting (prettier)
pnpm run fmt

# Apply formatting
pnpm run fmt:write

# Lint (eslint)
pnpm run lint

# Auto-fix linting issues
pnpm run lint:fix

# Type check
pnpm run typecheck

# Build for production
pnpm run build
```

### Testing

```bash
# Run all tests (watch mode)
pnpm run test

# Run tests in watch mode with UI
pnpm run test:ui

# Run tests once (no watch)
pnpm run test:run

# Run E2E tests
pnpm run test:e2e
```

### Static Analysis & Security

```bash
# TypeScript unused exports analysis
pnpm run analyze

# Security audit (moderate severity only)
pnpm run security-scan

# Security audit (high severity only)
pnpm run security-scan:full

# SAST scan for XSS/eval/localStorage patterns
pnpm run sast

# Full quality check (lint + typecheck + security + tests)
pnpm run quality:check

# Full quality check + production build
pnpm run quality:full
```

### Development

```bash
# Start dev server
pnpm run dev

# Preview production build
pnpm run preview

# HTTP server for preview
pnpm run serve
```

## Quick Start

```bash
# 1. Start dev server
pnpm run dev

# 2. Make changes and run quality checks
pnpm run fmt && pnpm run lint && pnpm run test:run

# 3. Check for unused exports
pnpm run analyze

# 4. Security scan
pnpm run security-scan

# 5. Build and preview
pnpm run build && pnpm run preview
```

## Development Workflow

```bash
# Run full check before committing
pnpm run quality:full

# If tests fail
pnpm run test:run -- --ui  # Open test UI to debug

# If linting fails
pnpm run lint:fix

# If formatting is off
pnpm run fmt:write
```


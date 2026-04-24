# Development Tools - Usage Guide

## Available Scripts

### Code Formatting & Quality

```bash
# Check formatting (prettier)
npm run fmt

# Apply formatting
npm run fmt:write

# Lint (eslint)
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Type check
npm run typecheck

# Build for production
npm run build
```

### Testing

```bash
# Run all tests (watch mode)
npm run test

# Run tests in watch mode with UI
npm run test:ui

# Run tests once (no watch)
npm run test:run

# Run E2E tests
npm run test:e2e
```

### Static Analysis & Security

```bash
# TypeScript unused exports analysis
npm run analyze

# Security audit (moderate severity only)
npm run security-scan

# Security audit (high severity only)
npm run security-scan:full

# SAST scan for XSS/eval/localStorage patterns
npm run sast

# Full quality check (lint + typecheck + security + tests)
npm run quality:check

# Full quality check + production build
npm run quality:full
```

### Development

```bash
# Start dev server
npm run dev

# Preview production build
npm run preview

# HTTP server for preview
npm run serve
```

## Quick Start

```bash
# 1. Start dev server
npm run dev

# 2. Make changes and run quality checks
npm run fmt && npm run lint && npm run test:run

# 3. Check for unused exports
npm run analyze

# 4. Security scan
npm run security-scan

# 5. Build and preview
npm run build && npm run preview
```

## Development Workflow

```bash
# Run full check before committing
npm run quality:full

# If tests fail
npm run test:run -- --ui  # Open test UI to debug

# If linting fails
npm run lint:fix

# If formatting is off
npm run fmt:write
```
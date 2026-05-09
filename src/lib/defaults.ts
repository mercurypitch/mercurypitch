// ============================================================
// App Defaults — Centralised environment & build-time constants
// ============================================================
//
// All `import.meta.env` access is isolated here so the rest of
// the codebase uses plain, well-named constants.

import packageJson from '../../package.json'

// ── Build mode flags ──────────────────────────────────────────

/** True when running `npm run dev` or built with `--mode development` */
export const IS_DEV = import.meta.env.DEV || import.meta.env.MODE === 'development'

/** True when running inside Vitest or an E2E test harness. */
export const IS_TEST = import.meta.env.MODE === 'test'

// ── App metadata ──────────────────────────────────────────────

/** Semantic version from package.json (e.g. "0.1.2"). */
export const APP_VERSION = packageJson.version

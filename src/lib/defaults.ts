// ============================================================
// App Defaults — Centralised environment & build-time constants
// ============================================================
//
// All `import.meta.env` access is isolated here so the rest of
// the codebase uses plain, well-named constants.

import packageJson from '../../package.json'

// ── Build mode flags ──────────────────────────────────────────

/** True when running `npm run dev` or built with `--mode development` */
export const IS_DEV =
  import.meta.env.DEV || import.meta.env.MODE === 'development'

/** True when running inside Vitest or an E2E test harness. */
export const IS_TEST = import.meta.env.MODE === 'test'

// ── App metadata ──────────────────────────────────────────────

/** Semantic version from package.json (e.g. "0.1.2"). */
export const APP_VERSION = packageJson.version

/** Git commit SHA injected by Vite. */
export const COMMIT_SHA =
  typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'unknown'

// ── Domains (from .env / .env.local) ─────────────────────────

export const PROD_DOMAIN =
  import.meta.env.VITE_PROD_DOMAIN ?? 'mercurypitch.com'
export const DEV_DOMAIN =
  import.meta.env.VITE_DEV_DOMAIN ?? 'dev.mercurypitch.com'

export function getUvrApiBase(): string {
  return IS_DEV
    ? `https://${DEV_DOMAIN}/api/uvr`
    : `https://${PROD_DOMAIN}/api/uvr`
}

// ── UVR Model Configuration ──────────────────────────────────

/**
 * Base URL for ONNX models.
 * In production/test, we default to R2 because Cloudflare Pages has a 25MB file size limit.
 * In development, we allow VITE_MODEL_BASE to override (e.g. "" for local proxying).
 */
export const UVR_MODEL_BASE =
  import.meta.env.VITE_OVERRIDE_ONNX_MODEL ??
  'https://pub-2aafe9bb91454abb998beb378a16d44a.r2.dev'

export const UVR_MODEL_FILENAME = 'UVR-MDX-NET-Inst_HQ_3.onnx'

/** Full path to the main UVR model file. */
export const UVR_MODEL_PATH = `${UVR_MODEL_BASE ?? ''}/models/${UVR_MODEL_FILENAME}`

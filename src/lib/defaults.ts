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

/** True only for an immutable pull-request preview build. */
export const IS_PR_PREVIEW = import.meta.env.VITE_PR_PREVIEW === 'true'

/**
 * Premium features that depend on cloud storage of users' songs (cross-device
 * share links, reopening a separated session on another device, etc.). OFF by
 * default until cloud sync ships; opt in with VITE_PREMIUM_FEATURES=true.
 */
export const PREMIUM_FEATURES = import.meta.env.VITE_PREMIUM_FEATURES === 'true'

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

/**
 * Whether a page on `hostname` may write diagnostics to its console.
 *
 * `IS_DEV` alone is not the answer: the dev site is a *production* build
 * served from another domain, so a trace that only exists under `pnpm dev`
 * cannot be read off the phone it was written for. So: the local dev server,
 * a PR preview, and the dev domain — and nothing else. An unrecognised host
 * stays quiet, because a visitor's console is not a debugging surface.
 *
 * The one addition is the dev-log relay. `vite preview --host` serves the
 * real bundle to a phone over the LAN, at an IP that matches none of the
 * above — so the build worth debugging was the one build that said nothing.
 * The relay is a dev-server plugin behind an env flag; a page carrying its
 * shim is by construction one a developer is watching.
 *
 * A function so the rule can be tested; the constant below is the wiring.
 */
export function isDiagnosticHost(input: {
  isDev: boolean
  isPreview: boolean
  /** `null` where there is no location at all. */
  hostname: string | null
  devDomain: string
  /** Whether the dev-log relay's shim is on the page. */
  hasDevLogRelay?: boolean
}): boolean {
  if (input.isDev || input.isPreview || input.hasDevLogRelay === true) {
    return true
  }
  return input.hostname !== null && input.hostname === input.devDomain
}

/**
 * Whether this page may write diagnostics to the console. `location` is
 * guarded rather than assumed: this module is imported from workers and from
 * Vitest, where it may not be a Window's.
 */
export const IS_DIAGNOSTIC_BUILD: boolean = isDiagnosticHost({
  isDev: IS_DEV,
  isPreview: IS_PR_PREVIEW,
  // `globalThis.location`, not the bare global: the lint rule is right that
  // an unqualified `location` is ambiguous, and this module is loaded in
  // workers as well as in the page.
  hostname: globalThis.location?.hostname ?? null,
  devDomain: DEV_DOMAIN,
  // Set by the relay's shim, which is injected head-prepend — so it is
  // already there when this module is first evaluated.
  hasDevLogRelay:
    (globalThis as { __MP_DEV_LOG_RELAY__?: boolean }).__MP_DEV_LOG_RELAY__ ===
    true,
})

/** When set, the app connects to a remote API instead of local IndexedDB. */
export const API_BASE_URL: string | undefined = import.meta.env
  .VITE_API_BASE_URL

/**
 * Google Ads global site tag id (`AW-XXXXXXXXXX`). Empty unless explicitly set
 * for a build, so dev / test / tour builds never load the tag, show the consent
 * banner, or hit Google. Set `VITE_GOOGLE_ADS_TAG_ID=AW-18321142458` in the
 * production build only.
 */
export const GOOGLE_ADS_TAG_ID: string =
  import.meta.env.VITE_GOOGLE_ADS_TAG_ID ?? ''

/**
 * Cloudflare Turnstile public site key. Empty unless explicitly set for a build.
 */
export const TURNSTILE_SITE_KEY: string =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

/**
 * Google Analytics 4 measurement id (`G-XXXXXXXXXX`) for behaviour analytics
 * (dwell, retention, journeys). Empty unless set for a build, so dev / test /
 * tour builds stay inert. Loaded through the same gtag + Consent Mode as the
 * ad tag. Set `VITE_GA4_MEASUREMENT_ID` in the production build only.
 */
export const GA4_MEASUREMENT_ID: string =
  import.meta.env.VITE_GA4_MEASUREMENT_ID ?? ''

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
  (import.meta.env.DEV
    ? ''
    : 'https://pub-2aafe9bb91454abb998beb378a16d44a.r2.dev')

export const UVR_MODEL_FILENAME = 'UVR-MDX-NET-Inst_HQ_3.onnx'

/** Full path to the main UVR model file. */
export const UVR_MODEL_PATH = `${UVR_MODEL_BASE ?? ''}/models/${UVR_MODEL_FILENAME}`

// ── ONNX WASM paths ──────────────────────────────────────
//
// Gone from here. The base URL, its CDN fallback and the runtime
// configuration live in @irchiinnuss/pitch-engine now, because the detector
// that needs them does. `src/lib/pitch-engine-assets.ts` is the single place
// that still reads VITE_ONNX_WASM_BASE_URL and hands it to the package — the
// one deliberate exception to this file being the only reader of env.

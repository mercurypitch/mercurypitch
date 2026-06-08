// ============================================================
// App Defaults — Centralised environment & build-time constants
// ============================================================
//
// All `import.meta.env` access is isolated here so the rest of
// the codebase uses plain, well-named constants.

import type ort from 'onnxruntime-web'
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

/** When set, the app connects to a remote API instead of local IndexedDB. */
export const API_BASE_URL: string | undefined = import.meta.env
  .VITE_API_BASE_URL

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

// ── ONNX WASM Paths and Fallback ─────────────────────────────

export const CDN_FALLBACK =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/'
let cachedValidatedWasmBase: string | null = null

/**
 * Validates and returns the active WASM base URL.
 * Checks the configured VITE_ONNX_WASM_BASE_URL first, and falls back to CDN_FALLBACK if it fails.
 */
export async function getValidatedWasmBase(): Promise<string> {
  if (cachedValidatedWasmBase !== null) return cachedValidatedWasmBase

  const envWasmBase = import.meta.env.VITE_ONNX_WASM_BASE_URL
  const hasEnvBase = typeof envWasmBase === 'string' && envWasmBase.length > 0
  const envWasmBaseStr = hasEnvBase ? (envWasmBase as string) : ''

  const primaryBase = hasEnvBase
    ? envWasmBaseStr.endsWith('/')
      ? envWasmBaseStr
      : `${envWasmBaseStr}/`
    : CDN_FALLBACK
  const secondaryBase = hasEnvBase ? CDN_FALLBACK : null

  const testBase = async (base: string, label: string): Promise<boolean> => {
    try {
      const checkUrl = `${base}ort-wasm-simd-threaded.mjs`
      const resp = await fetch(checkUrl)
      if (!resp.ok) {
        console.warn(
          `[WasmBase] ${label} base check failed for URL: ${checkUrl} with status: ${resp.status} ${resp.statusText}`,
        )
        return false
      }
      return true
    } catch (err) {
      console.warn(
        `[WasmBase] ${label} base check failed for URL: ${base} due to network/CORS error:`,
        err,
      )
      return false
    }
  }

  if (await testBase(primaryBase, 'Primary')) {
    cachedValidatedWasmBase = primaryBase
    return primaryBase
  }

  if (secondaryBase !== null && (await testBase(secondaryBase, 'Secondary'))) {
    console.warn(
      `[WasmBase] Primary base ${primaryBase} failed. Falling back to secondary ${secondaryBase}`,
    )
    cachedValidatedWasmBase = secondaryBase
    return secondaryBase
  }

  // If everything fails, return the primary as a final fallback
  cachedValidatedWasmBase = primaryBase
  return primaryBase
}

export function configureWasmPaths(
  ortInstance: typeof ort,
  base: string,
): void {
  ortInstance.env.wasm.numThreads = navigator.hardwareConcurrency || 4
  ortInstance.env.wasm.wasmPaths = base
}

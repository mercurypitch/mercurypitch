// ============================================================
// Pitch engine asset resolution — the root app's side of it
// ============================================================
//
// The engine package carries no `import.meta.env` coupling on purpose: it is
// consumed by the web app, the native app and Beside Cue, and each serves the
// onnxruntime wasm and the SwiftF0 model from a different place. Every root
// build reads its own env here and hands the answer over once at boot.

import { configurePitchEngineAssets } from '@irchiinnuss/pitch-engine/assets'

/** Where the root app publishes the SwiftF0 model, from `public/models`. */
export const ROOT_MODEL_PATH = '/models/swiftf0.onnx'

/**
 * Configure the engine from `VITE_ONNX_WASM_BASE_URL`.
 *
 * The semantics are the ones the root app has always had: with the variable
 * set the build serves its own copy of the onnxruntime dist and the CDN is
 * only the fallback when that copy does not answer; with it unset there is no
 * local copy to try and the CDN is the single source. Leaving `wasmBase`
 * unpassed — rather than passing an empty string — is what keeps the second
 * case from probing a base that does not exist.
 */
export function configurePitchEngineAssetsFromEnv(): void {
  const envBase = import.meta.env.VITE_ONNX_WASM_BASE_URL
  const wasmBase =
    typeof envBase === 'string' && envBase.length > 0 ? envBase : undefined

  configurePitchEngineAssets({
    ...(wasmBase !== undefined ? { wasmBase } : {}),
    modelPath: ROOT_MODEL_PATH,
  })
}

// Runs on import, not only from the boot files: a worker is its own module
// graph with its own copy of the engine's asset state, and the root fork used
// to read the env inside every graph that reached it. Both detector shims
// import this module for the effect, so any graph that can reach
// SwiftF0Detector.init() through src/lib -- the page, the separator worker,
// the stem-transcription worker, the next worker someone writes -- is
// configured before its first init(). The explicit calls in the boot files
// repeat it; that is harmless and keeps the intent where startup is read.
configurePitchEngineAssetsFromEnv()

/** Asset locations for the ONNX runtime and pitch model.
 *
 * The package carries no import.meta.env coupling: the consuming app calls
 * configurePitchEngineAssets() once at boot with its own base URLs. Without
 * configuration the wasm loads from the jsDelivr CDN and the model from
 * /models/swiftf0.onnx, matching the root app's public layout.
 */
import type ort from 'onnxruntime-web'

export const CDN_FALLBACK =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/'

export const DEFAULT_MODEL_PATH = '/models/swiftf0.onnx'

let configuredWasmBase: string | null = null
let configuredModelPath: string | null = null
let cachedValidatedWasmBase: string | null = null

export interface PitchEngineAssetConfig {
  /** Base URL serving the onnxruntime-web dist files (ort-wasm-*.mjs/.wasm). */
  wasmBase?: string
  /** URL of the SwiftF0 ONNX model. */
  modelPath?: string
}

export function configurePitchEngineAssets(
  config: PitchEngineAssetConfig,
): void {
  if (config.wasmBase !== undefined) {
    configuredWasmBase = config.wasmBase.endsWith('/')
      ? config.wasmBase
      : `${config.wasmBase}/`
    cachedValidatedWasmBase = null
  }
  if (config.modelPath !== undefined) configuredModelPath = config.modelPath
}

export function pitchEngineModelPath(): string {
  return configuredModelPath ?? DEFAULT_MODEL_PATH
}

/**
 * Validates and returns the active WASM base URL: the configured base first,
 * falling back to the CDN when the configured base does not respond.
 */
export async function getValidatedWasmBase(): Promise<string> {
  if (cachedValidatedWasmBase !== null) return cachedValidatedWasmBase

  const primaryBase = configuredWasmBase ?? CDN_FALLBACK
  const secondaryBase = configuredWasmBase !== null ? CDN_FALLBACK : null

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

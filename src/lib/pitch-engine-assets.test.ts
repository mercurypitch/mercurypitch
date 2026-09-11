import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * A fresh module registry per case: the engine caches the validated base in
 * module state, and a test that inherited another test's cache would pass
 * without the code under test having done anything.
 */
async function bootWith(envBase: string | undefined): Promise<{
  getValidatedWasmBase: () => Promise<string>
  pitchEngineModelPath: () => string
  CDN_FALLBACK: string
}> {
  vi.resetModules()
  vi.stubEnv('VITE_ONNX_WASM_BASE_URL', envBase as string)
  // Deliberately the barrel, while the module under test uses the `/assets`
  // subpath: the configuration only works because both reach one module.
  const engine = await import('@irchiinnuss/pitch-engine')
  const { configurePitchEngineAssetsFromEnv } =
    await import('./pitch-engine-assets')
  configurePitchEngineAssetsFromEnv()
  return engine
}

function stubFetch(reachable: (url: string) => boolean): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      reachable(url)
        ? { ok: true, status: 200, statusText: 'OK' }
        : { ok: false, status: 404, statusText: 'Not Found' },
    ),
  )
}

describe('configurePitchEngineAssetsFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('serves the wasm from the build when VITE_ONNX_WASM_BASE_URL is set', async () => {
    stubFetch(() => true)
    const engine = await bootWith('/ort/')

    expect(await engine.getValidatedWasmBase()).toBe('/ort/')
  })

  it('normalises a base given without its trailing slash', async () => {
    stubFetch(() => true)
    const engine = await bootWith('/ort')

    expect(await engine.getValidatedWasmBase()).toBe('/ort/')
  })

  it('falls back to the CDN when the configured base does not answer', async () => {
    const engine = await bootWith('/ort/')
    stubFetch((url) => url.startsWith('https://'))

    expect(await engine.getValidatedWasmBase()).toBe(engine.CDN_FALLBACK)
  })

  it('uses the CDN alone when the variable is empty', async () => {
    stubFetch(() => true)
    const engine = await bootWith('')

    expect(await engine.getValidatedWasmBase()).toBe(engine.CDN_FALLBACK)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('uses the CDN alone when the variable is absent', async () => {
    stubFetch(() => true)
    const engine = await bootWith(undefined)

    expect(await engine.getValidatedWasmBase()).toBe(engine.CDN_FALLBACK)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('always points the model at the root app public path', async () => {
    stubFetch(() => true)
    const engine = await bootWith('/ort/')

    expect(engine.pitchEngineModelPath()).toBe('/models/swiftf0.onnx')
  })
})

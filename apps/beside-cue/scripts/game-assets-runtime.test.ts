// Pitch runtime packaging — main and worker imports use the staged CPU WASM pair.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, loadConfigFromFile } from 'vite'
import { expect, it } from 'vitest'

it('uses the external CPU runtime for both the page and module worker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'beside-cue-pitch-runtime-'))
  try {
    const config = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    )
    expect(config).not.toBeNull()
    const detector = fileURLToPath(
      new URL(
        '../../../packages/pitch-engine/src/swift-f0-detector.ts',
        import.meta.url,
      ),
    )
    writeFileSync(
      join(root, 'index.html'),
      '<script type="module" src="/main.ts"></script>',
    )
    writeFileSync(
      join(root, 'main.ts'),
      `
      import { SwiftF0Detector } from ${JSON.stringify(detector)}
      globalThis.detector = new SwiftF0Detector()
      globalThis.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    `,
    )
    writeFileSync(
      join(root, 'worker.ts'),
      `
      import { SwiftF0Detector } from ${JSON.stringify(detector)}
      self.onmessage = async () => self.postMessage(await new SwiftF0Detector().init())
    `,
    )
    await build({
      root,
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      resolve: config!.config.resolve,
      worker: { format: 'es' },
      build: { minify: false },
    })
    const assets = join(root, 'dist/assets')
    const files = readdirSync(assets)
    expect(files.some((file) => file.endsWith('.wasm'))).toBe(false)
    const javascript = files
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFileSync(join(assets, file), 'utf8'))
    expect(
      javascript.some((source) =>
        source.includes('ort-wasm-simd-threaded.mjs'),
      ),
    ).toBe(true)
    for (const source of javascript)
      expect(source.includes('ort-wasm-simd-threaded.jsep')).toBe(false)
    expect(files.some((file) => file.startsWith('worker-'))).toBe(true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)

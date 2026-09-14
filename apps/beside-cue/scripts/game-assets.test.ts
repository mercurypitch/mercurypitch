// ============================================================
// Game asset packaging — exercise Vite's real public-copy lifecycle
// ============================================================

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gameAssetsPlugin } from './game-assets'

let root: string
const seed = (file: string, content: string): void => {
  const path = join(root, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}
const contents = (file: string): string =>
  readFileSync(join(root, file), 'utf8')
const compile = (enabled: boolean, outDir = 'output', rollupDir?: string) =>
  build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [gameAssetsPlugin(enabled, join(root, 'runtime'))],
    build: {
      outDir,
      minify: false,
      rollupOptions:
        rollupDir === undefined ? {} : { output: { dir: rollupDir } },
    },
  })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'beside-cue-game-assets-'))
  seed('index.html', '<main>Beside Cue<img src="/art/record.svg"></main>')
  seed('public/art/record.svg', '<svg/>')
  seed('public/games/glass3d/merc.glb', 'merc source')
  seed('public/models/swiftf0.onnx', 'model source')
  seed('public/ort/stale.wasm', 'stale public runtime')
  seed('runtime/ort-wasm-simd-threaded.mjs', 'runtime module')
  seed('runtime/ort-wasm-simd-threaded.wasm', 'runtime wasm')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('direct Vite game asset packaging', () => {
  it.each(['public', 'public/nested', 'public/..nested', '.'])(
    'refuses output overlapping public sources: %s',
    async (output) => {
      await expect(compile(false, output)).rejects.toThrow(
        'separate from public sources',
      )
      expect(contents('public/games/glass3d/merc.glb')).toBe('merc source')
    },
  )

  it('rejects a Rollup output override inside public before copying files', async () => {
    await expect(compile(false, 'output', 'public/games')).rejects.toThrow(
      'separate from public sources',
    )
    expect(contents('public/games/glass3d/merc.glb')).toBe('merc source')
  })

  it('excludes every game asset when off, preserving public sources and app art', async () => {
    await compile(false)
    for (const directory of ['games', 'models', 'ort'])
      expect(existsSync(join(root, 'output', directory))).toBe(false)
    expect(contents('output/art/record.svg')).toBe('<svg/>')
    expect(contents('public/games/glass3d/merc.glb')).toBe('merc source')
    expect(contents('public/models/swiftf0.onnx')).toBe('model source')
    expect(contents('public/ort/stale.wasm')).toBe('stale public runtime')
  })

  it('ships the configured local runtime and model without a prebuild, then switches off cleanly', async () => {
    await compile(true)
    expect(contents('output/ort/ort-wasm-simd-threaded.mjs')).toBe(
      'runtime module',
    )
    expect(contents('output/ort/ort-wasm-simd-threaded.wasm')).toBe(
      'runtime wasm',
    )
    expect(contents('output/models/swiftf0.onnx')).toBe('model source')
    expect(contents('output/games/glass3d/merc.glb')).toBe('merc source')
    expect(existsSync(join(root, 'output/ort/stale.wasm'))).toBe(false)
    await compile(false)
    for (const directory of ['games', 'models', 'ort'])
      expect(existsSync(join(root, 'output', directory))).toBe(false)
  })

  it('refuses a missing runtime even if a stale public copy exists', async () => {
    seed('public/ort/ort-wasm-simd-threaded.wasm', 'outdated runtime')
    rmSync(join(root, 'runtime/ort-wasm-simd-threaded.wasm'))
    await expect(compile(true)).rejects.toThrow('ENOENT')
  })

  it('fails an enabled build with no local pitch model', async () => {
    rmSync(join(root, 'public/models/swiftf0.onnx'))
    await expect(compile(true)).rejects.toThrow('missing models/swiftf0.onnx')
  })
})

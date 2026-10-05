// ============================================================
// Game asset packaging — exercise Vite's real public-copy lifecycle
// ============================================================

import { GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS, GLASS_GAME_REQUIRED_FILES, } from '@irchiinnuss/glass-game/assets'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gameAssetsPlugin, NATIVE_DESKTOP_ONLY_GAME_ASSETS, NATIVE_EXCLUDED_GAME_ASSETS, } from './game-assets'

const R3_NATIVE_GAME_ASSETS = [
  'games/adventure-v2/platform-kit.glb',
  'games/adventure-v2/garden-kit.glb',
  'games/adventure-v5/painting-garden.webp',
] as const

// The in-app runner needs these before its first frame, even though the
// standalone Glassworks preview uses the same dressing.
const RUNNER_SCENERY_GAME_ASSETS = [
  'games/adventure-v3/garden-arcade.glb',
  'games/adventure-v3/observatory-canopy.glb',
] as const

const CURRENT_DELIVERY_GAME_ASSETS = GLASS_GAME_REQUIRED_FILES.filter(
  (asset) =>
    (asset.startsWith('singing-current-walls-v1/') && asset.endsWith('.glb')) ||
    (asset.startsWith('shatter-sounds-v1/') && asset.endsWith('.mp3')) ||
    (asset.startsWith('adventure-v2/textures/') &&
      asset.endsWith('-normal.webp')),
).map((asset) => `games/${asset}`)
const UNKNOWN_GAME_ASSETS = [
  'games/future-v1/retained.bin',
  'games/adventure-v2/textures/future-normal.png',
] as const

let root: string
const seed = (file: string, content: string): void => {
  const path = join(root, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}
const contents = (file: string): string =>
  readFileSync(join(root, file), 'utf8')
const compile = (
  enabled: boolean,
  outDir = 'output',
  rollupDir?: string,
  nativeProfile = false,
) =>
  build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [gameAssetsPlugin(enabled, join(root, 'runtime'), nativeProfile)],
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
  for (const asset of NATIVE_EXCLUDED_GAME_ASSETS)
    seed(`public/${asset}`, `${asset} source`)
  for (const asset of [
    ...R3_NATIVE_GAME_ASSETS,
    ...RUNNER_SCENERY_GAME_ASSETS,
    ...CURRENT_DELIVERY_GAME_ASSETS,
    ...UNKNOWN_GAME_ASSETS,
  ])
    seed(`public/${asset}`, `${asset} source`)
  for (const { mobile } of GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS)
    seed(`public/games/${mobile}`, `${mobile} source`)
  seed('public/models/swiftf0.onnx', 'model source')
  seed('public/ort/stale.wasm', 'stale public runtime')
  seed('runtime/ort-wasm-simd-threaded.mjs', 'runtime module')
  seed('runtime/ort-wasm-simd-threaded.wasm', 'runtime wasm')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('direct Vite game asset packaging', () => {
  it('retains the in-app runner scenery in a native Vite build', async () => {
    await compile(true, 'output', undefined, true)
    for (const asset of RUNNER_SCENERY_GAME_ASSETS) {
      expect(existsSync(join(root, 'output', asset)), asset).toBe(true)
      expect(contents(`output/${asset}`)).toBe(`${asset} source`)
    }
  })

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
    for (const asset of NATIVE_EXCLUDED_GAME_ASSETS)
      expect(contents(`output/${asset}`)).toBe(`${asset} source`)
    for (const asset of [
      ...CURRENT_DELIVERY_GAME_ASSETS,
      ...UNKNOWN_GAME_ASSETS,
    ])
      expect(contents(`output/${asset}`)).toBe(`${asset} source`)
    for (const { mobile } of GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS)
      expect(contents(`output/games/${mobile}`)).toBe(`${mobile} source`)
    expect(existsSync(join(root, 'output/ort/stale.wasm'))).toBe(false)
    await compile(false)
    for (const directory of ['games', 'models', 'ort'])
      expect(existsSync(join(root, 'output', directory))).toBe(false)
  })

  it('omits only native-excluded bytes and retains every mobile alternative', async () => {
    await compile(true, 'output', undefined, true)
    for (const asset of NATIVE_EXCLUDED_GAME_ASSETS) {
      expect(existsSync(join(root, 'output', asset))).toBe(false)
      expect(contents(`public/${asset}`)).toBe(`${asset} source`)
    }
    expect(NATIVE_DESKTOP_ONLY_GAME_ASSETS).toHaveLength(
      GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS.length,
    )
    for (const { mobile } of GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS)
      expect(contents(`output/games/${mobile}`)).toBe(`${mobile} source`)
    expect(
      CURRENT_DELIVERY_GAME_ASSETS.filter((asset) => asset.endsWith('.glb')),
    ).toHaveLength(10)
    expect(
      CURRENT_DELIVERY_GAME_ASSETS.filter((asset) => asset.endsWith('.mp3')),
    ).toHaveLength(14)
    expect(
      CURRENT_DELIVERY_GAME_ASSETS.filter((asset) => asset.endsWith('.webp')),
    ).toHaveLength(4)
    for (const asset of [
      ...R3_NATIVE_GAME_ASSETS,
      ...CURRENT_DELIVERY_GAME_ASSETS,
      ...UNKNOWN_GAME_ASSETS,
    ])
      expect(contents(`output/${asset}`)).toBe(`${asset} source`)
    expect(contents('output/games/glass3d/merc.glb')).toBe('merc source')
    expect(contents('output/models/swiftf0.onnx')).toBe('model source')
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

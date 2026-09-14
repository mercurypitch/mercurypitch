// ============================================================
// Game assets — stage the build's public files without changing their sources
// ============================================================
//
// CI and native packaging invoke Vite directly, so package prebuild hooks
// cannot own these files. The module alias removes game code; this plugin
// handles public assets, which Vite otherwise copies regardless of imports.

import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

const ORT_FILES = [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
] as const

const runtimeDirectory = (): string => {
  const appRequire = createRequire(new URL('../package.json', import.meta.url))
  const engineRequire = createRequire(
    appRequire.resolve('@irchiinnuss/pitch-engine'),
  )
  return resolve(
    dirname(dirname(engineRequire.resolve('onnxruntime-web'))),
    'dist',
  )
}

/** `runtimeDir` permits a local runtime fixture in the real Vite build tests. */
export function gameAssetsPlugin(
  gamesEnabled: boolean,
  runtimeDir?: string,
): Plugin {
  let config: ResolvedConfig
  const assertOutput = (output: string): void => {
    if (!config.publicDir) return
    const contains = (parent: string, child: string): boolean => {
      const path = relative(parent, child)
      return (
        path === '' ||
        (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))
      )
    }
    const publicDir = resolve(config.publicDir)
    if (contains(publicDir, output) || contains(output, publicDir)) {
      throw new Error('Game asset output must be separate from public sources')
    }
  }
  const copyRuntime = (destination: string): void => {
    const source = runtimeDir ?? runtimeDirectory()
    mkdirSync(destination, { recursive: true })
    for (const file of ORT_FILES)
      copyFileSync(resolve(source, file), resolve(destination, file))
  }
  return {
    name: 'beside-cue-game-assets',
    configResolved(resolved) {
      config = resolved
      // Validate before Vite empties/copies output, including Rollup overrides.
      assertOutput(resolve(config.root, config.build.outDir))
      const output = config.build.rollupOptions.output
      for (const target of Array.isArray(output) ? output : [output]) {
        if (target?.dir) assertOutput(resolve(config.root, target.dir))
      }
    },
    configureServer() {
      if (gamesEnabled && config.publicDir)
        copyRuntime(resolve(config.publicDir, 'ort'))
    },
    // Public files have been copied by this point, including stale ORT files
    // left by a previous local dev session. Only the output is cleaned.
    writeBundle(options) {
      const output = resolve(config.root, options.dir ?? config.build.outDir)
      assertOutput(output)
      rmSync(resolve(output, 'ort'), { recursive: true, force: true })
      if (!gamesEnabled) {
        for (const directory of ['games', 'models'])
          rmSync(resolve(output, directory), { recursive: true, force: true })
        return
      }
      if (!existsSync(resolve(output, 'models/swiftf0.onnx'))) {
        throw new Error('Games build is missing models/swiftf0.onnx')
      }
      copyRuntime(resolve(output, 'ort'))
    },
  }
}

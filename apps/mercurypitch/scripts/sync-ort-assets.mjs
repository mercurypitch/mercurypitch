// Vendors everything the pitch engine loads at runtime into the staged
// publicDir, so the microphone works on a plane.
//
// Without this the engine falls back to jsDelivr for the wasm runtime
// (packages/pitch-engine/src/assets.ts:10-11) and to /models/swiftf0.onnx for
// the model. Both are fine in a browser tab and neither is acceptable in an
// app binary: the first request a singer makes is the one that starts the
// microphone, and it must not depend on a CDN.
//
// Two things are copied, from two different places:
//   - the onnxruntime-web wasm pair, out of the engine's own module graph
//   - the SwiftF0 model, out of the web app's public/ tree
//
// Exported as `syncOrtAssets()` and called from `sync-native-assets.mjs`,
// which a Vite plugin in vite.config.ts runs -- NOT from an npm lifecycle
// hook. A `prebuild` hook is
// bypassed by `pnpm exec vite build` -- which is exactly how CI builds, to
// avoid repeating tsc -- so the hook version of this shipped a bundle with no
// vendored assets at all and the CI asset check caught it on the first run.
// A plugin cannot be bypassed: every build that loads this config runs it.
//
// Still runnable directly (`node scripts/sync-ort-assets.mjs`) for a one-off;
// with no argument it fills the same staged directory the build uses.
//
// The output root is .native-public/, which is gitignored in full: everything
// in it is copied there by a build, and one copy of the wasm runtime and the
// SwiftF0 model in the repository (the web app's public/ tree) is better than
// two that can drift.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @param {string} [outRoot] Where to vendor into. Defaults to the staged
 *   publicDir, which is what every build and dev server wants; a caller passes
 *   its own only to stage somewhere else.
 */
export function syncOrtAssets(outRoot = join(here, '../.native-public')) {
  // onnxruntime-web is a dependency of the pitch engine, not of this app, so it
  // is resolved from the engine's own module graph — pnpm keeps graphs strict
  // and a bare resolve from here would miss.
  const appRequire = createRequire(import.meta.url)
  const engineRequire = createRequire(
    appRequire.resolve('@irchiinnuss/pitch-engine'),
  )
  const ortDist = join(
    dirname(dirname(engineRequire.resolve('onnxruntime-web'))),
    'dist',
  )

  const ortOut = join(outRoot, 'ort')
  mkdirSync(ortOut, { recursive: true })
  for (const file of [
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.wasm',
  ]) {
    const from = join(ortDist, file)
    if (!existsSync(from)) {
      throw new Error(
        `[sync-ort-assets] ${file} not found at ${from}. onnxruntime-web's dist layout changed; ` +
          `fix this script rather than letting the build fall back to the CDN.`,
      )
    }
    copyFileSync(from, join(ortOut, file))
  }

  // The model lives in the web app's public tree, which this app deliberately
  // does NOT copy wholesale — it also holds the night-app packs and the drum
  // kits, none of which belong in a V1-1 binary. The pictures the V1-1 surfaces
  // DO need are named one at a time in ../native-assets.mjs and staged beside
  // this model by sync-native-assets.mjs.
  const modelSrc = join(here, '../../../public/models/swiftf0.onnx')
  const modelOut = join(outRoot, 'models')
  if (!existsSync(modelSrc)) {
    throw new Error(
      `[sync-ort-assets] SwiftF0 model not found at ${modelSrc}. Without it the engine ` +
        `requests /models/swiftf0.onnx at runtime and a cold offline start has no pitch detection.`,
    )
  }
  mkdirSync(modelOut, { recursive: true })
  copyFileSync(modelSrc, join(modelOut, 'swiftf0.onnx'))

  return { ortOut, modelOut }
}

// Direct invocation stays supported.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { ortOut, modelOut } = syncOrtAssets()
  console.log(`[sync-ort-assets] wasm -> ${ortOut}`)
  console.log(`[sync-ort-assets] model -> ${modelOut}`)
}

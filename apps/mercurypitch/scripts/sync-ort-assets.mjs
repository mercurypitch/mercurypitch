// Vendors everything the pitch engine loads at runtime into public/, so the
// microphone works on a plane.
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
// Runs before dev and before build. public/ort and public/models stay
// gitignored — they are build inputs, not sources.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// onnxruntime-web is a dependency of the pitch engine, not of this app, so it
// is resolved from the engine's own module graph — pnpm keeps graphs strict
// and a bare resolve from here would miss.
const appRequire = createRequire(import.meta.url)
const engineRequire = createRequire(appRequire.resolve('@irchiinnuss/pitch-engine'))
const ortDist = join(dirname(dirname(engineRequire.resolve('onnxruntime-web'))), 'dist')

const ortOut = join(here, '../public/ort')
mkdirSync(ortOut, { recursive: true })
for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
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
// does NOT copy wholesale — it also holds legends, room art and the night-app
// bundles, none of which belong in a voice-only V1-1 binary.
const modelSrc = join(here, '../../../public/models/swiftf0.onnx')
const modelOut = join(here, '../public/models')
if (!existsSync(modelSrc)) {
  throw new Error(
    `[sync-ort-assets] SwiftF0 model not found at ${modelSrc}. Without it the engine ` +
      `requests /models/swiftf0.onnx at runtime and a cold offline start has no pitch detection.`,
  )
}
mkdirSync(modelOut, { recursive: true })
copyFileSync(modelSrc, join(modelOut, 'swiftf0.onnx'))

console.log(`[sync-ort-assets] wasm -> ${ortOut}`)
console.log(`[sync-ort-assets] model -> ${modelOut}`)

// Copies the onnxruntime-web wasm pair the pitch engine needs into
// public/ort so games work offline (Capacitor webview has no CDN
// guarantee). Runs before dev and build; public/ort stays gitignored.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// onnxruntime-web is a dependency of the pitch engine, not of this app, so
// resolve it from the engine's own module graph (pnpm keeps graphs strict).
const appRequire = createRequire(import.meta.url)
const engineRequire = createRequire(
  appRequire.resolve('@irchiinnuss/pitch-engine'),
)
const distDir = dirname(dirname(engineRequire.resolve('onnxruntime-web')))
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../public/ort')

mkdirSync(outDir, { recursive: true })
for (const file of [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
]) {
  copyFileSync(join(distDir, 'dist', file), join(outDir, file))
}
console.log(`[sync-ort-assets] copied wasm runtime to ${outDir}`)

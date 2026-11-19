// window.mjs <proj> <fps> <out.mp4> [from = 488]: render the frames from <from> to <from> + 8 s of <proj>'s root and nothing
// else. The renderer's own plan (all of the root's frames, its video cut) is made, then only the chunk
// that starts at <from> is captured (HyperFrames 0.8.97's distributed plan/renderChunk: the same stages
// as `hyperframes render`, with a frame range). 240 frames a chunk at 30 fps, 480 at 60: chunk 61.
import { rmSync, renameSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
const H = '/root/.npm/_npx/f293411582888030/node_modules/hyperframes/dist/chunk-VSVNEDUL.js'
const { plan, renderChunk } = await import(H)
const [proj, fpsArg, out] = process.argv.slice(2)
const fps = Number(fpsArg)
const chunkSize = 8 * fps, from = Number(process.argv[5] ?? 488)
const planDir = resolve(`${out}.plan`)
rmSync(planDir, { recursive: true, force: true })
const t0 = Date.now()
const p = await plan(resolve(proj), {
  fps, width: 1920, height: 1080, format: 'mp4', quality: 'high', chunkSize, maxParallelChunks: 256,
  rejectOnSystemFonts: false, failClosedFontFetch: false,
}, planDir)
const idx = Math.round((from * fps) / chunkSize)
console.log(`plan: ${p.totalFrames} frames at ${p.fps} fps, ${p.chunkCount} chunks; chunk ${idx} = film frames ${idx * chunkSize} to ${idx * chunkSize + chunkSize - 1} (${(Date.now() - t0) / 1000} s)`)
const r = await renderChunk(planDir, idx, resolve(out))
console.log('chunk:', JSON.stringify(r).slice(0, 400), `(${(Date.now() - t0) / 1000} s)`)
rmSync(planDir, { recursive: true, force: true })

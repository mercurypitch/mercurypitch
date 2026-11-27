// piece.mjs: the film's picture in pieces, each a fresh process (DECISIONS 265).
//   node piece.mjs plan <planDir> <projectDir> <chunkFrames>   the renderer's own plan of the whole root
//                                                               (its compile, timing and video cut), into
//                                                               <planDir>; prints the plan's summary
//   node piece.mjs chunk <planDir> <index> <out.mp4>            film frames index*chunk to the next chunk's
//                                                               first, captured by a fresh browser
// HyperFrames 0.8.97's distributed plan/renderChunk: the same stages as `hyperframes render`, with a
// frame range (lab/integration/film-hops-fix/README.md: faithful to the CLI to 0.2 px, deterministic).
// Delivery quality ('high'), 60 fps, 1920x1080, video only (the sound is muxed once on the whole).
import { resolve } from 'node:path'
const H = '/root/.npm/_npx/f293411582888030/node_modules/hyperframes/dist/chunk-VSVNEDUL.js'
const { plan, renderChunk } = await import(H)
const [mode, planDir, a, b] = process.argv.slice(2)
const t0 = Date.now()
if (mode === 'plan') {
  const p = await plan(resolve(a), {
    fps: 60, width: 1920, height: 1080, format: 'mp4', quality: 'high', chunkSize: Number(b),
    maxParallelChunks: 256, rejectOnSystemFonts: false, failClosedFontFetch: false,
  }, resolve(planDir))
  console.log('PLAN ' + JSON.stringify(p))
} else if (mode === 'chunk') {
  const r = await renderChunk(resolve(planDir), Number(a), resolve(b))
  console.log('CHUNK ' + JSON.stringify(r).slice(0, 800))
} else {
  console.error('usage: node piece.mjs plan <planDir> <projectDir> <chunkFrames> | chunk <planDir> <index> <out.mp4>')
  process.exit(2)
}
console.log(`${mode} done in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
process.exit(0)

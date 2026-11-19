// L.passFrame (the staged hosts.js) against the renderer's own extraction (ffmpeg-model/model.txt shows the
// model is exact on a synthetic pass at 30 and 60 fps) and against the film: s13 at 462.370 s, its tag
// data-start 0, data-media-start 0.050; film frame n shows pass frame n - 13871 at 30 fps.
import fs from 'node:fs'
import vm from 'node:vm'
const src = fs.readFileSync(process.argv[2], 'utf8')
const ctx = { window: {}, console }
ctx.window.L = { f2: (v) => v.toFixed(2), clamp: (v) => Math.max(0, Math.min(1, v)) }
vm.createContext(ctx)
vm.runInContext(src, ctx)
const L = ctx.window.L
const model = (k, F, ms, pf = 30) => {
  // the renderer's cut (ffmpeg fps filter, round=up, pts less 0.5 ms), written out on its own
  let best = -1
  for (let i = 0; i < 4000; i++) if ((Math.round((i * 1000) / pf) - 1000 * ms - 0.5) * F / 1000 <= k) best = i
  return best
}
const lines = []
for (const F of [30, 60]) {
  ctx.window.__HF_EXPORT_RENDER_SEEK_CONFIG = { fps: F }
  let bad = 0, badProp = 0, badOld = 0, n0 = Math.round(488 * F), n1 = Math.round(493 * F)
  for (let n = n0; n <= n1; n++) {
    const t = n / F - 462.37 // the scene's local time, as the film's timeline hands it to s13
    const k = Math.floor((n / F - 462.37) * F + 1e-9) // the renderer: getFrameIndexAtTime
    const want = model(k, F, 0.05)
    if (L.passFrame(t, 0, 0.05, 30) !== want) bad++
    if (Math.floor(0.05 * 30 + 1e-6) + Math.floor(t * 30 + 1e-6) !== want) badProp++
    if (Math.floor((t + 0.05) * 30 + 1e-6) !== want) badOld++
    if (F === 30 && want !== n - 13871) lines.push(`F=30 n=${n}: model ${want}, film table n - 13871 = ${n - 13871}`)
  }
  lines.push(`film 488-493 s at ${F} fps (${n1 - n0 + 1} frames): L.passFrame differs from the renderer on ${bad}; floor(30 ms) + floor(30 (t - ds)) on ${badProp}; floor(30 (t - ds + ms)) (before) on ${badOld}`)
  // the scene rendered alone (the lab): starts at 0
  let badAlone = 0
  for (let n = 0; n <= 65 * F; n++) if (L.passFrame(n / F, 0, 0.05, 30) !== model(n, F, 0.05)) badAlone++
  lines.push(`s13 alone, 0-65 s at ${F} fps: L.passFrame differs from the renderer on ${badAlone} frames`)
}
delete ctx.window.__HF_EXPORT_RENDER_SEEK_CONFIG
let badPrev = 0
for (let n = 0; n <= 1950; n++) if (L.passFrame(n / 30, 0, 0.05, 30) !== Math.floor((n / 30 + 0.05) * 30 + 1e-6)) badPrev++
lines.push(`no render config (probe, preview), s13 alone at 30 fps: differs from the old reading on ${badPrev} frames`)
console.log(lines.join('\n'))

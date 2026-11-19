// L.passFrame (hosts.js given) against the renderer: its cut of the pass (written out on its own below;
// ffmpeg-model/model.txt shows it exact on a synthetic pass at 30 and 60 fps) at k = floor((T - start) F)
// of the frame's exact time T. The page's t is that time rounded to the microsecond (debug-gate.js:
// alone-dbg-before-60.txt, (t - ds) x 60 is n, n + 2e-5 or n - 2e-5). Cases: the film (s13 at 462.370 s,
// 488 to 493 s) and s13 alone (0 to 65 s), at 30 and 60 fps; the tag's data-start 0, data-media-start 0.050.
import fs from 'node:fs'
import vm from 'node:vm'
const ctx = { window: {}, console }
ctx.window.L = { f2: (v) => v.toFixed(2), clamp: (v) => Math.max(0, Math.min(1, v)) }
vm.createContext(ctx)
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx)
const L = ctx.window.L
const cut = (k, F, ms = 0.05, pf = 30) => {
  let best = -1
  for (let i = 0; i < 4000; i++) if (((Math.round((i * 1000) / pf) - 1000 * ms - 0.5) * F) / 1000 <= k) best = i
  return best
}
const us = (x) => Math.round(x * 1e6) / 1e6
const out = []
for (const [name, start, a, b] of [['film', 462.37, 488, 493], ['s13 alone', 0, 0, 65]]) {
  for (const F of [30, 60]) {
    ctx.window.__HF_EXPORT_RENDER_SEEK_CONFIG = { fps: F }
    let n0 = Math.round(a * F), n1 = Math.round(b * F), kit = 0, kitUs = 0, old = 0, oldUs = 0, prop = 0
    for (let n = n0; n <= n1; n++) {
      const T = n / F, want = cut(Math.floor((T - start) * F + 1e-9), F)
      const t = T - start, tu = us(T - start)
      if (L.passFrame(t, 0, 0.05, 30) !== want) kit++
      if (L.passFrame(tu, 0, 0.05, 30) !== want) kitUs++
      if (Math.floor((t + 0.05) * 30 + 1e-6) !== want) old++
      if (Math.floor((tu + 0.05) * 30 + 1e-6) !== want) oldUs++
      if (Math.floor(0.05 * 30 + 1e-6) + Math.floor(tu * 30 + 1e-6) !== want) prop++
    }
    out.push(`${name}, ${a} to ${b} s at ${F} fps (${n1 - n0 + 1} frames): frames read off the renderer's: L.passFrame ${kit} (page time to the microsecond: ${kitUs}); ` +
      `before, floor((t - ds + ms) x 30) ${old} (${oldUs}); the proposal floor(30 ms) + floor(30 (t - ds)) (${prop})`)
  }
}
delete ctx.window.__HF_EXPORT_RENDER_SEEK_CONFIG
let probe = 0
for (let n = 0; n <= 1950; n++) if (L.passFrame(us(n / 30), 0, 0.05, 30) !== cut(n, 30)) probe++
out.push(`no render config (a probe, a preview), s13 alone at 30 fps: L.passFrame off a 30 fps render on ${probe} frames`)
console.log(out.join('\n'))

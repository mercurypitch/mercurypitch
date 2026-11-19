// S7's derived times for the build notes (node, no browser): the kit's chart.js loaded beside lesson.js
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const ROOT = new URL('../../..', import.meta.url).pathname
const ctx = { console }
ctx.window = ctx; ctx.document = { fonts: null, createElementNS: () => ({ setAttribute() {}, appendChild() {}, style: {} }) }
vm.createContext(ctx)
for (const f of ['assets/cues.js', 'assets/scenes.js', 'assets/lib/lesson.js', 'assets/lib/chart.js']) { try { vm.runInContext(readFileSync(ROOT + f, 'utf8'), ctx) } catch (e) { console.log('load', f, e.message) } }
const v = vm.runInContext(`(() => {
  const at = (c, e, o) => L.at('s07-support', c, e, o), word = (l, w, e, o) => L.word('s07-support', l, w, e, o)
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const PUSHING = word('b17', 'pushing'), SQZ2 = word('b18', 'squeezing')
  const REDRAW = PUSHING + 0.1, HOLD_D = 0.5, SHRINK_MIN = 0.4, PC = L.CONTOUR.pushed
  const SPEED = Math.max(2.5, PC.len / (SQZ2 - 0.2 - SHRINK_MIN - HOLD_D - REDRAW)), REDRAW_D = PC.len / SPEED
  const SHRINK1 = REDRAW + REDRAW_D + HOLD_D, SHRINK1_D = clamp(SQZ2 - 0.2 - SHRINK1, SHRINK_MIN, 0.6)
  const ROW1 = Math.min(SHRINK1 + SHRINK1_D, SQZ2 - 0.45), ROW2A = Math.max(SQZ2, ROW1 + 0.4)
  const cross = (f, lo, hi) => { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) === f(lo)) lo = m; else hi = m } return (lo + hi) / 2 }
  const IN_T = cross((u) => PC.cents(u) > -35, 0, 0.5), OUT_T = cross((u) => PC.cents(u) > 35, 1, PC.len)
  const LIT_ON = Math.max(REDRAW + IN_T / SPEED, PUSHING + 0.4), LIT_OFF = REDRAW + OUT_T / SPEED
  return { len: PC.len, SPEED, REDRAW, REDRAW_END: REDRAW + REDRAW_D, SHRINK1, SHRINK1_END: SHRINK1 + SHRINK1_D, ROW1, ROW2A, LIT_ON, LIT_OFF }
})()`, ctx)
for (const [k, x] of Object.entries(v)) console.log(k.padEnd(12), x.toFixed(3))

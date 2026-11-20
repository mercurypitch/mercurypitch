// The numbers the sound is made from, read out of the film kit, so sound and picture share them
// (FACTS 98). Read-only: it loads the kit's own modules in node (no browser, no DOM), evaluates
// the functions the scenes draw with, and writes assets/audio/kit-sound.json for tools/mix.py and
// tools/sound-measure.py. Nothing here is typed from a document: a number comes from the kit
// (assets/lib/*.js), the cue sheet (assets/cues.js) or, for two rules only a scene holds, from
// that scene's own line, which must still read as it did when this was written or the run stops.
//
//   node tools/sound-kit.mjs            writes assets/audio/kit-sound.json
//   node tools/sound-kit.mjs --print    prints a summary and writes nothing
//
// What it writes:
//   step        seconds between samples of every sampled function below (1 ms)
//   vib         L.CONTOUR.VIB { hz, cents, grow }
//   wave        L.CONTOUR.vib(t, 0) over 10 s: the "ooh"'s own wave from a note's start, for every
//               held note the kit draws no contour for (the gauge's, the model notes, the tune's)
//   contours    easy, pushed, push, demo: { len, vib0, cents[], c[], db[] } sampled every `step`
//               from 0 to len: cents(t) the centre, c(t) the drawn line with its wave, db(t) the
//               level (L.CONTOUR, assets/lib/chart.js)
//   push        the slider: at[] (L.CONTOUR.pushAt), a step's cents and dB, the top's cents and dB
//   gauge       the gauge's note: its length from the gauge's own time axis (L.GAUGE.x), Merc's
//               line's offset from his small band's centre in px (0: the band's centre, his note
//               unchanged), the crossings (assets/lib/gauge.js)
//   starts      the three starts: len, ONSET, level[kind][] (L.TRACE, assets/lib/folds.js), and
//               the back-to-back row times from s09-onset's own ROW_T
//   tease       the tune's notes and onsets (L.TEASE.BEADS, L.TEASE.onset, assets/lib/tease.js)
//   title       the title's chime times from its cue (L.TITLE.CHIME, assets/lib/lesson.js)
//   hops        Merc's two hops in `break`: s13-recap's own offsets, L.HOP, and each landing on
//               the film clock (take-off = cue + offset + crouch; landing = take-off + air)
//   settled     L.settled('demo'): the page's rule on the demo's line
//   sources     the files read, each with its sha256
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'

const ROOT = new URL('..', import.meta.url).pathname
const read = (f) => readFileSync(ROOT + f, 'utf8')
const sources = {}
const load = (f) => {
  const text = read(f)
  sources[f] = createHash('sha256').update(text).digest('hex')
  return text
}

const ctx = { document: { fonts: null }, console }
ctx.window = ctx
vm.createContext(ctx)
const scripts = read('assets/lib/scripts.txt').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
for (const f of scripts) {
  if (f.includes('/vendor/')) continue                       // GSAP: the scenes' timelines, not the kit's numbers
  vm.runInContext(load(f), ctx, { filename: f })
}
const ev = (code) => vm.runInContext(code, ctx)
const L = ctx.L

const STEP = 0.001
const sample = (fn, len) => {
  const n = Math.round(len / STEP)
  const out = new Array(n + 1)
  for (let i = 0; i <= n; i++) out[i] = +fn(i * STEP).toFixed(6)
  return out
}

/* the contours (FACTS 80) */
const contours = {}
for (const name of ['easy', 'pushed', 'push', 'demo']) {
  const c = L.CONTOUR[name]
  contours[name] = { len: c.len, vib0: c.vib0, cents: sample(c.cents, c.len), c: sample(c.c, c.len), db: sample(c.db, c.len) }
}
const P = L.CONTOUR
const push = {
  at: sample(P.pushAt, P.push.len),
  centsAStep: +(P.pushCents(51) - P.pushCents(50)).toFixed(6),
  dbAStep: +(P.pushDb(51) - P.pushDb(50)).toFixed(6),
  top: { p: 100, cents: P.pushCents(100), db: P.pushDb(100) },
  rest: { p: 50, cents: P.pushCents(50), db: P.pushDb(50) },
}

/* the gauge's note: as long as the gauge's own axis, on Merc's line at his small band's centre */
const G = L.GAUGE
const gaugeLen = (G.FRAME.x1 - G.x(0)) / (G.x(1) - G.x(0))
const gauge = {
  len: +gaugeLen.toFixed(6),
  lineOffsetPx: G.SMALL.line - (G.SMALL.y0 + G.SMALL.y1) / 2,
  cross: { quiet: G.cross(G.GOLD.quiet), loud: G.cross(G.GOLD.loud) },
}

/* the three starts, and s09's own row times for the three back to back */
const T = L.TRACE
const s09 = load('compositions/s09-onset.html')
const rowT = s09.match(/const STARTS = at\('starts'\), ROW_T = (\[[^\]]+\])/)
if (!rowT) throw new Error("sound-kit: s09-onset no longer has `const STARTS = at('starts'), ROW_T = [...]`: read its rule again")
if (!/const LEN = TR\.len\b/.test(s09)) throw new Error('sound-kit: s09-onset no longer takes LEN from TR.len')
const rows = ev(`(() => { const LEN = L.TRACE.len; return ${rowT[1]} })()`)
const starts = {
  len: T.len,
  onset: { ...T.ONSET },
  level: { air: sample((t) => T.level('air', t), T.len), catch: sample((t) => T.level('catch', t), T.len), together: sample((t) => T.level('together', t), T.len) },
  rows: Array.from(rows),
  rowsRule: rowT[1],
}

/* the tease's tune */
const tease = { notes: L.TEASE.BEADS.map((b) => b.note), onset: L.TEASE.BEADS.map((_, i) => L.TEASE.onset(i)) }

/* Merc's two hops in `break`: s13-recap's rule (its HOP1 and HOP2, its moves) with the kit's L.HOP */
const s13 = load('compositions/s13-recap.html')
const hopRule = s13.match(/const HOP1 = at\('break', 'start', ([\d.]+)\), HOP2 = at\('break', 'start', ([\d.]+)\)/)
if (!hopRule) throw new Error("sound-kit: s13-recap no longer has `const HOP1 = at('break', 'start', a), HOP2 = at('break', 'start', b)`: read its rule again")
for (const n of ['1', '2']) {
  if (!new RegExp(`\\{ at: HOP${n} \\+ L\\.HOP\\.crouch, dur: L\\.HOP\\.air,`).test(s13)) {
    throw new Error(`sound-kit: s13-recap's hop ${n} no longer moves at HOP${n} + L.HOP.crouch for L.HOP.air: read its rule again`)
  }
}
const offsets = [parseFloat(hopRule[1]), parseFloat(hopRule[2])]
const hops = {
  cue: 'break', offsets, crouch: L.HOP.crouch, air: L.HOP.air,
  takeoff: offsets.map((o) => +(L.cue('break', 'start', o) + L.HOP.crouch).toFixed(6)),
  landing: offsets.map((o) => +(L.cue('break', 'start', o) + L.HOP.crouch + L.HOP.air).toFixed(6)),
}

/* the title's five chimes, as s02-title hops its notes in */
const title = { chime: [0, 1, 2, 3, 4].map((k) => +(L.TITLE.CHIME(k) - L.cue('title')).toFixed(6)) }

const WAVE_LEN = 10
const out = { step: STEP, vib: { ...P.VIB }, wave: sample((t) => P.vib(t, 0), WAVE_LEN), contours, push, gauge, starts, tease, title, hops, settled: L.settled('demo'), sources }

if (process.argv.includes('--print')) {
  const brief = (a) => `${a.length} samples, ${a[0]} .. ${a[a.length - 1]}`
  console.log('vib', JSON.stringify(out.vib))
  for (const [k, c] of Object.entries(contours)) console.log(k, `len ${c.len}, vib0 ${c.vib0}, c ${brief(c.c)}, db ${brief(c.db)}`)
  console.log('push', JSON.stringify({ ...push, at: brief(push.at) }))
  console.log('gauge', JSON.stringify(gauge))
  console.log('starts', JSON.stringify({ ...starts, level: Object.fromEntries(Object.entries(starts.level).map(([k, a]) => [k, brief(a)])) }))
  console.log('tease', JSON.stringify(tease))
  console.log('title', JSON.stringify(title))
  console.log('hops', JSON.stringify(hops))
  console.log('settled', JSON.stringify(out.settled))
} else {
  mkdirSync(ROOT + 'assets/audio', { recursive: true })
  writeFileSync(ROOT + 'assets/audio/kit-sound.json', JSON.stringify(out) + '\n')
  console.log(`sound-kit: assets/audio/kit-sound.json (${Object.keys(sources).length} files read; hops land at ${hops.landing.join(' and ')})`)
}

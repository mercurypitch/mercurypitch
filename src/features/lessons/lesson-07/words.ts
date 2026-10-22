// ============================================================
// Lesson 7 four words — range, siren, lip trill and voice type
// ============================================================
//
// Lesson 1's strip of figure, word, definition and button (kit/words-strip.ts),
// with four small figures, pitch as height in each (WEB-SPEC, Toys 3):
// Range shows the column, its two ends lighting in turn, bottom then top;
// Siren plays Merc's siren on "ng" and draws it as it sounds; Lip trill plays
// the same siren on the trill, its line drawn with the buzz in it (FACTS 82);
// Voice type lights the six bands in turn, low to high, and names them. The
// two plays are the page's one sound (kit/now-playing.ts): a new press
// anywhere stops them. The two shows play nothing, so they take no sound
// and never warn that sound is off. Each figure is drawn once; only a
// pressed word moves, and under reduced motion a siren draws at once.

import { clamp, q, qa, svg } from '@/features/lessons/kit/dom'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { TIMBRES } from '@/features/lessons/kit/timbre'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import type { Run } from './play'
import { playLine } from './play'
import type { ChartVoice } from './range-data'
import { BANDS, SIREN_SEC, SIREN_UP, sirenAt, sirenContour, sirenEnds, } from './range-data'
import { TYPES_NAMED } from './range-words'

const DIM = rgba(COLOR.chrome, 0.16)
const EDGE = rgba(COLOR.chrome, 0.45)
const LIT = rgba(COLOR.ink, 0.28)

const stub = (word: string): SVGSVGElement =>
  q<SVGSVGElement>(`[data-word="${word}"] .stub svg`)

/** A siren's height in the stub: its low note at 100, its high at 24. */
function sirenPoint(t: number, buzz: boolean): [number, number] {
  const x = 6 + (52 * t) / SIREN_SEC
  const u = (sirenAt('lower', t) - 52) / 9
  const y = 100 - 76 * u + (buzz ? 2.6 * Math.sin(t * 38) : 0)
  return [x, y]
}

function sirenPoints(until: number, buzz: boolean): string {
  const out: string[] = []
  for (let t = 0; t <= until + 1e-9; t += buzz ? 0.03 : 0.08) {
    const [x, y] = sirenPoint(t, buzz)
    out.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return out.join(' ')
}

/** A siren figure: its whole line faint, and the line drawn as it sounds, with its head. */
function sirenFigure(word: string, buzz: boolean) {
  const host = stub(word)
  svg(
    'polyline',
    {
      points: sirenPoints(SIREN_SEC, buzz),
      fill: 'none',
      stroke: rgba(COLOR.amber, 0.28),
      'stroke-width': 1.5,
    },
    host,
  )
  const drawn = svg(
    'polyline',
    { points: '', fill: 'none', stroke: COLOR.amber, 'stroke-width': 2 },
    host,
  )
  const head = svg('circle', { cx: 6, cy: 100, r: 4, fill: COLOR.amber }, host)
  head.setAttribute('opacity', '0')
  return {
    /** The line drawn to `t`, its head at `headT` (the turn, under reduced motion). */
    at(t: number, headT = t): void {
      drawn.setAttribute('points', sirenPoints(t, buzz))
      const [x, y] = sirenPoint(headT, buzz)
      head.setAttribute('cx', x.toFixed(1))
      head.setAttribute('cy', y.toFixed(1))
      head.setAttribute('opacity', '1')
    },
    rest(): void {
      drawn.setAttribute('points', '')
      head.setAttribute('opacity', '0')
    },
  }
}

/** The column: its middle half lit, its two ends dimmed, each end a lamp. */
function rangeFigure() {
  const host = stub('range')
  const x = 18
  const w = 28
  svg('rect', { x, y: 34, width: w, height: 52, fill: LIT }, host)
  const top = svg('rect', { x, y: 10, width: w, height: 24, fill: DIM }, host)
  const bottom = svg(
    'rect',
    { x, y: 86, width: w, height: 24, fill: DIM },
    host,
  )
  svg(
    'rect',
    { x, y: 10, width: w, height: 100, fill: 'none', stroke: EDGE },
    host,
  )
  return {
    light(end: 'top' | 'bottom' | null): void {
      top.setAttribute('fill', end === 'top' ? COLOR.chrome : DIM)
      bottom.setAttribute('fill', end === 'bottom' ? COLOR.chrome : DIM)
    },
  }
}

/** The six bands side by side, each at its height (E2 to C6), each a lamp. */
function typesFigure() {
  const host = stub('types')
  const lo = 40
  const hi = 84
  const yOf = (m: number): number => 112 - (104 * (m - lo)) / (hi - lo)
  const bars = BANDS.map((b, i) =>
    svg(
      'rect',
      {
        x: 5 + i * 9.4,
        y: yOf(b.hi),
        width: 7,
        height: yOf(b.lo) - yOf(b.hi),
        rx: 2,
        fill: DIM,
        stroke: EDGE,
      },
      host,
    ),
  )
  return {
    light(n: number | null): void {
      bars.forEach((r, i) =>
        r.setAttribute('fill', i === n ? COLOR.chrome : DIM),
      )
    },
  }
}

/** Waits a frame at a time until `seconds` have passed or `stopped` says so. */
function frames(
  seconds: number,
  fn: (t: number) => void,
  stopped: () => boolean,
): Promise<boolean> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const frame = (now: number): void => {
      if (stopped()) {
        resolve(false)
        return
      }
      const t = clamp((now - t0) / 1000, 0, seconds)
      fn(t)
      if (t < seconds) requestAnimationFrame(frame)
      else resolve(true)
    }
    requestAnimationFrame(frame)
  })
}

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

export function initWords(): void {
  const sirens = {
    siren: sirenFigure('siren', false),
    trill: sirenFigure('trill', true),
  }
  const runs: Partial<Record<string, Run>> = {}
  const voice = (): ChartVoice => VoiceChoice.voice ?? 'lower'

  const playSiren = async (
    word: string,
    audible: boolean,
    stopped: () => boolean,
  ): Promise<void> => {
    const fig = word === 'trill' ? sirens.trill : sirens.siren
    const v = voice()
    const r = playLine(sirenContour(v), {
      audible,
      timbre: TIMBRES[word === 'trill' ? 'trill' : 'ng'],
    })
    runs[word] = r
    mercSing(mercOf(v), sirenEnds(v).low, true)
    if (reducedMotion()) {
      fig.at(SIREN_SEC, SIREN_UP + 0.2)
      await r.done
    } else await frames(SIREN_SEC, (t) => fig.at(t), stopped)
    mercSing(mercOf(v), sirenEnds(v).low, false)
    if (!stopped()) await r.done
    fig.rest()
    delete runs[word]
  }

  for (const word of ['siren', 'trill'])
    bindWordPlays(q(`[data-word="${word}"]`), playSiren, {
      owner: NowPlaying,
      stop: (w) => {
        runs[w]?.stop()
        mercSing(mercOf(voice()), sirenEnds(voice()).low, false)
      },
    })

  // the two shows: nothing sounds, so a second press waits for the first
  const range = rangeFigure()
  const types = typesFigure()
  const said = q('[data-word-said]')
  const shows: Record<string, () => Promise<void>> = {
    range: async () => {
      range.light('bottom')
      await pause(900)
      range.light('top')
      await pause(900)
      range.light(null)
    },
    types: async () => {
      if (said.textContent !== TYPES_NAMED) said.textContent = TYPES_NAMED
      for (let i = 0; i < BANDS.length; i++) {
        types.light(i)
        await pause(reducedMotion() ? 500 : 420)
      }
      types.light(null)
    },
  }
  for (const b of qa<HTMLButtonElement>(
    '[data-word="range"] [data-word-play], [data-word="types"] [data-word-play]',
  )) {
    let busy = false
    b.addEventListener('click', () => {
      const show = shows[b.dataset.wordPlay ?? '']
      if (busy || show === undefined) return
      busy = true
      b.classList.add('is-on')
      void show().then(() => {
        busy = false
        b.classList.remove('is-on')
      })
    })
  }
}

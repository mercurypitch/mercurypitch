// ============================================================
// Lesson 5 four words — air pressure, diaphragm, onset and support
// ============================================================
//
// Each ticket's stub is a small drawing that answers its button (WEB-SPEC,
// Sections 5): Air pressure plays Push's note at 50, then at 70, its dot
// climbing in the band as its level bar grows (FACTS 73); Diaphragm shows
// the breath figure's dome breathing in, flattening over 2 s and rising
// again over 5 s, never held flat (FACTS 33); Onset plays the "together"
// start, its wave growing from the gold tick (FACTS 75). Support has no
// button: it has no agreed definition. Under reduced motion each lands in
// its end state; what the viewer starts still sounds.

import { BAND_COLOR } from '@/features/lessons/kit/band-chart'
import { clamp, q, qa, smooth, svg, wait } from '@/features/lessons/kit/dom'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import { figurePaths, IN_SEC, OUT_SEC } from './breath-figure'
import { playStart, START_SEC, TOGETHER_RISE } from './starts'
import { pushCents, pushGain, pushHz, pushLevel } from './toy-push'

/** The breath figure's box in a 64 by 120 stub. */
const STUB = { x: 2, y: 8, w: 60, h: 104 } as const

/** Seconds of Push's note at 50, then at 70. */
const AIR_SEC = 1.2
const AIR_PUSH = [50, 70] as const

/** Runs `fn(u)` every frame for `dur` seconds, u from 0 to 1; once, at the end, under reduced motion. */
function animate(dur: number, fn: (u: number) => void): Promise<void> {
  if (reducedMotion()) {
    fn(1)
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const t0 = performance.now()
    const frame = (now: number): void => {
      const u = clamp((now - t0) / (dur * 1000), 0, 1)
      fn(u)
      if (u < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

/** The air stub: Merc's band, the note's dot in it, and its level bar under it. */
function drawAir(el: SVGSVGElement): (push: number) => void {
  svg(
    'rect',
    { x: 8, y: 32, width: 48, height: 28, fill: rgba(BAND_COLOR.target, 0.16) },
    el,
  )
  svg(
    'line',
    {
      x1: 8,
      x2: 56,
      y1: 46,
      y2: 46,
      stroke: BAND_COLOR.target,
      'stroke-width': 2,
    },
    el,
  )
  svg(
    'line',
    { x1: 8, x2: 56, y1: 100, y2: 100, stroke: 'rgba(195,204,214,.3)' },
    el,
  )
  const bar = svg(
    'rect',
    { x: 20, width: 24, rx: 2, fill: rgba(COLOR.chrome, 0.4) },
    el,
  )
  const dot = svg('circle', { cx: 32, r: 5, fill: BAND_COLOR.singer }, el)
  return (push) => {
    // 14 px of band for 35 cents; the bar's half-height is the level
    dot.setAttribute('cy', (46 - pushCents(push) * 0.4).toFixed(1))
    const half = 16 * pushLevel(push)
    bar.setAttribute('y', (100 - half).toFixed(1))
    bar.setAttribute('height', (2 * half).toFixed(1))
  }
}

/** The dome stub: the breath figure itself, small and unlabelled, `u` breathed in. */
function drawDome(el: SVGSVGElement): (u: number) => void {
  const lungs = svg(
    'path',
    { fill: rgba(COLOR.chrome, 0.1), stroke: rgba(COLOR.chrome, 0.45) },
    el,
  )
  const dome = svg(
    'path',
    {
      fill: 'none',
      stroke: COLOR.chrome,
      'stroke-width': 2.4,
      'stroke-linecap': 'round',
    },
    el,
  )
  const wall = {
    fill: 'none',
    stroke: rgba(COLOR.chrome, 0.75),
    'stroke-width': 1.6,
  }
  const back = svg('path', wall, el)
  const front = svg('path', wall, el)
  return (u) => {
    const paths = figurePaths(STUB, u)
    lungs.setAttribute('d', paths.lungs)
    lungs.setAttribute('fill', rgba(COLOR.chrome, 0.08 + 0.07 * u))
    dome.setAttribute('d', paths.dome)
    back.setAttribute('d', paths.back)
    front.setAttribute('d', paths.front)
  }
}

/** The onset stub: a trace whose wave grows from the gold tick, drawn up to `u` of its width. */
function drawOnset(el: SVGSVGElement): (u: number) => void {
  svg(
    'line',
    { x1: 8, x2: 58, y1: 60, y2: 60, stroke: 'rgba(195,204,214,.3)' },
    el,
  )
  svg(
    'line',
    { x1: 10, x2: 10, y1: 38, y2: 82, stroke: COLOR.gold, 'stroke-width': 2 },
    el,
  )
  const wave = svg(
    'path',
    { fill: 'none', stroke: COLOR.chrome, 'stroke-width': 1.6 },
    el,
  )
  return (u) => {
    let d = 'M10 60'
    for (let x = 10; x <= 10 + 48 * u; x += 0.5) {
      const t = ((x - 10) / 48) * START_SEC
      const y =
        60 - 18 * smooth(0, TOGETHER_RISE, t) * Math.sin(t * 2 * Math.PI * 6)
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
    }
    wave.setAttribute('d', d)
  }
}

/** The support stub: the word in quotation marks, a thing singers say. */
function drawSupport(el: SVGSVGElement): void {
  svg(
    'text',
    {
      x: 32,
      y: 78,
      'text-anchor': 'middle',
      fill: COLOR.chrome,
      'font-size': 54,
      'font-family': '"Instrument Serif", serif',
      text: '“”',
    },
    el,
  )
}

export function initWords(): void {
  const air = drawAir(q<SVGSVGElement>('#wAir'))
  const dome = drawDome(q<SVGSVGElement>('#wDome'))
  const onset = drawOnset(q<SVGSVGElement>('#wOnset'))
  drawSupport(q<SVGSVGElement>('#wSupport'))
  air(AIR_PUSH[0])
  dome(0)
  onset(0)
  const busy: Record<string, boolean> = {}

  async function playAir(): Promise<void> {
    const audible = Sound.canPlay()
    const [easy, more] = AIR_PUSH
    const v = audible
      ? Sound.voice(pushHz(easy), { kind: 'merc', gain: pushGain(easy) })
      : null
    air(easy)
    await wait(AIR_SEC)
    v?.setFreq(pushHz(more), 0.08)
    v?.setGain(pushGain(more), 0.08)
    await animate(0.3, (u) => air(easy + (more - easy) * u))
    await wait(AIR_SEC - 0.3)
    v?.stop()
    await wait(0.6)
    air(easy)
  }

  async function showDome(): Promise<void> {
    // one breath, as the figure's Breathe in runs it: in, then straight out, never held
    if (reducedMotion()) {
      dome(1)
      await wait(IN_SEC + OUT_SEC)
      dome(0)
      return
    }
    await animate(IN_SEC, (u) => dome(smooth(0, 1, u)))
    await animate(OUT_SEC, (u) => dome(1 - smooth(0, 1, u)))
  }

  async function playOnset(): Promise<void> {
    playStart('together', Sound.canPlay())
    await animate(START_SEC, (u) => onset(u))
  }

  const plays: Readonly<Record<string, () => Promise<void>>> = {
    air: playAir,
    dome: showDome,
    onset: playOnset,
  }

  for (const b of qa<HTMLButtonElement>('[data-word-play]')) {
    b.addEventListener('click', () => {
      const w = b.dataset.wordPlay ?? ''
      const run = plays[w]
      if (run === undefined || busy[w]) return
      busy[w] = true
      b.classList.add('is-on')
      void run().then(() => {
        busy[w] = false
        b.classList.remove('is-on')
      })
    })
  }
}

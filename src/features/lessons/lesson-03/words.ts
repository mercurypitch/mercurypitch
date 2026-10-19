// ============================================================
// Lesson 3 three words — vocal folds, cent and target band, each shown
// ============================================================
//
// Each ticket's stub is a small drawing that answers its button: the folds
// close and vibrate while Merc's "ooh" on A3 plays, a bead climbs 100 cents
// along Lesson 2's slow glide from A3 to A sharp 3 (FACTS 46a), and the band
// lights its edge in mint and takes a violet note. Under reduced motion each
// lands in its end state; what the viewer starts still sounds.

import { BAND_COLOR } from '@/features/lessons/kit/band-chart'
import { clamp, q, qa, svg, TAU } from '@/features/lessons/kit/dom'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { A3, COLOR, hz, rgba } from '@/features/lessons/kit/notes'
import { contourOf, playContour, playTone, Sound, } from '@/features/lessons/kit/sound'

/** Lesson 2's 100-cent glide: hold A3, glide slowly up to A sharp 3, hold. */
const GLIDE = contourOf(hz(A3), [
  { hold: 0.5 },
  { glide: 2.5, to: hz(A3 + 1) },
  { hold: 0.6 },
])
const GLIDE_SEC = 3.6

/** Runs `fn(u, now)` every frame for `dur` seconds, u from 0 to 1; once, at the end, under reduced motion. */
function animate(
  dur: number,
  fn: (u: number, now: number) => void,
): Promise<void> {
  if (reducedMotion()) {
    fn(1, performance.now())
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const t0 = performance.now()
    const frame = (now: number): void => {
      const u = clamp((now - t0) / (dur * 1000), 0, 1)
      fn(u, now)
      if (u < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

/** The folds from above: a V, open at the back; `open` from 0 (closed) to 1 (breathing). */
function foldsPath(open: number, wobble: number): [string, string] {
  const back = 2 + 12 * open + wobble
  return [
    `M30 24 L${(32 - back).toFixed(1)} 96`,
    `M34 24 L${(32 + back).toFixed(1)} 96`,
  ]
}

function drawFolds(el: SVGSVGElement): (open: number, wobble: number) => void {
  const left = svg(
    'path',
    {
      fill: 'none',
      stroke: COLOR.chrome,
      'stroke-width': 6,
      'stroke-linecap': 'round',
    },
    el,
  )
  const right = svg(
    'path',
    {
      fill: 'none',
      stroke: COLOR.chrome,
      'stroke-width': 6,
      'stroke-linecap': 'round',
    },
    el,
  )
  const set = (open: number, wobble: number): void => {
    const [l, r] = foldsPath(open, wobble)
    left.setAttribute('d', l)
    right.setAttribute('d', r)
  }
  set(1, 0)
  return set
}

function drawCent(el: SVGSVGElement): (u: number) => void {
  svg(
    'line',
    { x1: 32, x2: 32, y1: 26, y2: 96, stroke: 'rgba(195,204,214,.3)' },
    el,
  )
  for (const [y, label] of [
    [26, '100'],
    [96, '0'],
  ] as const) {
    svg(
      'line',
      { x1: 24, x2: 40, y1: y, y2: y, stroke: 'rgba(195,204,214,.5)' },
      el,
    )
    svg(
      'text',
      {
        x: 32,
        y: y === 26 ? 16 : 114,
        'text-anchor': 'middle',
        class: 'svg-mono',
        fill: COLOR.ink3,
        text: label,
      },
      el,
    )
  }
  const trail = svg(
    'line',
    { x1: 32, x2: 32, y1: 96, y2: 96, stroke: COLOR.chrome, 'stroke-width': 2 },
    el,
  )
  const bead = svg('circle', { cx: 32, cy: 96, r: 5.5, fill: COLOR.chrome }, el)
  return (u) => {
    const y = 96 - 70 * u
    bead.setAttribute('cy', y.toFixed(1))
    trail.setAttribute('y1', y.toFixed(1))
  }
}

function drawBand(el: SVGSVGElement): (lit: boolean) => void {
  svg(
    'rect',
    { x: 8, y: 46, width: 48, height: 28, fill: rgba(BAND_COLOR.target, 0.16) },
    el,
  )
  const edges = [46, 74].map((y) =>
    svg(
      'line',
      {
        x1: 8,
        x2: 56,
        y1: y,
        y2: y,
        stroke: rgba(BAND_COLOR.target, 0.6),
        'stroke-width': 1.4,
      },
      el,
    ),
  )
  svg(
    'line',
    {
      x1: 8,
      x2: 56,
      y1: 60,
      y2: 60,
      stroke: BAND_COLOR.target,
      'stroke-width': 2,
    },
    el,
  )
  const note = svg(
    'circle',
    { cx: 44, cy: 64, r: 5, fill: BAND_COLOR.singer, opacity: 0 },
    el,
  )
  return (lit) => {
    for (const e of edges) {
      e.setAttribute(
        'stroke',
        lit ? BAND_COLOR.mint : rgba(BAND_COLOR.target, 0.6),
      )
      e.setAttribute('stroke-width', lit ? '2.2' : '1.4')
    }
    note.setAttribute('opacity', lit ? '1' : '0')
  }
}

export function initWords(): void {
  const folds = drawFolds(q<SVGSVGElement>('#wFolds'))
  const cent = drawCent(q<SVGSVGElement>('#wCent'))
  const band = drawBand(q<SVGSVGElement>('#wBand'))
  const busy: Record<string, boolean> = {}

  async function play(w: string, b: HTMLButtonElement): Promise<void> {
    const audible = Sound.canPlay()
    if (w === 'folds') {
      // closed while Merc sings, vibrating unless motion is reduced; apart again after
      folds(0, 0)
      const tone = playTone(hz(A3), 1.6, { kind: 'merc', audible })
      if (!reducedMotion())
        await animate(1.6, (_u, now) =>
          folds(0, 1.2 * Math.sin((TAU * now) / 90)),
        )
      await tone
      folds(1, 0)
    } else if (w === 'cent') {
      const tone = playContour(GLIDE, { audible })
      await animate(GLIDE_SEC, (u) =>
        cent(clamp((u * GLIDE_SEC - 0.5) / 2.5, 0, 1)),
      )
      await tone
      window.setTimeout(() => cent(0), 900)
    } else {
      const lit = b.getAttribute('aria-pressed') !== 'true'
      b.setAttribute('aria-pressed', String(lit))
      band(lit)
    }
  }

  for (const b of qa<HTMLButtonElement>('[data-word-play]')) {
    b.addEventListener('click', () => {
      const w = b.dataset.wordPlay ?? ''
      if (busy[w]) return
      busy[w] = true
      b.classList.toggle('is-on', w !== 'band')
      void play(w, b).then(() => {
        busy[w] = false
        if (w !== 'band') b.classList.remove('is-on')
      })
    })
  }
}

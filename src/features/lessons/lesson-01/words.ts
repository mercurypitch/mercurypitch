// ============================================================
// Lesson 1 three words — pitch, hertz and the octave, each heard
// ============================================================
//
// The strip itself, a button per word lit while it plays, is the kit's
// (kit/words-strip.ts); this draws the three figures and plays each word.

import { easeInOut, q, svg, TAU } from '@/features/lessons/kit/dom'
import { COLOR, logPos } from '@/features/lessons/kit/notes'
import { playTone, Sound } from '@/features/lessons/kit/sound'
import { animate, bindWordPlays } from '@/features/lessons/kit/words-strip'

/** One short cosine wave as an SVG path. */
function wave(
  cycles: number,
  ph = 0,
  y = 90,
  amp = 9,
  x0 = 6,
  x1 = 58,
): string {
  let d = ''
  for (let i = 0; i <= 60; i++) {
    const x = x0 + ((x1 - x0) * i) / 60
    const yy = y - amp * Math.cos((TAU * cycles * i) / 60 + ph)
    d += `${i > 0 ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`
  }
  return d
}

export function initWords(): void {
  const pitch = q<SVGSVGElement>('#wPitch')
  const hertz = q<SVGSVGElement>('#wHertz')
  const oct = q<SVGSVGElement>('#wOctave')
  // pitch: a bead on a rail (higher is higher)
  svg(
    'line',
    { x1: 32, x2: 32, y1: 22, y2: 98, stroke: 'rgba(195,204,214,.35)' },
    pitch,
  )
  for (const y of [22, 47, 73, 98]) {
    svg(
      'line',
      { x1: 26, x2: 38, y1: y, y2: y, stroke: 'rgba(195,204,214,.45)' },
      pitch,
    )
  }
  svg(
    'text',
    {
      x: 34,
      y: 12,
      'text-anchor': 'middle',
      class: 'svg-mono',
      fill: COLOR.ink3,
      text: 'High',
    },
    pitch,
  )
  svg(
    'text',
    {
      x: 34,
      y: 116,
      'text-anchor': 'middle',
      class: 'svg-mono',
      fill: COLOR.ink3,
      text: 'Low',
    },
    pitch,
  )
  const pb = svg(
    'circle',
    {
      cx: 32,
      cy: 86,
      r: 6.5,
      fill: COLOR.chrome,
      style: 'filter: drop-shadow(0 0 6px rgba(195,204,214,.8))',
    },
    pitch,
  )
  // hertz: a counter and one short wave
  const hn = svg(
    'text',
    {
      x: 32,
      y: 52,
      'text-anchor': 'middle',
      fill: COLOR.ink,
      'font-family': 'Outfit, sans-serif',
      'font-weight': 600,
      'font-size': 22,
      text: '220',
    },
    hertz,
  )
  svg(
    'text',
    {
      x: 32,
      y: 70,
      'text-anchor': 'middle',
      class: 'svg-mono',
      fill: COLOR.ink3,
      style: 'letter-spacing:.06em',
      text: 'per sec',
    },
    hertz,
  )
  const hw = svg(
    'path',
    { d: wave(3), fill: 'none', stroke: COLOR.blue, 'stroke-width': 1.6 },
    hertz,
  )
  // octave: two waves, 1 : 2, gold where the peaks meet
  const ob = svg(
    'path',
    {
      d: wave(2, 0, 42, 10),
      fill: 'none',
      stroke: COLOR.blue,
      'stroke-width': 1.6,
    },
    oct,
  )
  const oo = svg(
    'path',
    {
      d: wave(4, 0, 80, 10),
      fill: 'none',
      stroke: COLOR.orange,
      'stroke-width': 1.6,
    },
    oct,
  )
  for (const x of [6, 32, 58]) {
    svg(
      'line',
      {
        x1: x,
        x2: x,
        y1: 26,
        y2: 96,
        stroke: COLOR.gold,
        'stroke-width': 1,
        'stroke-dasharray': '2 3',
        opacity: 0.8,
      },
      oct,
    )
  }
  svg(
    'text',
    {
      x: 32,
      y: 117,
      'text-anchor': 'middle',
      fill: COLOR.gold,
      'font-family': 'Outfit, sans-serif',
      'font-weight': 600,
      'font-size': 14,
      text: '2 : 1',
    },
    oct,
  )

  const flash = (p: SVGPathElement, on: boolean): void =>
    p.setAttribute('stroke-width', on ? '2.6' : '1.6')
  bindWordPlays(document, async (w, audible) => {
    if (w === 'pitch') {
      const v = audible ? Sound.voice(165, { gain: 0.12 }) : null
      await animate(1.8, (u) => {
        const f = 165 * 4 ** easeInOut(u)
        v?.setFreq(f, 0.01)
        pb.setAttribute('cy', (98 - logPos(f, 165, 660) * 76).toFixed(1))
      })
      v?.stop()
      window.setTimeout(() => pb.setAttribute('cy', '86'), 600)
    } else if (w === 'hertz') {
      const v = audible ? Sound.voice(220, { gain: 0.13 }) : null
      await animate(1, (u, now) => {
        hn.textContent = String(Math.round(220 * u))
        hw.setAttribute('d', wave(3, -now * 0.012))
      })
      await animate(0.3, () => undefined)
      v?.stop()
      hn.textContent = '220'
    } else {
      flash(ob, true)
      await playTone(220, 0.75, { audible })
      flash(ob, false)
      flash(oo, true)
      await playTone(440, 0.75, { audible })
      flash(oo, false)
      flash(ob, true)
      flash(oo, true)
      await Promise.all([
        playTone(220, 1.1, { audible, gain: 0.11 }),
        playTone(440, 1.1, { audible, gain: 0.09 }),
      ])
      flash(ob, false)
      flash(oo, false)
    }
  })
}

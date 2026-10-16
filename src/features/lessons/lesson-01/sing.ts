// ============================================================
// Lesson 1 sing it — Merc's A, a hum-along ring, Voice Mirror's rule
// ============================================================
//
// Nothing listens and nothing is scored here: the ring plays Merc's note,
// then breathes for four seconds while the visitor hums. The illustration
// beside the practise card shows what Voice Mirror does for real: a reply an
// octave below the note it plays still counts as a match.

import { q, qa, svg, TAU } from '@/features/lessons/kit/dom'
import { addDrawer, watch } from '@/features/lessons/kit/frame-loop'
import { A3, A4, COLOR, hz, nameOf, rgba } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'

interface Run {
  t0: number
  dur: number
  hum: number
  col: string
  lastN: number
}

export function initSing(stills: { blue: string; orange: string }): void {
  const ringP = q<SVGCircleElement>('#ringProgress')
  const breath = q<SVGCircleElement>('#ringBreath')
  const ripples = q<SVGGElement>('#ringRipples')
  const img = q<HTMLImageElement>('#ringMerc')
  const noteL = q('#ringNote')
  const stateL = q('#ringState')
  const buttons = qa<HTMLButtonElement>('#singA3, #singA4')
  const CIRC = 2 * Math.PI * 182
  const ringSeen = watch(q('#ring'))
  let run: Run | null = null
  let rips: { t: number; c: SVGCircleElement }[] = []

  function go(midi: number, which: 'blue' | 'orange'): void {
    if (run) return
    const audible = Sound.canPlay()
    img.src = which === 'blue' ? stills.blue : stills.orange
    noteL.textContent = `${nameOf(midi) ?? ''} · ${Math.round(hz(midi))} Hz`
    noteL.style.color = which === 'blue' ? COLOR.blue : COLOR.orange
    stateL.textContent = 'Listen'
    run = {
      t0: performance.now(),
      dur: 2.4,
      hum: 4,
      col: which === 'blue' ? COLOR.blue : COLOR.orange,
      lastN: -1,
    }
    if (audible) Sound.voice(hz(midi), { kind: 'merc', dur: run.dur })
    buttons.forEach((b) => {
      b.disabled = true
    })
  }
  q('#singA3').addEventListener('click', () => go(A3, 'blue'))
  q('#singA4').addEventListener('click', () => go(A4, 'orange'))

  addDrawer({
    active: () => run !== null && ringSeen(),
    draw(now) {
      if (!run) return
      const t = (now - run.t0) / 1000
      if (t < run.dur) {
        const last = rips[rips.length - 1]
        if (last === undefined || now - last.t > 420) {
          const c = svg(
            'circle',
            {
              cx: 200,
              cy: 200,
              r: 120,
              fill: 'none',
              stroke: run.col,
              'stroke-width': 1.5,
            },
            ripples,
          )
          rips.push({ t: now, c })
        }
        breath.setAttribute('r', '150')
        breath.setAttribute('opacity', '.55')
      } else if (t < run.dur + run.hum) {
        const h = t - run.dur
        const n = Math.ceil(run.hum - h)
        if (n !== run.lastN) {
          run.lastN = n
          stateL.textContent = `Hum it back · ${n}`
        }
        // breathe in and out, two seconds a breath
        const b = 0.5 - 0.5 * Math.cos((TAU * h) / 2)
        breath.setAttribute('r', (142 + 22 * b).toFixed(1))
        breath.setAttribute('opacity', (0.45 + 0.45 * b).toFixed(2))
        breath.setAttribute('stroke-width', (2 + 2 * b).toFixed(1))
        ringP.setAttribute(
          'stroke-dashoffset',
          (CIRC * (1 - h / run.hum)).toFixed(1),
        )
      } else {
        stateL.textContent = 'Again whenever you like'
        ringP.setAttribute('stroke-dashoffset', String(CIRC))
        breath.setAttribute('r', '150')
        breath.setAttribute('opacity', '.55')
        breath.setAttribute('stroke-width', '2')
        run = null
        buttons.forEach((b) => {
          b.disabled = false
        })
      }
      rips = rips.filter((r) => {
        const a = (now - r.t) / 1600
        if (a >= 1) {
          r.c.remove()
          return false
        }
        r.c.setAttribute('r', (118 + a * 72).toFixed(1))
        r.c.setAttribute('opacity', (0.7 * (1 - a)).toFixed(2))
        return true
      })
    },
  })

  drawMirrorFigure()
}

/** Voice Mirror plays a note; a reply an octave below still counts as a match. */
function drawMirrorFigure(): void {
  const fig = q<SVGSVGElement>('#mirrorFig')
  const texts: [SVGTextElement, number][] = []
  const label = (
    attrs: Record<string, string | number>,
    px: number,
    lines: string[],
  ): void => {
    const t = svg(
      'text',
      {
        'font-family': 'JetBrains Mono, monospace',
        'font-weight': 500,
        'letter-spacing': '.18em',
        ...attrs,
      },
      fig,
    )
    lines.forEach((ln, i) =>
      svg('tspan', { x: attrs.x, dy: i > 0 ? '1.25em' : null, text: ln }, t),
    )
    texts.push([t, px])
  }
  for (let i = 0; i <= 12; i++) {
    svg(
      'line',
      {
        x1: 40,
        x2: 352,
        y1: 14 + i * 10,
        y2: 14 + i * 10,
        stroke: 'rgba(195,204,214,.07)',
      },
      fig,
    )
  }
  svg(
    'rect',
    {
      x: 40,
      y: 29,
      width: 312,
      height: 10,
      rx: 3,
      fill: rgba(COLOR.blue, 0.16),
      stroke: rgba(COLOR.blue, 0.6),
      'stroke-width': 0.8,
    },
    fig,
  )
  svg(
    'rect',
    {
      x: 40,
      y: 99,
      width: 312,
      height: 10,
      rx: 3,
      fill: rgba(COLOR.blue, 0.07),
      stroke: rgba(COLOR.blue, 0.45),
      'stroke-width': 0.8,
      'stroke-dasharray': '4 3',
    },
    fig,
  )
  label({ x: 46, y: 23, fill: COLOR.blue }, 12, ['THE NOTE MIRROR PLAYS'])
  label({ x: 352, y: 125, 'text-anchor': 'end', fill: COLOR.blue }, 12, [
    'SAME NOTE,',
    'AN OCTAVE BELOW',
  ])
  label(
    {
      x: 30,
      y: 38,
      'text-anchor': 'end',
      fill: COLOR.ink3,
      'font-family': 'Outfit, sans-serif',
      'font-weight': 600,
      'letter-spacing': 0,
    },
    14,
    ['2×'],
  )
  label(
    {
      x: 30,
      y: 108,
      'text-anchor': 'end',
      fill: COLOR.ink3,
      'font-family': 'Outfit, sans-serif',
      'font-weight': 600,
      'letter-spacing': 0,
    },
    14,
    ['1×'],
  )
  svg(
    'path',
    {
      d: 'M44 140 C70 136 84 128 100 120 S128 96 146 106 S170 106 188 104 L196 104',
      fill: 'none',
      stroke: COLOR.chrome,
      'stroke-width': 2.4,
      'stroke-linecap': 'round',
    },
    fig,
  )
  svg(
    'path',
    {
      d: 'M196 104 L300 104',
      fill: 'none',
      stroke: COLOR.aqua,
      'stroke-width': 2.6,
      'stroke-linecap': 'round',
    },
    fig,
  )
  svg('circle', { cx: 300, cy: 104, r: 4.5, fill: COLOR.aqua }, fig)
  label({ x: 352, y: 91, 'text-anchor': 'end', fill: COLOR.aqua }, 12, [
    'MATCH',
  ])
  // the labels keep their pixel size as the figure scales with the card
  const fit = (): void => {
    const w = fig.getBoundingClientRect().width
    if (w === 0) return
    const k = 360 / w
    texts.forEach(([t, px]) => t.setAttribute('font-size', (px * k).toFixed(2)))
  }
  fit()
  new ResizeObserver(fit).observe(fig)
}

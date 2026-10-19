// ============================================================
// Lesson 1 sing it — Merc's A, a hum-along ring, Voice Mirror's rule
// ============================================================
//
// The kit's sing card (kit/sing.ts): Merc's A, or the same A an octave up,
// then four seconds of breathing while the visitor hums; nothing listens
// and nothing is scored. The illustration beside the practise card is this
// lesson's own: it shows what Voice Mirror does for real, that a reply an
// octave below the note it plays still counts as a match.

import { q, svg } from '@/features/lessons/kit/dom'
import { A3, A4, COLOR, rgba } from '@/features/lessons/kit/notes'
import { mountSing } from '@/features/lessons/kit/sing'

export function initSing(stills: { blue: string; orange: string }): void {
  mountSing(q('#sing'), {
    stills,
    notes: [
      { button: q<HTMLButtonElement>('#singA3'), which: 'blue', midi: A3 },
      { button: q<HTMLButtonElement>('#singA4'), which: 'orange', midi: A4 },
    ],
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

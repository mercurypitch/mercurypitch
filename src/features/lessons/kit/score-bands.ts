// ============================================================
// Score bands — a song's parts as bands on the pitch line
// ============================================================
//
// The score's pitch-line view (Lesson 28 WEB-SPEC, Toys 2 and Look): the
// same bars on one time axis, a row a semitone from one under the lowest
// note any part sings to three over the highest, a faint lane at each
// pitch a part sings and a bar line at each bar's end, and each note a band
// across its beats on its row, each part's in its own colour, Merc's blue
// and Tavi's orange, with the part's name over its highest band at the
// left, so colour never tells the parts apart alone. The band sounding
// lights, and the cursor is the score's: the drawing has the staffs'
// shape, one system and a row with no head inset, so `lightScore` and
// `writeScore` (kit/score-draw.ts) work it as they do the staffs.

import { svg } from './dom'
import { r } from './rhythm-glyphs'
import type { RowLayout } from './rhythm-layout'
import { SIDE, xOf } from './rhythm-layout'
import { FOUR_FOUR } from './rhythm-model'
import type { DrawnNote, ScoreDrawing } from './score-draw'
import type { ScoreScene, SystemLayout } from './score-layout'
import { BAR, barsOf, timedNotes } from './score-layout'
import { midiOf } from './staff-places'

/** Rows of room over the highest note, for its part's name, and under the lowest. */
const HEAD_ROWS = 3
const FOOT_ROWS = 1
/** The tallest row, px. */
const ROW_MOST = 14

/** The pitch line's one row, from `x0` to `x1`, beats across, with no head inset. */
function bandRow(
  x0: number,
  x1: number,
  beats: number,
  y0: number,
  y1: number,
): RowLayout {
  return {
    x0,
    x1,
    beats,
    metre: FOUR_FOUR,
    bar: BAR,
    beat: 1,
    padEvery: 1,
    y: (y0 + y1) / 2,
    space: 0,
    top: y0,
    bottom: y1,
    numberY: y1,
    countY: y1,
    stripTop: y1,
    stripH: 0,
    read2Y: y1,
    arcY: y1,
    arcH: 0,
  }
}

/** Draws the scene's parts as bands into `host` at `w` by `h`; the drawing, for the frames to light. */
export function drawBands(
  host: SVGSVGElement,
  scene: ScoreScene,
  size: { w: number; h: number },
): ScoreDrawing {
  host.replaceChildren()
  host.setAttribute('viewBox', `0 0 ${r(size.w)} ${r(size.h)}`)
  const timed = scene.staffs.map(timedNotes)
  const midis = timed.flatMap((t) => t.map((n) => midiOf(n.note)))
  const lo = Math.min(...midis) - FOOT_ROWS
  const hi = Math.max(...midis) + HEAD_ROWS
  const rows = hi - lo + 1
  const rowH = Math.min(ROW_MOST, (size.h - 8) / rows)
  const top = (size.h - rowH * rows) / 2
  const yOf = (midi: number): number => top + (hi - midi + 0.5) * rowH
  const bars = barsOf(scene)
  const row = bandRow(
    SIDE + 2,
    size.w - SIDE,
    bars * BAR,
    top,
    top + rowH * rows,
  )
  const g = svg('g', { class: 'sc-bands' }, host)
  for (const midi of [...new Set(midis)])
    svg(
      'line',
      {
        x1: r(row.x0),
        x2: r(row.x1),
        y1: r(yOf(midi)),
        y2: r(yOf(midi)),
        class: 'sc-lane',
      },
      g,
    )
  for (let b = 1; b <= bars; b++) {
    const x = b === bars ? row.x1 : xOf(row, b * BAR)
    svg(
      'line',
      {
        x1: r(x),
        x2: r(x),
        y1: r(row.top),
        y2: r(row.bottom),
        class: 'sc-beatline',
      },
      g,
    )
  }
  const bandH = Math.max(4, rowH * 0.78)
  const notes = timed.map((part, k): DrawnNote[] => {
    const staff = scene.staffs[k]
    const pg = svg(
      'g',
      { class: 'sc-part', 'data-staff': k, 'data-tone': staff?.tone ?? '' },
      g,
    )
    const highest = Math.max(...part.map((n) => midiOf(n.note)))
    svg(
      'text',
      {
        x: r(row.x0),
        y: r(yOf(highest) - rowH * 1.1),
        'font-size': r(Math.max(11, rowH * 0.95)),
        class: 'sc-part-name',
        text: staff?.label ?? '',
      },
      pg,
    )
    return part.map((n) => {
      const x = xOf(row, n.beat)
      const x2 = xOf(row, n.beat + n.beats)
      const y = yOf(midiOf(n.note))
      const el = svg('g', { class: 'sc-band', 'data-note': n.index }, pg)
      svg(
        'rect',
        {
          x: r(x + 1),
          y: r(y - bandH / 2),
          width: r(Math.max(2, x2 - x - 2)),
          height: r(bandH),
          rx: r(bandH / 2),
        },
        el,
      )
      return { el, beat: n.beat, beats: n.beats, system: 0, x, y }
    })
  })
  const cursor = svg(
    'line',
    {
      x1: r(row.x0),
      x2: r(row.x0),
      y1: r(row.top),
      y2: r(row.bottom),
      class: 'sc-cursor is-off',
    },
    g,
  )
  const system: SystemLayout = {
    from: 0,
    to: bars,
    rows: [row],
    top: row.top,
    bottom: row.bottom,
    tagTop: 0,
    tagH: 0,
    numberY: 0,
    numeralY: 0,
    metre: false,
  }
  return {
    layout: {
      w: size.w,
      h: size.h,
      space: 0,
      mark: 0,
      inset: 0,
      systems: [system],
    },
    notes,
    cursors: [cursor],
  }
}

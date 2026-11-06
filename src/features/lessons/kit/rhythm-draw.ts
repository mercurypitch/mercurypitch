// ============================================================
// Rhythm drawing — written bars on one line or a staff, with their pads, counts and strip
// ============================================================
//
// The rhythm bar's picture (Lesson 17 WEB-SPEC, Toys 1 and Look), drawn
// from a scene: rows of bars, the staff they sit on (one line, or the bass
// or the treble staff), the notation or the pitch-line view, the pads, the
// counts and the stopwatch strip. A scene is drawn once into the figure's
// one SVG, in the figure's own pixels, with every symbol in place and
// hidden; `set` then shows what has been heard and lights what sounds, so a
// note fades in at its start and a strip cell fills over its length without
// the drawing starting again. The pads' buttons are the toy's, on a layer
// over the figure; this module draws what they look like and hands back
// where each pad is.
//
// The writing, notes and rests, beams, ties, bar lines and the time
// signature on the line or the staff, is kit/rhythm-engrave.ts's, in the
// Ear Lab's engraving. Where everything falls is kit/rhythm-layout.ts's,
// pure. Over the strip, the checkpoint draws each tap as a tick where it
// fell, gold where it met its note (`ticks`).
//
// Past 4/4 (Lesson 19 WEB-SPEC, Toys 1): a row's pads may span an eighth
// each, six to a bar of 6/8 or 3/4, every bar's first numbered larger; a
// grouped row draws an arc under each beat's pads, hidden until the
// group's first note sounds; and a figure of pads alone, the hero's,
// writes nothing above them.
//
// The pitch-line view is Season 1's picture: time left to right, pitch up,
// each sound a band as long as it is held, rests as dashed gaps, the beat
// lines under it (WEB-SPEC, Look). Ink and chrome are the page's tokens; a
// sounding note takes its singer's colour, Merc's blue or Tavi's orange
// (lesson-rhythm.css).

import { svg } from './dom'
import type { RowNotation } from './rhythm-engrave'
import { engraveRow, hline } from './rhythm-engrave'
import { r } from './rhythm-glyphs'
import type { RhythmLayout, RhythmRow, RhythmScene, RowLayout, } from './rhythm-layout'
import { headInset, layoutRhythm, padSpan, placeRow, SIDE, symbolX, xOf, } from './rhythm-layout'
import type { FigureCount, PlacedSymbol } from './rhythm-model'
import { countsOf, GAP_S, soundsOf } from './rhythm-model'
import { midiOf } from './staff-places'
import type { StripPlan } from './stopwatch-strip'
import { planStrip } from './stopwatch-strip'

/** Everything one row draws, for `set` to show and light: its writing (kit/rhythm-engrave.ts), pads, arcs, counts and strip. */
interface RowParts extends RowNotation {
  readonly placed: readonly PlacedSymbol[]
  /** Each arc under a group of pads, by its group, from 0. */
  readonly arcs: readonly SVGPathElement[]
  readonly pads: readonly SVGGElement[]
  readonly counts: readonly {
    count: FigureCount
    of: number
    el: SVGTextElement
  }[]
  readonly cells: readonly SVGGElement[]
  readonly readings: readonly { cells: readonly number[]; el: SVGTextElement }[]
  /** Where the taps' ticks go, over the strip; null with no strip. */
  readonly tickLayer: SVGGElement | null
  readonly plan: StripPlan
  /** The sounds, a tied run as one, each with its symbols. */
  readonly sounds: readonly { first: number; last: number }[]
}

/** How one row shows at a moment. */
export interface RowState {
  /** Per placed symbol: written yet. */
  readonly written: readonly boolean[]
  /** The placed symbol sounding now; its whole tied run lights with it. */
  readonly sounding?: number | null
  /** The 4/4 at the line's start. */
  readonly metre: boolean
  /** The pad lit now, from 0: a beat's, or an eighth's where a pad spans one. */
  readonly lit?: number | null
  /** Per arc under a group of pads: drawn yet. */
  readonly arcs?: readonly boolean[]
  /** The pad chosen for Halve and Join. */
  readonly chosen?: number | null
  /** Per strip cell: its reading shown. */
  readonly read?: readonly boolean[]
  /** The strip cell filling now, and over how long, s. */
  readonly filling?: { readonly cell: number; readonly seconds: number } | null
  /** The counts at full strength or faint. */
  readonly faint?: boolean
  /** The count lit now, by index. */
  readonly countLit?: number | null
}

/** A pad's box in the figure's pixels. */
export interface PadBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** A tap drawn where it fell in a row: its beat from the row's start, and whether it met its note. */
export interface RhythmTick {
  readonly beat: number
  readonly met: boolean
}

/** A drawn figure: where everything is, and how to show a moment of it. */
export interface RhythmFigure {
  readonly layout: RhythmLayout
  /** Each row's placed symbols, strip plan, counts and arcs. */
  readonly rows: readonly {
    readonly placed: readonly PlacedSymbol[]
    readonly strip: StripPlan
    readonly counts: readonly FigureCount[]
    readonly arcs: number
  }[]
  /** Where a row's pad is, by its place from 0: a beat's, or an eighth's where a pad spans one. */
  padBox(row: number, pad: number): PadBox
  set(states: readonly RowState[]): void
  /** Draws taps as ticks across a row's strip, gold where one met its note, in place of the ticks before. */
  ticks(row: number, at: readonly RhythmTick[]): void
}

/**
 * The figure's size: the box its drawing fills, inside any border, so the
 * drawing is made at the size it shows, never scaled to fit; or a phone's
 * figure where nothing lays it out (jsdom).
 */
export function figureSize(el: Element): { w: number; h: number } {
  const b = el.getBoundingClientRect()
  const cs = window.getComputedStyle(el)
  const px = (v: string): number => Number.parseFloat(v) || 0
  const w = b.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth)
  const h = b.height - px(cs.borderTopWidth) - px(cs.borderBottomWidth)
  return w > 0 && h > 0 ? { w, h } : { w: 356, h: 250 }
}

/**
 * The pitch-line view of a row: lanes, beat lines, a band for each sound
 * and a dashed gap for each rest. A row on one note has five lanes, its
 * note's the middle one; a row that gives its notes, a tune, has a lane at
 * each of its pitches, a semitone half a lane, and each band at its own.
 */
function lanes(
  row: RowLayout,
  placed: readonly PlacedSymbol[],
  rowScene: RhythmRow,
  parent: Element,
): SVGGElement[] {
  const lane = row.space * 1.1
  const sounds = soundsOf(placed)
  const pitch = (n: number): number | null => {
    const note = rowScene.notes?.[n]
    return note === undefined ? null : midiOf(note)
  }
  const pitches = sounds
    .map((_, n) => pitch(n))
    .filter((m): m is number => m !== null)
  const mid =
    pitches.length === 0
      ? null
      : (Math.min(...pitches) + Math.max(...pitches)) / 2
  const yOf = (m: number | null): number =>
    mid === null || m === null ? row.y : row.y - ((m - mid) * lane) / 2
  if (mid === null)
    for (let k = -2; k <= 2; k++)
      hline(
        row.x0,
        row.x1,
        row.y + k * lane,
        k === 0 ? 'rb-lane is-note' : 'rb-lane',
        parent,
      )
  else
    for (const m of [...new Set(pitches)].sort((a, b) => a - b))
      hline(row.x0, row.x1, yOf(m), 'rb-lane', parent)
  // a line on each of the metre's beats, a bar's first marked
  for (let k = 0; k * row.beat <= row.beats + 1e-6; k++) {
    const b = k * row.beat
    const onBar = Math.abs(b / row.bar - Math.round(b / row.bar)) < 1e-6
    svg(
      'line',
      {
        x1: r(xOf(row, b)),
        x2: r(xOf(row, b)),
        y1: r(row.y - 2.5 * lane),
        y2: r(row.y + 2.5 * lane),
        class: onBar ? 'rb-beatline is-bar' : 'rb-beatline',
      },
      parent,
    )
  }
  // a band ends where its sound is let go, its gap at the tempo (FACTS 63)
  const bpm = rowScene.bpm
  const gap = (beats: number): number =>
    (Math.min(GAP_S, (beats * 60) / bpm / 4) * bpm) / 60
  // a tune's bands a whole tone apart keep a gap between them
  const h = mid === null ? lane * 0.9 : lane * 0.8
  const band = (
    from: number,
    to: number,
    cls: string,
    g: Element,
    y = row.y,
  ): void => {
    svg(
      'rect',
      {
        x: r(from),
        y: r(y - h / 2),
        width: r(Math.max(2, to - from)),
        height: r(h),
        rx: 3,
        class: cls,
      },
      g,
    )
  }
  return placed.map((p, i) => {
    const g = svg(
      'g',
      {
        class: `rb-sym rb-${p.kind} is-hidden`,
        'data-part': p.kind === 'note' ? 'band' : 'gap',
        'data-i': i,
      },
      parent,
    )
    const n = sounds.findIndex((s) => s.first === i)
    if (p.kind === 'rest')
      band(xOf(row, p.beat) + 1, xOf(row, p.beat + p.beats) - 1, 'rb-gap', g)
    else if (n !== -1)
      band(
        xOf(row, sounds[n].at),
        xOf(row, sounds[n].at + sounds[n].beats - gap(sounds[n].beats)),
        'rb-band',
        g,
        yOf(pitch(n)),
      )
    return g
  })
}

/** A row's pads, how many, and how many to a bar. */
const padsOf = (row: RowLayout): { count: number; perBar: number } => ({
  count: Math.round(row.beats / row.padEvery),
  perBar: Math.round(row.bar / row.padEvery),
})

/** A row's pads, numbered from 1 in each bar, a beat a pad (4/4's four) or an eighth (six to a bar of 6/8 or 3/4), each bar's first numbered larger. */
function drawPads(row: RowLayout, parent: Element): SVGGElement[] {
  const { count, perBar } = padsOf(row)
  return Array.from({ length: count }, (_, k) => {
    const pad = svg(
      'g',
      {
        class: k % perBar === 0 ? 'rb-pad one' : 'rb-pad',
        'data-beat': k * row.padEvery,
        'data-pad': k,
      },
      parent,
    )
    const x = xOf(row, k * row.padEvery)
    const x2 = xOf(row, (k + 1) * row.padEvery)
    // a figure drawn at no size, in a panel not yet shown, has empty pads
    const span = padSpan(row, x, x2)
    svg(
      'rect',
      {
        x: r(span.x),
        y: r(row.top),
        width: r(span.w),
        height: r(row.bottom - row.top),
        rx: 10,
        class: 'rb-pad-box',
      },
      pad,
    )
    svg(
      'text',
      {
        x: r((x + x2) / 2),
        y: r(row.numberY),
        'text-anchor': 'middle',
        class: 'rb-pad-n',
        text: String((k % perBar) + 1),
      },
      pad,
    )
    return pad
  })
}

/**
 * An arc under each group of pads, a group a beat of the row's metre: two
 * of three in 6/8, three of two in 3/4, each hidden until its group's
 * first note sounds (Lesson 19 WEB-SPEC, Toys 1). A row whose pads are its
 * beats has no groups to draw.
 */
function drawArcs(row: RowLayout, parent: Element): SVGPathElement[] {
  const per = Math.round(row.beat / row.padEvery)
  if (per < 2) return []
  const groups = Math.round(row.beats / row.beat)
  return Array.from({ length: groups }, (_, g) => {
    const from = xOf(row, g * row.beat) + 6
    const to = xOf(row, (g + 1) * row.beat) - 6
    const y = row.arcY
    return svg(
      'path',
      {
        d: `M${r(from)} ${r(y)}Q${r((from + to) / 2)} ${r(y + row.arcH * 2)} ${r(to)} ${r(y)}`,
        class: 'rb-arc is-hidden',
        'data-part': 'arc',
        'data-group': g,
      },
      parent,
    )
  })
}

/** Each count under the note it falls on, or under its beat when a note holds over it. */
function drawCounts(
  row: RowLayout,
  placed: readonly PlacedSymbol[],
  parent: Element,
): RowParts['counts'] {
  return countsOf(placed, row.metre).map((count) => {
    const of = placed.findIndex(
      (p) => p.beat <= count.at + 1e-6 && count.at < p.beat + p.beats - 1e-6,
    )
    const p = placed[of] as PlacedSymbol | undefined
    const onIt = p !== undefined && Math.abs(p.beat - count.at) < 1e-6
    const x = onIt ? symbolX(row, p) : xOf(row, count.at) + headInset(row, 1)
    const el = svg(
      'text',
      {
        x: r(x),
        y: r(row.countY),
        'text-anchor': 'middle',
        class: count.said ? 'rb-count is-hidden' : 'rb-count is-held is-hidden',
        'data-part': 'count',
        text: count.text,
      },
      parent,
    )
    return { count, of, el }
  })
}

/** The strip's cells, each with its fill, and its readings, hidden until read. */
function drawStrip(
  row: RowLayout,
  plan: StripPlan,
  parent: Element,
): Pick<RowParts, 'cells' | 'readings' | 'tickLayer'> {
  const g = svg('g', { class: 'rb-strip', 'aria-hidden': 'true' }, parent)
  const cells = plan.cells.map((c) => {
    const cg = svg(
      'g',
      {
        class: c.kind === 'rest' ? 'rb-cell is-rest' : 'rb-cell',
        'data-part': 'cell',
      },
      g,
    )
    const box = {
      x: r(c.left),
      y: r(row.stripTop),
      width: r(Math.max(0, c.right - c.left)),
      height: r(row.stripH),
      rx: 4,
    }
    svg('rect', { ...box, class: 'rb-cell-box' }, cg)
    svg('rect', { ...box, class: 'rb-fill' }, cg)
    return cg
  })
  const readings = plan.readings.map((reading) => ({
    cells: reading.cells,
    el: svg(
      'text',
      {
        x: r(reading.x),
        y: r(
          reading.row === 0 ? row.stripTop + row.stripH / 2 + 4.2 : row.read2Y,
        ),
        'text-anchor': 'middle',
        class: 'rb-read is-hidden',
        'data-part': 'reading',
        'data-row': reading.row,
        text: reading.text,
      },
      g,
    ),
  }))
  return { cells, readings, tickLayer: svg('g', { class: 'rb-ticks' }, g) }
}

/** One row, drawn. */
function drawRow(
  scene: RhythmScene,
  rowScene: RhythmRow,
  row: RowLayout,
  index: number,
  parent: Element,
): RowParts {
  const placed = placeRow(rowScene)
  const g = svg('g', { class: 'rb-row', 'data-row': index }, parent)
  const pads = scene.pads === false ? [] : drawPads(row, g)
  const arcs = scene.arcs === true ? drawArcs(row, g) : []
  const unwritten = {
    symbols: [],
    beams: [],
    ties: [],
    barlines: [],
    metre: null,
  }
  const drawn =
    scene.notation === false
      ? unwritten
      : scene.lanes === true
        ? { ...unwritten, symbols: lanes(row, placed, rowScene, g) }
        : engraveRow(scene, rowScene, row, placed, g)
  const counts = scene.counts === true ? drawCounts(row, placed, g) : []
  const reads = rowScene.reads
  const plan = planStrip(placed, rowScene.bpm, {
    x: (beat) => xOf(row, beat),
    left: SIDE,
    right: row.x1,
    reads: reads === undefined ? undefined : (_cell, i) => reads(i),
  })
  const strip =
    scene.strip === false
      ? { cells: [], readings: [], tickLayer: null }
      : drawStrip(row, plan, g)
  return {
    placed,
    ...drawn,
    pads,
    arcs,
    counts,
    ...strip,
    plan,
    sounds: soundsOf(placed),
  }
}

/** The notation's part of a moment: what is written, what sounds, the beams, ties, bar lines and the 4/4. */
function showWriting(p: RowParts, st: RowState): void {
  const isWritten = (i: number): boolean => st.written[i] === true
  const at = st.sounding ?? null
  const sounding =
    at === null
      ? undefined
      : p.sounds.find((s) => at >= s.first && at <= s.last)
  const lit = (i: number): boolean =>
    sounding !== undefined && i >= sounding.first && i <= sounding.last
  p.symbols.forEach((g, i) => {
    g.classList.toggle('is-hidden', !isWritten(i))
    g.classList.toggle('is-sounding', lit(i))
  })
  for (const { group, el } of p.beams) {
    const whole = group.members.every(isWritten)
    el.classList.toggle('is-hidden', !whole)
    for (const k of group.members)
      p.symbols[k].classList.toggle('is-beamed', whole)
  }
  for (const t of p.ties) {
    t.el.classList.toggle('is-hidden', !isWritten(t.to))
    t.el.classList.toggle('is-sounding', lit(t.from) && lit(t.to))
  }
  for (const b of p.barlines)
    b.el.classList.toggle('is-hidden', !isWritten(b.after))
  p.metre?.classList.toggle('is-hidden', !st.metre)
}

/** The rest of a moment: the lit pad, the counts and the strip. */
function showTime(p: RowParts, st: RowState): void {
  p.pads.forEach((pad, b) => {
    pad.classList.toggle('is-now', st.lit === b)
    pad.classList.toggle('is-chosen', st.chosen === b)
  })
  p.arcs.forEach((arc, g) =>
    arc.classList.toggle('is-hidden', st.arcs?.[g] !== true),
  )
  p.counts.forEach((c, k) => {
    c.el.classList.toggle('is-hidden', st.written[c.of] !== true)
    c.el.classList.toggle('is-lit', st.countLit === k && st.faint !== true)
    c.el.classList.toggle('is-faint', st.faint === true)
  })
  const read = (i: number): boolean => st.read?.[i] === true
  const filling = st.filling ?? null
  p.cells.forEach((cell, i) => {
    const now = filling !== null && filling.cell === i && !read(i)
    cell.classList.toggle('is-full', read(i))
    cell.classList.toggle('is-filling', now)
    if (now) cell.style.setProperty('--fill-s', `${filling.seconds}s`)
  })
  for (const reading of p.readings)
    reading.el.classList.toggle('is-hidden', !reading.cells.every(read))
}

/**
 * Draws `scene` into `el`, every part in place and hidden, and hands back
 * the figure, whose `set` shows a moment of it.
 */
export function drawRhythm(
  el: SVGSVGElement,
  scene: RhythmScene,
  size: { w: number; h: number } = figureSize(el),
): RhythmFigure {
  const L = layoutRhythm(size.w, size.h, scene)
  el.replaceChildren()
  el.setAttribute('viewBox', `0 0 ${r(size.w)} ${r(size.h)}`)
  el.dataset.staff = scene.lanes === true ? 'lanes' : scene.staff
  const parts = scene.rows.map((rowScene, i) =>
    drawRow(scene, rowScene, L.rows[i], i, el),
  )
  return {
    layout: L,
    rows: parts.map((p) => ({
      placed: p.placed,
      strip: p.plan,
      counts: p.counts.map((c) => c.count),
      arcs: p.arcs.length,
    })),
    padBox(ri, pad) {
      const row = L.rows[ri]
      const span = padSpan(
        row,
        xOf(row, pad * row.padEvery),
        xOf(row, (pad + 1) * row.padEvery),
      )
      return { x: span.x, y: row.top, w: span.w, h: row.bottom - row.top }
    },
    set(states) {
      parts.forEach((p, i) => {
        const st = states[i] as RowState | undefined
        if (st === undefined) return
        showWriting(p, st)
        showTime(p, st)
      })
    },
    ticks(ri, at) {
      const layer = parts[ri]?.tickLayer ?? null
      const row = L.rows[ri] as RowLayout | undefined
      if (layer === null || row === undefined) return
      layer.replaceChildren()
      for (const t of at) {
        const x = r(xOf(row, t.beat))
        svg(
          'line',
          {
            x1: x,
            x2: x,
            y1: r(row.stripTop - 4),
            y2: r(row.stripTop + row.stripH + 4),
            class: t.met ? 'rb-tick is-met' : 'rb-tick',
          },
          layer,
        )
      }
    },
  }
}

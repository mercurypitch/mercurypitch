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
// The writing is the Ear Lab's, as The Chart draws it (FACTS 13, 40;
// src/features/ear-lab/RhythmScore.tsx): oval heads, open for a half or a
// whole note, stems, flags and beams by its `beamGroups`, its rests, a whole
// rest hanging under the line and a half rest on it, and dots; with ties,
// which the Ear Lab never writes. On the one line every stem goes up and a
// tie curves below. On a staff a note's place sets its stem: from the
// middle line up it points down, on the left of the head, and its tie
// curves above, so A3 on the bass staff's top line is written stems down,
// tied above, its dot in the space over the line; A4 in the treble's second
// space stems up, tied below, its dot in its own space (FACTS 29). Flags in
// one beat join into a beam once every note under it is written, so a beat
// of eighths written as it sounds shows its flags until its last note, then
// the beam (WEB-SPEC, Toys 1, "Written as it sounds"). The 4/4 is written at
// the line's start, shown with the first note heard. A bare figure, a short
// rhythm on its own as the four words' tickets show one, has neither the
// 4/4 nor a bar line, and its bars, groups here, may start where the row
// says (WEB-SPEC, Toys 4).
//
// Where everything falls is kit/rhythm-layout.ts's, pure. Over the strip,
// the checkpoint draws each tap as a tick where it fell, gold where it met
// its note (`ticks`).
//
// The pitch-line view is Season 1's picture: time left to right, pitch up,
// each sound a band as long as it is held, rests as dashed gaps, the beat
// lines under it (WEB-SPEC, Look). Ink and chrome are the page's tokens; a
// sounding note takes its singer's colour, Merc's blue or Tavi's orange
// (lesson-rhythm.css).

import type { BeamGroup } from '@/lib/ear/rhythm-notation'
import { beamGroups } from '@/lib/ear/rhythm-notation'
import { svg } from './dom'
import type { Metrics, NoteSpot } from './rhythm-glyphs'
import { engraveClef, engraveMetre, engraveNote, engraveRest, metrics, r, stemEnd, stemX, tiePath, } from './rhythm-glyphs'
import type { RhythmLayout, RhythmRow, RhythmScene, RhythmStaff, RowLayout, } from './rhythm-layout'
import { headInset, layoutRhythm, placeRow, SIDE, STAFF_A, symbolX, xOf, } from './rhythm-layout'
import type { FigureCount, PlacedSymbol } from './rhythm-model'
import { BAR_BEATS, countsOf, GAP_S, soundsOf } from './rhythm-model'
import { ledgersOf, placeOf } from './staff-places'
import type { StripPlan } from './stopwatch-strip'
import { planStrip } from './stopwatch-strip'

/** A note's place on the row's staff: its letters above the bottom line, or the one line's 4. */
function placeIn(staff: RhythmStaff, row: RhythmRow, sound: number): number {
  if (staff === 'line') return 4
  return placeOf(row.notes?.[sound] ?? STAFF_A[staff], staff)
}

/** A place's height: the middle line is place 4. */
const yAt = (row: RowLayout, place: number): number =>
  row.y - ((place - 4) * row.space) / 2

/** Everything one row draws, for `set` to show and light. */
interface RowParts {
  readonly placed: readonly PlacedSymbol[]
  readonly symbols: readonly SVGGElement[]
  readonly beams: readonly { group: BeamGroup; el: SVGGElement }[]
  readonly ties: readonly { from: number; to: number; el: SVGPathElement }[]
  readonly barlines: readonly { after: number; el: SVGLineElement }[]
  readonly metre: SVGGElement | null
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
  /** The beat lit now, from 0. */
  readonly lit?: number | null
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
  /** Each row's placed symbols, strip plan and counts. */
  readonly rows: readonly {
    readonly placed: readonly PlacedSymbol[]
    readonly strip: StripPlan
    readonly counts: readonly FigureCount[]
  }[]
  /** Where a row's pad for a beat is. */
  padBox(row: number, beat: number): PadBox
  set(states: readonly RowState[]): void
  /** Draws taps as ticks across a row's strip, gold where one met its note, in place of the ticks before. */
  ticks(row: number, at: readonly RhythmTick[]): void
}

/** The figure's size: its box, or a phone's figure where nothing lays it out (jsdom). */
export function figureSize(el: Element): { w: number; h: number } {
  const b = el.getBoundingClientRect()
  return b.width > 0 && b.height > 0
    ? { w: b.width, h: b.height }
    : { w: 356, h: 250 }
}

/** A horizontal line across `x1` to `x2` at `y`. */
const hline = (
  x1: number,
  x2: number,
  y: number,
  cls: string,
  parent: Element,
): SVGLineElement =>
  svg('line', { x1: r(x1), x2: r(x2), y1: r(y), y2: r(y), class: cls }, parent)

/** The bar lines, one at each full bar's end, shown once its last symbol is written. */
function barlines(
  row: RowLayout,
  placed: readonly PlacedSymbol[],
  staffed: boolean,
  parent: Element,
): { after: number; el: SVGLineElement }[] {
  const top = staffed ? yAt(row, 8) : row.y - row.space * 1.3
  const bottom = staffed ? yAt(row, 0) : row.y + row.space * 1.3
  const out: { after: number; el: SVGLineElement }[] = []
  for (let b = 0; (b + 1) * BAR_BEATS <= row.beats; b++) {
    const last = placed.reduce((at, p, i) => (p.bar === b ? i : at), -1)
    if (last === -1) continue
    const end = (b + 1) * BAR_BEATS
    const x = end >= row.beats ? row.x1 : xOf(row, end)
    const el = svg(
      'line',
      {
        x1: r(x),
        x2: r(x),
        y1: r(top),
        y2: r(bottom),
        class: 'rb-barline is-hidden',
      },
      parent,
    )
    out.push({ after: last, el })
  }
  return out
}

/** Each note's spot, from the sound it starts or carries on; null for a rest. */
function spotsOf(
  scene: RhythmScene,
  rowScene: RhythmRow,
  row: RowLayout,
  placed: readonly PlacedSymbol[],
): (NoteSpot | null)[] {
  let sound = -1
  return placed.map((p) => {
    if (p.kind !== 'note') return null
    if (p.onset !== null) sound++
    const place = placeIn(scene.staff, rowScene, Math.max(0, sound))
    return {
      x: symbolX(row, p),
      y: yAt(row, place),
      place,
      down: scene.staff !== 'line' && place >= 4,
    }
  })
}

/** Each tie, from its note to the next. */
function ties(
  placed: readonly PlacedSymbol[],
  spots: readonly (NoteSpot | null)[],
  m: Metrics,
  space: number,
  parent: Element,
): { from: number; to: number; el: SVGPathElement }[] {
  const out: { from: number; to: number; el: SVGPathElement }[] = []
  placed.forEach((p, i) => {
    if (!p.tie) return
    const to = placed.findIndex((q, k) => k > i && q.kind === 'note')
    const a = spots[i]
    const b = to === -1 ? null : spots[to]
    if (a === null || b === null) return
    const el = svg(
      'path',
      {
        d: tiePath(a, b, m, space),
        class: 'rb-tie is-hidden',
        'data-part': 'tie',
      },
      parent,
    )
    out.push({ from: i, to, el })
  })
  return out
}

/** Each beat's beam, over the stems' ends of the notes it joins. */
function beams(
  groups: readonly BeamGroup[],
  spots: readonly (NoteSpot | null)[],
  m: Metrics,
  space: number,
  parent: Element,
): { group: BeamGroup; el: SVGGElement }[] {
  return groups.map((group) => {
    const el = svg(
      'g',
      { class: 'rb-beam is-hidden', 'data-part': 'beam' },
      parent,
    )
    const members = group.members
      .map((k) => spots[k])
      .filter((s): s is NoteSpot => s !== null)
    const down = members[0]?.down === true
    const ends = members.map((s) => stemEnd(s, m))
    const end = down ? Math.max(...ends) : Math.min(...ends)
    for (const seg of group.segments) {
      const a = spots[seg.from]
      const b = spots[seg.to]
      if (a === null || b === null) continue
      const stub = seg.stub === null ? 0 : space * 0.9
      const x1 = stemX(a, m) - (seg.stub === 'left' ? stub : m.stemW / 2)
      const x2 = stemX(b, m) + (seg.stub === 'right' ? stub : m.stemW / 2)
      const inset = (seg.level - 1) * m.beamGap
      svg(
        'rect',
        {
          x: r(x1),
          y: r(down ? end - m.beamH - inset : end + inset),
          width: r(Math.max(0, x2 - x1)),
          height: r(m.beamH),
          class: 'rb-ink',
          'data-level': seg.level,
        },
        el,
      )
    }
    return { group, el }
  })
}

/** A row's notes and rests, ties, beams and bar lines, on its line or staff. */
function notation(
  scene: RhythmScene,
  rowScene: RhythmRow,
  row: RowLayout,
  placed: readonly PlacedSymbol[],
  parent: Element,
): Pick<RowParts, 'symbols' | 'beams' | 'ties' | 'barlines' | 'metre'> {
  const staff = scene.staff
  const staffed = staff !== 'line'
  const m = metrics(row.space)
  for (const place of staffed ? [0, 2, 4, 6, 8] : [4])
    hline(
      SIDE,
      row.x1,
      yAt(row, place),
      staffed ? 'rb-staff' : 'rb-line',
      parent,
    ).dataset.place = String(place)
  if (staff !== 'line')
    engraveClef(staff, SIDE + row.space * 0.5, yAt(row, 0), row.space, parent)
  const metre =
    scene.bare === true
      ? null
      : engraveMetre(
          row.x0 - row.space * (staffed ? 1.4 : 1.35),
          row.y,
          row.space,
          staffed,
          parent,
        )
  const spots = spotsOf(scene, rowScene, row, placed)
  const groups = beamGroups(placed)
  const beamed = new Set(groups.flatMap((g) => g.members))
  const symbols = placed.map((p, i) => {
    const g = svg(
      'g',
      {
        class: `rb-sym rb-${p.kind} is-hidden`,
        'data-part': p.kind,
        'data-i': i,
        'data-value': p.value,
      },
      parent,
    )
    const spot = spots[i]
    if (spot === null) {
      const whole = p.value >= 4 && p.beats >= BAR_BEATS
      const cx = whole
        ? (xOf(row, p.beat) + xOf(row, p.beat + p.beats)) / 2
        : symbolX(row, p)
      engraveRest(p, cx, row.y, row.space, staffed, g)
    } else {
      const ledgers =
        staff === 'line'
          ? []
          : ledgersOf(spot.place, staff).map((place) => yAt(row, place))
      engraveNote(
        p,
        { spot, m, space: row.space, ledgers, beamable: beamed.has(i) },
        g,
      )
    }
    return g
  })
  return {
    symbols,
    ties: ties(placed, spots, m, row.space, parent),
    beams: beams(groups, spots, m, row.space, parent),
    barlines: scene.bare === true ? [] : barlines(row, placed, staffed, parent),
    metre,
  }
}

/** The pitch-line view of a row: lanes, beat lines, a band for each sound and a dashed gap for each rest. */
function lanes(
  row: RowLayout,
  placed: readonly PlacedSymbol[],
  bpm: number,
  parent: Element,
): SVGGElement[] {
  const lane = row.space * 1.1
  for (let k = -2; k <= 2; k++)
    hline(
      row.x0,
      row.x1,
      row.y + k * lane,
      k === 0 ? 'rb-lane is-note' : 'rb-lane',
      parent,
    )
  for (let b = 0; b <= row.beats; b++)
    svg(
      'line',
      {
        x1: r(xOf(row, b)),
        x2: r(xOf(row, b)),
        y1: r(row.y - 2.5 * lane),
        y2: r(row.y + 2.5 * lane),
        class: b % BAR_BEATS === 0 ? 'rb-beatline is-bar' : 'rb-beatline',
      },
      parent,
    )
  // a band ends where its sound is let go, its gap at the tempo (FACTS 63)
  const gap = (beats: number): number =>
    (Math.min(GAP_S, (beats * 60) / bpm / 4) * bpm) / 60
  const sounds = soundsOf(placed)
  const band = (from: number, to: number, cls: string, g: Element): void => {
    svg(
      'rect',
      {
        x: r(from),
        y: r(row.y - lane * 0.45),
        width: r(Math.max(2, to - from)),
        height: r(lane * 0.9),
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
    const sound = sounds.find((s) => s.first === i)
    if (p.kind === 'rest')
      band(xOf(row, p.beat) + 1, xOf(row, p.beat + p.beats) - 1, 'rb-gap', g)
    else if (sound !== undefined)
      band(
        xOf(row, sound.at),
        xOf(row, sound.at + sound.beats - gap(sound.beats)),
        'rb-band',
        g,
      )
    return g
  })
}

/** A row's pads, numbered 1 to 4 a bar, beat 1's number larger. */
function drawPads(row: RowLayout, parent: Element): SVGGElement[] {
  return Array.from({ length: row.beats }, (_, b) => {
    const pad = svg(
      'g',
      {
        class: b % BAR_BEATS === 0 ? 'rb-pad one' : 'rb-pad',
        'data-beat': b,
      },
      parent,
    )
    const x = xOf(row, b)
    svg(
      'rect',
      {
        x: r(x + 2),
        y: r(row.top),
        width: r(xOf(row, b + 1) - x - 4),
        height: r(row.bottom - row.top),
        rx: 10,
        class: 'rb-pad-box',
      },
      pad,
    )
    svg(
      'text',
      {
        x: r((x + xOf(row, b + 1)) / 2),
        y: r(row.numberY),
        'text-anchor': 'middle',
        class: 'rb-pad-n',
        text: String((b % BAR_BEATS) + 1),
      },
      pad,
    )
    return pad
  })
}

/** Each count under the note it falls on, or under its beat when a note holds over it. */
function drawCounts(
  row: RowLayout,
  placed: readonly PlacedSymbol[],
  parent: Element,
): RowParts['counts'] {
  return countsOf(placed).map((count) => {
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
  const drawn =
    scene.lanes === true
      ? {
          symbols: lanes(row, placed, rowScene.bpm, g),
          beams: [],
          ties: [],
          barlines: [],
          metre: null,
        }
      : notation(scene, rowScene, row, placed, g)
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
    })),
    padBox(ri, beat) {
      const row = L.rows[ri]
      const x = xOf(row, beat)
      return {
        x: x + 2,
        y: row.top,
        w: xOf(row, beat + 1) - x - 4,
        h: row.bottom - row.top,
      }
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

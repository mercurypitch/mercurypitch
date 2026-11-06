// ============================================================
// Rhythm engraving — a row's written bars: notes and rests, beams, ties and bar lines
// ============================================================
//
// The rhythm drawing's notation (kit/rhythm-draw.ts), on one line or a
// five-line staff, in the figure's own pixels where the layout puts each
// row and symbol (kit/rhythm-layout.ts), from the glyphs of
// kit/rhythm-glyphs.ts. Each part is drawn hidden; the drawing's `set`
// shows what has been heard.
//
// The writing is the Ear Lab's, as The Chart draws it (Lesson 17 FACTS 13,
// 40; src/features/ear-lab/RhythmScore.tsx): oval heads, open for a half or
// a whole note, stems, flags and beams by its `beamGroups`, its rests, a
// whole rest hanging under the line and a half rest on it, and dots; with
// ties, which the Ear Lab never writes. On the one line every stem goes up
// and a tie curves below. On a staff a note's place sets its stem: from the
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
// Past 4/4 (Lesson 19 WEB-SPEC, Toys 1): a row's metre writes its time
// signature, 6/8, 3/4 or 2/4, its bar lines a bar apart and its beams by
// the metre's beat, 3 + 3 in 6/8 and 2 + 2 + 2 in 3/4; a beamed triplet
// carries its 3 over the beam, with no bracket, shown with the beam (FACTS
// 41); a system that carries on another writes its clef and no time
// signature. On a staff a beamed group's stems take one direction, from
// its highest and lowest notes, down from the middle line (FACTS 30).

import type { BeamGroup, TupletSpan } from '@/lib/ear/rhythm-notation'
import { tupletSpans } from '@/lib/ear/rhythm-notation'
import { svg } from './dom'
import type { Metrics, NoteSpot } from './rhythm-glyphs'
import { engraveClef, engraveMetre, engraveNote, engraveRest, metrics, r, stemEnd, stemX, tiePath, } from './rhythm-glyphs'
import type { RhythmRow, RhythmScene, RhythmStaff, RowLayout, } from './rhythm-layout'
import { SIDE, STAFF_A, symbolX, xOf } from './rhythm-layout'
import type { PlacedSymbol } from './rhythm-model'
import { beamsOf } from './rhythm-model'
import { ledgersOf, placeOf } from './staff-places'

/** A row's written parts, for the drawing's `set` to show and light. */
export interface RowNotation {
  readonly symbols: readonly SVGGElement[]
  readonly beams: readonly { group: BeamGroup; el: SVGGElement }[]
  readonly ties: readonly { from: number; to: number; el: SVGPathElement }[]
  readonly barlines: readonly { after: number; el: SVGLineElement }[]
  readonly metre: SVGGElement | null
}

/** A note's place on the row's staff: its letters above the bottom line, or the one line's 4. */
function placeIn(staff: RhythmStaff, row: RhythmRow, sound: number): number {
  if (staff === 'line') return 4
  return placeOf(row.notes?.[sound] ?? STAFF_A[staff], staff)
}

/** A place's height: the middle line is place 4. */
const yAt = (row: RowLayout, place: number): number =>
  row.y - ((place - 4) * row.space) / 2

/** A horizontal line across `x1` to `x2` at `y`. */
export const hline = (
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
  for (let b = 0; (b + 1) * row.bar <= row.beats + 1e-6; b++) {
    const last = placed.reduce((at, p, i) => (p.bar === b ? i : at), -1)
    if (last === -1) continue
    const end = (b + 1) * row.bar
    const x = end >= row.beats - 1e-6 ? row.x1 : xOf(row, end)
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

/**
 * On a staff, each beamed group's stems in one direction, from its highest
 * and lowest notes: down when their middle is on or above the middle line
 * (Lesson 19 FACTS 30). On one line every stem stays up.
 */
function beamDirections(
  spots: readonly (NoteSpot | null)[],
  groups: readonly BeamGroup[],
): (NoteSpot | null)[] {
  const out = [...spots]
  for (const g of groups) {
    const places = g.members
      .map((k) => spots[k])
      .filter((s): s is NoteSpot => s !== null)
      .map((s) => s.place)
    if (places.length === 0) continue
    const down = (Math.min(...places) + Math.max(...places)) / 2 >= 4
    for (const k of g.members) {
      const spot = out[k]
      if (spot !== null) out[k] = { ...spot, down }
    }
  }
  return out
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

/** Each beat's beam, over the stems' ends of the notes it joins, a beamed triplet's 3 with it. */
function beams(
  groups: readonly BeamGroup[],
  spots: readonly (NoteSpot | null)[],
  m: Metrics,
  space: number,
  parent: Element,
  tuplets: readonly TupletSpan[] = [],
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
    tupletMark(group, spots, tuplets, { m, space, end, down }, el)
    return { group, el }
  })
}

/** A beamed triplet's 3, over its beam on the side away from the heads (FACTS 41); none for a group that is no triplet. */
function tupletMark(
  group: BeamGroup,
  spots: readonly (NoteSpot | null)[],
  tuplets: readonly TupletSpan[],
  beam: { m: Metrics; space: number; end: number; down: boolean },
  el: SVGGElement,
): void {
  const first = group.members[0]
  const last = group.members[group.members.length - 1]
  const span = tuplets.find(
    (t) => t.beamed && t.from === first && t.to === last,
  )
  const a = spots[first]
  const b = spots[last]
  if (span === undefined || a === null || b === null) return
  const { m, space, end, down } = beam
  svg(
    'text',
    {
      x: r((stemX(a, m) + stemX(b, m)) / 2),
      y: r(down ? end + space * 1.9 : end - space * 0.7),
      'text-anchor': 'middle',
      'font-size': r(space * 1.45),
      class: 'rb-tuplet',
      'data-part': 'tuplet',
      text: String(span.number),
    },
    el,
  )
}

/** Where each beamed note's stem ends: a beam lies at its group's furthest stem end, and every stem reaches it. */
function beamEnds(
  groups: readonly BeamGroup[],
  spots: readonly (NoteSpot | null)[],
  m: Metrics,
): Map<number, number> {
  const beamAt = new Map<number, number>()
  for (const g of groups) {
    const members = g.members
      .map((k) => spots[k])
      .filter((s): s is NoteSpot => s !== null)
    if (members.length === 0) continue
    const ends = members.map((s) => stemEnd(s, m))
    const at = members[0].down ? Math.max(...ends) : Math.min(...ends)
    for (const k of g.members) beamAt.set(k, at)
  }
  return beamAt
}

/** A row's notes and rests, ties, beams and bar lines, on its line or staff. */
export function engraveRow(
  scene: RhythmScene,
  rowScene: RhythmRow,
  row: RowLayout,
  placed: readonly PlacedSymbol[],
  parent: Element,
): RowNotation {
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
    scene.bare === true || rowScene.continues === true
      ? null
      : engraveMetre(
          row.x0 - row.space * (staffed ? 1.4 : 1.35),
          row.y,
          row.space,
          staffed,
          parent,
          [row.metre.top, row.metre.bottom],
        )
  const groups = beamsOf(placed, row.metre)
  const spots = staffed
    ? beamDirections(spotsOf(scene, rowScene, row, placed), groups)
    : spotsOf(scene, rowScene, row, placed)
  const beamed = new Set(groups.flatMap((g) => g.members))
  const beamAt = beamEnds(groups, spots, m)
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
      const whole = p.value >= 4 && p.beats >= row.bar
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
        {
          spot,
          m,
          space: row.space,
          ledgers,
          beamable: beamed.has(i),
          stemTo: beamAt.get(i),
        },
        g,
      )
    }
    return g
  })
  return {
    symbols,
    ties: ties(placed, spots, m, row.space, parent),
    beams: beams(
      groups,
      spots,
      m,
      row.space,
      parent,
      tupletSpans(placed, groups),
    ),
    barlines: scene.bare === true ? [] : barlines(row, placed, staffed, parent),
    metre,
  }
}

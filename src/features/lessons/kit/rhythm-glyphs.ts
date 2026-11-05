// ============================================================
// Rhythm glyphs — a note, a rest, a tie, a flag, a clef and the 4/4, engraved as SVG
// ============================================================
//
// The rhythm bar's engraving (kit/rhythm-draw.ts lays the bars out and
// shows them as they sound; Lesson 17 WEB-SPEC, Toys 1 and Look), after the
// Ear Lab's score (src/features/ear-lab/RhythmScore.tsx), whose metrics at
// a staff space of 8 px these scale: an oval head tilted 22 degrees, open
// for a half or a whole note; a stem three and a half spaces long, on the
// right of an up head and the left of a down one; a flag out from the stem's
// end and back, two for a sixteenth; a whole rest hanging under its line, a
// half rest on it, the quarter rest's zigzag and the eighth's and
// sixteenth's slash with its one or two knobs. A tie curves on the side away
// from the stems, from one head to the next. A clef is Noto Music's outline,
// as the staff toy engraves it (kit/staff-glyphs.ts, kit/glyphs.ts). A dot
// sits right of its head, in the head's own space, or in the space above a
// head on a line (FACTS 29).

import { svg } from './dom'
import { G_CLEF_PATH } from './glyphs'
import type { PlacedSymbol } from './rhythm-model'
import { BAR_BEATS } from './rhythm-model'
import { F_CLEF_PATH, NOTO_GLYPHS } from './staff-glyphs'
import type { Clef } from './staff-places'
import { isLine } from './staff-places'

/** Two decimals, enough for a pixel. */
export const r = (v: number): string => v.toFixed(2)

/** Glyph metrics at a staff space, px. */
export interface Metrics {
  /** The scale against the Ear Lab's space of 8 px. */
  readonly s: number
  readonly headRx: number
  readonly headRy: number
  readonly stem: number
  readonly stemW: number
  readonly beamH: number
  readonly beamGap: number
  readonly dot: number
}

/** The metrics at `space`, the Ear Lab's at a space of 8 scaled. */
export function metrics(space: number): Metrics {
  const s = space / 8
  return {
    s,
    headRx: 4.9 * s,
    headRy: 3.7 * s,
    stem: 3.5 * space,
    stemW: 1.6 * s,
    beamH: 3.6 * s,
    beamGap: 5.6 * s,
    dot: 1.7 * s,
  }
}

/** A written note in place: its head's centre, its place on the staff, and which way its stem goes. */
export interface NoteSpot {
  readonly x: number
  readonly y: number
  readonly place: number
  readonly down: boolean
}

/** Where a note's stem ends. */
export const stemEnd = (spot: NoteSpot, m: Metrics): number =>
  spot.down ? spot.y + m.stem : spot.y - m.stem

/** The stem's line: on the head's right going up, on its left going down. */
export const stemX = (spot: NoteSpot, m: Metrics): number =>
  spot.down ? spot.x - m.headRx + m.stemW / 2 : spot.x + m.headRx - m.stemW / 2

/** A clef, its staff's bottom line at `yBottom`, as the staff toy engraves it. */
export function engraveClef(
  c: Clef,
  x: number,
  yBottom: number,
  space: number,
  parent: Element,
): void {
  const k = space / NOTO_GLYPHS.space
  const base = c === 'treble' ? NOTO_GLYPHS.base.g : NOTO_GLYPHS.base.f
  svg(
    'path',
    {
      d: c === 'treble' ? G_CLEF_PATH : F_CLEF_PATH,
      class: 'rb-clef',
      transform: `translate(${r(x)} ${r(yBottom + base * k)}) scale(${k.toFixed(5)})`,
    },
    parent,
  )
}

/** The flag off a stem's end: out and back, falling from an up stem and rising from a down one. */
export function flagPath(
  x: number,
  y: number,
  s: number,
  down: boolean,
): string {
  const d = down ? -1 : 1
  return (
    `M ${r(x)} ${r(y)}` +
    ` c ${r(5.4 * s)} ${r(1.6 * s * d)}, ${r(7.4 * s)} ${r(5.4 * s * d)}, ${r(1.6 * s)} ${r(10.6 * s * d)}` +
    ` c ${r(2.2 * s)} ${r(-5.4 * s * d)}, ${r(0.4 * s)} ${r(-8.2 * s * d)}, ${r(-1.6 * s)} ${r(-9.4 * s * d)} z`
  )
}

/** A tie from one head to the next, a crescent on the side away from the stems. */
export function tiePath(
  a: NoteSpot,
  b: NoteSpot,
  m: Metrics,
  space: number,
): string {
  const d = a.down ? -1 : 1
  const y = a.y + d * (m.headRy + 1.5 * m.s)
  const x1 = a.x + m.headRx * 0.4
  const x2 = b.x - m.headRx * 0.4
  const mid = (x1 + x2) / 2
  const h = Math.min(space * 0.9, Math.max(space * 0.45, (x2 - x1) * 0.12))
  return (
    `M ${r(x1)} ${r(y)} Q ${r(mid)} ${r(y + d * h)} ${r(x2)} ${r(y)}` +
    ` Q ${r(mid)} ${r(y + d * (h - 1.6 * m.s))} ${r(x1)} ${r(y)} Z`
  )
}

/** A rest's block: a whole rest hangs from `top`, a half rest sits on its line. */
function block(cx: number, top: number, s: number, g: Element): void {
  svg(
    'rect',
    {
      x: r(cx - 7 * s),
      y: r(top),
      width: r(14 * s),
      height: r(5 * s),
      class: 'rb-ink',
    },
    g,
  )
}

/** The flagged rests' slash and its knobs, one for an eighth rest and two for a sixteenth. */
function slash(cx: number, y: number, s: number, knobs: number, g: Element) {
  svg(
    'path',
    {
      d: `M ${r(cx + 3.4 * s)} ${r(y - 9.4 * s)} L ${r(cx - 3 * s)} ${r(y + 8.4 * s)}`,
      class: 'rb-rest-stroke',
      'stroke-width': r(1.8 * s),
    },
    g,
  )
  for (let k = 0; k < knobs; k++)
    svg(
      'circle',
      {
        cx: r(cx + (1 - k * 2.1) * s),
        cy: r(y + (-7 + k * 6.2) * s),
        r: r(2.2 * s),
        class: 'rb-ink',
      },
      g,
    )
}

/**
 * A rest, drawn for its value at `cx` about `y`, the one line or the
 * staff's middle line: on a staff a whole rest hangs from the fourth line.
 */
export function engraveRest(
  p: PlacedSymbol,
  cx: number,
  y: number,
  space: number,
  staffed: boolean,
  g: Element,
): void {
  const s = space / 8
  if (p.value >= 4) block(cx, staffed ? y - space : y, s, g)
  else if (p.value === 2) block(cx, y - 5 * s, s, g)
  else if (p.value === 1)
    svg(
      'path',
      {
        d:
          `M ${r(cx - 3.4 * s)} ${r(y - 11 * s)}` +
          ` L ${r(cx + 3.2 * s)} ${r(y - 4.2 * s)}` +
          ` L ${r(cx - 3 * s)} ${r(y + 1.8 * s)}` +
          ` L ${r(cx + 3.8 * s)} ${r(y + 8.6 * s)}`,
        class: 'rb-rest-stroke',
        'stroke-width': r(2.4 * s),
      },
      g,
    )
  else slash(cx, y, s, p.value < 0.5 ? 2 : 1, g)
  if (p.dotted)
    svg(
      'circle',
      {
        cx: r(cx + 9 * s),
        cy: r(y - 4.5 * s),
        r: r(1.9 * s),
        class: 'rb-ink',
      },
      g,
    )
}

/** The 4/4 at `x`: on the one line straddling it, on a staff filling its two halves. */
export function engraveMetre(
  x: number,
  y: number,
  space: number,
  staffed: boolean,
  parent: Element,
): SVGGElement {
  const g = svg('g', { class: 'rb-metre', 'data-part': 'metre' }, parent)
  const size = staffed ? space * 2.15 : space * 1.7
  const ys = staffed
    ? [y - space * 0.08, y + space * 1.92]
    : [y - space * 0.2, y + space * 1.45]
  for (const at of ys)
    svg(
      'text',
      {
        x: r(x),
        y: r(at),
        'font-size': r(size),
        'text-anchor': 'middle',
        class: 'rb-metre-digit',
        text: String(BAR_BEATS),
      },
      g,
    )
  return g
}

/** How a note is engraved: its spot, the ledger lines it needs, and whether a beam will take its flags. */
export interface NoteEngraving {
  readonly spot: NoteSpot
  readonly m: Metrics
  readonly space: number
  /** The heights of its ledger lines. */
  readonly ledgers: readonly number[]
  /** Its flags give way to a beam once its beat is written. */
  readonly beamable: boolean
}

/** A note's head, stem, flags and dot, and its ledger lines. */
export function engraveNote(
  p: PlacedSymbol,
  e: NoteEngraving,
  g: Element,
): void {
  const { spot, m } = e
  for (const y of e.ledgers)
    svg(
      'line',
      {
        x1: r(spot.x - m.headRx * 1.6),
        x2: r(spot.x + m.headRx * 1.6),
        y1: r(y),
        y2: r(y),
        class: 'rb-staff',
      },
      g,
    )
  const open = p.value >= 2
  svg(
    'ellipse',
    {
      cx: r(spot.x),
      cy: r(spot.y),
      rx: r(m.headRx),
      ry: r(m.headRy),
      transform: `rotate(-22 ${r(spot.x)} ${r(spot.y)})`,
      class: open ? 'rb-head rb-open' : 'rb-head',
      'stroke-width': open ? r(1.5 * m.s) : null,
      'data-part': 'head',
    },
    g,
  )
  if (p.value < 4) stemAndFlags(p, e, g)
  if (p.dotted)
    svg(
      'circle',
      {
        cx: r(spot.x + m.headRx + 4 * m.s),
        cy: r(isLine(spot.place) ? spot.y - e.space / 2 : spot.y),
        r: r(m.dot),
        class: 'rb-ink',
        'data-part': 'dot',
      },
      g,
    )
}

/** A note's stem and the flags at its end. */
function stemAndFlags(p: PlacedSymbol, e: NoteEngraving, g: Element): void {
  const { spot, m } = e
  const x = stemX(spot, m)
  svg(
    'line',
    {
      x1: r(x),
      x2: r(x),
      y1: r(spot.y + (spot.down ? m.s : -m.s)),
      y2: r(stemEnd(spot, m)),
      class: 'rb-stem',
      'stroke-width': r(m.stemW),
      'data-part': 'stem',
    },
    g,
  )
  for (let k = 0; k < p.flags; k++)
    svg(
      'path',
      {
        d: flagPath(
          x,
          stemEnd(spot, m) + (spot.down ? -1 : 1) * k * 6.4 * m.s,
          m.s,
          spot.down,
        ),
        class: e.beamable ? 'rb-ink rb-flag is-beamable' : 'rb-ink rb-flag',
        'data-part': 'flag',
      },
      g,
    )
}

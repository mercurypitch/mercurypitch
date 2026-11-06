// ============================================================
// Staff interval drawing — the learner's staff beside the upright pitch line, straight or curled into a ring
// ============================================================
//
// The staff toy's interval state's picture (staff-interval.ts; Lesson 23's
// WEB-SPEC, Toys 1 and Look), drawn from a scene into the figure's one SVG:
// the pitch line on the left, a lane a semitone from C at its foot to the C
// an octave up, the white-key lanes chrome and the black-key lanes fainter,
// with B below the foot in Step 4; the staff on the right, engraved by the
// staff toy's own drawing (staff-draw.ts) in a frame of its own. A sounding
// note lights in its singer's colour on both, blue on the bass staff and
// orange on the treble, and only the notes of the interval shown are named,
// beside their lanes. A thin span beside the lanes runs from the interval's
// bottom note to its top; a fold lays two spans end to end, and once they
// meet the bracket for the whole octave turns gold, the only gold on the
// page, with the sums beside it, "7 + 5" over "= 12".
//
// Curled, the line bends round until its two Cs meet in one bead at the
// top: Lesson 2's ring of twelve, seen from the top, every bead named, the
// B below the foot landing on the ring's B. The bend keeps each lane's
// distance along the line, so it is the line that bends, its middle, F♯,
// staying at the ring's foot, while the whole turns a quarter and grows to
// the ring's size. The interval shown is drawn across the ring as a chord,
// so a tritone is its diameter. Before the cold open's choice the line
// draws its white-key lanes alone, at their heights, and a black key that
// sounds draws its own lane; at the choice the rest draw in.

import { clamp, easeInOut, lerp, svg } from './dom'
import type { Spelled } from './notes'
import { isBlack, signName } from './notes'
import type { Layout, Mark } from './staff-draw'
import { drawScene, emptyScene, layoutScene } from './staff-draw'
import type { Clef } from './staff-places'
import { midiOf, placeRange, writtenOf } from './staff-places'

/** What the figure shows. */
export interface IntervalScene {
  readonly clef: Clef
  /** The C at the line's foot, as MIDI: 48 under the bass staff, 60 under the treble. */
  readonly base: number
  /** The B lane below the foot (Step 4). */
  readonly bLane: boolean
  /** The pitch line beside the staff (the switch). */
  readonly lanes: boolean
  /** The cold open's choice is in: every black-key lane draws. */
  readonly open: boolean
  /** How far the black-key lanes have drawn in, 0 to 1. */
  readonly blacks: number
  /** Black-key lanes drawn whatever `blacks` says: one that has sounded before the choice. */
  readonly own: readonly number[]
  /** The lanes sounding now, by MIDI. */
  readonly lit: readonly number[]
  /** The interval's notes, named beside their lanes and on the ring. */
  readonly named: readonly Spelled[]
  /** Spans beside the lanes, each from its bottom note's MIDI up to its top's, and how far drawn, 0 to 1. */
  readonly spans: readonly {
    readonly lo: number
    readonly hi: number
    readonly u: number
  }[]
  /** The octave's gold bracket and its two lines of sums, once a fold has met in it. */
  readonly fit: readonly [string, string] | null
  /** 0 straight, 1 the ring. */
  readonly curl: number
  /** Under reduced motion the curl cross-fades: the line and the ring each at its own opacity. */
  readonly fade: boolean
  /** The staff's noteheads, written as they sound, and its columns. */
  readonly marks: readonly Mark[]
  readonly cols: number
}

/** Where the parts sit, for the toy's taps. */
export interface IntervalLayout {
  readonly w: number
  readonly h: number
  /** The staff's frame: its left edge, and its own layout inside it. */
  readonly staffX: number
  readonly staff: Layout
}

/** The pitch line's share of the figure's width (Lesson 23 FACTS 79: the staff about 60 %), and the most it takes on a wide figure, px. */
const LINE_SHARE = 0.4
const LINE_MAX = 200
const PAD = 14

const r = (v: number): string => v.toFixed(2)
const clamp01 = (u: number): number => clamp(u, 0, 1)

/** The semitones a scene's line draws, top first: 12 down to 0, and -1 for the B lane. */
const steps = (s: IntervalScene): number[] =>
  Array.from({ length: s.bLane ? 14 : 13 }, (_, i) => 12 - i)

/** The sums' type size beside the gold bracket, px. */
const sumSize = (w: number): number => clamp(w * 0.075, 10.5, 13)

/**
 * The straight line's geometry, left to right in its share `w`: the sums,
 * the gold bracket, the two spans, the lanes, then the names; its lane
 * height and a lane's centre height.
 */
function straight(s: IntervalScene, w: number, h: number) {
  const n = steps(s).length
  const lh = (h - 2 * PAD) / n
  // "= 12" and "7 + 5" right-aligned 4 px left of the bracket, which sits
  // 22 px left of the lanes, with the spans between
  const x0 = sumSize(w) * 3.2 + 30
  const laneW = clamp(w - x0 - 40, 24, 56)
  return {
    lh,
    x0,
    x1: x0 + laneW,
    yOf: (semi: number): number => PAD + (12 - semi + 0.5) * lh,
  }
}

/** The ring's centre, radius and bead size, inside the line's share of the figure. */
function ring(w: number, h: number) {
  const R = Math.max(30, Math.min(w, h) / 2 - 30)
  return { cx: w / 2, cy: h / 2, R, bead: Math.min(9, R * 0.19) }
}

/** A lane's place and turn as the line curls by `u`: its centre, its angle (deg), and its size. */
function laneAt(
  s: IntervalScene,
  semi: number,
  u: number,
  w: number,
  h: number,
): { x: number; y: number; deg: number; lw: number; lh: number; rx: number } {
  const L = straight(s, w, h)
  const g = ring(w, h)
  const laneW = L.x1 - L.x0
  const cxLine = (L.x0 + L.x1) / 2
  const tau = semi - 6
  // the bend: the arc keeps each lane's distance from the middle, F♯
  const k = (2 * Math.PI * u) / 12
  const px = k < 1e-6 ? 0 : (1 - Math.cos(k * tau)) / k
  const py = k < 1e-6 ? tau : Math.sin(k * tau) / k
  // a quarter turn, so the two Cs meet at the top
  const t = (Math.PI / 2) * u
  const x = px * Math.cos(t) - py * Math.sin(t)
  const y = px * Math.sin(t) + py * Math.cos(t)
  const scale = lerp(L.lh, g.R / (12 / (2 * Math.PI)), u)
  const ox = lerp(cxLine, g.cx, u)
  const oy = lerp(L.yOf(6), g.cy + g.R, u)
  const d = g.bead * 2
  return {
    x: ox + scale * x,
    y: oy - scale * y,
    deg: ((k * tau - t) * 180) / Math.PI,
    lw: lerp(laneW, d, u),
    lh: lerp(L.lh - 1, d, u),
    rx: lerp(1, g.bead, u),
  }
}

/** The name of `midi` as the interval spells it, or by its sharp. */
const nameFor = (midi: number, named: readonly Spelled[]): Spelled =>
  named.find((n) => midiOf(n) === midi) ?? writtenOf(midi)

/** The line or the ring, lanes and beads, at curl `u`, faded to `opacity`. */
function laneLayer(
  s: IntervalScene,
  u: number,
  opacity: number,
  w: number,
  h: number,
  tone: string,
  parent: Element,
): void {
  if (opacity <= 0) return
  const g = svg('g', { class: 'iv-lanes', opacity: r(opacity) }, parent)
  const lit = new Set(s.lit)
  for (const semi of steps(s)) {
    const midi = s.base + semi
    const black = isBlack(midi)
    const own = s.own.includes(midi)
    if (black && !own && !s.open) continue
    const drawn = black && !own ? s.blacks : 1
    const at = laneAt(s, semi, u, w, h)
    const lw = at.lw * drawn
    svg(
      'rect',
      {
        x: r(-lw / 2),
        y: r(-at.lh / 2),
        width: r(Math.max(0.5, lw)),
        height: r(Math.max(0.5, at.lh)),
        rx: r(at.rx),
        transform: `translate(${r(at.x)} ${r(at.y)}) rotate(${r(at.deg)})`,
        opacity: drawn < 1 ? r(drawn) : undefined,
        class: `iv-lane ${black ? 'is-black' : 'is-white'}${lit.has(midi) ? ` is-lit is-${tone}` : ''}`,
      },
      g,
    )
  }
}

/** The straight line's names, spans, and the gold bracket with its sums, faded as the line curls. */
function lineMarks(
  s: IntervalScene,
  opacity: number,
  w: number,
  h: number,
  parent: Element,
): void {
  if (opacity <= 0) return
  const L = straight(s, w, h)
  const g = svg('g', { class: 'iv-marks', opacity: r(opacity) }, parent)
  const size = Math.min(14, Math.max(11, L.lh * 0.62))
  const seen = new Set<number>()
  for (const n of s.named) {
    const midi = midiOf(n)
    const semi = midi - s.base
    if (seen.has(midi) || semi < -1 || semi > 12) continue
    seen.add(midi)
    svg(
      'text',
      {
        x: r(L.x1 + 6),
        y: r(L.yOf(semi) + size * 0.36),
        'font-size': r(size),
        class: 'iv-name',
        text: signName(n),
      },
      g,
    )
  }
  s.spans.forEach((span, i) => {
    const u = clamp01(span.u)
    if (u <= 0) return
    const x = L.x0 - 6 - i * 6
    const y0 = L.yOf(span.lo - s.base)
    const y1 = lerp(y0, L.yOf(span.hi - s.base), u)
    svg(
      'line',
      { x1: r(x), x2: r(x), y1: r(y0), y2: r(y1), class: 'iv-span' },
      g,
    )
  })
  if (s.fit === null) return
  const x = L.x0 - 22
  const yTop = L.yOf(12)
  const yBot = L.yOf(0)
  svg(
    'path',
    {
      d: `M${r(x + 4)} ${r(yTop)}H${r(x)}V${r(yBot)}H${r(x + 4)}`,
      class: 'iv-fit',
    },
    g,
  )
  const mid = (yTop + yBot) / 2
  const fs = sumSize(w)
  s.fit.forEach((line, i) =>
    svg(
      'text',
      {
        x: r(x - 4),
        y: r(mid + (i - 0.5) * fs * 1.25 + fs * 0.36),
        'font-size': r(fs),
        'text-anchor': 'end',
        class: 'iv-fit-sum',
        text: line,
      },
      g,
    ),
  )
}

/** The ring's names and the interval's chord across it. */
function ringMarks(
  s: IntervalScene,
  opacity: number,
  w: number,
  h: number,
  parent: Element,
): void {
  if (opacity <= 0) return
  const g0 = ring(w, h)
  const g = svg('g', { class: 'iv-marks', opacity: r(opacity) }, parent)
  const at = (semi: number, out: number): [number, number] => {
    const a = (((semi % 12) + 12) % 12) * (Math.PI / 6)
    return [g0.cx + out * Math.sin(a), g0.cy - out * Math.cos(a)]
  }
  const notes = s.named.map(midiOf).filter((m, i, all) => all.indexOf(m) === i)
  if (notes.length >= 2) {
    const [a, b] = [notes[0] - s.base, notes[notes.length - 1] - s.base]
    const [x1, y1] = at(a, g0.R)
    const [x2, y2] = at(b, g0.R)
    svg(
      'line',
      { x1: r(x1), y1: r(y1), x2: r(x2), y2: r(y2), class: 'iv-chord' },
      g,
    )
  }
  const size = Math.min(13, Math.max(10.5, g0.R * 0.26))
  for (let semi = 0; semi < 12; semi++) {
    const midi = s.base + semi
    const [x, y] = at(semi, g0.R + g0.bead + size * 0.85)
    svg(
      'text',
      {
        x: r(x),
        y: r(y + size * 0.36),
        'font-size': r(size),
        'text-anchor': 'middle',
        class: 'iv-bead-name',
        text: signName(nameFor(midi, s.named), { octave: false }),
      },
      g,
    )
  }
}

/** The places the staff keeps room for: two ledger lines past each edge, as the staff toy's. */
export const IV_ROOM: readonly [number, number] = placeRange('treble')

/** The staff's frame inside the figure, and the layout the staff is drawn to. */
export function layoutInterval(
  w: number,
  h: number,
  s: Pick<IntervalScene, 'lanes' | 'clef' | 'cols'>,
): IntervalLayout {
  const staffX = s.lanes ? Math.round(Math.min(w * LINE_SHARE, LINE_MAX)) : 0
  const scene = { ...emptyScene(s.clef, IV_ROOM), cols: s.cols }
  return { w, h, staffX, staff: layoutScene(w - staffX, h, scene) }
}

/** Draws `s` into `el`, every part again, and hands back where the staff sits. */
export function drawInterval(
  el: SVGSVGElement,
  s: IntervalScene,
  size: { w: number; h: number },
): IntervalLayout {
  const { w, h } = size
  const L = layoutInterval(w, h, s)
  el.replaceChildren()
  el.setAttribute('viewBox', `0 0 ${r(w)} ${r(h)}`)
  const tone = s.clef === 'bass' ? 'blue' : 'orange'
  if (s.lanes) {
    const lw = L.staffX
    const line = svg('g', { class: 'iv-line' }, el)
    const u = clamp01(s.curl)
    if (s.fade) {
      // reduced motion: the line and the ring cross-fade, with no travel
      laneLayer(s, 0, 1 - u, lw, h, tone, line)
      lineMarks(s, 1 - u, lw, h, line)
      laneLayer(s, 1, u, lw, h, tone, line)
      ringMarks(s, u, lw, h, line)
    } else {
      const eased = easeInOut(u)
      laneLayer(s, eased, 1, lw, h, tone, line)
      lineMarks(s, clamp01(1 - u * 3), lw, h, line)
      ringMarks(s, clamp01((u - 0.7) / 0.3), lw, h, line)
    }
  }
  const staff = svg(
    'svg',
    {
      x: r(L.staffX),
      y: '0',
      width: r(w - L.staffX),
      height: r(h),
      class: 'iv-staff',
    },
    el,
  )
  drawScene(
    staff,
    {
      ...emptyScene(s.clef, IV_ROOM),
      marks: s.marks,
      cols: s.cols,
    },
    { w: w - L.staffX, h },
  )
  return L
}

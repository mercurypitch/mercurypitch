// ============================================================
// Circle drawing — Lesson 2's ring of twelve, or the circle of fifths, as SVG
// ============================================================
//
// The circle toy's picture (circle.ts; Lesson 21's WEB-SPEC, Toys 3, and
// Look), drawn from a scene into the figure's one SVG, in the figure's own
// pixels: the orbit, the twelve beads round it at the scene's angles, the
// thread from bead to bead, the house beside do's bead, and the walk's gap
// past C. On the ring by semitones (the hero, its share card) a white key's
// bead is large and carries its letter, and a black key's is small and
// unnamed unless the key holds it: then it is large, ringed in ink, with its
// name and sign. On the circle of fifths every bead is a key, its name
// outside the ring so the beads keep room for 44 px buttons, the bottom
// three's two names, the sharp name over the flat; a bead past the page's
// reading is dimmed. Chrome at rest and ink lit, as the staff's noteheads
// are; the house marks do, never a colour; the gap is a short dashed arc in
// ink-2 with its label. A word's figure is small: thinner margins, beads
// small enough that twelve keep apart in its 88 px, and any name inside its
// bead, on the circle of fifths too. Pure drawing: the toy keeps the scene.

import type { PitchClass } from './circle-geometry'
import { onRing } from './circle-geometry'
import { svg } from './dom'
import { HOME_PATH } from './home-glyph'

/** How a bead shows: at rest, lit (its note sounding, or its key the house's), the key's own black key, or dimmed. */
export type BeadLook = 'rest' | 'lit' | 'key' | 'dim'

/** One bead as drawn. */
export interface BeadView {
  readonly pc: PitchClass
  /** Radians, clockwise from the top. */
  readonly angle: number
  readonly look: BeadLook
  /** Its name or names: inside a large bead on the ring by semitones, outside the ring on the circle of fifths. */
  readonly names: readonly string[]
  /** A large bead: on the ring by semitones, a white key's or one the key holds; every bead on the circle of fifths. */
  readonly big: boolean
}

export interface CircleScene {
  readonly beads: readonly BeadView[]
  /** The circle of fifths: names outside the ring, every bead the same size. */
  readonly fifths: boolean
  /** The house's angle, beside the ring inside it, or none. */
  readonly house: number | null
  /** The thread, bead to bead in the order given. */
  readonly thread: readonly PitchClass[]
  /** The walk's overshoot: a dashed arc clockwise past the thread's end, its sweep in radians and its label. */
  readonly gap: { readonly sweep: number; readonly label: string } | null
  /** A small figure (a word's): thinner margins, smaller beads, and any name inside its bead. */
  readonly small?: boolean
}

/** Where the ring sits in its figure. */
export interface CircleLayout {
  readonly cx: number
  readonly cy: number
  /** The orbit's radius, through the beads' centres. */
  readonly r: number
  /** A large bead's radius. */
  readonly bead: number
  /** A bead's centre, by its angle. */
  at(angle: number): { x: number; y: number }
}

/** Two decimals, enough for a pixel. */
const n = (v: number): string => v.toFixed(2)

/** The room names take outside the ring on the circle of fifths: two lines for the bottom three. */
const NAMES_OUT = 34

/** Lays the ring out in a `w` by `h` figure. */
export function layoutCircle(
  w: number,
  h: number,
  s: CircleScene,
): CircleLayout {
  const pad = s.small === true ? 2 : 6
  const half = Math.min(w, h) / 2 - pad
  const out = s.fifths && s.small !== true ? NAMES_OUT : 0
  // the semitone ring's large beads and their halos sit inside the figure
  const r0 = half - out
  // a word's figure lets the ring's beads shrink, so twelve keep apart
  const least = s.small === true ? 5 : 9
  const bead = s.fifths
    ? Math.max(8, Math.min(15, r0 * 0.12))
    : Math.max(least, Math.min(22, r0 * 0.17))
  // a figure measured before it has room, a pixel tall on its first frame,
  // keeps its ring at the centre until the next draw: a negative radius is
  // an error in every browser
  const r = Math.max(0, r0 - bead * (s.fifths ? 1.1 : 1.45))
  const cx = w / 2
  const cy = h / 2
  return { cx, cy, r, bead, at: (a) => onRing(cx, cy, r, a) }
}

/** The thread: a line through each bead's centre in turn. */
function thread(s: CircleScene, L: CircleLayout, parent: Element): void {
  if (s.thread.length < 2) return
  const byPc = new Map(s.beads.map((b) => [b.pc, b]))
  const pts = s.thread.flatMap((pc) => {
    const b = byPc.get(pc)
    return b === undefined ? [] : [L.at(b.angle)]
  })
  svg(
    'path',
    {
      d: pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${n(p.x)} ${n(p.y)}`)
        .join(''),
      class: 'ci-thread',
    },
    parent,
  )
}

/** The walk's gap: a dashed arc on the orbit, clockwise past the thread's last bead, and its label outside it. */
function gap(s: CircleScene, L: CircleLayout, parent: Element): void {
  if (s.gap === null || s.thread.length === 0) return
  const end = s.beads.find((b) => b.pc === s.thread[s.thread.length - 1])
  if (end === undefined) return
  const a0 = end.angle
  const a1 = a0 + s.gap.sweep
  const r = L.r + L.bead + 6
  const p0 = onRing(L.cx, L.cy, r, a0)
  const p1 = onRing(L.cx, L.cy, r, a1)
  svg(
    'path',
    {
      d: `M${n(p0.x)} ${n(p0.y)}A${n(r)} ${n(r)} 0 0 1 ${n(p1.x)} ${n(p1.y)}`,
      class: 'ci-gap',
    },
    parent,
  )
  // the label just inside the orbit, by the gap's middle
  const mid = onRing(L.cx, L.cy, L.r - L.bead * 2.4, (a0 + a1) / 2)
  svg(
    'text',
    {
      x: n(mid.x),
      y: n(mid.y),
      class: 'ci-gap-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': n(Math.max(11, Math.min(15, L.bead))),
      text: s.gap.label,
    },
    parent,
  )
}

const LOOK_CLASS: Readonly<Record<BeadLook, string>> = {
  rest: 'ci-bead',
  lit: 'ci-bead is-lit',
  key: 'ci-bead is-key',
  dim: 'ci-bead is-dim',
}

/** A bead, its halo while lit, and its name inside it or outside the ring. */
function bead(
  s: CircleScene,
  L: CircleLayout,
  b: BeadView,
  parent: Element,
): void {
  const { x, y } = L.at(b.angle)
  const r = b.big ? L.bead : L.bead * 0.52
  const g = svg('g', { class: 'ci-beadg' }, parent)
  if (b.look === 'lit' || b.look === 'key')
    svg('circle', { cx: n(x), cy: n(y), r: n(r * 1.42), class: 'ci-halo' }, g)
  svg('circle', { cx: n(x), cy: n(y), r: n(r), class: LOOK_CLASS[b.look] }, g)
  if (b.names.length === 0) return
  // outside the ring on the circle of fifths, but inside the bead in a
  // word's small figure, which has no room round it
  const out = s.fifths && s.small !== true
  const size = Math.max(11, Math.min(17, L.bead * (out ? 1.05 : 0.8)))
  const cls = `ci-name is-${b.look}${out ? ' is-out' : ''}`
  if (!out) {
    svg(
      'text',
      {
        x: n(x),
        y: n(y),
        class: cls,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': n(size),
        text: b.names[0],
      },
      g,
    )
    return
  }
  // outside the ring, centred on the bead's own direction; a second name under the first
  const lines = b.names.length
  const at = onRing(L.cx, L.cy, L.r + L.bead + 6 + size * 0.75, b.angle)
  b.names.forEach((name, i) => {
    svg(
      'text',
      {
        x: n(at.x),
        y: n(at.y + (i - (lines - 1) / 2) * size * 1.05),
        class: cls,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': n(size),
        text: name,
      },
      g,
    )
  })
}

/** The house, inside the ring beside the bead at its angle. */
function house(s: CircleScene, L: CircleLayout, parent: Element): void {
  if (s.house === null) return
  const size = Math.max(14, Math.min(24, L.bead * 1.5))
  const at = onRing(L.cx, L.cy, L.r - L.bead - size * 0.75, s.house)
  const k = size / 24
  svg(
    'path',
    {
      d: HOME_PATH,
      class: 'ci-home',
      transform: `translate(${n(at.x - size / 2)} ${n(at.y - size / 2)}) scale(${k.toFixed(4)})`,
    },
    parent,
  )
}

/** The figure's size: its box, or a phone's figure where nothing lays it out (jsdom). */
export function circleSize(el: Element): { w: number; h: number } {
  const b = el.getBoundingClientRect()
  return b.width > 0 && b.height > 0
    ? { w: b.width, h: b.height }
    : { w: 320, h: 300 }
}

/** Draws `s` into `el`, every part again, and hands back where the ring sits, for the toy's buttons. */
export function drawCircle(
  el: SVGSVGElement,
  s: CircleScene,
  size: { w: number; h: number } = circleSize(el),
): CircleLayout {
  const L = layoutCircle(size.w, size.h, s)
  el.replaceChildren()
  el.setAttribute('viewBox', `0 0 ${n(size.w)} ${n(size.h)}`)
  svg('circle', { cx: n(L.cx), cy: n(L.cy), r: n(L.r), class: 'ci-orbit' }, el)
  thread(s, L, el)
  gap(s, L, el)
  const beads = svg('g', { class: 'ci-beads' }, el)
  for (const b of s.beads) bead(s, L, b, beads)
  house(s, L, el)
  return L
}

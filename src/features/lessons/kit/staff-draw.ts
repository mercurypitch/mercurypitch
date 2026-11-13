// ============================================================
// Staff drawing — staves, clefs, notes and the pitch line, engraved as SVG
// ============================================================
//
// The staff toy's picture (staff.ts; Lesson 15's WEB-SPEC, Toys 1 and
// Look), drawn from a scene: which staff, the places it makes room for, the
// noteheads on it and how each is lit, the letters kept beside it, the gold
// clef line, the pitch line beside it and the key strip under it. Each
// change draws the whole scene again into the figure's one SVG, in the
// figure's own pixels, so a line stays one crisp weight at every size.
//
// The engraving is the stats site's (its staff-engraving snippet): five
// evenly spaced lines, true-size clefs and filled noteheads from Noto
// Music's outlines (glyphs.ts and staff-glyphs.ts), a sign to the left of
// its note, ledger lines a little wider than a notehead and only as far as
// the note needs.
// No stems and no time signature: note lengths wait for Lesson 17. A key
// signature, where a scene has one, sits just past the clef at its clef's
// places (staff-key.ts), each sign its own width and a tenth of a space
// after the last, as the app's notation library spaces them; a note whose
// letter it covers is written with no sign of its own. A sign that has just
// joined it fades in, or travels there from the note that carried it, and a
// sign lights with a note it covers while that note sounds, in its tone. A
// note an F major written with A sharp would need a natural sign under a
// signature is never written: a page drops the signature first (Lesson
// 21's white keys). An outlined note, one a step has just changed, is ringed
// in ink, never coloured. The
// line weight and colour are the toy's tokens (lesson-staff.css), ink at
// 3:1 or more against the figure at every stop of its gradient (FACTS 72).
// A lit note is ink with a halo, never colour alone; Merc's sung note is
// blue, the sung model amber, and only the line a clef names is gold, with
// its letter beside it.
//
// The pitch line beside the staff is Season 1's: a lane a semitone over the
// range shown, the white-key lanes chrome and the black-key lanes fainter;
// a sounding note lights its lane and a thin chrome connector joins the
// lane to its notehead, so a step of one letter shows as one lane or two.

import { svg } from './dom'
import { G_CLEF_PATH } from './glyphs'
import { HOME_PATH } from './home-glyph'
import type { Strip, StripKey, StripSpec } from './key-strip'
import { stripLayout } from './key-strip'
import { Motion } from './motion-switch'
import type { Spelled } from './notes'
import { isBlack, signName } from './notes'
import { F_CLEF_PATH, FLAT_PATH, NOTEHEAD_PATH, NOTO_GLYPHS, SHARP_PATH, } from './staff-glyphs'
import type { KeySig } from './staff-key'
import { covered, keyLetters, keyPlaces } from './staff-key'
import type { Clef, StaffKind } from './staff-places'
import { clefPlace, isLine, ledgersOf, LINES, midiOf, noteAt, placeOf, writtenOf, } from './staff-places'

/**
 * How a notehead is lit: at rest, sounding, the sung model, Merc's sung
 * note, or a note sounding on the treble staff in the interval state's
 * colour for the higher voice (kit/staff-interval.ts), as blue is the
 * lower's.
 */
export type Tone = 'rest' | 'lit' | 'amber' | 'blue' | 'orange'

/** A notehead on the staff. */
export interface Mark {
  readonly note: Spelled
  /** Its column of a run, from 0; a mark with none sits in the middle. */
  readonly col?: number
  readonly tone: Tone
  /** On the grand staff, the staff middle C is written on. */
  readonly on?: Clef
  /** The house that marks do (kit/home-glyph.ts). */
  readonly home?: boolean
  /** Its name beside it: "G4". */
  readonly named?: boolean
  /** Ringed in ink, with its sign: a note a step has just changed (Lesson 21). */
  readonly outline?: boolean
}

/** The key strip under the staff: its range, and the window of white keys showing. */
export interface KeysView {
  readonly lo: number
  readonly hi: number
  readonly from: number
  readonly count: number
  readonly lit: readonly number[]
}

export interface Scene {
  readonly staff: StaffKind
  /** The places the figure keeps room for, lowest and highest. */
  readonly room: readonly [number, number]
  readonly marks: readonly Mark[]
  /** The columns a run spreads across; 1 puts every mark in the middle. */
  readonly cols: number
  /** Places whose letters stay beside the staff, as each is played. */
  readonly letters: readonly number[]
  /** The clef whose line is gold, with its letter. */
  readonly gold: Clef | null
  /** The pitch line beside the staff: its MIDI range. */
  readonly lanes: { readonly lo: number; readonly hi: number } | null
  readonly keys: KeysView | null
  /** The guide's chrome line, 0 to 1 across the run, or none. */
  readonly sweep: number | null
  /** The staff of the grand staff a play names, its lines lit. */
  readonly staffLit: Clef | null
  /** A small figure: no names, no letters, thinner margins. */
  readonly small?: boolean
  /** Lines and spaces alone, with no clef: a staff before it says which notes. */
  readonly noClef?: boolean
  /**
   * The staff spaces the figure's width holds, 9 when unset: a figure that
   * writes more columns side by side asks for more, so its notes and their
   * signs never touch on a narrow screen.
   */
  readonly across?: number
  /** The key signature just past the clef, on one staff; none when unset (staff-key.ts). */
  readonly key?: KeySig | null
  /** The first sign that has just joined the signature, by its place in the order: it and those after it fade in. */
  readonly keyFresh?: number | null
  /** The run column whose note carried that sign: the sign travels from beside the note into the signature, in `keyMs` (450 ms unless given). */
  readonly keyFrom?: number | null
  readonly keyMs?: number
  /** The signs the staff keeps room for past the clef, so its notes stay put as a signature grows. */
  readonly keyRoom?: number
  /** A sign lit with the note it covers as that note sounds: its place in the order, and the note's tone. */
  readonly keyLit?: { readonly sign: number; readonly tone: Tone } | null
}

/** A scene with nothing on it: `staff` making room for `room`. */
export function emptyScene(
  staff: StaffKind,
  room: readonly [number, number],
): Scene {
  return {
    staff,
    room,
    marks: [],
    cols: 1,
    letters: [],
    gold: null,
    lanes: null,
    keys: null,
    sweep: null,
    staffLit: null,
  }
}

/** Where everything sits, in the figure's pixels. */
export interface Layout {
  readonly w: number
  readonly h: number
  /** One staff space, px. */
  readonly space: number
  /** The staff lines' left and right ends. */
  readonly x0: number
  readonly x1: number
  /** The pitch line's left and right edges, and its top and bottom. */
  readonly lanes: {
    readonly x0: number
    readonly x1: number
    readonly top: number
    readonly bottom: number
  } | null
  readonly strip: Strip | null
  yOf(place: number): number
  /** The nearest place to a height, unclamped. */
  placeAt(y: number): number
  /** A run column's centre; the middle for none. */
  colX(col?: number): number
}

/** The widest a staff space grows, px: a desktop figure fills its height up to this. */
const MAX_SPACE = 34
const MIN_SPACE = 6
/** The key strip's share of the height, and its bounds, px. */
const KEYS_SHARE = 0.3
const KEYS_MIN = 60
const KEYS_MAX = 96

/** A sign's own width, in staff spaces: the glyph's right edge less its left bearing, 50 units. */
const signWidth = (sign: KeySig['sign']): number =>
  ((sign === 'sharp' ? NOTO_GLYPHS.sharp : NOTO_GLYPHS.flat) - 50) /
  NOTO_GLYPHS.space

/** From one sign of a signature to the next, in staff spaces: its width and a tenth of a space. */
const signStep = (sign: KeySig['sign']): number => signWidth(sign) + 0.1

/** Where a signature's first sign starts, in staff spaces from the staff's left end: where a note would. */
const KEY_X = 3.6
/** The gap between a signature's last sign and the notes, staff spaces. */
const KEY_GAP = 0.5
/** How long a sign takes to travel from its note into the signature, ms. */
const SLIDE_MS = 450

/** The key signature a scene draws: none on the grand staff, or with no clef. */
const keyOf = (s: Scene): KeySig | null =>
  s.key == null || s.key.count === 0 || s.staff === 'grand' || s.noClef === true
    ? null
    : s.key

/**
 * The staff spaces past the clef a scene keeps for its signature and the
 * gap after it: the signature's own, or the room asked for, a sharp's width
 * a sign, whichever is wider; none with neither.
 */
export function keySpaces(s: Scene): number {
  const key = keyOf(s)
  const own = key === null ? 0 : key.count * signStep(key.sign)
  const room =
    s.staff === 'grand' || s.noClef === true
      ? 0
      : (s.keyRoom ?? 0) * signStep('sharp')
  const width = Math.max(own, room)
  return width === 0 ? 0 : width + KEY_GAP
}

/** Lays a scene out in a `w` by `h` figure. */
export function layoutScene(w: number, h: number, s: Scene): Layout {
  const pad = s.small === true ? 4 : 12
  const keysH =
    s.keys === null ? 0 : Math.min(KEYS_MAX, Math.max(KEYS_MIN, h * KEYS_SHARE))
  const lanesW = s.lanes === null ? 0 : Math.min(110, Math.max(48, w * 0.2))
  const top = pad
  const bottom = h - pad - (keysH > 0 ? keysH + 10 : 0)
  const [lo, hi] = s.room
  // half a space and a little more past the room at each end
  const spaces = (hi - lo) / 2 + 1.6
  const keyRoom = keySpaces(s)
  const space = Math.max(
    MIN_SPACE,
    Math.min(
      MAX_SPACE,
      (bottom - top) / spaces,
      (w - lanesW - 2 * pad) / ((s.across ?? 9) + keyRoom),
    ),
  )
  const mid = (top + bottom) / 2
  const midPlace = (lo + hi) / 2
  const yOf = (p: number): number => mid - ((p - midPlace) * space) / 2
  const brace = s.staff === 'grand' ? space * 1.1 : 0
  const x0 = pad + lanesW + (lanesW > 0 ? 12 : 0) + brace
  const x1 = w - pad
  const notes0 = x0 + space * (KEY_X + keyRoom)
  const notes1 = x1 - space * 1.6
  const colX = (col?: number): number => {
    if (col === undefined || s.cols <= 1) return (notes0 + notes1) / 2
    return notes0 + ((col + 0.5) * (notes1 - notes0)) / s.cols
  }
  const lanes =
    s.lanes === null
      ? null
      : {
          x0: pad,
          x1: pad + lanesW,
          top: yOf(hi) - space * 0.4,
          bottom: yOf(lo) + space * 0.4,
        }
  const strip =
    s.keys === null
      ? null
      : stripLayout({
          lo: s.keys.lo,
          hi: s.keys.hi,
          x0: pad,
          x1: w - pad,
          top: h - pad - keysH,
          height: keysH,
          window: { from: s.keys.from, keys: s.keys.count },
        })
  return {
    w,
    h,
    space,
    x0,
    x1,
    lanes,
    strip,
    yOf,
    // + 0 turns a rounded -0 into 0
    placeAt: (y) => Math.round(midPlace + ((mid - y) * 2) / space) + 0,
    colX,
  }
}

/** The places of the staff lines a scene draws. */
const linesOf = (staff: StaffKind): readonly number[] => LINES[staff]

/** A Noto Music glyph at true size, its baseline at (x, y). */
function glyph(
  d: string,
  x: number,
  y: number,
  space: number,
  cls: string,
  parent: Element,
): SVGPathElement {
  const k = space / NOTO_GLYPHS.space
  return svg(
    'path',
    {
      d,
      class: cls,
      transform: `translate(${r(x)} ${r(y)}) scale(${k.toFixed(5)})`,
    },
    parent,
  )
}

/** Two decimals, enough for a pixel. */
const r = (v: number): string => v.toFixed(2)

/** A clef at the start of its staff, whose bottom line is at `yBottom`. */
export function engraveClef(
  clef: Clef,
  x: number,
  yBottom: number,
  space: number,
  parent: Element,
): SVGPathElement {
  const k = space / NOTO_GLYPHS.space
  return clef === 'treble'
    ? glyph(
        G_CLEF_PATH,
        x,
        yBottom + NOTO_GLYPHS.base.g * k,
        space,
        'st-clef',
        parent,
      )
    : glyph(
        F_CLEF_PATH,
        x,
        yBottom + NOTO_GLYPHS.base.f * k,
        space,
        'st-clef',
        parent,
      )
}

/** A filled notehead centred on (cx, y). */
export function engraveHead(
  cx: number,
  y: number,
  space: number,
  cls: string,
  parent: Element,
): SVGPathElement {
  const k = space / NOTO_GLYPHS.space
  return glyph(
    NOTEHEAD_PATH,
    cx - NOTO_GLYPHS.head.cx * k,
    y + NOTO_GLYPHS.head.cy * k,
    space,
    cls,
    parent,
  )
}

/** Half a notehead's width, px. */
export const headHalf = (space: number): number =>
  ((NOTO_GLYPHS.head.width - 50) / 2 / NOTO_GLYPHS.space) * space

/** A sharp or a flat to the left of a notehead at (cx, y). */
function engraveSign(
  alter: number,
  cx: number,
  y: number,
  space: number,
  parent: Element,
): void {
  if (alter === 0) return
  const at = signAt(alter, cx, y, space)
  glyph(
    alter > 0 ? SHARP_PATH : FLAT_PATH,
    at.x,
    at.y,
    space,
    'st-sign',
    parent,
  )
}

/** A horizontal line from x0 to x1 at y. */
function hline(
  x0: number,
  x1: number,
  y: number,
  cls: string,
  parent: Element,
): void {
  svg('line', { x1: r(x0), x2: r(x1), y1: r(y), y2: r(y), class: cls }, parent)
}

/** The grand staff's brace and the line that joins its staves, at the left. */
function brace(L: Layout, parent: Element): void {
  const yTop = L.yOf(20)
  const yBot = L.yOf(0)
  svg(
    'line',
    { x1: r(L.x0), x2: r(L.x0), y1: r(yTop), y2: r(yBot), class: 'st-line' },
    parent,
  )
  const xr = L.x0 - L.space * 0.25
  const a = xr - L.space * 0.4
  const b = xr - L.space * 0.8
  const yMid = (yTop + yBot) / 2
  const c = (yBot - yTop) * 0.1
  svg(
    'path',
    {
      d: `M${r(xr)} ${r(yTop)}Q${r(a)} ${r(yTop)} ${r(a)} ${r(yTop + c)}L${r(a)} ${r(yMid - c)}Q${r(a)} ${r(yMid)} ${r(b)} ${r(yMid)}Q${r(a)} ${r(yMid)} ${r(a)} ${r(yMid + c)}L${r(a)} ${r(yBot - c)}Q${r(a)} ${r(yBot)} ${r(xr)} ${r(yBot)}`,
      class: 'st-brace',
    },
    parent,
  )
}

/** The staff lines, the clefs and the gold clef line with its letter. */
function staves(s: Scene, L: Layout, parent: Element): void {
  const g = svg('g', { class: 'st-staves' }, parent)
  const lit = (p: number): boolean =>
    s.staffLit !== null &&
    (s.staff !== 'grand' || (s.staffLit === 'treble' ? p >= 12 : p <= 8))
  for (const p of linesOf(s.staff))
    hline(L.x0, L.x1, L.yOf(p), lit(p) ? 'st-line is-lit' : 'st-line', g)
  if (s.staff === 'grand') brace(L, g)
  const clefs: readonly Clef[] =
    s.noClef === true
      ? []
      : s.staff === 'grand'
        ? ['treble', 'bass']
        : [s.staff]
  for (const c of clefs) {
    const bottom = s.staff === 'grand' && c === 'treble' ? 12 : 0
    engraveClef(c, L.x0 + L.space * 0.3, L.yOf(bottom), L.space, g)
  }
  if (s.gold === null) return
  const p = clefPlace(s.gold, s.staff)
  const y = L.yOf(p)
  hline(L.x0, L.x1, y, 'st-gold', g)
  svg(
    'text',
    {
      x: r(L.x1 - L.space * 0.3),
      y: r(y - L.space * 0.22),
      class: 'st-gold-name',
      'text-anchor': 'end',
      'font-size': r(Math.min(18, Math.max(11, L.space * 0.75))),
      text: noteAt(p, s.staff).letter,
    },
    g,
  )
}

/** Where a mark's own sign is engraved, the glyph's origin: just left of its head. */
function signAt(
  alter: number,
  cx: number,
  y: number,
  space: number,
): { x: number; y: number } {
  const k = space / NOTO_GLYPHS.space
  const right = cx - headHalf(space) - space * 0.25
  const width = alter > 0 ? NOTO_GLYPHS.sharp : NOTO_GLYPHS.flat
  return { x: right - width * k, y: y + NOTO_GLYPHS.head.cy * k }
}

/** Moves a sign from (dx, dy) away to where it is drawn, in `ms`; held still while motion is paused. */
function travel(el: SVGGElement, dx: number, dy: number, ms = SLIDE_MS): void {
  if (Motion.paused || typeof el.animate !== 'function') return
  el.animate(
    [
      { transform: `translate(${r(dx)}px, ${r(dy)}px)` },
      { transform: 'translate(0px, 0px)' },
    ],
    { duration: ms, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
  )
}

/**
 * The key signature past the clef: each sign at its clef's place, in its
 * order, its own width and a tenth of a space after the one before. A sign
 * that has just joined fades in, or travels from beside the note in the
 * scene's `keyFrom` column that carried it.
 */
function keySig(s: Scene, L: Layout, parent: Element): void {
  const key = keyOf(s)
  if (key === null || s.staff === 'grand') return
  const g = svg('g', { class: 'st-keysig' }, parent)
  const k = L.space / NOTO_GLYPHS.space
  const d = key.sign === 'sharp' ? SHARP_PATH : FLAT_PATH
  const step = signStep(key.sign) * L.space
  const fresh = s.keyFresh ?? null
  const letters = keyLetters(key)
  keyPlaces(key, s.staff).forEach((place, i) => {
    // the glyph's left bearing, 50 units, sits before the sign's left edge
    const x = L.x0 + KEY_X * L.space + i * step - 50 * k
    const y = L.yOf(place) + NOTO_GLYPHS.head.cy * k
    const joining = fresh !== null && i >= fresh
    const from =
      joining && s.keyFrom != null
        ? s.marks.find(
            (m) => m.col === s.keyFrom && m.note.letter === letters[i],
          )
        : undefined
    if (from === undefined) {
      const lit = s.keyLit?.sign === i ? ` is-${s.keyLit.tone}` : ''
      const fading = joining ? ' is-fresh' : ''
      glyph(d, x, y, L.space, `st-sign st-keysign${fading}${lit}`, g)
      return
    }
    const holder = svg('g', { class: 'st-keysign-move' }, g)
    glyph(d, x, y, L.space, 'st-sign st-keysign', holder)
    const was = signAt(
      key.sign === 'sharp' ? 1 : -1,
      L.colX(from.col),
      L.yOf(placeOf(from.note, s.staff)),
      L.space,
    )
    travel(holder, was.x - x, was.y - y, s.keyMs)
  })
}

/** The sign a mark is written with: none where the scene's signature covers its letter. */
function signOf(s: Scene, m: Mark): number {
  const key = keyOf(s)
  return key !== null && covered(m.note, key) ? 0 : m.note.alter
}

/** A mark's lane on the pitch line: its MIDI note's band, top and bottom. */
function laneBand(
  s: Scene,
  L: Layout,
  midi: number,
): { top: number; bottom: number } | null {
  if (s.lanes === null || L.lanes === null) return null
  const n = s.lanes.hi - s.lanes.lo + 1
  const h = (L.lanes.bottom - L.lanes.top) / n
  const top = L.lanes.top + (s.lanes.hi - midi) * h
  return { top, bottom: top + h }
}

/** The pitch line: a lane a semitone, the sounding notes' lanes lit, each joined to its notehead. */
function pitchLine(s: Scene, L: Layout, parent: Element): void {
  if (s.lanes === null || L.lanes === null) return
  const g = svg('g', { class: 'st-lanes' }, parent)
  const sounding = s.marks.filter((m) => m.tone !== 'rest')
  const lit = new Set(sounding.map((m) => midiOf(m.note)))
  for (let m = s.lanes.lo; m <= s.lanes.hi; m++) {
    const band = laneBand(s, L, m)
    if (band === null) continue
    const cls = `st-lane ${isBlack(m) ? 'is-black' : 'is-white'}${lit.has(m) ? ' is-lit' : ''}`
    svg(
      'rect',
      {
        x: r(L.lanes.x0),
        y: r(band.top + 0.5),
        width: r(L.lanes.x1 - L.lanes.x0),
        height: r(Math.max(0.5, band.bottom - band.top - 1)),
        rx: 1,
        class: cls,
      },
      g,
    )
  }
  for (const m of sounding) {
    const band = laneBand(s, L, midiOf(m.note))
    if (band === null) continue
    const x =
      L.colX(m.col) -
      headHalf(L.space) -
      (signOf(s, m) === 0 ? 0 : L.space * 1.1)
    svg(
      'line',
      {
        x1: r(L.lanes.x1),
        y1: r((band.top + band.bottom) / 2),
        x2: r(x - 2),
        y2: r(L.yOf(placeOf(m.note, s.staff))),
        class: 'st-connector',
      },
      g,
    )
  }
}

const TONE_CLASS: Readonly<Record<Tone, string>> = {
  rest: 'st-head',
  lit: 'st-head is-lit',
  amber: 'st-head is-amber',
  blue: 'st-head is-blue',
  orange: 'st-head is-orange',
}

/** One notehead with its ledger lines, its sign, its halo while it sounds, its name and its house. */
function mark(s: Scene, L: Layout, m: Mark, parent: Element): void {
  const g = svg('g', { class: 'st-mark' }, parent)
  const place = placeOf(m.note, s.staff)
  const cx = L.colX(m.col)
  const y = L.yOf(place)
  const ledger = L.space * 0.95
  for (const p of ledgersOf(place, s.staff))
    hline(cx - ledger, cx + ledger, L.yOf(p), 'st-ledger', g)
  if (m.tone !== 'rest')
    svg(
      'circle',
      {
        cx: r(cx),
        cy: r(y),
        r: r(L.space * 0.95),
        class: `st-halo is-${m.tone}`,
      },
      g,
    )
  const sign = signOf(s, m)
  if (m.outline === true) {
    // round the head, and its sign where one is written
    const left = cx - headHalf(L.space) - L.space * (sign === 0 ? 0.35 : 1.45)
    const right = cx + headHalf(L.space) + L.space * 0.35
    svg(
      'rect',
      {
        x: r(left),
        y: r(y - L.space * 0.95),
        width: r(right - left),
        height: r(L.space * 1.9),
        rx: r(L.space * 0.5),
        class: 'st-outline',
      },
      g,
    )
  }
  engraveSign(sign, cx, y, L.space, g)
  engraveHead(cx, y, L.space, TONE_CLASS[m.tone], g)
  if (m.home === true) {
    const size = L.space * 1.05
    const k = size / 24
    svg(
      'path',
      {
        d: HOME_PATH,
        class: m.tone === 'rest' ? 'st-home' : `st-home is-${m.tone}`,
        transform: `translate(${r(cx - size / 2)} ${r(y + L.space * 0.95)}) scale(${k.toFixed(4)})`,
      },
      g,
    )
  }
  if (m.named !== true || s.small === true) return
  const left = cx - headHalf(L.space) - L.space * (sign === 0 ? 0.45 : 1.55)
  svg(
    'text',
    {
      x: r(left),
      y: r(y + L.space * 0.3),
      class: 'st-name',
      'text-anchor': 'end',
      'font-size': r(Math.min(18, Math.max(11, L.space * 0.75))),
      text: signName(m.note),
    },
    g,
  )
}

/** The letters kept beside the staff: lines' in one column, spaces' in the next, so they take turns. */
function letters(s: Scene, L: Layout, parent: Element): void {
  if (s.letters.length === 0 || s.small === true) return
  const g = svg('g', { class: 'st-letters' }, parent)
  const size = Math.min(18, Math.max(11, L.space * 0.75))
  const cx = L.colX()
  for (const p of s.letters) {
    const x = cx + headHalf(L.space) + L.space * (isLine(p) ? 0.9 : 1.8)
    svg(
      'text',
      {
        x: r(x),
        y: r(L.yOf(p) + size * 0.36),
        'font-size': r(size),
        class: 'st-letter',
        text: noteAt(p, s.staff).letter,
      },
      g,
    )
  }
}

/** The guide's chrome line across the run. */
function sweepLine(s: Scene, L: Layout, parent: Element): void {
  if (s.sweep === null) return
  const x0 = L.colX(0) - L.space
  const x1 = L.colX(Math.max(0, s.cols - 1)) + L.space
  const x = x0 + (x1 - x0) * Math.min(1, Math.max(0, s.sweep))
  svg(
    'line',
    {
      x1: r(x),
      x2: r(x),
      y1: r(L.yOf(s.room[1]) - L.space * 0.4),
      y2: r(L.yOf(s.room[0]) + L.space * 0.4),
      class: 'st-sweep',
    },
    parent,
  )
}

/**
 * One key of the strip, clipped to the strip's edges (a white key inset a
 * little from its neighbours), dim or lit: the width drawn, or 0 where none
 * of it shows.
 */
function keyRect(
  k: StripKey,
  spec: StripSpec,
  lit: ReadonlySet<number>,
  g: Element,
): number {
  const inset = k.white ? 0.75 : 0
  const x = Math.max(spec.x0, k.x + inset)
  const right = Math.min(spec.x1, k.x + k.w - inset)
  if (right <= x) return 0
  const tone = k.white ? 'st-key is-white' : 'st-key is-black'
  svg(
    'rect',
    {
      x: r(x),
      y: r(k.y),
      width: r(right - x),
      height: r(k.h),
      rx: k.white ? 3 : 2,
      class: lit.has(k.midi) ? `${tone} is-lit` : tone,
    },
    g,
  )
  return right - x
}

/** A white key's name, for each C and the lit key, where the key drawn is wide enough. */
function keyName(
  k: StripKey,
  width: number,
  lit: ReadonlySet<number>,
  g: Element,
): void {
  const named = lit.has(k.midi) || k.midi % 12 === 0
  if (!named || width < 18) return
  svg(
    'text',
    {
      x: r(k.cx),
      y: r(k.y + k.h - 8),
      'text-anchor': 'middle',
      'font-size': r(Math.max(10, Math.min(13, k.w * 0.3))),
      class: 'st-key-name',
      text: signName(writtenOf(k.midi)),
    },
    g,
  )
}

/** The key strip: white keys dim but for the lit ones, each C named, the lit key named too. */
function keyStrip(s: Scene, L: Layout, parent: Element): void {
  if (s.keys === null || L.strip === null) return
  const g = svg('g', { class: 'st-keys' }, parent)
  const lit = new Set(s.keys.lit)
  const { spec, keys } = L.strip
  // the white keys first, so the black keys sit over them
  for (const k of keys)
    if (k.white) keyName(k, keyRect(k, spec, lit, g), lit, g)
  for (const k of keys) if (!k.white) keyRect(k, spec, lit, g)
}

/** The figure's size: its box, or a phone's figure where nothing lays it out (jsdom). */
export function figureSize(el: Element): { w: number; h: number } {
  const b = el.getBoundingClientRect()
  return b.width > 0 && b.height > 0
    ? { w: b.width, h: b.height }
    : { w: 356, h: 310 }
}

/**
 * Draws `s` into `el`, every part again, and hands back where it put
 * everything, for the toy's taps.
 */
export function drawScene(
  el: SVGSVGElement,
  s: Scene,
  size: { w: number; h: number } = figureSize(el),
): Layout {
  const L = layoutScene(size.w, size.h, s)
  el.replaceChildren()
  el.setAttribute('viewBox', `0 0 ${r(size.w)} ${r(size.h)}`)
  pitchLine(s, L, el)
  staves(s, L, el)
  keySig(s, L, el)
  letters(s, L, el)
  sweepLine(s, L, el)
  const marks = svg('g', { class: 'st-marks' }, el)
  for (const m of s.marks) mark(s, L, m, marks)
  keyStrip(s, L, el)
  return L
}

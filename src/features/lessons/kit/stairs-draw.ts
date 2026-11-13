// ============================================================
// Staircase painter — rows, blocks, names, marks and the strip
// ============================================================
//
// Paints one frame of the staircase from its layout (stairs-geometry.ts)
// and a scene the toy keeps. The colour code is the series': every stair
// and key is chrome until a voice lights it, blue where Merc sings it
// and orange where Tavi does; gold marks only the two semitone steps, in
// Lesson 4's steps 1 and 2 (Lesson 4 WEB-SPEC, Look); do, home, is a house
// glyph, never a colour. Tavi's guess, the white keys from the start, is
// dashed ink-2 with a "?", since violet belongs to the singer in the
// lessons. Each part draws in its own small function, in paint order.
//
// A page may draw another scale's stairs (stairs-scales.ts): the risers
// and their gold follow its steps, the keys and their names its notes, and
// do's house sits on each do. Lesson 20's stairs print both names, the
// sung name over the letter, and each riser its size in semitones, 1, 2 or
// 3, since a riser of three is neither T nor S.

import { drawHome } from './home-glyph'
import { drawStrip } from './key-strip'
import type { StepSize } from './major-scale'
import { MAJOR_STEPS, stepSizes, whiteKeysFrom } from './major-scale'
import type { NamesMode } from './names-modes'
import { COLOR, rgba, signName } from './notes'
import type { StairBox, StairsLayout } from './stairs-geometry'
import { BLOCK_GAP } from './stairs-geometry'
import { paintRows, paintRuler } from './stairs-ruler'
import type { Degrees } from './stairs-scales'
import { risersOf, spellDegrees, syllableOf } from './stairs-scales'
import { stairName } from './stairs-words'

/** A stair's light: how strongly (0 to 1) and in whose colour. */
export interface StairLight {
  readonly amount: number
  readonly color: string
}

/** Everything a frame shows that the layout does not decide. */
export interface StairsScene {
  /** The start the stairs are named from (a whole semitone). */
  readonly tonic: number
  /** The stairs as semitones above do: the major scale's, or a page's other scale. */
  readonly degrees: Degrees
  /** Each stair's sung name over its letter, in place of the names mode. */
  readonly both: boolean
  /** Each riser's size as a number, in place of T and S. */
  readonly numbers: boolean
  readonly names: NamesMode
  /** The risers' labels: T and S, or their sizes. */
  readonly steps: boolean
  /** The semitone steps in gold (Lesson 4's steps 1 and 2, once Play up has played). */
  readonly gold: boolean
  /** Group's brackets, 0 to 1, and each bracket's flash. */
  readonly group: number
  readonly groupFlash: readonly [number, number]
  /** White keys only, 0 to 1, from `whiteFrom`, its stairs lit as they sound. */
  readonly white: number
  readonly whiteFrom: number | null
  readonly whiteLit: (i: number) => number
  /** Each stair's light. */
  readonly light: (i: number) => StairLight | null
  /** How strongly each key flashes, by MIDI number. */
  readonly keyPulse: (midi: number) => number
  /** Stop on ti: the top stair an outline, the arrow drawn in (0 to 1). */
  readonly waiting: boolean
  readonly arrow: number
  /** The top stair's house, lit by Land on do (0 to 1). */
  readonly home: number
  /**
   * The stairs' names while a slide has not landed: the stairs it left, so
   * a stair's name changes as it lands (Lesson 25's Raise te).
   */
  readonly named?: Degrees
  /** A riser outlined from tread to tread, its label beside it (Lesson 25's le-to-ti stair, "3"). */
  readonly outline?: StairsOutline | null
}

/** One riser outlined: the rise from stair `riser` to the next, and its label. */
export interface StairsOutline {
  readonly riser: number
  readonly label: string
}

const FONT = {
  name: (px: number): string => `600 ${px}px Outfit, sans-serif`,
  mono: (px: number): string => `500 ${px}px "JetBrains Mono", monospace`,
  serif: (px: number): string => `italic 400 ${px}px "Instrument Serif", serif`,
}

/** The block's drawn rectangle: its column less half the gap each side. */
const block = (st: StairBox): { x: number; w: number } => ({
  x: st.x + BLOCK_GAP / 2,
  w: st.w - BLOCK_GAP,
})

const nameSize = (L: StairsLayout): number =>
  L.mode === 'compact' ? Math.max(10, Math.min(13, L.rowH * 1.05)) : 13

/** The scale's notes, MIDI, a stair each. */
const notesOf = (s: StairsScene): number[] => s.degrees.map((d) => s.tonic + d)

// ---------------------------------------------------------------- the strip and its hairlines

function paintHairlines(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  const strip = L.strip
  if (strip === null) return
  notesOf(s).forEach((midi, i) => {
    const key = strip.key(midi)
    if (key === null || i >= L.stairs.length) return
    const st = L.stairs[i]
    const lit = s.light(i)?.amount ?? 0
    ctx.strokeStyle = rgba(COLOR.chrome, 0.32 + 0.5 * lit)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(st.x + st.w / 2, st.bottom + 2)
    ctx.lineTo(key.cx, strip.spec.top - 2)
    ctx.stroke()
  })
}

function paintKeys(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  if (L.strip === null) return
  // the keys of the stairs it draws, each named as the scale spells it
  const notes = notesOf(s)
  const spelled = spellDegrees(s.tonic, s.degrees)
  drawStrip(ctx, L.strip, {
    lit: (m) => notes.includes(m),
    label: (m) => (notes.includes(m) ? spelled[notes.indexOf(m)] : null),
    pulse: s.keyPulse,
  })
}

// ---------------------------------------------------------------- the stairs

function paintBlock(
  ctx: CanvasRenderingContext2D,
  st: StairBox,
  light: StairLight | null,
  outline: boolean,
): void {
  const { x, w } = block(st)
  const h = st.bottom - st.top
  const amount = light?.amount ?? 0
  const color = light?.color ?? COLOR.chrome
  if (!outline) {
    ctx.fillStyle = rgba(COLOR.chrome, 0.1)
    ctx.fillRect(x, st.top, w, h)
    if (amount > 0) {
      ctx.fillStyle = rgba(color, 0.34 * amount)
      ctx.fillRect(x, st.top, w, h)
    }
  }
  ctx.strokeStyle = rgba(COLOR.chrome, outline ? 0.7 : 0.22)
  ctx.lineWidth = 1
  ctx.setLineDash(outline ? [4, 4] : [])
  ctx.strokeRect(x + 0.5, st.top + 0.5, w - 1, h - 1)
  ctx.setLineDash([])
  if (outline) return
  // the tread
  ctx.fillStyle = amount > 0 ? color : rgba(COLOR.chrome, 0.85)
  ctx.fillRect(x, st.top, w, 3)
  if (amount > 0) {
    ctx.fillStyle = rgba('#ffffff', 0.5 * amount)
    ctx.fillRect(x, st.top, w, 3)
  }
}

/** The riser from stair i up to stair i + 1: the next block's left edge, between the two treads. */
function riser(
  L: StairsLayout,
  i: number,
): { x: number; y0: number; y1: number } {
  const next = L.stairs[i + 1]
  return { x: block(next).x, y0: next.top, y1: L.stairs[i].top }
}

function paintRisers(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  risersOf(s.named ?? s.degrees).forEach((size, i) => {
    const r = riser(L, i)
    const gold = s.gold && size === 1
    ctx.strokeStyle = gold ? COLOR.gold : rgba(COLOR.chrome, 0.4)
    ctx.lineWidth = gold ? 2.5 : 1.25
    ctx.beginPath()
    ctx.moveTo(r.x + 0.5, r.y0)
    ctx.lineTo(r.x + 0.5, r.y1)
    ctx.stroke()
  })
}

/** The middle of a riser's label: the riser's mid-height, and clear of the tread above it. */
const labelY = (r: { y0: number; y1: number }): number =>
  Math.max((r.y0 + r.y1) / 2, r.y0 + 11)

/** A riser's label's font: 12 px, in the weight given. */
const labelFont = (weight: number): string =>
  `${weight} 12px "JetBrains Mono", monospace`

/** A step's size label, inside the next block's top corner, at the riser's mid-height and clear of its tread. */
function stepLabel(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  i: number,
  text: string,
  color: string,
  weight = 500,
): void {
  const r = riser(L, i)
  ctx.fillStyle = color
  ctx.font = labelFont(weight)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, r.x + 6, labelY(r))
}

/** A riser's label: its size in semitones, or T for a tone and S for a semitone. */
const riserText = (size: number, numbers: boolean): string =>
  numbers || (size !== 1 && size !== 2) ? String(size) : size === 1 ? 'S' : 'T'

function paintStepLabels(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  if (!s.steps || s.white > 0.5) return
  // a sliding stair's riser keeps its size until it lands, as its name does
  risersOf(s.named ?? s.degrees).forEach((size, i) => {
    const gold = s.gold && size === 1
    // with Group on, the tone that joins the two groups speaks up
    const joint = i === 3 && s.group > 0.5
    const color = gold
      ? COLOR.gold
      : joint
        ? COLOR.ink
        : rgba(COLOR.chrome, 0.9)
    stepLabel(
      ctx,
      L,
      i,
      riserText(size, s.numbers),
      color,
      joint || gold ? 700 : 500,
    )
  })
}

/**
 * The outlined riser: the higher block's width, from its tread down to the
 * lower one's, in chrome, and its label in ink at its side, as a riser's
 * size is labelled.
 */
function paintOutline(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  const o = s.outline
  const next = o === undefined || o === null ? undefined : L.stairs[o.riser + 1]
  if (o === undefined || o === null || next === undefined) return
  const { x, w } = block(next)
  const h = Math.max(2, L.stairs[o.riser].top - next.top)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.85)
  ctx.lineWidth = 1.5
  ctx.strokeRect(x + 0.75, next.top + 0.75, w - 1.5, h - 1.5)
  stepLabel(ctx, L, o.riser, o.label, COLOR.ink, 700)
}

function paintNames(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  const px = nameSize(L)
  ctx.font = FONT.name(px)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const spelled = s.both ? spellDegrees(s.tonic, s.degrees) : []
  L.stairs.forEach((st, i) => {
    const lit = s.light(i)?.amount ?? 0
    const x = st.x + st.w / 2
    const y = st.top - (L.mode === 'compact' ? 5 : 7)
    ctx.fillStyle = lit > 0.3 ? '#ffffff' : COLOR.ink
    if (!s.both) {
      ctx.fillText(stairName(i, s.tonic, s.names, s.named ?? s.degrees), x, y)
      return
    }
    // the sung name over the letter
    ctx.fillText(signName(spelled[i], { octave: false }), x, y)
    ctx.fillText(syllableOf(s.degrees[i]), x, y - px - 3)
  })
}

/** The label drawn in stair i's block, the outline's or its riser's size, if any. */
function labelIn(s: StairsScene, i: number): string | null {
  if (i === 0) return null
  if (s.outline?.riser === i - 1) return s.outline.label
  if (!s.steps || s.white > 0.5) return null
  return riserText(risersOf(s.named ?? s.degrees)[i - 1], s.numbers)
}

/**
 * A house's centre on stair i: `centred`, or, where the label in the
 * block's top corner would touch it, just under that label's line and
 * still inside the block. A narrow block's top do needs it, as on Lesson
 * 25's compact staircases, whose blocks are not much wider than the house.
 */
function homeY(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
  i: number,
  size: number,
  centred: number,
): number {
  const text = labelIn(s, i)
  if (text === null) return centred
  const st = L.stairs[i]
  const r = riser(L, i - 1)
  const y = labelY(r)
  // the bold weight is the wider: an outline's label, or a gold or joining one
  ctx.font = labelFont(700)
  const right = r.x + 6 + ctx.measureText(text).width
  const clear =
    st.x + st.w / 2 - size / 2 >= right + 2 ||
    centred - size / 2 >= y + 8 ||
    centred + size / 2 <= y - 8
  if (clear) return centred
  return Math.min(Math.max(centred, y + 9 + size / 2), st.bottom - 2 - size / 2)
}

/** Do's house inside each do block; the top one lights as Land on do lands. */
function paintHomes(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  // centred in the height of do's own block, on both do stairs, and inside
  // it, under the label in its corner where the two would meet
  const room = L.stairs[0].bottom - L.stairs[0].top
  const size =
    L.mode === 'compact' ? Math.min(18, L.rowH * 1.45) : Math.min(18, room - 4)
  const homes = s.degrees.flatMap((d, i) => (d % 12 === 0 ? [i] : []))
  for (const i of homes) {
    const st = L.stairs[i]
    const lit = i > 0 ? s.home : 0
    const color = i > 0 && s.waiting ? rgba(COLOR.chrome, 0.6) : COLOR.ink
    const cy = homeY(ctx, L, s, i, size, st.top + 2 + room / 2)
    if (lit > 0) {
      const halo = ctx.createRadialGradient(
        st.x + st.w / 2,
        cy,
        0,
        st.x + st.w / 2,
        cy,
        size * 1.4,
      )
      halo.addColorStop(0, rgba('#ffffff', 0.45 * lit))
      halo.addColorStop(1, rgba('#ffffff', 0))
      ctx.fillStyle = halo
      ctx.fillRect(st.x, cy - size * 1.4, st.w, size * 2.8)
    }
    drawHome(ctx, st.x + st.w / 2, cy, size, lit > 0.5 ? '#ffffff' : color)
  }
}

// ---------------------------------------------------------------- Tavi's guess: the white keys

/** The guess's treads: stair i as many rows above do as its key is above the start. */
function overlayPoints(
  L: StairsLayout,
  keys: readonly number[],
): { x0: number; x1: number; y: number }[] {
  const doTop = L.stairs[0].top
  return keys.map((m, i) => {
    const { x, w } = block(L.stairs[i])
    return { x0: x, x1: x + w, y: doTop - (m - keys[0]) * L.rowH }
  })
}

function paintOverlay(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  const keys = s.whiteFrom === null ? null : whiteKeysFrom(s.whiteFrom)
  if (s.white <= 0 || keys === null || keys.length > L.stairs.length) return
  const pts = overlayPoints(L, keys)
  const sizes = stepSizes(keys)
  ctx.save()
  ctx.globalAlpha = s.white
  ctx.strokeStyle = COLOR.ink2
  ctx.lineWidth = 2
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x0, p.y)
    else ctx.lineTo(p.x0, p.y)
    ctx.lineTo(p.x1, p.y)
  })
  ctx.stroke()
  ctx.setLineDash([])
  pts.forEach((p, i) => {
    const lit = s.whiteLit(i)
    if (lit <= 0) return
    ctx.fillStyle = rgba(COLOR.ink2, 0.35 * lit)
    ctx.fillRect(p.x0, p.y, p.x1 - p.x0, 4)
  })
  paintOverlayMarks(ctx, sizes, pts)
  ctx.restore()
}

/** The guess's step sizes, the ones that leave the major pattern ringed, and its "?". */
function paintOverlayMarks(
  ctx: CanvasRenderingContext2D,
  sizes: readonly StepSize[],
  pts: readonly { x0: number; x1: number; y: number }[],
): void {
  let first: number | null = null
  sizes.forEach((size, i) => {
    const off = size !== MAJOR_STEPS[i]
    if (off && first === null) first = i + 1
    const x = pts[i + 1].x0 + 6
    const y = (pts[i].y + pts[i + 1].y) / 2
    ctx.fillStyle = COLOR.ink2
    ctx.font = FONT.mono(11)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(size, x, y)
    if (!off) return
    ctx.strokeStyle = COLOR.ink2
    ctx.lineWidth = 1.2
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.arc(x + 3.5, y, 9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  })
  const at = first === null ? null : pts[first]
  if (at === null) return
  ctx.fillStyle = COLOR.ink2
  ctx.font = FONT.serif(26)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('?', (at.x0 + at.x1) / 2 + 6, at.y + 6)
}

// ---------------------------------------------------------------- Group, and ti's arrow

function paintBrackets(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  if (s.group <= 0) return
  ctx.save()
  ctx.globalAlpha = s.group
  L.brackets.forEach((b, g) => {
    const a = L.stairs[g * 4]
    const z = L.stairs[g * 4 + 3]
    const xa = a.x + a.w / 2
    const xz = z.x + z.w / 2
    const flash = s.groupFlash[g]
    ctx.strokeStyle =
      flash > 0 ? rgba('#ffffff', 0.6 + 0.4 * flash) : rgba(COLOR.chrome, 0.8)
    ctx.lineWidth = 1.6 + flash
    ctx.beginPath()
    ctx.moveTo(xa, b.y + 7)
    ctx.lineTo(xa, b.y)
    ctx.lineTo(xz, b.y)
    ctx.lineTo(xz, b.y + 7)
    ctx.stroke()
    ctx.fillStyle = flash > 0 ? '#ffffff' : COLOR.ink
    ctx.font = FONT.mono(12)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('T T S', (xa + xz) / 2, b.y - 5)
  })
  ctx.restore()
}

/** The arrow up from ti into the top stair, drawn in as `s.arrow` runs 0 to 1. */
function paintArrow(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  if (s.arrow <= 0 || L.stairs.length < 8) return
  const ti = L.stairs[6]
  const top = L.stairs[7]
  const x0 = ti.x + ti.w * 0.72
  const y0 = ti.top - (L.mode === 'compact' ? 18 : 22)
  const x1 = top.x + top.w * 0.32
  const y1 = top.top - (L.mode === 'compact' ? 16 : 20)
  const cx = (x0 + x1) / 2
  const cy = Math.min(y0, y1) - 16
  const steps = 24
  const n = Math.max(1, Math.round(steps * s.arrow))
  const at = (u: number): [number, number] => [
    (1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u ** 2 * x1,
    (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u ** 2 * y1,
  ]
  ctx.strokeStyle = COLOR.ink
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let k = 0; k <= n; k++) {
    const [x, y] = at(k / steps)
    if (k === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  if (s.arrow < 1) return
  const [hx, hy] = at(1)
  const [px, py] = at(0.9)
  const ang = Math.atan2(hy - py, hx - px)
  ctx.beginPath()
  ctx.moveTo(hx - 7 * Math.cos(ang - 0.5), hy - 7 * Math.sin(ang - 0.5))
  ctx.lineTo(hx, hy)
  ctx.lineTo(hx - 7 * Math.cos(ang + 0.5), hy - 7 * Math.sin(ang + 0.5))
  ctx.stroke()
}

/** One frame of the staircase. `view` is the start as drawn, fractional while a slide travels. */
export function paintStairs(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
  view: number,
): void {
  paintRows(ctx, L)
  paintRuler(ctx, L, view)
  paintHairlines(ctx, L, s)
  paintKeys(ctx, L, s)
  L.stairs.forEach((st, i) =>
    paintBlock(ctx, st, s.light(i), i === 7 && s.waiting),
  )
  paintRisers(ctx, L, s)
  paintStepLabels(ctx, L, s)
  paintOutline(ctx, L, s)
  paintNames(ctx, L, s)
  paintHomes(ctx, L, s)
  paintOverlay(ctx, L, s)
  paintBrackets(ctx, L, s)
  paintArrow(ctx, L, s)
}

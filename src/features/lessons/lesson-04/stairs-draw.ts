// ============================================================
// Lesson 4 staircase painter — rows, blocks, names, marks and the strip
// ============================================================
//
// Paints one frame of the staircase from its layout (stairs-geometry.ts)
// and a scene the toy keeps. The colour code is the series': every stair
// and key is chrome until a voice lights it, blue where Merc sings it
// and orange where Tavi does; gold marks only the two semitone
// steps, in steps 1 and 2 (WEB-SPEC, Look); do, home, is a house glyph,
// never a colour. Tavi's guess in step 3, the white keys from the start,
// is dashed ink-2 with a "?", since violet belongs to the singer on this
// page. Each part draws in its own small function, in paint order.

import { drawHome } from '@/features/lessons/kit/home-glyph'
import { drawStrip } from '@/features/lessons/kit/key-strip'
import type { StepSize } from '@/features/lessons/kit/major-scale'
import { MAJOR_STEPS, nameInScale, scaleNotes, stepSizes, whiteKeysFrom, } from '@/features/lessons/kit/major-scale'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import type { StairBox, StairsLayout } from './stairs-geometry'
import { BLOCK_GAP } from './stairs-geometry'
import { paintRows, paintRuler } from './stairs-ruler'
import type { NamesMode } from './stairs-words'
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
  readonly names: NamesMode
  /** The T and S labels on the risers. */
  readonly steps: boolean
  /** The two semitone steps in gold (steps 1 and 2, once Play up has played). */
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

// ---------------------------------------------------------------- the strip and its hairlines

function paintHairlines(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  const strip = L.strip
  if (strip === null) return
  scaleNotes(s.tonic).forEach((midi, i) => {
    const key = strip.key(midi)
    if (key === null) return
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
  const notes = scaleNotes(s.tonic)
  drawStrip(ctx, L.strip, {
    lit: (m) => notes.includes(m),
    label: (m) => (notes.includes(m) ? nameInScale(m, s.tonic) : null),
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
  MAJOR_STEPS.forEach((size, i) => {
    const r = riser(L, i)
    const gold = s.gold && size === 'S'
    ctx.strokeStyle = gold ? COLOR.gold : rgba(COLOR.chrome, 0.4)
    ctx.lineWidth = gold ? 2.5 : 1.25
    ctx.beginPath()
    ctx.moveTo(r.x + 0.5, r.y0)
    ctx.lineTo(r.x + 0.5, r.y1)
    ctx.stroke()
  })
}

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
  ctx.font = `${weight} 12px "JetBrains Mono", monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, r.x + 6, Math.max((r.y0 + r.y1) / 2, r.y0 + 11))
}

function paintStepLabels(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  if (!s.steps || s.white > 0.5) return
  MAJOR_STEPS.forEach((size, i) => {
    const gold = s.gold && size === 'S'
    // with Group on, the tone that joins the two groups speaks up
    const joint = i === 3 && s.group > 0.5
    const color = gold
      ? COLOR.gold
      : joint
        ? COLOR.ink
        : rgba(COLOR.chrome, 0.9)
    stepLabel(ctx, L, i, size, color, joint || gold ? 700 : 500)
  })
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
  L.stairs.forEach((st, i) => {
    const lit = s.light(i)?.amount ?? 0
    ctx.fillStyle = lit > 0.3 ? '#ffffff' : COLOR.ink
    ctx.fillText(
      stairName(i, s.tonic, s.names),
      st.x + st.w / 2,
      st.top - (L.mode === 'compact' ? 5 : 7),
    )
  })
}

/** Do's house inside both do blocks; the top one lights as Land on do lands. */
function paintHomes(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  s: StairsScene,
): void {
  // centred in the height of do's own block, on both do stairs, and inside it
  const room = L.stairs[0].bottom - L.stairs[0].top
  const size =
    L.mode === 'compact' ? Math.min(18, L.rowH * 1.45) : Math.min(18, room - 4)
  for (const i of [0, 7]) {
    const st = L.stairs[i]
    const lit = i === 7 ? s.home : 0
    const color = i === 7 && s.waiting ? rgba(COLOR.chrome, 0.6) : COLOR.ink
    const cy = st.top + 2 + room / 2
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
  if (s.white <= 0 || keys === null) return
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
  if (s.arrow <= 0) return
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
  paintNames(ctx, L, s)
  paintHomes(ctx, L, s)
  paintOverlay(ctx, L, s)
  paintBrackets(ctx, L, s)
  paintArrow(ctx, L, s)
}

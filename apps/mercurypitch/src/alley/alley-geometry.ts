// ============================================================
// Alley geometry: cover-fit, the projective map, hit-testing
// ============================================================
//
// The lab's §4 (native-s4-alley-lab.html, REPORT §4), carried over as pure
// functions so they can be tested against the lab's own numbers. Nothing in
// here touches the DOM: the component measures the screen and hands the size
// in, which is also how rotation is answered — iPad and Android can turn the
// phone, so the doors are recomputed from the new size rather than assumed to
// be 393 x 852.

import type { DoorKey, DoorSpec, Point, Quad } from './alley-plate'

/** The lab rounds every screen coordinate to a tenth of a pixel. */
const r1 = (n: number): number => Math.round(n * 10) / 10

export interface PlateBox {
  readonly width: number
  readonly height: number
  readonly position: string
}

export interface CoverFit {
  readonly scale: number
  readonly ox: number
  readonly oy: number
  /** The plate as drawn, CSS px: at (-ox, -oy), this wide and this tall. */
  readonly width: number
  readonly height: number
  /** A plate pixel to a screen CSS px, rounded as the lab rounds. */
  readonly at: (p: Point) => Point
}

const POSITION_WORDS: Record<string, number> = {
  left: 0,
  top: 0,
  center: 0.5,
  right: 1,
  bottom: 1,
}

/**
 * `object-position`, resolved to two fractions. Keywords as well as
 * percentages: `72% center` read as two numbers gives NaN for the vertical
 * one, and every quad would come back with a NaN y (lab REPORT, iOS quirks).
 */
export function parsePosition(position: string): [number, number] {
  const parts = position.trim().toLowerCase().split(/\s+/u)
  const frac = (value: string | undefined, fallback: number): number => {
    if (value === undefined) return fallback
    if (value in POSITION_WORDS) return POSITION_WORDS[value]
    const n = Number.parseFloat(value)
    return Number.isNaN(n) ? fallback : n / 100
  }
  return [frac(parts[0], 0.5), frac(parts[1] ?? 'center', 0.5)]
}

/** `object-fit: cover` at `position`, as one scale and two offsets. */
export function coverFit(plate: PlateBox, w: number, h: number): CoverFit {
  const scale = Math.max(w / plate.width, h / plate.height)
  const [fx, fy] = parsePosition(plate.position)
  const ox = (plate.width * scale - w) * fx
  const oy = (plate.height * scale - h) * fy
  return fitOf(plate, scale, ox, oy)
}

function fitOf(
  plate: PlateBox,
  scale: number,
  ox: number,
  oy: number,
): CoverFit {
  return {
    scale,
    ox,
    oy,
    width: plate.width * scale,
    height: plate.height * scale,
    at: (p) => [r1(p[0] * scale - ox), r1(p[1] * scale - oy)],
  }
}

/**
 * Where the landscape door band may go: from the safe top to the dock, right
 * of the headline block, which stands beside the doors on a screen on its
 * side (`left`, its right edge; 0 when it is above them).
 */
export interface AlleyFrame {
  readonly top: number
  readonly bottom: number
  readonly left?: number
  /**
   * The right bound: the width less the right safe-area inset. On its side an
   * Android phone can put its camera cutout there, and the doors, like the
   * dock and the room header, stay clear of it. The screen's width if absent.
   */
  readonly right?: number
}

/** The doors' extent in plate pixels. */
function doorExtent(doors: readonly DoorSpec[]): {
  x0: number
  x1: number
  y0: number
  y1: number
} {
  const xs = doors.flatMap((d) => d.quad.map((p) => p[0]))
  const ys = doors.flatMap((d) => d.quad.map((p) => p[1]))
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  }
}

/** The band's slack, as `tapBand` adds it. */
const BAND_SLACK = 6

/**
 * Where the plate is drawn for the alley.
 *
 * PORTRAIT is cover-fit, and the plate's horizontal anchor is a MAXIMUM: 72%
 * is where the lab framed the six doors at 393 x 852, but on a narrower or
 * taller screen the same anchor slides the Ear Lab's left jamb off the edge
 * (-7 px at 412 x 915). The anchor is pulled left just far enough to keep
 * that jamb at x >= 0, which also shows as much of the Guitar door as the
 * plate allows.
 *
 * LANDSCAPE sizes the plate by the door band instead: the band fits between
 * `frame.top` (the safe top) and `frame.bottom` (the dock), and between
 * `frame.left` (the headline block's right edge: on its side the block stands
 * beside the doors, so the band keeps the full height) and `frame.right` (the
 * right safe-area inset), centred in that box. What the plate does not cover is the alley's own
 * ground colour. Cover-fit there would put the doors a screen and a half tall
 * behind a 393 px window.
 */
export function alleyFit(
  plate: PlateBox,
  doors: readonly DoorSpec[],
  w: number,
  h: number,
  frame: AlleyFrame = { top: 0, bottom: h },
): CoverFit {
  const extent = doorExtent(doors)
  if (w > h) {
    const cover = Math.max(w / plate.width, h / plate.height)
    const left = frame.left ?? 0
    const right = frame.right ?? w
    const room = Math.max(1, frame.bottom - frame.top - BAND_SLACK * 2)
    const scale = Math.min(
      cover,
      room / (extent.y1 - extent.y0),
      Math.max(1, right - left - BAND_SLACK * 2) / (extent.x1 - extent.x0),
    )
    const ox = ((extent.x0 + extent.x1) / 2) * scale - (left + right) / 2
    const oy =
      ((extent.y0 + extent.y1) / 2) * scale - (frame.top + frame.bottom) / 2
    return fitOf(plate, scale, ox, oy)
  }
  const scale = Math.max(w / plate.width, h / plate.height)
  const [fx, fy] = parsePosition(plate.position)
  const spare = plate.width * scale - w
  // The largest anchor that keeps the leftmost jamb on screen.
  const most = spare > 0 ? (extent.x0 * scale) / spare : fx
  const anchor = Math.max(0, Math.min(fx, most))
  return fitOf(plate, scale, spare * anchor, (plate.height * scale - h) * fy)
}

/** A 2D homography [[a,b,c],[d,e,f],[g,h,1]] as its eight free entries. */
export type Homography = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

/** The unit square (0,0) (1,0) (1,1) (0,1) onto four points. */
export function squareToQuad(q: Quad): Homography {
  const [p0, p1, p2, p3] = q
  const dx1 = p1[0] - p2[0]
  const dx2 = p3[0] - p2[0]
  const dx3 = p0[0] - p1[0] + p2[0] - p3[0]
  const dy1 = p1[1] - p2[1]
  const dy2 = p3[1] - p2[1]
  const dy3 = p0[1] - p1[1] + p2[1] - p3[1]
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    return [
      p1[0] - p0[0],
      p2[0] - p1[0],
      p0[0],
      p1[1] - p0[1],
      p2[1] - p1[1],
      p0[1],
      0,
      0,
    ]
  }
  const den = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / den
  const h = (dx1 * dy3 - dx3 * dy1) / den
  return [
    p1[0] - p0[0] + g * p1[0],
    p3[0] - p0[0] + h * p3[0],
    p0[0],
    p1[1] - p0[1] + g * p1[1],
    p3[1] - p0[1] + h * p3[1],
    p0[1],
    g,
    h,
  ]
}

/** A w x h element's own corners onto the quad. */
export function rectToQuad(w: number, h: number, q: Quad): Homography {
  const m = squareToQuad(q)
  return [
    m[0] / w,
    m[1] / h,
    m[2],
    m[3] / w,
    m[4] / h,
    m[5],
    m[6] / w,
    m[7] / h,
  ]
}

/**
 * CSS `matrix3d` is column-major; the homography goes in as
 * (a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1).
 */
export function matrix3d(m: Homography): string {
  const v = [
    m[0],
    m[3],
    0,
    m[6],
    m[1],
    m[4],
    0,
    m[7],
    0,
    0,
    1,
    0,
    m[2],
    m[5],
    0,
    1,
  ]
  return `matrix3d(${v.map((n) => Math.round(n * 1e6) / 1e6).join(',')})`
}

/** The adjugate, normalised so its own [2][2] is 1; the determinant cancels. */
export function invert(m: Homography): Homography {
  const [a, b, c, d, e, f, g, h] = m
  const adj = [
    [e - f * h, -(b - c * h), b * f - c * e],
    [-(d - f * g), a - c * g, -(a * f - c * d)],
    [d * h - e * g, -(a * h - b * g), a * e - b * d],
  ]
  const k = adj[2][2]
  return [
    adj[0][0] / k,
    adj[0][1] / k,
    adj[0][2] / k,
    adj[1][0] / k,
    adj[1][1] / k,
    adj[1][2] / k,
    adj[2][0] / k,
    adj[2][1] / k,
  ]
}

/** Where a homography sends one point. */
export function project(m: Homography, p: Point): Point {
  const w = m[6] * p[0] + m[7] * p[1] + 1
  return [
    (m[0] * p[0] + m[1] * p[1] + m[2]) / w,
    (m[3] * p[0] + m[4] * p[1] + m[5]) / w,
  ]
}

/** The screen as a quad, clockwise from the top left. */
export function fullQuad(w: number, h: number): Quad {
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]
}

/** Corner by corner from `from` to `to`. */
export function lerpQuad(from: Quad, to: Quad, t: number): Quad {
  const at = (i: 0 | 1 | 2 | 3): Point => [
    from[i][0] + (to[i][0] - from[i][0]) * t,
    from[i][1] + (to[i][1] - from[i][1]) * t,
  ]
  return [at(0), at(1), at(2), at(3)]
}

/** The kit's `--ease-out`, solved, because the open is driven from script. */
export function bezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const X = (t: number): number => ((ax * t + bx) * t + cx) * t
  const Y = (t: number): number => ((ay * t + by) * t + cy) * t
  const dX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const err = X(t) - x
      if (Math.abs(err) < 1e-5) return Y(t)
      const slope = dX(t)
      if (Math.abs(slope) < 1e-6) break
      t -= err / slope
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 24; i++) {
      const err = X(t) - x
      if (Math.abs(err) < 1e-5) break
      if (err > 0) hi = t
      else lo = t
      t = (lo + hi) / 2
    }
    return Y(t)
  }
}

export const easeOut = bezier(0.16, 1, 0.3, 1)

export interface DoorLayout {
  readonly key: DoorKey
  /** The quad on screen, CSS px. */
  readonly quad: Quad
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
  readonly cx: number
  readonly cy: number
  /** The quad as an SVG `points` list. */
  readonly points: string
}

/** Every door at this screen size. */
export function layoutDoors(
  plate: PlateBox,
  doors: readonly DoorSpec[],
  w: number,
  h: number,
  frame?: AlleyFrame,
): DoorLayout[] {
  const fit = alleyFit(plate, doors, w, h, frame)
  return doors.map((door) => {
    const [a, b, c, d] = door.quad.map(fit.at)
    const quad: Quad = [a, b, c, d]
    const xs = quad.map((p) => p[0])
    const ys = quad.map((p) => p[1])
    return {
      key: door.key,
      quad,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
      cx: r1((xs[0] + xs[1] + xs[2] + xs[3]) / 4),
      cy: r1((ys[0] + ys[1] + ys[2] + ys[3]) / 4),
      points: quad.map((p) => `${p[0]},${p[1]}`).join(' '),
    }
  })
}

/** Even-odd point in polygon. */
export function inQuad(p: Point, q: Quad): boolean {
  let inside = false
  for (let i = 0, j = 3; i < 4; j = i++) {
    const a = q[i]
    const b = q[j]
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Which door a tap meant. Inside a quad wins; otherwise the nearest centre,
 * with the vertical distance weighted down (x 0.16) because the bays are
 * tall, narrow and side by side. This is how a 28 px Ear Lab door flush with
 * the left edge still takes a thumb (owner decision 4).
 */
export function pickDoor(p: Point, doors: readonly DoorLayout[]): DoorLayout {
  for (const door of doors) if (inQuad(p, door.quad)) return door
  let best = doors[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const door of doors) {
    const dx = p[0] - door.cx
    const dy = p[1] - door.cy
    const distance = dx * dx + dy * dy * 0.16
    if (distance < bestDistance) {
      bestDistance = distance
      best = door
    }
  }
  return best
}

/** The box a door's clip is laid out in before its homography: the quad's bounds. */
export function artBox(door: DoorLayout): { w: number; h: number } {
  return {
    w: Math.max(1, Math.round(door.x1 - door.x0)),
    h: Math.max(1, Math.round(door.y1 - door.y0)),
  }
}

/** The coloured pool a lifted door throws on the floor: its centre on the
 * quad's bottom edge and its width, CSS px (the height is SPILL_H). */
export function spillAt(door: DoorLayout): { x: number; y: number; w: number } {
  const [, , c, d] = door.quad
  return {
    x: Math.round((c[0] + d[0]) / 2),
    y: Math.round((c[1] + d[1]) / 2),
    w: Math.round((door.x1 - door.x0) * 2.4),
  }
}

/** alley.css `.mp-alley__spill`: its height, and the share of it drawn
 * above its anchor (`translate(-50%, -26%)`). */
export const SPILL_H = 72
const SPILL_ABOVE = 0.26
/** Half the rim halo's 6 px stroke, and a pixel over. */
const RIM_SLACK = 4

/**
 * A door's own box, whole CSS px on screen: the quad, its rim's halo and the
 * spill under it. The door element is this box, not the screen, so a lifted
 * door is composited as a door-sized layer (measured at 393x852 each before,
 * on a 393x852 screen, CDP layer tree). Everything drawn inside the door is
 * placed in this box's coordinates.
 */
export function doorBox(door: DoorLayout): {
  x: number
  y: number
  w: number
  h: number
} {
  const spill = spillAt(door)
  const x = Math.floor(Math.min(door.x0 - RIM_SLACK, spill.x - spill.w / 2))
  const y = Math.floor(door.y0 - RIM_SLACK)
  const right = Math.ceil(Math.max(door.x1 + RIM_SLACK, spill.x + spill.w / 2))
  const bottom = Math.ceil(
    Math.max(door.y1 + RIM_SLACK, spill.y + SPILL_H * (1 - SPILL_ABOVE)),
  )
  return { x, y, w: right - x, h: bottom - y }
}

/** A quad moved into a box that starts at (x, y). */
export function quadIn(q: Quad, x: number, y: number): Quad {
  const [a, b, c, d] = q.map((p): Point => [p[0] - x, p[1] - y])
  return [a, b, c, d]
}

/** A rectangle of a video's own pixels. */
export interface SourceRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** What `object-fit: cover` shows of a vw x vh video in a w x h box. */
export function coverCrop(
  vw: number,
  vh: number,
  w: number,
  h: number,
): SourceRect {
  const scale = Math.max(w / vw, h / vh)
  const cw = w / scale
  const ch = h / scale
  return { x: (vw - cw) / 2, y: (vh - ch) / 2, w: cw, h: ch }
}

export function lerpRect(a: SourceRect, b: SourceRect, t: number): SourceRect {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  }
}

/**
 * The CSS transform, origin 0 0, that lays source rect `r` of a video drawn
 * at its own pixel size (`object-fit: fill`) exactly over a w x h box.
 */
export function cropTransform(r: SourceRect, w: number, h: number): string {
  const kx = w / r.w
  const ky = h / r.h
  return `matrix(${kx}, 0, 0, ${ky}, ${-r.x * kx}, ${-r.y * ky})`
}

export interface Band {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/**
 * The one surface that takes a door tap: the union of the quads with 6 px of
 * slack, clamped to the screen — the guitar's right jamb runs past the edge
 * and the surface must not — and to `minTop`, the measured bottom of the
 * headline block. Under a tall safe area the headline reaches down over the
 * door tops, and a tap on the words must not open a door behind them.
 * `maxRight` is the right bound inside the safe area (`AlleyFrame.right`).
 */
export function tapBand(
  doors: readonly DoorLayout[],
  w: number,
  h: number,
  minTop = 0,
  maxRight = w,
): Band {
  const x = r1(Math.max(0, Math.min(...doors.map((d) => d.x0)) - 6))
  const y1 = r1(Math.min(h, Math.max(...doors.map((d) => d.y1)) + 6))
  const y = r1(
    Math.min(y1, Math.max(0, minTop, Math.min(...doors.map((d) => d.y0)) - 6)),
  )
  const x1 = r1(Math.min(w, maxRight, Math.max(...doors.map((d) => d.x1)) + 6))
  return { x, y, w: r1(x1 - x), h: r1(y1 - y) }
}

export const PANEL_WIDTH = 236

/**
 * The card under a selected door: centred on it, 14 px below its sill, kept
 * 16 px inside the screen and clear of whatever the dock draws (`floor` is
 * the dock's top edge, `height` the card's own measured height).
 */
export function placePanel(
  door: DoorLayout,
  w: number,
  floor: number,
  height: number,
): { x: number; y: number } {
  const x = Math.max(
    16,
    Math.min(w - 16 - PANEL_WIDTH, Math.round(door.cx - PANEL_WIDTH / 2)),
  )
  const y = Math.max(
    16,
    Math.min(Math.round(door.y1 + 14), floor - 12 - height),
  )
  return { x, y }
}

/** The 35% dim with the chosen door cut out of it (fill-rule evenodd). */
export function dimPath(w: number, h: number, door: DoorLayout | null): string {
  const screen = `M0 0H${w}V${h}H0Z`
  if (door === null) return screen
  return `${screen} M${door.quad.map((p) => `${p[0]} ${p[1]}`).join('L')}Z`
}

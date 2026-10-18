// ============================================================
// The Warm-up path's layout: where each stop, its name and Merc go
// ============================================================
//
// In W units, a screen's width, as the storyboard was measured
// (DESIGN-warm-up.md §1.2 and §3; bay-layout.ts works the same way), with y
// measured UP from the floor's line of light, because the path stands on
// the floor: the bottom stop sits on it and the others climb from there.
//
// The routine is data, so the path draws however many stops the plan has
// (owner, pw-stops). The storyboard's five places repeat upward: the
// zigzag of their x, and their gaps (the first is wider, the bottom stop
// being the next one and the largest). At the end the stops pack closer
// (screen 3) to make room for Merc on the song stop.
//
// One scale, k, for the whole screen: the smallest that fits both the rest
// layout (start, between, resume) and the end one between the screen's top
// zone and its floor, clamped to 0.75 to 1 so the path does not jump
// between states. A path that does not fit even at 0.75 scrolls.

/** A waiting orb's rim radius, W (storyboard slots 3 to 5). */
export const RIM_W = 0.1005

/**
 * The side of an orb's sprite, W: the sheet's quarter (627 px) at the
 * scale that gives a waiting orb's rim (140.85 px in it) RIM_W. Every state
 * shares the box; the next orb's rim is wider in its own sprite (0.121 W).
 */
export const ORB_BOX_W = 0.4474

/** The storyboard's x for slots 1 to 4 (slot 5 repeats slot 1). */
const SLOT_X = [0.543, 0.455, 0.553, 0.47] as const

/** The storyboard's gaps between slots 1 and 5, W; past them, the last. */
const REST_GAPS = [0.319, 0.259, 0.266, 0.264] as const

/** The end packs the stops closer (screen 3: 0.21 to 0.24 W apart). */
const END_GAP = 0.21

/** The bottom stop's centre above the floor's line, W (slot 1, screen 1). */
const FIRST_ABOVE_FLOOR = 0.132

/** From a stop's centre to its name's near edge, W (0.141 to 0.173). */
export const NAME_GAP_W = 0.157

/**
 * Merc's canvas, a square, W. His body is about 0.35 W tall in it (the
 * renderer's front view frames him at 0.545 of its height), as the
 * storyboard draws him (0.31 to 0.37 W).
 */
export const MERC_CANVAS_W = 0.64

/** Beside a stop: the gap from its rim to his body, W (§3). */
const MERC_BESIDE_GAP = 0.07
/** Half his body's width, W (screen 1: 0.289 W across). */
const MERC_HALF_BODY = 0.145
/** Half his body's height, W: centred on a stop's height beside it. */
const MERC_HALF_HEIGHT = 0.175
/** On the song stop: his feet above its centre, and left of it, W (screen 3). */
const MERC_ON_SONG = { dx: -0.054, dy: 0.036 } as const
/** On the floor at the start, left of the bottom stop (screen 1). */
const MERC_ON_FLOOR = { x: 0.2075, y: 0 } as const
/** His head above the song stop's centre at the end, W (screen 3). */
const MERC_HEAD_OVER_SONG = 0.29

/** The clamp on the screen's one scale (§3). */
export const MIN_K = 0.75
export const MAX_K = 1

export type PathMode = 'rest' | 'end'

/** One stop's place: x across, y up from the floor, W; its name's side. */
export interface StopPlace {
  readonly x: number
  readonly y: number
  /** Names alternate, right then left, from the bottom (§1.2). */
  readonly side: 'left' | 'right'
}

/** Where every stop of a path of `count` goes. */
export function stopPlaces(count: number, mode: PathMode): StopPlace[] {
  const places: StopPlace[] = []
  let y = FIRST_ABOVE_FLOOR
  for (let i = 0; i < count; i += 1) {
    if (i > 0) {
      y += mode === 'end' ? END_GAP : REST_GAPS[Math.min(i - 1, 3)]
    }
    places.push({
      x: SLOT_X[i % SLOT_X.length],
      y,
      side: i % 2 === 0 ? 'right' : 'left',
    })
  }
  return places
}

/** How far above the floor the layout reaches, W: its top stop, or Merc on it. */
export function layoutTop(
  places: readonly StopPlace[],
  mode: PathMode,
): number {
  const top = places.at(-1)
  if (top === undefined) return 0
  return mode === 'end' ? top.y + MERC_HEAD_OVER_SONG : top.y + RIM_W + 0.02
}

export type MercSpot =
  | { readonly at: 'floor' }
  | { readonly at: 'beside'; readonly index: number }
  | { readonly at: 'on'; readonly index: number }

/** Merc's feet, W: x across, y up from the floor. */
export function mercFeet(
  places: readonly StopPlace[],
  spot: MercSpot,
): { x: number; y: number } {
  if (spot.at === 'floor') return { ...MERC_ON_FLOOR }
  const stop = places[spot.index]
  if (stop === undefined) return { ...MERC_ON_FLOOR }
  if (spot.at === 'on') {
    return { x: stop.x + MERC_ON_SONG.dx, y: stop.y + MERC_ON_SONG.dy }
  }
  // Beside, on the side away from the stop's name.
  const reach = RIM_W + MERC_BESIDE_GAP + MERC_HALF_BODY
  return {
    x: stop.side === 'right' ? stop.x - reach : stop.x + reach,
    y: stop.y - MERC_HALF_HEIGHT,
  }
}

export interface FitInput {
  /** The column's width, px. */
  readonly width: number
  /** Floor to the bottom of the top zone in the rest states, px. */
  readonly restRoom: number
  /** The same at the end, under its two titles, px. */
  readonly endRoom: number
  /** The plan's stops. */
  readonly count: number
}

export interface Fit {
  readonly k: number
  /** The path is taller than its room even at MIN_K: it scrolls. */
  readonly scrolls: boolean
}

/** The screen's one scale (§3), and whether the path must scroll. */
export function fitScale(input: FitInput): Fit {
  const need = (mode: PathMode, room: number): number => {
    const top = layoutTop(stopPlaces(input.count, mode), mode)
    return room / (top * input.width)
  }
  const fits = Math.min(
    need('rest', input.restRoom),
    need('end', input.endRoom),
  )
  const k = Math.min(MAX_K, Math.max(MIN_K, fits))
  return { k, scrolls: fits < MIN_K }
}

/** A stop's centre in the path's own px, from the floor at `floorPx`. */
export function placePx(
  place: StopPlace,
  unit: number,
  floorPx: number,
): { x: number; y: number } {
  return { x: place.x * unit, y: floorPx - place.y * unit }
}

/**
 * The path between two stops, in px: one cubic S-curve from the lower
 * centre to the upper one, leaving and arriving upright (screen 1).
 */
export function segmentD(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const bend = (from.y - to.y) * 0.5
  const r = (v: number): number => Math.round(v * 10) / 10
  return `M${r(from.x)} ${r(from.y)}C${r(from.x)} ${r(from.y - bend)} ${r(to.x)} ${r(to.y + bend)} ${r(to.x)} ${r(to.y)}`
}

// ── The screen around the path ────────────────────────────────
//
// §3's three zones, in CSS px: the shell's bar and the chip (or the end's
// two titles) on top, the buttons at the bottom, the path between, standing
// on the floor just above the buttons. The floor stays where it is in
// every state, so the stops do not move when the card and its buttons come
// and go: it is set by the tallest stack, the card over Skip and Next.

/** The path's column: the screen's width up to this, centred (§3). */
export const COLUMN_MAX_PX = 430
/** Under the bar at rest: the chip's row, px. */
export const TOP_REST_PX = 48
/** Under the bar at the end: the two titles, px. */
export const TOP_END_PX = 84
/** The card (52), the gap (10) and Skip and Next (52), px. */
export const BOTTOM_STACK_PX = 114
/** Under the buttons, over the safe area, px (§3). */
export const BOTTOM_MARGIN_PX = 12
/** From the floor's line down to the stack's top, px. */
export const FLOOR_GAP_PX = 16

/** The screen the path is drawn on, CSS px. */
export interface ScreenBox {
  readonly width: number
  readonly height: number
  /** The bar's bottom: the shell's --pushed-top. */
  readonly top: number
  /** The safe area under the buttons: the shell's --pushed-bottom. */
  readonly bottom: number
}

export interface PathFrame {
  /** The column's width, px. */
  readonly column: number
  /** One W at the screen's scale, px: the column's width times k. */
  readonly unit: number
  readonly k: number
  /** The floor's line, px from the column's top. */
  readonly floor: number
  /** The column's height, px: the screen's, or more when it scrolls. */
  readonly height: number
  readonly scrolls: boolean
}

/** Where the floor sits on the screen, px from its top. */
function screenFloor(box: ScreenBox): number {
  return (
    box.height - box.bottom - BOTTOM_MARGIN_PX - BOTTOM_STACK_PX - FLOOR_GAP_PX
  )
}

/**
 * The path's frame on this screen in this mode: its scale (one for every
 * state, §3) and, when even the smallest scale does not fit under the top
 * zone, a taller column that scrolls, its floor still on the screen's.
 */
export function pathFrame(
  box: ScreenBox,
  count: number,
  mode: PathMode,
): PathFrame {
  const column = Math.min(box.width, COLUMN_MAX_PX)
  const floorOnScreen = screenFloor(box)
  const restTop = box.top + TOP_REST_PX
  const endTop = box.top + TOP_END_PX
  const { k } = fitScale({
    width: column,
    restRoom: floorOnScreen - restTop,
    endRoom: floorOnScreen - endTop,
    count,
  })
  const unit = column * k
  const zoneTop = mode === 'end' ? endTop : restTop
  const need = zoneTop + layoutTop(stopPlaces(count, mode), mode) * unit
  const floor = Math.max(floorOnScreen, Math.ceil(need))
  return {
    column,
    unit,
    k,
    floor,
    height: floor + (box.height - floorOnScreen),
    scrolls: floor > floorOnScreen,
  }
}

/** A W position across, in the column's px: the path centred in it. */
export function columnX(x: number, frame: PathFrame): number {
  return frame.column / 2 + (x - 0.5) * frame.unit
}

/** A W height above the floor, in the column's px from its top. */
export function columnY(y: number, frame: PathFrame): number {
  return frame.floor - y * frame.unit
}

// ── Sparkles ──────────────────────────────────────────────────

/** At most this many points (DESIGN-warm-up.md §11). */
export const SPARKLES_MAX = 40
/** Points per 100,000 px² of the screen: at rest, and at the end (§1.2). */
export const SPARKLES_REST = 8
export const SPARKLES_END = 13.7

export interface Sparkle {
  /** Across the column and down to the floor, 0 to 1. */
  readonly x: number
  readonly y: number
  /** px */
  readonly size: number
  readonly tint: 'blue' | 'violet' | 'white'
  /** Its twinkle starts this far into the cycle, s. */
  readonly delay: number
}

const TINTS = ['blue', 'violet', 'white'] as const

/**
 * The night's points: the same ones on every visit (a fixed seed), so the
 * sky does not reshuffle between states; the end shows more of them.
 */
export function sparkles(area: number, mode: PathMode): Sparkle[] {
  const density = mode === 'end' ? SPARKLES_END : SPARKLES_REST
  const count = Math.min(SPARKLES_MAX, Math.round((area / 100_000) * density))
  let seed = 0x2f6b
  const next = (): number => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const points: Sparkle[] = []
  for (let i = 0; i < SPARKLES_MAX; i += 1) {
    const point: Sparkle = {
      x: 0.04 + next() * 0.92,
      y: 0.06 + next() * 0.86,
      size: 1.5 + next() * 1.8,
      tint: TINTS[Math.floor(next() * TINTS.length)] ?? 'blue',
      delay: next() * 4,
    }
    if (i < count) points.push(point)
  }
  return points
}

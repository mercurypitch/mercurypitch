// ============================================================
// Tune line motion — a slide's lift, travel and glow, and a lit note's afterglow
// ============================================================
//
// A slide is the tune line's signature move (Lesson 6 WEB-SPEC, Toys 1): the
// line lifts off its rows (a soft shadow, the rows dimming), travels, and
// settles on its new rows, where the gap numbers glow gold once, unchanged.
// Here each part is a pure function of the time since the slide began, so
// the core (tune-line.ts) only asks where things are. Under reduced motion
// the core never starts one: the line lands at once, with no lift and no
// glow.

/** Seconds the line takes to lift, and to settle once it lands. */
export const LIFT_SEC = 0.16
export const SETTLE_SEC = 0.22
/** The gap numbers' glow: how fast it rises as the line lands, and how long it fades. */
export const GLOW_RISE_SEC = 0.12
export const GLOW_SEC = 1.2
/** How long a note stays lit after it ends, seconds. */
export const AFTERGLOW_SEC = 0.18

/** A slide from one start to another, begun at `t0` (seconds), travelling for `travel`. */
export interface Slide {
  readonly from: number
  readonly to: number
  readonly t0: number
  readonly travel: number
}

/** A slide's travel, a little longer for a longer slide: 0.31 s for a semitone, 0.58 s for six. */
export const travelSec = (rows: number): number =>
  Math.min(0.75, 0.25 + 0.055 * Math.abs(rows))

/** Seconds from a slide's start until the line lands on its new rows. */
export const landsAfter = (s: Slide): number => LIFT_SEC + s.travel

/** Where a slide is: the start the line is drawn at, its lift and the glow, each 0 to 1. */
export interface SlideState {
  readonly view: number
  readonly lift: number
  readonly glow: number
  /** True once the line has settled and the glow is spent. */
  readonly done: boolean
}

const unit = (u: number): number => Math.min(1, Math.max(0, u))
const smoothstep = (u: number): number => u * u * (3 - 2 * u)

/** A slide `t` seconds into the page's clock. */
export function slideAt(s: Slide, t: number): SlideState {
  const u = t - s.t0
  const land = landsAfter(s)
  const moved = smoothstep(unit((u - LIFT_SEC) / s.travel))
  const lift = u < land ? unit(u / LIFT_SEC) : 1 - unit((u - land) / SETTLE_SEC)
  const since = u - land
  const glow =
    since < 0
      ? 0
      : since < GLOW_RISE_SEC
        ? since / GLOW_RISE_SEC
        : 1 - unit((since - GLOW_RISE_SEC) / GLOW_SEC)
  return {
    view: s.from + (s.to - s.from) * moved,
    lift,
    glow,
    done: since >= Math.max(SETTLE_SEC, GLOW_RISE_SEC + GLOW_SEC),
  }
}

/** A lit note's light at `t`: full while it sounds, fading over the afterglow, 0 before and after. */
export function lightAt(from: number, to: number, t: number): number {
  if (t < from) return 0
  if (t <= to) return 1
  return Math.max(0, 1 - (t - to) / AFTERGLOW_SEC)
}

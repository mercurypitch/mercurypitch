// ============================================================
// The bubbles the voice sheds while it sounds
// ============================================================
//
// DESIGN-lip-roll.md 1: a stream of small glass bubbles from the ribbon's
// head while the voice sounds. They are decoration, not a claim that the
// app hears the lips: they follow the voice, whatever makes it. Each is
// born at the head (world X and y, so it stays in the water it was born
// in and scrolls away with it), rises and fades over a second. At most
// MAX_BUBBLES live at once; under reduced motion there are none.
//
// The stream is pure (time in, bubbles out); BayScene.tsx draws them onto
// one canvas a frame, the bubble sprite (bay-art.ts) once each.

/** Bubbles alive at once. */
export const MAX_BUBBLES = 30
/** New bubbles a second while the voice sounds. */
export const BUBBLE_RATE = 24
/** A bubble's life, s. */
export const BUBBLE_LIFE_SEC = 1
/** How far a bubble rises and drifts back over its life, W. */
const RISE_W = 0.075
const DRIFT_W = 0.025
/** Its size, W: the storyboard's 0.02 to 0.03. */
const SIZE_MIN_W = 0.014
const SIZE_SPAN_W = 0.014
/** Where it is born about the head, W. */
const JITTER_W = 0.012

export interface Bubble {
  /** World X and y (W) where it was born. */
  readonly x: number
  readonly y: number
  /** When, s (the stream's clock). */
  readonly born: number
  readonly size: number
  /** -1..1: which way it wobbles as it rises. */
  readonly sway: number
}

/** A bubble as drawn now: its world place, size and opacity. */
export interface BubbleAt {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly alpha: number
}

export interface BubbleStream {
  /**
   * Time moves to `now` (s); while the voice sounds at `head` (world X and
   * y), new bubbles are born there. Null: the voice is silent.
   */
  step: (now: number, head: { x: number; y: number } | null) => void
  /** Every live bubble, where it is now. */
  readonly live: () => readonly BubbleAt[]
  /** None left. */
  clear: () => void
}

export function createBubbleStream(
  random: () => number = Math.random,
): BubbleStream {
  let bubbles: Bubble[] = []
  let now = 0
  let owed = 0
  let last: number | null = null

  return {
    step: (t, head) => {
      const dt = last === null ? 0 : Math.max(0, Math.min(0.1, t - last))
      last = t
      now = t
      bubbles = bubbles.filter((b) => t - b.born < BUBBLE_LIFE_SEC)
      if (head === null) {
        owed = 0
        return
      }
      owed += dt * BUBBLE_RATE
      while (owed >= 1 && bubbles.length < MAX_BUBBLES) {
        owed -= 1
        bubbles.push({
          x: head.x + (random() - 0.5) * 2 * JITTER_W,
          y: head.y + (random() - 0.5) * 2 * JITTER_W,
          born: t,
          size: SIZE_MIN_W + random() * SIZE_SPAN_W,
          sway: random() * 2 - 1,
        })
      }
      if (bubbles.length >= MAX_BUBBLES) owed = 0
    },
    live: () =>
      bubbles.map((b) => {
        const age = Math.max(0, (now - b.born) / BUBBLE_LIFE_SEC)
        const rise = 1 - (1 - age) * (1 - age)
        return {
          x: b.x - DRIFT_W * age + 0.006 * b.sway * Math.sin(age * 9),
          y: b.y - RISE_W * rise,
          size: b.size * (0.8 + 0.3 * age),
          alpha: Math.min(1, age * 8) * (1 - age),
        }
      }),
    clear: () => {
      bubbles = []
      owed = 0
      last = null
    },
  }
}

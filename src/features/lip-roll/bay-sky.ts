// ============================================================
// The bay's sky: how far it slides, and where the moon rides in it
// ============================================================
//
// The bay-back (sky, cliffs, far sea) slides left as the camera moves.
// Owner, 15 Oct 2026: the sky slides further, so the moon reaches
// storyboard screen 2's and screen 3's spots, and it shrinks a little in
// the run. Screen 2 is a run a quarter of the way into its first wave (the
// playhead at u = -0.467 of it, where screen 2's ribbon head sits on its
// own fitted arch); screen 3 is the demo's first take on its hold
// (demo-script.ts DEMO_HOLD). Both come early, so the slide starts fast:
// SKY.fast is the slope through the intro that puts the moon at both
// screens' x (least squares; bay-sky.test.ts measures it). Past screen 3
// the slope eases down to SKY.slow, which brings a run's end to the old
// quarter-speed slide's total, so the plate still covers the screen.
//
// The moon is a plate of its own (bay-moon), in the bay-back's box: it
// slides with the sky, so the moonlight path painted on the far sea stays
// under it. Over the count-in's zoom it shrinks to screens 2 and 3's size
// and rises to their mean height. The storyboard paints the moon at 0.164,
// 0.214 and 0.178 H on screens 1 to 3, which no scroll can do (L0 report,
// section 5), so the run keeps the mean: about 0.05 W from each screen.
//
// Reduced motion keeps the sky still, as before: the moon stays at screen
// 1's x, shrunk and raised with the zoom like everything else.

import { easedDistance } from '@/components/room-kit/glide-gap'
import { BAY } from './bay-geometry'
import { horizonAt } from './bay-layout'
import { INTRO_CAMERA } from './bay-scroll'

export const SKY = {
  /** The sky's slide per W of camera, through screens 2 and 3. */
  fast: 0.52,
  /** The slope after them, to the run's end. */
  slow: 0.167,
  /** The ease from fast to slow starts this far past the intro's camera, W, */
  easeFrom: 0.32,
  /** and takes this much of the camera's travel, W. */
  easeOver: 0.6,
  /**
   * The count-in rolls the camera back past the intro's a little: the sky
   * eases to at most this far right (its plate's left margin, less a hair).
   */
  backRoom: 0.019,
} as const

/** How far left the sky has slid (W) with the camera at `camera`. */
export function skyTravel(camera: number): number {
  const d = camera - INTRO_CAMERA
  if (d <= 0) return SKY.backRoom * Math.tanh((SKY.fast * d) / SKY.backRoom)
  const past = d - SKY.easeFrom
  if (past <= 0) return SKY.fast * d
  const over = SKY.easeOver
  const eased =
    past >= over ? over / 2 + (past - over) : over * easedDistance(past / over)
  return SKY.fast * d + (SKY.slow - SKY.fast) * eased
}

const mean = (a: number, b: number): number => (a + b) / 2
const [screen2, screen3] = BAY.moonScreens

/** The moon in the run: screens 2 and 3's mean size, at their mean height. */
const MOON_RUN = {
  scale: mean(screen2.d, screen3.d) / BAY.moon.d,
  dy:
    mean(screen2.cy, screen3.cy) - (BAY.moon.cy + BAY.horizonRun - BAY.horizon),
} as const

/** The moon's own move about its centre at zoom `z`: up `dy` W, scaled. */
export function moonPose(z: number): { dy: number; scale: number } {
  const k = Math.max(0, Math.min(1, z))
  return { dy: MOON_RUN.dy * k, scale: 1 + (MOON_RUN.scale - 1) * k }
}

/** Where the moon is on the screen: its centre (W, storyboard y) and size. */
export function moonAt(
  camera: number,
  z: number,
  reduced: boolean,
): { x: number; y: number; d: number } {
  const pose = moonPose(z)
  return {
    x: BAY.moon.cx - (reduced ? 0 : skyTravel(camera)),
    y: BAY.moon.cy + horizonAt(z) - BAY.horizon + pose.dy,
    d: BAY.moon.d * pose.scale,
  }
}

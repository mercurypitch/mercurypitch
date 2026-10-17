// ============================================================
// Where Merc will ride over the next moments of the demo's take
// ============================================================
//
// The demo's tooltips are placed once, when they show, and Merc rides on
// under them, so the room's demo layer asks where he will be while a
// tooltip is up, not only where he is (demo/tip-targets.ts, its `lane`).
// The demo's take carries its whole voice ahead of the frames released so
// far (scripted-take.ts `voice`), so his path is known: the camera's
// x for him (bay-ride.ts rideXOn) and his feet on the voice's pitch
// (rideTarget), sampled over the time asked for.

import type { DemoVoicePoint } from '@/components/demo-kit/demo-plan'
import type { GlidePath } from '@/lib/glide/glide-path'
import { targetAt } from '@/lib/glide/glide-path'
import { rideTarget, rideXOn } from './bay-ride'
import type { BayScroll } from './bay-scroll'

/** Where Merc will ride during the demo's take: a moment ahead of now. */
export interface MercSpot {
  /** Screen x (W) and world y of his feet, as the bay's frame takes them. */
  readonly x: number
  readonly feetY: number
  /** The camera's zoom then, 0 to 1. */
  readonly zoom: number
}

/** The demo's take as the room runs it. */
export interface AheadTake {
  readonly path: GlidePath
  readonly countIn: number
  readonly scroll: BayScroll
  /** The wave a path time is on (room-kit glide/glide-take.ts archAt). */
  readonly waveAt: (t: number) => number
  /** The take's whole voice on its own clock (count-in included). */
  readonly voice: readonly DemoVoicePoint[]
  /** The take's clock now, s. */
  readonly now: number
}

/** Samples over the time asked for. */
export const AHEAD_SAMPLES = 24

/** Merc's spots from now to `seconds` ahead, AHEAD_SAMPLES + 1 of them. */
export function mercAheadOf(take: AheadTake, seconds: number): MercSpot[] {
  const { path, countIn, voice } = take
  const step = voice.length > 1 ? voice[1].t - voice[0].t : 0.025
  const from = take.now - countIn
  const spots: MercSpot[] = []
  for (let k = 0; k <= AHEAD_SAMPLES; k++) {
    const t = from + (seconds * k) / AHEAD_SAMPLES
    const wave = path.arches[take.waveAt(t)]
    const point = voice[Math.round((t + countIn) / step)] as
      | DemoVoicePoint
      | undefined
    const midi =
      point === undefined || point.level <= 0
        ? null
        : wave.rootMidi + point.cents / 100
    spots.push({
      x: rideXOn(take.scroll, t),
      feetY: rideTarget(
        midi,
        t < 0 ? null : targetAt(path, t),
        wave.rootMidi,
        wave.topMidi - wave.rootMidi,
      ),
      zoom: take.scroll.zoom(t),
    })
  }
  return spots
}

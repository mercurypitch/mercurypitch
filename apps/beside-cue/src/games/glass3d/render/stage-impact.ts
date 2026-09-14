// The break, as a stage plays it.
// ============================================================
//
// runtime/impact.ts is the timeline, and it is pure. This is the part of
// it that reaches outside the frame: the taps go to the hand, and the
// burst's pixel ratio goes to the canvas. Every stage that breaks glass --
// the Cabinet, the Hallway, the chamber -- asks it the same things once a
// frame, so the three cannot drift apart.
//
// Once a frame, DRAWN OR NOT. A tap belongs to its moment, and a frame
// calm mode skips drawing is still a frame that moment can fall in. Calm
// never engages while glass is in the air, but a tap should not depend on
// that staying true.

import { tap } from '../runtime/haptics'
import type { ImpactConfig, ImpactFrame, Tap } from '../runtime/impact'
import { createImpactTrack, pixelRatioFor } from '../runtime/impact'

export interface StageImpact {
  /** The glass broke at this wall time. A second break starts it over. */
  start(wallSeconds: number): void
  /** This frame's share of the break, with its taps already sent. Null
   * before the first break. */
  frame(wallSeconds: number): ImpactFrame | null
  /** The pixel ratio to draw at: the running cap, or the burst's while
   * the glass flies. */
  pixelRatio(): number
  /** Heard when the burst starts and when it ends, so the stage can size
   * its canvas again. */
  onBurst(refit: () => void): void
}

export const createStageImpact = (
  config: () => ImpactConfig,
  haptic: (style: Tap) => void = tap,
  screenRatio: () => number = () => window.devicePixelRatio,
): StageImpact => {
  const track = createImpactTrack()
  let burst = false
  let refit = (): void => {}
  return {
    start(wallSeconds) {
      track.start(wallSeconds)
    },
    frame(wallSeconds) {
      const f = track.frame(wallSeconds, config())
      if (f === null) return null
      for (const t of f.taps) haptic(t)
      if (f.burst !== burst) {
        burst = f.burst
        refit()
      }
      return f
    },
    pixelRatio: () => pixelRatioFor(screenRatio(), burst, config()),
    onBurst(fn) {
      refit = fn
    },
  }
}

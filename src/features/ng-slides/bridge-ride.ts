// ============================================================
// Merc on the bridge: where he stands and what he does
// ============================================================
//
// DESIGN-ng-slides.md 1: he rides the voice at the playhead. On the path
// he walks on the arch's top edge; flat, he sinks under it; sharp, he
// rises above it, so his place says which way to move. In a breath he
// lands on the landing's stone.
//
// THE SEAM FOR PR 8. His `hum` (mouth closed, soft rings while the voice
// sounds) and `ride` (his lean follows the pitch's rate of change, read
// from the voice the room hands him every frame) are new choreography
// states, built in PR 8. Until then he uses the states he has: `sing`
// while the voice sounds on a slide, `listen` while it does not. PR 8
// changes RIDE_STATES below; the room already feeds his voice (MercVoice,
// with the voice's MIDI) on every frame of a slide, so nothing else
// changes.

import type { MercState } from '@/lib/merc/constants'
import { ARCH } from './bridge-geometry'
import { pitchY } from './bridge-layout'

/** What the run is doing, as Merc's choreography sees it. */
export type RideMoment =
  | 'intro'
  | 'countIn'
  | 'slideVoiced'
  | 'slideQuiet'
  | 'breath'
  | 'archLit'
  | 'result'
  | 'resultAllLit'

/**
 * His state for each moment. PR 8: `slideVoiced` becomes 'hum' (or 'ride'
 * with the hum on), `slideQuiet` 'ride'.
 */
export const RIDE_STATES: Readonly<Record<RideMoment, MercState>> = {
  intro: 'idle',
  countIn: 'listen',
  slideVoiced: 'sing',
  slideQuiet: 'listen',
  breath: 'idle',
  archLit: 'lock',
  result: 'idle',
  resultAllLit: 'celebrate',
}

/** His feet's smoothing toward the voice, s (a time constant). */
export const RIDE_TAU_SEC = 0.08
/** How far above the apex and under the deck the voice takes him, W. */
const ABOVE_APEX_W = 0.12
const UNDER_DECK_W = 0.08

/**
 * Where his feet go for this frame: on the voice while it sounds, on the
 * path (or the landing's stone) while it does not.
 */
export function rideTarget(
  voiceMidi: number | null,
  targetMidi: number | null,
  root: number,
): number {
  const midi = voiceMidi ?? targetMidi ?? root
  const y = pitchY(midi, root)
  return Math.min(
    ARCH.deckY + UNDER_DECK_W,
    Math.max(ARCH.apexY - ABOVE_APEX_W, y),
  )
}

/** One step of his feet toward `target`, `dt` seconds on. */
export function rideStep(current: number, target: number, dt: number): number {
  if (!(dt > 0)) return current
  const k = 1 - Math.exp(-dt / RIDE_TAU_SEC)
  return current + (target - current) * k
}

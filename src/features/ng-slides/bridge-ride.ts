// ============================================================
// Merc on the bridge: where he stands and what he does
// ============================================================
//
// DESIGN-ng-slides.md 1: he rides the voice at the playhead. On the path
// he walks on the arch's top edge; flat, he sinks under it; sharp, he
// rises above it, so his place says which way to move. In a breath he
// lands on the landing's stone.
//
// His states (RIDE_STATES): at the intro he hums at the arch's foot, his
// mouth closed and his rings soft (`hum`, with a hum of his own on the
// first root, introHum: nobody sings yet). On the slides he rides the
// voice (`ride`: the hum, leaning with the sung pitch's slope, forward up
// a rise and back down a fall; src/lib/merc/sim-glide.ts reads the slope),
// so the room hands him the SUNG pitch every frame (MercVoice.midi), with
// the cents against the moving line. His rings show only while the voice
// sounds, so a quiet slide is the same state with no rings and no lean.
// In the count-in he listens to the root; in a breath he stands; an arch
// lit, his happy face; the result, idle, or a cheer when all five lit.

import type { MercState } from '@/lib/merc/constants'
import { ARCH, PLAYHEAD_X } from './bridge-geometry'
import { MERC_INTRO_X, pitchY } from './bridge-layout'

// His feet's easing and his own sound at the intro: every glide room's.
export {
  INTRO_HUM_LEVEL,
  introHum,
  RIDE_TAU_SEC,
  rideStep,
} from '@/components/room-kit/glide/glide-ride'

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

/** His state for each moment. */
export const RIDE_STATES: Readonly<Record<RideMoment, MercState>> = {
  intro: 'hum',
  countIn: 'listen',
  slideVoiced: 'ride',
  slideQuiet: 'ride',
  breath: 'idle',
  archLit: 'lock',
  result: 'idle',
  resultAllLit: 'celebrate',
}

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

/**
 * His x (W) at path time `t`: from his place on the pier at the intro to
 * the playhead over the count-in (t from -countIn to 0), eased at both
 * ends, as the bridge rolls the first arch's foot in under him. From the
 * first slide on he stays at the playhead.
 */
export function rideX(t: number, countIn: number): number {
  if (t >= 0 || countIn <= 0) return PLAYHEAD_X
  const p = Math.min(1, Math.max(0, (t + countIn) / countIn))
  const eased = p * p * (3 - 2 * p)
  return MERC_INTRO_X + (PLAYHEAD_X - MERC_INTRO_X) * eased
}

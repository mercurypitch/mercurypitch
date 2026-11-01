// ============================================================
// Merc in the bay: where he rides and what he does
// ============================================================
//
// DESIGN-lip-roll.md 1: he surfs the voice at the playhead. On the path he
// sits on the crest; flat, he sinks into the wave; sharp, he lifts off it,
// so his place says which way to move. In a breath he rests on the root.
//
// His states (RIDE_STATES): at the intro he waits at the first wave's
// root, buzzing on his own (`hum` with the intro's own voice, introHum;
// the buzz is drawn beside his mouth by the room, and his own sound rings
// are off for the whole room, MercView `rings`). On the waves he rides the
// voice (`ride`: leaning with the sung pitch's slope; src/lib/merc/
// sim-glide.ts reads it), so the room hands him the SUNG pitch every
// frame. In the count-in he listens to the root; in a breath he stands; a
// wave lit, his happy face; the result, idle, or a cheer on a new best.

import type { MercState } from '@/lib/merc/constants'
import type { GlideMouth } from '@/lib/merc/sim-glide'
import { PLAYHEAD_X, WAVE } from './bay-geometry'
import { ABOVE_CREST_W, MERC_INTRO_X, pitchY, UNDER_ROOT_W, zoomAt, } from './bay-layout'
import type { BayScroll } from './bay-scroll'

// His feet's easing and his own sound at the intro: every glide room's, his
// feet eased at a lip roll's own pace (BUZZ_RIDE_TAU_SEC: a trill flutters).
export {
  BUZZ_RIDE_TAU_SEC,
  INTRO_HUM_LEVEL,
  introHum,
  rideFeet,
} from '@/components/room-kit/glide/glide-ride'

/** What the run is doing, as Merc's choreography sees it. */
export type RideMoment =
  | 'intro'
  | 'countIn'
  | 'waveVoiced'
  | 'waveQuiet'
  | 'breath'
  | 'waveLit'
  | 'result'
  | 'resultBest'

/** His state for each moment. */
export const RIDE_STATES: Readonly<Record<RideMoment, MercState>> = {
  intro: 'hum',
  countIn: 'listen',
  waveVoiced: 'ride',
  waveQuiet: 'ride',
  breath: 'idle',
  waveLit: 'lock',
  result: 'idle',
  resultBest: 'celebrate',
}

/**
 * His mouth while he buzzes, at the intro and on the waves. `buzz`: a lip
 * roll's, the lips together, flapping and rippling along their seam, the
 * cheeks a little full. `open` would give him Long note's singing O
 * instead, opening with the voice's level.
 */
export const LIP_MOUTH: GlideMouth = 'buzz'

/**
 * Where his feet go for this frame (world y): on the voice while it
 * sounds, on the path (or the root, in a breath) while it does not.
 */
export function rideTarget(
  voiceMidi: number | null,
  targetMidi: number | null,
  root: number,
  semitones: number,
): number {
  const midi = voiceMidi ?? targetMidi ?? root
  const y = pitchY(midi, root, semitones)
  return Math.min(
    WAVE.rootY + UNDER_ROOT_W,
    Math.max(WAVE.crestY - ABOVE_CREST_W, y),
  )
}

/**
 * His x (W) at path time `t`: from his place at the first root on the
 * intro to the playhead over the count-in, eased at both ends. From the
 * first wave on he stays at the playhead.
 */
export function rideX(t: number, countIn: number): number {
  if (t >= 0 || countIn <= 0) return PLAYHEAD_X
  const p = Math.min(1, Math.max(0, (t + countIn) / countIn))
  const eased = p * p * (3 - 2 * p)
  return MERC_INTRO_X + (PLAYHEAD_X - MERC_INTRO_X) * eased
}

/**
 * His x (W) at path time `t` on `scroll`: rideX, and past the playhead by
 * as far as the voice has ridden on while a held camera stood (the demo's,
 * bay-scroll.ts holdCamera). A run's camera is where the voice is sung
 * (it stands between waves, and the voice's place with it): he stays at
 * the playhead.
 */
export function rideXOn(scroll: BayScroll, t: number): number {
  const ahead = scroll.at(t) - scroll.camera(t)
  return rideX(t, scroll.countIn) + zoomAt(scroll.zoom(t)).sx * ahead
}

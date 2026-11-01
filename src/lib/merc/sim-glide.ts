// ============================================================
// Merc glide reading — the sung pitch's slope and the hum's presence
// ============================================================
//
// What the glide states (`hum`, `ride`) read from the voice on top of what
// the sim already smooths: the sung pitch (MercVoice.midi) eased, how fast
// it moves in semitones a second, and how present the hum is. It is kept
// apart from smoothVoice so the approved states' arithmetic stays exactly as
// it was (sim-pinned.test.ts holds them to it).
//
// The slope is the derivative of the eased pitch, eased again over 0.2 s:
// a slide up a fifth reads as 4 to 6 semitones a second, while vibrato and
// a tracker's frame-to-frame noise stay under the dead band. A lip roll's
// slope is eased over half a second (RIDE.buzzSlopeTau): its pitch flutters
// with the lips, several semitones a second even on a held note, and the
// longer ease keeps that flutter under the dead band while the wave's own
// rise, two seconds long, still comes through. A voice that
// comes back after a silence starts where it is, and so does one that
// jumps (a register flip, or the tracker slipping an octave for a frame):
// neither is a slide, so neither leans him.

import { smooth } from './sim-math'

/**
 * His mouth while he hums or rides (Sim.glideMouth): `closed`, the hum's
 * closed smile (Ng slides); `open`, `sing`'s O, opening with the voice's
 * level as it does in Long note; `buzz`, a lip roll's: the lips together,
 * flapping and rippling along their seam while the voice sounds, the
 * cheeks a little full (Lip roll, whose buzz marks sit beside them).
 */
export type GlideMouth = 'closed' | 'open' | 'buzz'

/** The glide reading, carried in the sim's smoothed voice. */
export interface GlideSmooth {
  /** The sung pitch (fractional MIDI), eased over 60 ms. */
  pitch: number
  /** True while a voiced pitch is being followed. */
  heard: boolean
  /** How fast the sung pitch moves, semitones per second. */
  slope: number
  /** The hum's presence, 0..1: eased in and out over 0.12 s. */
  env: number
}

/** How `ride` turns the slope into his lean. */
export const RIDE = {
  /** Up to this slope (semitones/s) he stands upright: vibrato, drift. */
  dead: 0.8,
  /** How long the slope is eased over, s. */
  slopeTau: 0.2,
  /**
   * The same on a lip roll (GlideMouth `buzz`), s: the trill's pitch
   * flutters with the lips, and at 0.2 s he rocked on it. Eased over half a
   * second, a flutter of a semitone either way, 3 to 8 times a second,
   * hardly leans him, while a wave of half an octave in 2.4 s still does.
   */
  buzzSlopeTau: 0.5,
  /** From this slope on he leans all the way. */
  full: 6,
  /** His full lean on the lean spring; `listen` leans 0.24. */
  lean: 0.17,
  /**
   * A reading this far (semitones) from the eased pitch is a jump, not a
   * slide. The fastest slide the rooms ask for, an octave in half a second
   * (24 semitones/s), runs under 2 semitones ahead of the eased pitch.
   */
  jump: 2.5,
} as const

export const freshGlide = (): GlideSmooth => ({
  pitch: 0,
  heard: false,
  slope: 0,
  env: 0,
})

/** One step of the glide reading, after smoothVoice. */
export function stepGlide(
  g: GlideSmooth,
  voiced: boolean,
  midi: number,
  dt: number,
  slopeTau: number = RIDE.slopeTau,
): void {
  const was = g.heard
  const before = g.pitch
  g.heard = voiced && Number.isFinite(midi)
  const follows = was && g.heard && Math.abs(midi - g.pitch) <= RIDE.jump
  if (follows) g.pitch += (midi - g.pitch) * (1 - Math.exp(-dt / 0.06))
  else if (g.heard) g.pitch = midi
  const rate = follows ? (g.pitch - before) / dt : 0
  g.slope += (rate - g.slope) * (1 - Math.exp(-dt / slopeTau))
  g.env += ((voiced ? 1 : 0) - g.env) * (1 - Math.exp(-dt / 0.12))
}

/**
 * His lean for a slope: upright inside the dead band, forward (toward
 * where the bridge goes) up a rise, back down a fall, eased in and held at
 * RIDE.lean from RIDE.full on.
 */
export function rideLean(slope: number): number {
  const k = smooth(RIDE.dead, RIDE.full, Math.abs(slope))
  return k === 0 ? 0 : Math.sign(slope) * RIDE.lean * k
}

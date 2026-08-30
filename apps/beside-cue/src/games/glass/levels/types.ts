// ============================================================
// Melody levels — the content layer.
//
// The architecture keeps three things separate (see
// docs/games/melody-levels.md "Architecture"):
//   1. LEVEL (this file): what the music is — degrees, durations,
//      syllables, encounters. Pure JSON-serializable data; knows nothing
//      about pixels, physics, or input. The data format IS the editor,
//      and a remote songbook later is a fetch, not a refactor.
//   2. MODE: how a level becomes play — flow (voice is position),
//      platformer (voice is the jump), and later rhythm/listen.
//      `compileLevel(level, { mode })` is the bridge (the analogue of a
//      beatmap converter in rhythm games: one chart, many rulesets).
//   3. DRIVER: where the input comes from — voice, taps, answers.
//
// The one config-shaped hook is `feel` — a level's difficulty profile,
// still plain data (numbers in the JOURNEY_CONFIG tree shape).
// ============================================================

import type { FeelOverlay } from './feel'

export interface MelodyDef {
  id: string
  name: string
  /** Semitones relative to the tonic (the player's calibrated ground
   * note), in singing order. */
  degrees: number[]
  /** Note lengths in beats — platform width today, timing layer later.
   * Must be the same length as `degrees`. */
  durations: number[]
  /** Karaoke syllable per note (optional; same length as `degrees`). */
  syllables?: string[]
  /** Note indices (into `degrees`) compiled as GLASS slabs — icy, they
   * crack under a standing Merc, so these notes must keep moving.
   * Ignored in rhythm mode (the road never lets anyone camp). */
  glassAt?: number[]
  bpm?: number
}

export type Segment =
  /** A sung phrase. Each melody segment starts a checkpoint (except the
   * first — the ground slab is the safe start). */
  | { type: 'melody'; melody: MelodyDef }
  /** A resonating pane blocking the road: sing it open. */
  | { type: 'encounter'; kind: 'gate' | 'wall'; at: number; hint?: string }
  /** A musical rest — empty road, a breath wide. */
  | { type: 'rest'; beats?: number }

export interface LevelDef {
  id: string
  title: string
  /** One-line card copy on the games list. */
  blurb?: string
  /** Intro-card body; a default is used when omitted. */
  intro?: string
  /** Done-card body; a default is used when omitted. */
  done?: string
  /** Default play mode; the player can still pick another one. */
  control?: 'flow' | 'platformer' | 'rhythm'
  /** Deep-partial JOURNEY_CONFIG overlay — the difficulty profile,
   * merged over the defaults when the stage builds (applyFeel). */
  feel?: FeelOverlay
  segments: Segment[]
}

// ============================================================
// Drum hits — the app's drum voices, struck on the beat clock
// ============================================================
//
// Lesson 19 plays Subdivide's drums (its WEB-SPEC, Audio; FACTS 18, 63):
// the app's kick, snare, closed hi-hat and sidestick (src/lib/drum-voices.ts),
// each struck at its time on the audio clock into a run's own bus, so
// stopping a play silences what it booked, as Lesson 8's beat machine
// strikes its own (kit/beat-machine.ts `bookHit`). The rhythm bar takes
// `bookDrum` as an option, so only a page whose plays have drums carries
// the voices: Lesson 17's first paint does not.
//
// A bar of Subdivide's (src/lib/ear/metre.ts) strikes its first step full
// and every other at 0.7, as the Ear Lab's drill does (FACTS 18).

import type { DrumVoiceId } from '@/lib/drum-voices'
import { triggerDrumVoice } from '@/lib/drum-voices'
import type { MetrePattern } from '@/lib/ear/metre'
import type { Bus } from './sound-ahead'

/** A drum struck: its voice, and its level from 0 to 1. */
export interface DrumHit {
  readonly voice: DrumVoiceId
  readonly level: number
}

/** The level of every hit but a bar's accent, Subdivide's (FACTS 18). */
export const DRUM_LEVEL = 0.7

/** Strikes a drum at `when` on the audio clock, into a run's bus. */
export function bookDrum(hit: DrumHit, when: number, bus: Bus): void {
  triggerDrumVoice(hit.voice, bus.context, when, hit.level, bus.node)
}

/** A bar of Subdivide's as its hits, step by step: the accent full, the rest at 0.7. */
export const drumsOf = (pattern: MetrePattern): DrumHit[] =>
  pattern.steps.map((s) => ({
    voice: s.voice,
    level: s.accent === true ? 1 : DRUM_LEVEL,
  }))

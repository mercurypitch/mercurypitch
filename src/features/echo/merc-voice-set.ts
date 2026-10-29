// ============================================================
// Merc's voice set: ten sung "ooh" notes and which one sings a note
// ============================================================
//
// The set is the 13 Oct sampler set (agent-out, merc-exercise-voice/
// sampler/): ten sustained "ooh" notes, F2 to F5, a major third apart, each
// carrying the demo's vibrato (5.5 Hz, +-14 cents, grown in over 0.35 s
// from its attack). They are development placeholders, ElevenLabs takes
// re-pitched onto exact contours; the store build waits for real
// recordings, and Echo is not in the store build yet.
//
// Every import is relative, so a build without the premium exercises folds
// each file to an empty string (apps/mercurypitch/vite.config.ts,
// PREMIUM_VOICES) and the store build carries none of them
// (assert-bundle.mjs holds it to that).
//
// A major third between samples puts every note within 2 semitones of one,
// the most a note is shifted. A note 2 semitones from two samples takes the
// one above, played slower. So the set reaches D#2 to G5 (MIDI 39-79), and
// a call with a note outside that is not the set's to sing (merc-sampler.ts
// hands it to the synth).

import f2 from './voice/echo-merc-ooh-41-F2.mp3'
import a2 from './voice/echo-merc-ooh-45-A2.mp3'
import cs3 from './voice/echo-merc-ooh-49-Cs3.mp3'
import f3 from './voice/echo-merc-ooh-53-F3.mp3'
import a3 from './voice/echo-merc-ooh-57-A3.mp3'
import cs4 from './voice/echo-merc-ooh-61-Cs4.mp3'
import f4 from './voice/echo-merc-ooh-65-F4.mp3'
import a4 from './voice/echo-merc-ooh-69-A4.mp3'
import cs5 from './voice/echo-merc-ooh-73-Cs5.mp3'
import f5 from './voice/echo-merc-ooh-77-F5.mp3'

/** One note of the set: its pitch, where its file is served, its level. */
export interface VoiceSample {
  readonly midi: number
  /** Empty in a build without the premium exercises. */
  readonly url: string
  /**
   * Its gain over SAMPLED_GAIN (merc-sampler.ts), dB. The samples are all
   * -18 LUFS; the synth grows louder with pitch, 3 dB from D#2 to G5, and
   * a call sounds as loud in Merc's voice as in the synth's at every pitch.
   * Measured 14 Oct: one 0.9 s note through each voice, integrated LUFS in
   * Chromium's render, averaged over the notes each sample sings.
   */
  readonly levelDb: number
}

/** The set, low to high. */
export const MERC_SAMPLES: readonly VoiceSample[] = [
  { midi: 41, url: f2, levelDb: 0.4 },
  { midi: 45, url: a2, levelDb: 0.8 },
  { midi: 49, url: cs3, levelDb: 1.0 },
  { midi: 53, url: f3, levelDb: 1.2 },
  { midi: 57, url: a3, levelDb: 1.4 },
  { midi: 61, url: cs4, levelDb: 1.6 },
  { midi: 65, url: f4, levelDb: 1.9 },
  { midi: 69, url: a4, levelDb: 2.1 },
  { midi: 73, url: cs5, levelDb: 2.5 },
  { midi: 77, url: f5, levelDb: 3.2 },
]

/** Semitones between neighbouring samples. */
const SPACING = 4
/** The most a note is shifted from its sample, semitones. */
export const MAX_SHIFT = 2
/** The lowest and highest notes the set sings: D#2 and G5. */
export const LOWEST_MIDI = MERC_SAMPLES[0].midi - MAX_SHIFT
export const HIGHEST_MIDI =
  MERC_SAMPLES[MERC_SAMPLES.length - 1].midi + MAX_SHIFT

// Every sample has the same timing (the set's manifest), measured on the
// decoded file, seconds from its start.
/** Where the attack starts: playback starts here. */
export const SAMPLE_ONSET = 0.02
/** Where the attack has reached the held note: this lands on the beat. */
export const SAMPLE_SUSTAIN_START = 0.06
/** Where the held note ends and the sample's own release begins. */
export const SAMPLE_SUSTAIN_END = 1.36

/** Which sample sings `midi`, at what playback rate; null outside the set. */
export function sampleFor(
  midi: number,
): { readonly sample: VoiceSample; readonly rate: number } | null {
  // A note between two of A440's past either end would be shifted further
  // than MAX_SHIFT: out of reach, as the semitone beyond it is.
  if (midi < LOWEST_MIDI || midi > HIGHEST_MIDI) return null
  const rounded = Math.round(midi)
  const first = MERC_SAMPLES[0].midi
  // Math.round sends a tie (k + 0.5) up: the sample above, played slower.
  const index = Math.min(
    MERC_SAMPLES.length - 1,
    Math.max(0, Math.round((rounded - first) / SPACING)),
  )
  const sample = MERC_SAMPLES[index]
  // A note between two of A440's (a song tuned off it) is sung where it is.
  return { sample, rate: 2 ** ((midi - sample.midi) / 12) }
}

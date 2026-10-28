// ============================================================
// Low-note reinforcement: the bottom octave on a small speaker
// ============================================================
//
// The bottom octave needs help, and level alone cannot give it.
//
// A bare sine at D2 (73 Hz) puts all of its energy an octave below what a
// laptop or phone speaker can move, so it reads as "barely there" however
// far the gain is pushed, and the ear itself wants roughly 15 dB more at
// 75 Hz than at 440 Hz for the same loudness, which is far more headroom
// than the bus has. A bare sine's low note needs a partial above it: the
// octave sits nearer the reproducible band, and the ear still hears the
// pitch of the fundamental (the missing-fundamental effect), so the note
// reads louder without reading higher.
//
// Two knobs fade in together across the same span, and both are exactly 1
// and 0 at C3 upward: nothing above the bottom two octaves changes. The
// classic exercises' engine (audio-engine.ts) uses both on its sine voice;
// the premium rooms' notes (reference-tone.ts, demo-voice.ts) take the
// octave. The piano fallback synth pairs a triangle with an octave sine,
// and the mirror's tone player runs a partial series, for the same reason.
//
// The rooms' notes are not bare sines: the piano tone and the demo voice
// already carry the harmonics a phone speaker plays. Measured on 16 Oct
// (EBU R128, Chromium's offline render), their octave adds +0.6 LU at A2
// and +2.4 LU at A1 in full range, and 0.2 dB at most through a small-
// speaker model (a fourth-order high-pass at 400 Hz, which puts A2 about
// 14 dB under A4): an octave above A2 is 220 Hz, still under that speaker.

/** C3: at and above it, nothing is added. */
export const LOW_NOTE_FADE_FROM_HZ = 130.81
/** B1: at and below it, the help is full. */
export const LOW_NOTE_FADE_FULL_HZ = 61.74
/** The envelope peak's lift at full help. */
const LOW_NOTE_PEAK_BOOST = 1.3
/** The octave-up partial's level at full help, relative to the fundamental. */
const LOW_NOTE_OCTAVE_LEVEL = 0.5

/** 0 at C3 and above, 1 at B1 and below, linear in between. */
export function lowNoteFade(frequency: number | undefined): number {
  if (frequency === undefined || !(frequency > 0)) return 0
  if (frequency >= LOW_NOTE_FADE_FROM_HZ) return 0
  if (frequency <= LOW_NOTE_FADE_FULL_HZ) return 1
  return (
    (LOW_NOTE_FADE_FROM_HZ - frequency) /
    (LOW_NOTE_FADE_FROM_HZ - LOW_NOTE_FADE_FULL_HZ)
  )
}

/** Envelope-peak multiplier for a low note (1 for everything else). */
export function lowNotePeakBoost(frequency: number | undefined): number {
  return 1 + lowNoteFade(frequency) * (LOW_NOTE_PEAK_BOOST - 1)
}

/** Level of the octave-up partial, relative to the fundamental. */
export function lowNoteOctaveLevel(frequency: number | undefined): number {
  return lowNoteFade(frequency) * LOW_NOTE_OCTAVE_LEVEL
}

/** Points per period where the waveform's peak is read. */
const WAVE_SAMPLES = 4096

/**
 * The fundamental's amplitude in a PeriodicWave made of these sine
 * partials (index 1 is the fundamental), once Web Audio has normalized the
 * wave to a peak of 1: an octave partial beside such a wave is set
 * relative to this, as the engine's is to its bare sine.
 */
export function normalizedFundamental(partials: readonly number[]): number {
  let peak = 0
  for (let i = 0; i < WAVE_SAMPLES; i++) {
    const x = (2 * Math.PI * i) / WAVE_SAMPLES
    let value = 0
    partials.forEach((amount, k) => {
      value += amount * Math.sin(k * x)
    })
    peak = Math.max(peak, Math.abs(value))
  }
  const fundamental = partials[1] ?? 0
  return peak > 0 ? fundamental / peak : 0
}

// ============================================================
// Drone voice — a held note with the harmonics a sung interval beats against
// ============================================================
//
// Drone Intonation's drone (src/features/exercises/drone-intonation). A sung
// fifth meets the drone at the drone's third harmonic and a major third at
// its fifth, so those harmonics must be in the drone for an interval a few
// cents off to beat against it. The app's instrument cannot be trusted with
// that: its default sine has no harmonic but the first, and its piano dies
// away under a held note. So the drone is a voice of its own, whatever the
// instrument: one oscillator on a wave of eight harmonics, held level.
//
// The harmonics are Merc's "ooh" (demo-voice.ts, and the lesson kit's
// MERC_PARTIALS in src/features/lessons/kit/sound.ts), the timbre Lesson 24
// sets every note against a drone in (its FACTS 72): the third harmonic at
// 0.38 of the first and the fifth at 0.14, where a sine has neither. These
// are plain functions; the engine builds the oscillator from what they give.

/** Each harmonic's level against the first, the first to the eighth. */
export const DRONE_PARTIALS: readonly number[] = [
  1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025,
]

/** The highest harmonic the drone carries. */
export const DRONE_HARMONICS = DRONE_PARTIALS.length

/**
 * The wave's Fourier terms as `createPeriodicWave` takes them: sine terms
 * only, index 0 the constant term and index n the nth harmonic.
 */
export function droneWaveTerms(): { real: Float32Array; imag: Float32Array } {
  const imag = new Float32Array(DRONE_PARTIALS.length + 1)
  DRONE_PARTIALS.forEach((level, i) => {
    imag[i + 1] = level
  })
  return { real: new Float32Array(imag.length), imag }
}

/** Points per period where the wave is read. */
const WAVE_SAMPLES = 4096

/**
 * The wave's RMS once Web Audio has normalised it to a peak of 1, as it
 * does every periodic wave by default. A sine's is 1/sqrt(2).
 */
export function droneWaveRms(): number {
  let peak = 0
  let power = 0
  for (let i = 0; i < WAVE_SAMPLES; i++) {
    const x = (2 * Math.PI * i) / WAVE_SAMPLES
    let value = 0
    DRONE_PARTIALS.forEach((level, k) => {
      value += level * Math.sin((k + 1) * x)
    })
    peak = Math.max(peak, Math.abs(value))
    power += value * value
  }
  return peak > 0 ? Math.sqrt(power / WAVE_SAMPLES) / peak : 0
}

/**
 * The envelope peak that gives the drone the loudness, by RMS, of the
 * engine's sine at `sinePeak`: the level the drone sounded at before it
 * had harmonics, on the default instrument.
 */
export function droneLevel(sinePeak: number): number {
  return (sinePeak * Math.SQRT1_2) / droneWaveRms()
}

// ============================================================
// Pitch testing rate — the one sample rate the Lab analyses at
// ============================================================
//
// The Lab's detectors are built once with their default rate, 44100 Hz, and
// turn a period measured in samples into hertz at that rate. A browser decodes
// a file at its AudioContext's rate instead, 48000 Hz on most machines. So
// every waveform the Lab analyses is brought to 44100 Hz first, and every
// analysis window is timed at 44100 Hz.
//
// Before this, an uploaded file was brought down to 44100 but timed at the
// context's 48000, which stamped each note 8% early; and a separated vocal
// stem was neither brought down nor timed apart, which put each of its notes
// 147 cents flat.

/** The rate the Lab's detectors were built for, and the rate it times windows at. */
export const LAB_ANALYSIS_RATE = 44100

/**
 * `samples`, decoded at `sampleRate`, as the Lab's detectors expect them.
 *
 * Nearest sample, as the upload path always did: an analysis reads a period,
 * and picking samples keeps the period while costing nothing to compute.
 */
export function toLabAnalysisRate(
  samples: Float32Array,
  sampleRate: number,
): Float32Array {
  if (sampleRate === LAB_ANALYSIS_RATE) return samples
  const ratio = LAB_ANALYSIS_RATE / sampleRate
  const out = new Float32Array(Math.floor(samples.length * ratio))
  for (let i = 0; i < out.length; i++) {
    // Map the output index to the source by dividing by the ratio, not
    // multiplying, or only the first `ratio` of the source is ever read.
    out[i] = samples[Math.floor(i / ratio)]
  }
  return out
}

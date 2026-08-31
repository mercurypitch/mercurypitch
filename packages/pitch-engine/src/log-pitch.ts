// ============================================================
// Log-frequency (fractional MIDI) conversions for the pitch pipeline.
//
// scale-data's freqToMidi rounds to the nearest integer; the pipeline needs
// the un-rounded value so smoothing and octave correction work in a uniform
// log domain before the final quantize.
// ============================================================

const A4_MIDI = 69
const A4_FREQ = 440

/** Frequency (Hz) -> fractional MIDI note number (no rounding). */
export function freqToMidiFloat(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI
}

/** Fractional MIDI note number -> frequency (Hz). */
export function midiFloatToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12)
}

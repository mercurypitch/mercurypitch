// Shared worker-only antialiasing kernel for captured and rolling guitar PCM.
import { BASIC_PITCH } from './basic-pitch-inference'

export const RESAMPLING_PHASES = 256

/** Blackman-windowed sinc phases remove above-Nyquist energy before downsampling. */
export function basicPitchResamplingKernel(sourceRate: number) {
  if (!Number.isFinite(sourceRate) || sourceRate < 8000 || sourceRate > 192000)
    throw new Error('Chord analysis supports 8–192 kHz audio.')
  const cutoff = 0.94 * Math.min(1, BASIC_PITCH.sampleRate / sourceRate)
  const radius = Math.ceil(24 / cutoff)
  const width = radius * 2 + 1
  const phases = new Float32Array(RESAMPLING_PHASES * width)
  for (let phase = 0; phase < RESAMPLING_PHASES; phase++) {
    let sum = 0
    for (let tap = 0; tap < width; tap++) {
      const distance = tap - radius - phase / RESAMPLING_PHASES
      const position = distance / radius
      const angle = Math.PI * distance * cutoff
      const sinc = angle === 0 ? cutoff : (Math.sin(angle) / angle) * cutoff
      const window =
        Math.abs(position) > 1
          ? 0
          : 0.42 +
            0.5 * Math.cos(Math.PI * position) +
            0.08 * Math.cos(2 * Math.PI * position)
      const weight = sinc * window
      phases[phase * width + tap] = weight
      sum += weight
    }
    for (let tap = 0; tap < width; tap++) phases[phase * width + tap] /= sum
  }
  return { radius, width, phases }
}

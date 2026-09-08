// Bounded WAV-to-model PCM decoding stays in the refinement worker, never the live audio graph.
import { parseWavBlobFormat, readWavBlobWindow } from '../wav-blob-window'
import { BASIC_PITCH } from './basic-pitch-inference'

export const GUITAR_REFINEMENT_MAX_BYTES = 256 * 1024 * 1024
const PHASES = 256

/** Blackman-windowed sinc phases remove above-Nyquist energy before downsampling. */
function resamplingKernel(sourceRate: number) {
  const cutoff = 0.94 * Math.min(1, BASIC_PITCH.sampleRate / sourceRate)
  const radius = Math.ceil(24 / cutoff)
  const width = radius * 2 + 1
  const phases = new Float32Array(PHASES * width)
  for (let phase = 0; phase < PHASES; phase++) {
    let sum = 0
    for (let tap = 0; tap < width; tap++) {
      const distance = tap - radius - phase / PHASES
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

/**
 * Read at most one second plus FIR overlap at a time. The only full-size
 * allocation is <=25.3 MiB of 22.05kHz mono PCM; source payload is never
 * materialized wholesale. Supports the recorder's PCM WAV, not lossy uploads.
 */
export async function decodeGuitarRefinementAudio(
  blob: Blob,
  onProgress: (fraction: number) => void = () => {},
): Promise<{ samples: Float32Array; duration: number }> {
  if (blob.size > GUITAR_REFINEMENT_MAX_BYTES)
    throw new Error('Recording audio exceeds the 256 MiB refinement limit.')
  const format = await parseWavBlobFormat(blob)
  if (format === null)
    throw new Error('Chord refinement needs recorded PCM WAV audio.')
  if (
    format.channelCount > 2 ||
    format.sampleRate < 8000 ||
    format.sampleRate > 192000
  )
    throw new Error(
      'Chord refinement supports mono or stereo WAV at 8–192 kHz.',
    )
  if (format.durationSeconds > 300)
    throw new Error('Chord refinement is limited to five minutes.')
  const length = Math.floor(format.durationSeconds * BASIC_PITCH.sampleRate)
  if (length < 1) throw new Error('Recording audio is empty.')
  const samples = new Float32Array(length)
  const { radius, width, phases } = resamplingKernel(format.sampleRate)
  const ratio = format.sampleRate / BASIC_PITCH.sampleRate
  onProgress(0)
  for (
    let outputStart = 0;
    outputStart < length;
    outputStart += BASIC_PITCH.sampleRate
  ) {
    const outputEnd = Math.min(length, outputStart + BASIC_PITCH.sampleRate)
    const sourceStart = Math.max(0, Math.floor(outputStart * ratio) - radius)
    const sourceEnd = Math.min(
      format.frameCount,
      Math.floor((outputEnd - 1) * ratio) + radius + 1,
    )
    const channels = await readWavBlobWindow(
      blob,
      format,
      sourceStart,
      sourceEnd - sourceStart,
    )
    const mono = channels[0]
    for (let i = 0; i < mono.length; i++) {
      let sum = 0
      for (const channel of channels) {
        const sample = channel[i]
        if (!Number.isFinite(sample))
          throw new Error('Recording audio contains non-finite samples.')
        sum += sample
      }
      mono[i] = sum / channels.length
    }
    for (let i = outputStart; i < outputEnd; i++) {
      const sourcePosition = i * ratio
      const sourceFrame = Math.floor(sourcePosition)
      // Equal-rate recordings need no filtering and retain exact sample values.
      if (format.sampleRate === BASIC_PITCH.sampleRate) {
        samples[i] = mono[sourceFrame - sourceStart]
        continue
      }
      const phase = Math.min(
        PHASES - 1,
        Math.floor((sourcePosition - sourceFrame) * PHASES),
      )
      const offset = sourceFrame - radius - sourceStart
      let sum = 0
      for (
        let tap = Math.max(0, -offset);
        tap < Math.min(width, mono.length - offset);
        tap++
      )
        sum += mono[offset + tap] * phases[phase * width + tap]
      samples[i] = sum
    }
    onProgress(outputEnd / length)
  }
  return { samples, duration: format.durationSeconds }
}

// Speech envelope — compact, clock-addressable mouth energy from decoded narration.

export interface SpeechEnvelope {
  readonly frames: Float32Array
  readonly durationSeconds: number
  readonly frameSeconds: number
}

/** Sample the existing decoded clip once; playback needs no extra audio graph. */
export function createSpeechEnvelope(buffer: AudioBuffer): SpeechEnvelope {
  const frameSize = Math.max(1, Math.round(buffer.sampleRate * 0.02))
  const frames = new Float32Array(Math.ceil(buffer.length / frameSize))
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel)
    for (let frame = 0; frame < frames.length; frame++) {
      const start = frame * frameSize
      const end = Math.min(samples.length, start + frameSize)
      let energy = 0
      for (let i = start; i < end; i++) {
        const sample = Number.isFinite(samples[i]) ? samples[i] : 0
        energy += sample * sample
      }
      const rms = Math.sqrt(energy / Math.max(1, end - start))
      frames[frame] = Math.max(
        frames[frame],
        Math.min(1, Math.max(0, (rms - 0.012) / 0.18)),
      )
    }
  }
  return {
    frames,
    frameSeconds: frameSize / buffer.sampleRate,
    durationSeconds: buffer.length / buffer.sampleRate,
  }
}

export function speechEnvelopeAt(
  envelope: SpeechEnvelope,
  seconds: number,
): number {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    seconds >= envelope.durationSeconds
  )
    return 0
  const position = seconds / envelope.frameSeconds
  const index = Math.floor(position)
  const first = envelope.frames[index] ?? 0
  const next = envelope.frames[index + 1] ?? 0
  return first + (next - first) * (position - index)
}

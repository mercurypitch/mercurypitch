// ============================================================
// AudioBuffer WAV — one correct mono PCM encoder for browser audio
// ============================================================
//
// Voice exports and guided-example clips both need a universally playable
// copy. Keeping the RIFF math here prevents their headers and channel mixing
// from drifting apart.

const WAV_HEADER_BYTES = 44
const PCM_BYTES_PER_SAMPLE = 2

export interface AudioBufferWavRange {
  startFrame?: number
  endFrame?: number
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function createMonoPcmWavBuffer(
  frameCount: number,
  sampleRate: number,
): {
  bytes: ArrayBuffer
  view: DataView
} {
  const pcmBytes = frameCount * PCM_BYTES_PER_SAMPLE
  const bytes = new ArrayBuffer(WAV_HEADER_BYTES + pcmBytes)
  const view = new DataView(bytes)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcmBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * PCM_BYTES_PER_SAMPLE, true)
  view.setUint16(32, PCM_BYTES_PER_SAMPLE, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcmBytes, true)
  return { bytes, view }
}

function writePcmSample(view: DataView, offset: number, sample: number): void {
  const clamped = Math.max(-1, Math.min(1, Number(sample) || 0))
  view.setInt16(
    offset,
    clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff),
    true,
  )
}

/** Encode an already-mono sample array as signed 16-bit PCM RIFF/WAVE. */
export function encodeMonoPcmSamplesToWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('The PCM sample rate must be positive.')
  }
  const { bytes, view } = createMonoPcmWavBuffer(
    samples.length,
    Math.round(sampleRate),
  )
  let outputOffset = WAV_HEADER_BYTES
  for (let frame = 0; frame < samples.length; frame += 1) {
    writePcmSample(view, outputOffset, samples[frame] ?? 0)
    outputOffset += PCM_BYTES_PER_SAMPLE
  }
  return bytes
}

/** Encode all channels, mixed to mono, as signed 16-bit PCM in a RIFF/WAVE. */
export function encodeAudioBufferToMonoPcmWav(
  buffer: AudioBuffer,
  range: AudioBufferWavRange = {},
): ArrayBuffer {
  if (buffer.numberOfChannels < 1 || buffer.sampleRate <= 0) {
    throw new Error('The decoded audio has no playable channel.')
  }

  const startFrame = Math.min(
    buffer.length,
    Math.max(0, Math.floor(range.startFrame ?? 0)),
  )
  const endFrame = Math.min(
    buffer.length,
    Math.max(startFrame, Math.ceil(range.endFrame ?? buffer.length)),
  )
  const frameCount = endFrame - startFrame
  const { bytes, view } = createMonoPcmWavBuffer(frameCount, buffer.sampleRate)

  const channels = Array.from(
    { length: buffer.numberOfChannels },
    (_, channel) => buffer.getChannelData(channel),
  )
  let outputOffset = WAV_HEADER_BYTES
  for (let frame = startFrame; frame < endFrame; frame += 1) {
    let sample = 0
    for (const channel of channels) sample += channel[frame] ?? 0
    writePcmSample(view, outputOffset, sample / channels.length)
    outputOffset += PCM_BYTES_PER_SAMPLE
  }

  return bytes
}

// Studio WAV encoding — reuse the 16-bit quantizer in bounded, cancellable chunks.
import { encodeAudioBufferToPcmWav } from '@/lib/audio-buffer-wav'

const CHUNK = 16384
export const STUDIO_WAV_ENCODER_WORKING_BYTES = CHUNK * 2 * 4 + CHUNK * 4 + 44

function scaledChunk(
  buffer: AudioBuffer,
  from: number,
  to: number,
  gain: number,
): AudioBuffer {
  const channels = [new Float32Array(to - from), new Float32Array(to - from)]
  for (let channel = 0; channel < 2; channel++) {
    const source = buffer.getChannelData(channel)
    for (let frame = from; frame < Math.min(to, buffer.length); frame++) {
      const value = source[frame] * gain
      if (!Number.isFinite(value) || Math.abs(value) > 1)
        throw new Error(
          'The rendered audio clips or contains invalid samples. Lower its level and try again.',
        )
      channels[channel][frame - from] = value
    }
  }
  return {
    numberOfChannels: 2,
    sampleRate: 48000,
    length: to - from,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer
}

export async function encodeStudioWav(
  buffer: AudioBuffer,
  signal: AbortSignal,
  options: { gainDb?: number; frames?: number } = {},
): Promise<ArrayBuffer> {
  const frames = options.frames ?? buffer.length
  const gainDb = options.gainDb ?? 0
  if (
    buffer.numberOfChannels !== 2 ||
    buffer.sampleRate !== 48000 ||
    buffer.length <= 0 ||
    !Number.isSafeInteger(frames) ||
    frames < buffer.length ||
    frames * 4 + 44 > 0xffffffff ||
    !Number.isFinite(gainDb) ||
    gainDb > 0 ||
    gainDb < -120
  )
    throw new Error('This audio cannot be encoded as a Studio WAV.')
  signal.throwIfAborted()
  const gain = Math.pow(10, gainDb / 20)
  const output = new ArrayBuffer(44 + frames * 4)
  const bytes = new Uint8Array(output)
  for (let from = 0; from < frames; from += CHUNK) {
    signal.throwIfAborted()
    const chunk = new Uint8Array(
      encodeAudioBufferToPcmWav(
        scaledChunk(buffer, from, Math.min(frames, from + CHUNK), gain),
      ),
    )
    if (from === 0) bytes.set(chunk.subarray(0, 44))
    bytes.set(chunk.subarray(44), 44 + from * 4)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  signal.throwIfAborted()
  const header = new DataView(output)
  header.setUint32(4, output.byteLength - 8, true)
  header.setUint32(40, output.byteLength - 44, true)
  return output
}
